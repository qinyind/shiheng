import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.mjs";
import { hashToken } from "../src/security.mjs";

class MemoryRepository {
  devices = new Map();
  state = { version: 0, state: {}, updatedAt: new Date().toISOString() };
  analyses = new Map();
  usage = new Map();
  async createDevice({ id, userID, token, deviceName }) { this.devices.set(hashToken(token), { userID, deviceName, deviceID: id }); }
  async authenticate(token) { return this.devices.get(hashToken(token)) || null; }
  async getState() { return this.state; }
  async putState(_userID, baseVersion, state) {
    if (baseVersion !== this.state.version) return { ok: false, value: this.state };
    this.state = { version: baseVersion + 1, state, updatedAt: new Date().toISOString() };
    return { ok: true, value: this.state };
  }
  async getAnalysis(_userID, key) { return this.analyses.get(key) || null; }
  async saveAnalysis(_userID, key, value) { this.analyses.set(key, value); }
  async consumeAIQuota(deviceID, dailyLimit) {
    const count = this.usage.get(deviceID) || 0;
    if (count >= dailyLimit) return { allowed: false, remaining: 0 };
    this.usage.set(deviceID, count + 1);
    return { allowed: true, remaining: dailyLimit - count - 1 };
  }
}

const config = {
  pairingCode: "correct-horse",
  aiBaseURL: "http://cpa.internal:8317/v1/",
  aiKey: "test-key",
  aiModel: "gpt-5.6-luna",
  aiDailyLimit: 100,
  aiMaxConcurrent: 2,
};

test("配对、鉴权与版本同步", async () => {
  const app = await buildApp({ config, repository: new MemoryRepository(), logger: false });
  const denied = await app.inject({ method: "POST", url: "/v1/auth/pair", payload: { pairingCode: "wrong" } });
  assert.equal(denied.statusCode, 401);
  const paired = await app.inject({ method: "POST", url: "/v1/auth/pair", payload: { pairingCode: "correct-horse", deviceName: "测试 iPhone" } });
  assert.equal(paired.statusCode, 201);
  const token = paired.json().token;
  const saved = await app.inject({ method: "PUT", url: "/v1/sync", headers: { authorization: `Bearer ${token}` }, payload: { baseVersion: 0, state: { profile: { weight: 73 } } } });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().version, 1);
  const conflict = await app.inject({ method: "PUT", url: "/v1/sync", headers: { authorization: `Bearer ${token}` }, payload: { baseVersion: 0, state: { old: true } } });
  assert.equal(conflict.statusCode, 409);
  await app.close();
});

test("AI 识餐使用结构化结果并缓存", async () => {
  const repository = new MemoryRepository();
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls += 1;
    assert.equal(url, "http://cpa.internal:8317/v1/responses");
    const request = JSON.parse(options.body);
    assert.equal(request.model, "gpt-5.6-luna");
    assert.deepEqual(request.reasoning, { effort: "none" });
    assert.equal(request.text.format.type, "json_schema");
    return new Response(JSON.stringify({ output_text: JSON.stringify({ name: "米饭", grams: 150, carbs: 45, protein: 3.9, fat: 0.5, kcal: 200, confidence: "high", note: "按熟米饭估算" }) }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const app = await buildApp({ config, repository, fetchImpl, logger: false });
  const paired = await app.inject({ method: "POST", url: "/v1/auth/pair", payload: { pairingCode: "correct-horse" } });
  const headers = { authorization: `Bearer ${paired.json().token}` };
  const first = await app.inject({ method: "POST", url: "/v1/ai/analyze-food", headers, payload: { description: "150克熟米饭" } });
  const second = await app.inject({ method: "POST", url: "/v1/ai/analyze-food", headers, payload: { description: "150克熟米饭" } });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().quota.remaining, 99);
  assert.equal(second.json().cached, true);
  assert.equal(calls, 1);
  await app.close();
});

test("配对请求体有独立大小上限", async () => {
  const app = await buildApp({ config, repository: new MemoryRepository(), logger: false });
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/pair",
    payload: { pairingCode: "correct-horse", deviceName: "x".repeat(20_000) },
  });
  assert.equal(response.statusCode, 413);
  await app.close();
});

test("AI 每设备每日配额独立于 IP 限流", async () => {
  const limitedConfig = { ...config, aiDailyLimit: 1 };
  const estimate = { name: "米饭", grams: 100, carbs: 25, protein: 2.6, fat: 0.3, kcal: 116, confidence: "high", note: "测试" };
  const app = await buildApp({
    config: limitedConfig,
    repository: new MemoryRepository(),
    logger: false,
    fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify(estimate) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const paired = await app.inject({ method: "POST", url: "/v1/auth/pair", payload: { pairingCode: "correct-horse" } });
  const headers = { authorization: `Bearer ${paired.json().token}` };
  const first = await app.inject({ method: "POST", url: "/v1/ai/analyze-food", headers, payload: { description: "100克米饭" } });
  const exhausted = await app.inject({ method: "POST", url: "/v1/ai/analyze-food", headers, payload: { description: "另一碗米饭" } });
  assert.equal(first.statusCode, 200);
  assert.equal(exhausted.statusCode, 429);
  assert.equal(exhausted.json().error, "今日 AI 识餐次数已用完");
  await app.close();
});

test("AI 并发超过上限时快速拒绝", async () => {
  let releaseRequest;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const blocked = new Promise((resolve) => { releaseRequest = resolve; });
  const estimate = { name: "苹果", grams: 150, carbs: 21, protein: 0.4, fat: 0.3, kcal: 78, confidence: "high", note: "测试" };
  const app = await buildApp({
    config: { ...config, aiMaxConcurrent: 1 },
    repository: new MemoryRepository(),
    logger: false,
    fetchImpl: async () => {
      markStarted();
      await blocked;
      return new Response(JSON.stringify({ output_text: JSON.stringify(estimate) }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const paired = await app.inject({ method: "POST", url: "/v1/auth/pair", payload: { pairingCode: "correct-horse" } });
  const headers = { authorization: `Bearer ${paired.json().token}` };
  const firstRequest = app.inject({ method: "POST", url: "/v1/ai/analyze-food", headers, payload: { description: "苹果一" } });
  await started;
  const busy = await app.inject({ method: "POST", url: "/v1/ai/analyze-food", headers, payload: { description: "苹果二" } });
  assert.equal(busy.statusCode, 503);
  assert.equal(busy.json().error, "AI 服务繁忙，请稍后重试");
  releaseRequest();
  assert.equal((await firstRequest).statusCode, 200);
  await app.close();
});

test("配对接口限制暴力尝试", async () => {
  const app = await buildApp({ config, repository: new MemoryRepository(), logger: false });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await app.inject({ method: "POST", url: "/v1/auth/pair", payload: { pairingCode: "wrong" } });
    assert.equal(response.statusCode, 401);
  }
  const limited = await app.inject({ method: "POST", url: "/v1/auth/pair", payload: { pairingCode: "wrong" } });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error, "请求过于频繁");
  await app.close();
});

test("AI 上游错误不会泄露给客户端", async () => {
  const app = await buildApp({
    config,
    repository: new MemoryRepository(),
    logger: false,
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "secret upstream detail" } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    }),
  });
  const paired = await app.inject({ method: "POST", url: "/v1/auth/pair", payload: { pairingCode: "correct-horse" } });
  const response = await app.inject({
    method: "POST",
    url: "/v1/ai/analyze-food",
    headers: { authorization: `Bearer ${paired.json().token}` },
    payload: { description: "一碗饭" },
  });
  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.json(), { error: "AI 服务暂时不可用，请稍后重试" });
  await app.close();
});
