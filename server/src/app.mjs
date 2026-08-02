import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { createDeviceToken, safeEqual } from "./security.mjs";
import { personalUserID } from "./repository.mjs";
import { analysisHash, analyzeFood } from "./nutrition.mjs";

const maxStateBytes = 2_000_000;
const maxImageLength = 12_000_000;

function bearerToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export function buildApp({ config, repository, fetchImpl = fetch, logger = true }) {
  const app = Fastify({ logger, bodyLimit: 13_000_000 });

  app.get("/health", async () => ({ ok: true, service: "meal-meter", version: "0.1.0" }));

  app.post("/v1/auth/pair", async (request, reply) => {
    const { pairingCode = "", deviceName = "iPhone" } = request.body || {};
    if (!safeEqual(pairingCode, config.pairingCode)) return reply.code(401).send({ error: "配对码错误" });
    const cleanName = String(deviceName).trim().slice(0, 80) || "iPhone";
    const token = createDeviceToken();
    await repository.createDevice({ id: randomUUID(), userID: personalUserID, deviceName: cleanName, token });
    return reply.code(201).send({ token, user: { id: personalUserID, name: "个人用户" } });
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/v1/") || request.url === "/v1/auth/pair") return;
    const token = bearerToken(request);
    const identity = token ? await repository.authenticate(token) : null;
    if (!identity) return reply.code(401).send({ error: "设备令牌无效或已撤销" });
    request.identity = identity;
  });

  app.get("/v1/sync", async (request) => repository.getState(request.identity.userID));

  app.put("/v1/sync", async (request, reply) => {
    const { baseVersion, state } = request.body || {};
    if (!Number.isInteger(baseVersion) || baseVersion < 0 || !state || typeof state !== "object" || Array.isArray(state)) {
      return reply.code(400).send({ error: "同步数据格式无效" });
    }
    if (Buffer.byteLength(JSON.stringify(state), "utf8") > maxStateBytes) return reply.code(413).send({ error: "同步数据超过 2MB" });
    const result = await repository.putState(request.identity.userID, baseVersion, state);
    if (!result.ok) return reply.code(409).send({ error: "服务器已有更新", ...result.value });
    return result.value;
  });

  app.post("/v1/ai/analyze-food", async (request, reply) => {
    if (!config.openAIKey) return reply.code(503).send({ error: "服务器尚未配置 OPENAI_API_KEY" });
    const description = String(request.body?.description || "").trim();
    const imageDataURL = String(request.body?.imageDataURL || "");
    if (!description && !imageDataURL) return reply.code(400).send({ error: "请提供食物描述或照片" });
    if (description.length > 3000) return reply.code(400).send({ error: "文字描述不能超过 3000 字" });
    if (imageDataURL && (!/^data:image\/(jpeg|png|webp);base64,/.test(imageDataURL) || imageDataURL.length > maxImageLength)) {
      return reply.code(400).send({ error: "图片仅支持 JPEG、PNG、WebP，且不能超过约 8MB" });
    }
    const inputHash = analysisHash(description, imageDataURL);
    const cached = await repository.getAnalysis(request.identity.userID, inputHash);
    if (cached) return { estimate: cached, cached: true };
    try {
      const estimate = await analyzeFood({ description, imageDataURL, apiKey: config.openAIKey, model: config.openAIModel, fetchImpl });
      await repository.saveAnalysis(request.identity.userID, inputHash, estimate);
      return { estimate, cached: false };
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: error.message || "AI 识餐失败" });
    }
  });

  return app;
}
