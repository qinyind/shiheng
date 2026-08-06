export function readConfig(env = process.env) {
  const config = {
    nodeEnv: env.NODE_ENV || "development",
    port: Number(env.PORT || 8080),
    databaseURL: env.DATABASE_URL || "postgres://meal_meter:meal_meter@127.0.0.1:5432/meal_meter",
    pairingCode: env.PAIRING_CODE || "",
    trustProxy: env.TRUST_PROXY || false,
    aiBaseURL: env.AI_BASE_URL || env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    aiKey: env.AI_API_KEY || env.OPENAI_API_KEY || "",
    aiModel: env.AI_MODEL || env.OPENAI_MODEL || "gpt-5.6-luna",
    aiDailyLimit: Number(env.AI_DAILY_LIMIT || 100),
    aiMaxConcurrent: Number(env.AI_MAX_CONCURRENT || 2),
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("PORT 无效");
  if (!Number.isInteger(config.aiDailyLimit) || config.aiDailyLimit < 1 || config.aiDailyLimit > 10_000) throw new Error("AI_DAILY_LIMIT 无效");
  if (!Number.isInteger(config.aiMaxConcurrent) || config.aiMaxConcurrent < 1 || config.aiMaxConcurrent > 20) throw new Error("AI_MAX_CONCURRENT 无效");
  const aiURL = new URL(config.aiBaseURL);
  if (!["http:", "https:"].includes(aiURL.protocol)) throw new Error("AI_BASE_URL 仅支持 HTTP 或 HTTPS");
  if (config.nodeEnv === "production" && config.pairingCode.length < 12) {
    throw new Error("生产环境 PAIRING_CODE 至少需要 12 个字符");
  }
  return config;
}
