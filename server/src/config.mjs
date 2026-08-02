export function readConfig(env = process.env) {
  const config = {
    nodeEnv: env.NODE_ENV || "development",
    port: Number(env.PORT || 8080),
    databaseURL: env.DATABASE_URL || "postgres://meal_meter:meal_meter@127.0.0.1:5432/meal_meter",
    pairingCode: env.PAIRING_CODE || "",
    aiBaseURL: env.AI_BASE_URL || env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    aiKey: env.AI_API_KEY || env.OPENAI_API_KEY || "",
    aiModel: env.AI_MODEL || env.OPENAI_MODEL || "gpt-5.4-mini",
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("PORT 无效");
  const aiURL = new URL(config.aiBaseURL);
  if (!["http:", "https:"].includes(aiURL.protocol)) throw new Error("AI_BASE_URL 仅支持 HTTP 或 HTTPS");
  if (config.nodeEnv === "production" && config.pairingCode.length < 12) {
    throw new Error("生产环境 PAIRING_CODE 至少需要 12 个字符");
  }
  return config;
}
