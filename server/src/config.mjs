export function readConfig(env = process.env) {
  const config = {
    nodeEnv: env.NODE_ENV || "development",
    port: Number(env.PORT || 8080),
    databaseURL: env.DATABASE_URL || "postgres://meal_meter:meal_meter@127.0.0.1:5432/meal_meter",
    pairingCode: env.PAIRING_CODE || "",
    openAIKey: env.OPENAI_API_KEY || "",
    openAIModel: env.OPENAI_MODEL || "gpt-4.1-mini",
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("PORT 无效");
  if (config.nodeEnv === "production" && config.pairingCode.length < 12) {
    throw new Error("生产环境 PAIRING_CODE 至少需要 12 个字符");
  }
  return config;
}
