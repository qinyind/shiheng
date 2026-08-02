import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.mjs";
import { hashToken } from "../src/security.mjs";

class MemoryRepository {
  devices = new Map();
  state = { version: 0, state: {}, updatedAt: new Date().toISOString() };
  analyses = new Map();
  async createDevice({ userID, token, deviceName }) { this.devices.set(hashToken(token), { userID, deviceName }); }
  async authenticate(token) { return this.devices.get(hashToken(token)) || null; }
  async getState() { return this.state; }
  async putState(_userID, baseVersion, state) {
    if (baseVersion !== this.state.version) return { ok: false, value: this.state };
    this.state = { version: baseVersion + 1, state, updatedAt: new Date().toISOString() };
    return { ok: true, value: this.state };
  }
  async getAnalysis(_userID, key) { return this.analyses.get(key) || null; }
  async saveAnalysis(_userID, key, value) { this.analyses.set(key, value); }
}

const config = {
  pairingCode: "correct-horse",
  aiBaseURL: "http://cpa.internal:8317/v1/",
  aiKey: "test-key",
  aiModel: "gpt-5.6-luna",
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
  assert.equal(second.json().cached, true);
  assert.equal(calls, 1);
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
