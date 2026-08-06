import { Platform } from "react-native";
import { z } from "zod";
import type { AiEstimate, RemoteStateEnvelope, SavedState } from "@diet/domain";
import { tokenStore } from "./persist";

// 与 SwiftUI ServerClient.swift 一一对应的契约：
// - URL 需 http/https + host；__DEV__ 才放行 http（否则强制 https）
// - 45s 超时（AbortController）
// - 409 返回 RemoteStateEnvelope（乐观锁冲突）
// - 非 2xx 解 { error }；解析失败 → invalidResponse

export type ServerErrorCode = "invalidURL" | "notPaired" | "server" | "invalidResponse" | "conflict";

export class ServerAPIError extends Error {
  readonly code: ServerErrorCode;
  readonly envelope?: RemoteStateEnvelope;

  constructor(code: ServerErrorCode, message: string, envelope?: RemoteStateEnvelope) {
    super(message);
    this.name = "ServerAPIError";
    this.code = code;
    if (envelope) this.envelope = envelope;
  }

  static invalidURL() {
    return new ServerAPIError("invalidURL", "服务器地址无效，请填写 https:// 开头的地址。");
  }
  static notPaired() {
    return new ServerAPIError("notPaired", "请先使用服务器配对码连接。");
  }
  static server(message: string) {
    return new ServerAPIError("server", message);
  }
  static invalidResponse() {
    return new ServerAPIError("invalidResponse", "服务器返回了无法识别的数据。");
  }
  static conflict(envelope: RemoteStateEnvelope) {
    return new ServerAPIError("conflict", "服务器已有更新，正在合并数据。", envelope);
  }
}

// 服务端信封：version 乐观锁、state 可为空。轻校验 + passthrough，与 Swift try? decode 的宽容行为一致。
const envelopeSchema = z
  .object({
    version: z.number(),
    state: z.unknown().nullable(),
    updatedAt: z.string().nullable(),
  })
  .passthrough();

const estimateSchema = z
  .object({
    name: z.string(),
    grams: z.number(),
    carbs: z.number(),
    protein: z.number(),
    fat: z.number(),
    kcal: z.number(),
    confidence: z.enum(["low", "medium", "high"]),
    note: z.string(),
    ingredients: z.array(
      z.object({
        name: z.string(),
        grams: z.number(),
        carbs: z.number(),
        protein: z.number(),
        fat: z.number(),
        kcal: z.number(),
      }),
    ),
  })
  .passthrough();

function deviceName(): string {
  if (Platform.OS === "web") return "Web 浏览器";
  if (Platform.OS === "ios") return "iPhone";
  return "Android";
}

async function send<T>(serverURL: string, path: string, method: string, body?: unknown, authenticated = true): Promise<T> {
  let base: URL;
  try {
    base = new URL(serverURL.trim());
  } catch {
    throw ServerAPIError.invalidURL();
  }
  const scheme = base.protocol.replace(":", "").toLowerCase();
  if (!["https", "http"].includes(scheme) || !base.host) throw ServerAPIError.invalidURL();
  if (!__DEV__ && scheme !== "https") throw ServerAPIError.invalidURL();
  const pathname = base.pathname.replace(/\/+$/, "");
  const url = `${base.origin}${pathname}${path}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authenticated) {
    const token = await tokenStore.read();
    if (!token) throw ServerAPIError.notPaired();
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (response.status === 409) {
      throw ServerAPIError.conflict(parseEnvelope(text));
    }
    if (response.status < 200 || response.status >= 300) {
      let message = `服务器请求失败（${response.status}）`;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // 保留默认错误文案
      }
      throw ServerAPIError.server(message);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw ServerAPIError.invalidResponse();
    }
  } finally {
    clearTimeout(timer);
  }
}

function parseEnvelope(text: string): RemoteStateEnvelope {
  try {
    return envelopeSchema.parse(JSON.parse(text)) as RemoteStateEnvelope;
  } catch {
    throw ServerAPIError.invalidResponse();
  }
}

export async function isPaired(): Promise<boolean> {
  return (await tokenStore.read()) !== null;
}

export async function pair(serverURL: string, pairingCode: string): Promise<void> {
  const response = await send<{ token: string }>(
    serverURL,
    "/v1/auth/pair",
    "POST",
    { pairingCode, deviceName: deviceName() },
    false,
  );
  if (!response.token) throw ServerAPIError.invalidResponse();
  await tokenStore.save(response.token);
}

export async function fetchState(serverURL: string): Promise<RemoteStateEnvelope> {
  return send<RemoteStateEnvelope>(serverURL, "/v1/sync", "GET");
}

export async function pushState(serverURL: string, state: SavedState, baseVersion: number): Promise<RemoteStateEnvelope> {
  return send<RemoteStateEnvelope>(serverURL, "/v1/sync", "PUT", { baseVersion, state });
}

export async function analyze(serverURL: string, description: string, imageDataURL?: string): Promise<AiEstimate> {
  const response = await send<{ estimate: AiEstimate }>(serverURL, "/v1/ai/analyze-food", "POST", {
    description,
    imageDataURL,
  });
  if (!response.estimate) throw ServerAPIError.invalidResponse();
  return estimateSchema.parse(response.estimate) as AiEstimate;
}

export async function disconnect(): Promise<void> {
  await tokenStore.delete();
}
