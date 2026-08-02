import { createHash } from "node:crypto";

export const nutritionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "grams", "carbs", "protein", "fat", "kcal", "confidence", "note"],
  properties: {
    name: { type: "string" },
    grams: { type: "number", minimum: 1 },
    carbs: { type: "number", minimum: 0 },
    protein: { type: "number", minimum: 0 },
    fat: { type: "number", minimum: 0 },
    kcal: { type: "number", minimum: 0 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string" },
  },
};

export function analysisHash(description, imageDataURL) {
  return createHash("sha256").update(description.trim()).update("\0").update(imageDataURL || "").digest("hex");
}

function responseText(response) {
  if (response.output_text) return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

function validateEstimate(value) {
  const numbers = ["grams", "carbs", "protein", "fat", "kcal"];
  if (!value || typeof value !== "object" || typeof value.name !== "string" || typeof value.note !== "string") return false;
  if (!["low", "medium", "high"].includes(value.confidence)) return false;
  return numbers.every((key) => Number.isFinite(value[key]) && value[key] >= (key === "grams" ? 1 : 0));
}

export async function analyzeFood({ description, imageDataURL, apiKey, model, fetchImpl = fetch }) {
  const content = [{
    type: "input_text",
    text: `你是食品营养估算助手。估算用户实际食用的整份食物，而不是每100克。优先采用明确重量、包装营养标签和生熟状态；混合餐需包含烹调油和酱料。无法确定时使用保守常见值，并在 note 中说明假设。结果用于日常记录，不作医疗建议。\n\n用户描述：${description || "未提供文字，请根据图片估算。"}`,
  }];
  if (imageDataURL) content.push({ type: "input_image", image_url: imageDataURL, detail: "low" });
  const upstream = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "nutrition_estimate", strict: true, schema: nutritionSchema } },
      max_output_tokens: 1000,
    }),
  });
  const body = await upstream.json();
  if (!upstream.ok) throw new Error(body.error?.message || "AI 服务暂时不可用");
  const text = responseText(body);
  if (!text) throw new Error("AI 未返回可用结果");
  const estimate = JSON.parse(text);
  if (!validateEstimate(estimate)) throw new Error("AI 返回的营养数据格式无效");
  return estimate;
}
