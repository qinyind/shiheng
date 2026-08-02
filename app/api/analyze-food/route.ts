import { NextRequest, NextResponse } from "next/server";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "grams", "carbs", "protein", "fat", "kcal", "confidence", "note"],
  properties: {
    name: { type: "string", description: "A concise Chinese name for the whole serving or mixed dish." },
    grams: { type: "number", minimum: 1, description: "Estimated edible weight of the whole serving in grams." },
    carbs: { type: "number", minimum: 0, description: "Total carbohydrate grams in the whole serving." },
    protein: { type: "number", minimum: 0, description: "Total protein grams in the whole serving." },
    fat: { type: "number", minimum: 0, description: "Total fat grams in the whole serving." },
    kcal: { type: "number", minimum: 0, description: "Total energy in kcal for the whole serving." },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string", description: "A short Chinese explanation of assumptions, including raw/cooked state and cooking oil when relevant." },
  },
};

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI 服务尚未配置。需要先在站点中添加 OpenAI API 密钥。" }, { status: 503 });
  }

  try {
    const body = await request.json() as { description?: string; image?: string };
    const description = body.description?.trim() || "";
    const image = body.image || "";
    if (!description && !image) return NextResponse.json({ error: "请提供食物描述或照片。" }, { status: 400 });
    if (description.length > 3000) return NextResponse.json({ error: "文字描述请控制在 3000 字以内。" }, { status: 400 });
    if (image && (!image.startsWith("data:image/") || image.length > 12_000_000)) {
      return NextResponse.json({ error: "图片格式无效或文件过大。" }, { status: 400 });
    }

    const content: Array<Record<string, unknown>> = [{
      type: "input_text",
      text: `你是食品营养估算助手。请估算用户实际会吃下的整份食物，而不是每100克。优先采用用户给出的重量、包装营养标签和生熟状态；看不清或不知道时做保守的常见值估算。混合餐请把所有食材、烹调油和酱料合并为一个结果。热量应与三大营养素大致一致。结果只用于日常饮食记录，不作医疗建议。\n\n用户描述：${description || "未提供文字，请根据图片估算。"}`,
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
        max_output_tokens: 1200,
      }),
    });
    const response = await upstream.json() as OpenAIResponse;
    if (!upstream.ok) {
      const message = response.error?.message || "AI 服务暂时不可用。";
      return NextResponse.json({ error: message }, { status: upstream.status >= 500 ? 502 : 400 });
    }

    const output = extractText(response);
    if (!output) return NextResponse.json({ error: "AI 没有返回可用的营养结果，请换一张更清楚的照片或补充文字。" }, { status: 502 });
    const estimate = JSON.parse(output);
    return NextResponse.json({ estimate });
  } catch (error) {
    console.error("Food analysis failed", error);
    return NextResponse.json({ error: "识别失败，请检查图片或稍后重试。" }, { status: 500 });
  }
}
