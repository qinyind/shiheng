import { createHash } from "node:crypto";

export const nutritionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "ingredients", "confidence", "note"],
  properties: {
    name: { type: "string" },
    ingredients: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "grams", "carbs", "protein", "fat", "kcal"],
        properties: {
          name: { type: "string", description: "基础食材名称，名称中注明生熟状态，例如熟米饭、熟鸡胸肉、烹调油。" },
          grams: { type: "number", minimum: 0.1 },
          carbs: { type: "number", minimum: 0 },
          protein: { type: "number", minimum: 0 },
          fat: { type: "number", minimum: 0 },
          kcal: { type: "number", minimum: 0 },
        },
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string" },
  },
};

export function analysisHash(description, imageDataURL) {
  return createHash("sha256").update("ingredients-v2\0").update(description.trim()).update("\0").update(imageDataURL || "").digest("hex");
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

function normalizeEstimate(value) {
  const numbers = ["grams", "carbs", "protein", "fat", "kcal"];
  if (!value || typeof value !== "object" || typeof value.name !== "string" || typeof value.note !== "string") return false;
  if (!["low", "medium", "high"].includes(value.confidence)) return false;
  if (!Array.isArray(value.ingredients) || value.ingredients.length < 1 || value.ingredients.length > 20) return false;
  const ingredients = value.ingredients.map((ingredient) => {
    if (!ingredient || typeof ingredient !== "object" || typeof ingredient.name !== "string" || !ingredient.name.trim()) return null;
    if (!numbers.every((key) => Number.isFinite(ingredient[key]) && ingredient[key] >= (key === "grams" ? 0.1 : 0))) return null;
    return { name: ingredient.name.trim().slice(0, 80), ...Object.fromEntries(numbers.map((key) => [key, ingredient[key]])) };
  });
  if (ingredients.some((ingredient) => !ingredient)) return false;
  const sum = (key) => ingredients.reduce((total, ingredient) => total + ingredient[key], 0);
  return {
    name: value.name.trim().slice(0, 100) || ingredients.map((item) => item.name).join(" + "),
    grams: sum("grams"),
    carbs: sum("carbs"),
    protein: sum("protein"),
    fat: sum("fat"),
    kcal: sum("kcal"),
    confidence: value.confidence,
    note: value.note.trim().slice(0, 500),
    ingredients,
  };
}

export async function analyzeFood({ description, imageDataURL, apiKey, model, baseURL = "https://api.openai.com/v1", fetchImpl = fetch }) {
  const content = [{
    type: "input_text",
    text: `你是食品营养估算助手。把用户实际食用的餐食拆成可独立记录的基础食材，而不是合并成一道菜。每种食材返回实际吃下的整份重量和对应营养，不是每100克。名称需注明生熟状态，例如“熟米饭”“熟鸡胸肉”“烹调油”；混合菜要把主料、配料、实际摄入的烹调油和有营养贡献的酱料分别列出。相同食材合并，忽略无热量香辛料，不要虚构看不出的细小配料。优先采用用户给出的重量、包装标签和生熟状态；无法确定时使用保守常见值，并在 note 中说明假设。总营养由程序按 ingredients 相加，不要另行返回总数。结果用于日常记录，不作医疗建议。\n\n用户描述：${description || "未提供文字，请根据图片估算。"}`,
  }];
  if (imageDataURL) content.push({ type: "input_image", image_url: imageDataURL, detail: "low" });
  const responsesURL = `${baseURL.replace(/\/+$/, "")}/responses`;
  const upstream = await fetchImpl(responsesURL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "none" },
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "nutrition_estimate", strict: true, schema: nutritionSchema } },
      max_output_tokens: 1800,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await upstream.json();
  if (!upstream.ok) throw new Error(body.error?.message || "AI 服务暂时不可用");
  const text = responseText(body);
  if (!text) throw new Error("AI 未返回可用结果");
  const estimate = normalizeEstimate(JSON.parse(text));
  if (!estimate) throw new Error("AI 返回的营养数据格式无效");
  return estimate;
}
