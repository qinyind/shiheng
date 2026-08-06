import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "../../chatgpt-auth";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

type PersonalServerResponse = {
  estimate?: ReturnType<typeof normalizeEstimate>;
  error?: string;
};

async function readJSONResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "ingredients", "confidence", "note"],
  properties: {
    name: { type: "string", description: "A concise Chinese name for the whole meal." },
    ingredients: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "grams", "carbs", "protein", "fat", "kcal"],
        properties: {
          name: { type: "string", description: "Chinese base ingredient name including cooked/raw state." },
          grams: { type: "number", minimum: 0.1, description: "Actual eaten weight of this ingredient." },
          carbs: { type: "number", minimum: 0 },
          protein: { type: "number", minimum: 0 },
          fat: { type: "number", minimum: 0 },
          kcal: { type: "number", minimum: 0 },
        },
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string", description: "A short Chinese explanation of assumptions." },
  },
};

type Ingredient = { name: string; grams: number; carbs: number; protein: number; fat: number; kcal: number };

function normalizeEstimate(value: { name?: unknown; ingredients?: unknown; confidence?: unknown; note?: unknown }) {
  if (typeof value.name !== "string" || typeof value.note !== "string" || !["low", "medium", "high"].includes(String(value.confidence))) return null;
  if (!Array.isArray(value.ingredients) || value.ingredients.length < 1 || value.ingredients.length > 20) return null;
  const keys = ["grams", "carbs", "protein", "fat", "kcal"] as const;
  const ingredients: Ingredient[] = [];
  for (const item of value.ingredients) {
    if (!item || typeof item !== "object") return null;
    const ingredient = item as Record<string, unknown>;
    if (typeof ingredient.name !== "string" || !ingredient.name.trim()) return null;
    if (!keys.every((key) => Number.isFinite(ingredient[key]) && Number(ingredient[key]) >= (key === "grams" ? 0.1 : 0))) return null;
    ingredients.push({ name: ingredient.name.trim().slice(0, 80), grams: Number(ingredient.grams), carbs: Number(ingredient.carbs), protein: Number(ingredient.protein), fat: Number(ingredient.fat), kcal: Number(ingredient.kcal) });
  }
  const sum = (key: keyof Omit<Ingredient, "name">) => ingredients.reduce((total, ingredient) => total + ingredient[key], 0);
  return { name: value.name.trim().slice(0, 100), grams: sum("grams"), carbs: sum("carbs"), protein: sum("protein"), fat: sum("fat"), kcal: sum("kcal"), confidence: value.confidence, note: value.note.trim().slice(0, 500), ingredients };
}

function extractText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "需要登录后才能使用 AI 识餐。" }, { status: 401 });

  try {
    const body = await request.json() as { description?: string; image?: string };
    const description = body.description?.trim() || "";
    const image = body.image || "";
    if (!description && !image) return NextResponse.json({ error: "请提供食物描述或照片。" }, { status: 400 });
    if (description.length > 3000) return NextResponse.json({ error: "文字描述请控制在 3000 字以内。" }, { status: 400 });
    if (image && (!image.startsWith("data:image/") || image.length > 12_000_000)) {
      return NextResponse.json({ error: "图片格式无效或文件过大。" }, { status: 400 });
    }

    const personalServerURL = process.env.AI_UPSTREAM_URL?.trim();
    const personalServerToken = process.env.AI_UPSTREAM_TOKEN?.trim();
    if (personalServerURL && personalServerToken) {
      const upstreamURL = new URL("/v1/ai/analyze-food", personalServerURL);
      if (upstreamURL.protocol !== "https:") {
        return NextResponse.json({ error: "AI 服务地址配置不安全。" }, { status: 503 });
      }
      const upstream = await fetch(upstreamURL, {
        method: "POST",
        headers: { authorization: `Bearer ${personalServerToken}`, "content-type": "application/json" },
        body: JSON.stringify({ description, imageDataURL: image || undefined }),
        signal: AbortSignal.timeout(95_000),
      });
      const response = await readJSONResponse<PersonalServerResponse>(upstream);
      if (!response) {
        console.error("AI upstream returned a non-JSON response", { status: upstream.status, contentType: upstream.headers.get("content-type") });
        return NextResponse.json({ error: `AI 服务连接异常（${upstream.status}），请稍后重试。` }, { status: 502 });
      }
      if (!upstream.ok || !response.estimate) {
        return NextResponse.json({ error: response.error || "AI 服务暂时不可用，请稍后重试。" }, { status: upstream.status >= 500 ? 502 : upstream.status });
      }
      return NextResponse.json({ estimate: response.estimate });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI 服务尚未配置。" }, { status: 503 });
    }

    const content: Array<Record<string, unknown>> = [{
      type: "input_text",
      text: `你是食品营养估算助手。请把用户实际吃下的餐食拆成可独立记录的基础食材，不要合并成一道菜。每种食材返回实际食用重量和整份营养，不是每100克。名称注明生熟状态，例如熟米饭、熟鸡胸肉、烹调油。混合菜要分列主料、配料、实际摄入的烹调油和有营养贡献的酱料；相同食材合并，忽略无热量香辛料，不要虚构看不出的细小配料。优先使用用户提供的重量、包装标签和生熟状态，看不清时做保守常见值估算并在 note 说明。总营养由程序按 ingredients 相加。结果只用于日常饮食记录，不作医疗建议。\n\n用户描述：${description || "未提供文字，请根据图片估算。"}`,
    }];
    if (image) content.push({ type: "input_image", image_url: image, detail: "low" });

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "low" },
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "nutrition_estimate", strict: true, schema } },
        max_output_tokens: 1800,
      }),
    });
    const response = await upstream.json() as OpenAIResponse;
    if (!upstream.ok) {
      const message = response.error?.message || "AI 服务暂时不可用。";
      return NextResponse.json({ error: message }, { status: upstream.status >= 500 ? 502 : 400 });
    }

    const output = extractText(response);
    if (!output) return NextResponse.json({ error: "AI 没有返回可用的营养结果，请换一张更清楚的照片或补充文字。" }, { status: 502 });
    const estimate = normalizeEstimate(JSON.parse(output));
    if (!estimate) return NextResponse.json({ error: "AI 返回的食材明细格式无效，请重新识别。" }, { status: 502 });
    return NextResponse.json({ estimate });
  } catch (error) {
    console.error("Food analysis failed", error);
    return NextResponse.json({ error: "识别失败，请检查图片或稍后重试。" }, { status: 500 });
  }
}
