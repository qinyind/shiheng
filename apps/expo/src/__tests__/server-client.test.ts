/// <reference types="jest" />
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ZodError } from "zod";
import { TOKEN_KEY } from "../api/persist";
import {
  ServerAPIError,
  analyze,
  disconnect,
  fetchState,
  isPaired,
  pair,
  pushState,
} from "../api/serverClient";

// ---- 原生存储打桩（persist.ts 顶层 import）----
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// ---- fetch 打桩 ----
const originalFetch = (globalThis as any).fetch;
const mockFetch = jest.fn();
function mockResponse(text: string, status = 200): Response {
  return new Response(text, { status });
}
// 统一拿 fetch 调用的 url + init（避免重复解构）。
function lastFetchCall(): [string, RequestInit] {
  return mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
}

// send 在读取 token 处 await（微任务链），这里多刷几轮微任务直到 fetch 被调用。
async function flushUntilFetchCalled() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    if (mockFetch.mock.calls.length > 0) return;
  }
}

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "ios");
  (globalThis as any).__DEV__ = true;
  // mockReset 清空调用历史与实现，避免跨用例泄漏；随后设回默认值。
  (SecureStore.getItemAsync as jest.Mock).mockReset().mockResolvedValue("test-token");
  (SecureStore.setItemAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
  (SecureStore.deleteItemAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockFetch.mockReset();
  (globalThis as any).fetch = mockFetch;
});

afterEach(() => {
  (globalThis as any).__DEV__ = true;
  (globalThis as any).fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("URL 校验", () => {
  test("无法解析的 URL → invalidURL", async () => {
    await expect(fetchState("not-a-url")).rejects.toMatchObject({ code: "invalidURL" });
  });

  test("非 http/https scheme → invalidURL", async () => {
    await expect(fetchState("ftp://example.com")).rejects.toMatchObject({ code: "invalidURL" });
    await expect(fetchState("file:///tmp/x")).rejects.toMatchObject({ code: "invalidURL" });
  });

  test("http 在 __DEV__=true 时放行", async () => {
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ version: 1, state: null, updatedAt: null })));
    await expect(fetchState("http://example.com")).resolves.toEqual({ version: 1, state: null, updatedAt: null });
  });

  test("http 在 __DEV__=false 时强制拒绝，https 放行", async () => {
    (globalThis as any).__DEV__ = false;
    await expect(fetchState("http://example.com")).rejects.toMatchObject({ code: "invalidURL" });

    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ version: 1, state: null, updatedAt: null })));
    await expect(fetchState("https://example.com")).resolves.toBeDefined();
  });
});

describe("配对状态", () => {
  test("未配对（token 为 null）→ notPaired，且不发起请求", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await expect(fetchState("https://example.com")).rejects.toMatchObject({ code: "notPaired" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("isPaired：有 token → true；无 token → false", async () => {
    await expect(isPaired()).resolves.toBe(true);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await expect(isPaired()).resolves.toBe(false);
  });
});

describe("45s 超时", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("fetch 收到 signal，45s 后 abort 触发，finally 清理定时器", async () => {
    let resolveFetch!: (r: Response) => void;
    mockFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const promise = fetchState("https://example.com");
    await flushUntilFetchCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = lastFetchCall();
    const signal = init.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);

    const clearSpy = jest.spyOn(globalThis, "clearTimeout");
    jest.advanceTimersByTime(45_000);
    expect(signal.aborted).toBe(true);

    resolveFetch(new Response(JSON.stringify({ version: 1, state: null, updatedAt: null }), { status: 200 }));
    await expect(promise).resolves.toEqual({ version: 1, state: null, updatedAt: null });
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe("冲突与错误映射", () => {
  test("409 → conflict，envelope 从 body 解析（含 passthrough）", async () => {
    const body = {
      version: 3,
      state: { profile: {}, entries: [] },
      updatedAt: "2026-08-08",
      extra: "passthrough",
    };
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify(body), 409));

    const error = await fetchState("https://example.com").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerAPIError);
    expect((error as ServerAPIError).code).toBe("conflict");
    expect((error as ServerAPIError).envelope).toEqual(body);
  });

  test("409 的 envelope 中 state 可为 null", async () => {
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ version: 1, state: null, updatedAt: null }), 409));
    const error = await fetchState("https://example.com").catch((e: unknown) => e);
    expect((error as ServerAPIError).code).toBe("conflict");
    expect((error as ServerAPIError).envelope).toEqual({ version: 1, state: null, updatedAt: null });
  });

  test("409 但 body 非合法 JSON → invalidResponse", async () => {
    mockFetch.mockResolvedValue(mockResponse("not json", 409));
    const error = await fetchState("https://example.com").catch((e: unknown) => e);
    expect((error as ServerAPIError).code).toBe("invalidResponse");
  });

  test("非 2xx：取 { error } 文案", async () => {
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ error: "服务器开小差了" }), 500));
    const error = await fetchState("https://example.com").catch((e: unknown) => e);
    expect((error as ServerAPIError).code).toBe("server");
    expect((error as ServerAPIError).message).toBe("服务器开小差了");
  });

  test("非 2xx：无 error 文案 → 默认文案", async () => {
    mockFetch.mockResolvedValue(mockResponse("oops", 500));
    const error = await fetchState("https://example.com").catch((e: unknown) => e);
    expect((error as ServerAPIError).code).toBe("server");
    expect((error as ServerAPIError).message).toBe("服务器请求失败（500）");
  });

  test("2xx 但 body 非 JSON → invalidResponse", async () => {
    mockFetch.mockResolvedValue(mockResponse("hello", 200));
    const error = await fetchState("https://example.com").catch((e: unknown) => e);
    expect((error as ServerAPIError).code).toBe("invalidResponse");
  });
});

describe("fetchState / pushState", () => {
  test("fetchState：GET /v1/sync，带 Accept 与 Bearer，无 Content-Type", async () => {
    const envelope = { version: 1, state: null, updatedAt: null };
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify(envelope)));

    await expect(fetchState("https://example.com")).resolves.toEqual(envelope);
    const [url, init] = lastFetchCall();
    expect(url).toBe("https://example.com/v1/sync");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ Accept: "application/json", Authorization: "Bearer test-token" });
    expect(init.body).toBeUndefined();
  });

  test("pushState：PUT /v1/sync，body 为 { baseVersion, state }，带 Content-Type", async () => {
    const state = {
      profile: {},
      entries: [],
      customFoods: [],
      dayTypes: {},
      deletedEntryIDs: [],
      deletedFoodIDs: [],
    } as unknown as import("@diet/domain").SavedState;
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ version: 2, state: null, updatedAt: null })));

    await pushState("https://example.com", state, 1);
    const [url, init] = lastFetchCall();
    expect(url).toBe("https://example.com/v1/sync");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ baseVersion: 1, state });
  });
});

describe("pair", () => {
  test("POST /v1/auth/pair，body 含 pairingCode/deviceName，成功后存 token", async () => {
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ token: "abc123" })));

    await pair("https://example.com", "1234");
    const [url, init] = lastFetchCall();
    expect(url).toBe("https://example.com/v1/auth/pair");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ pairingCode: "1234", deviceName: "iPhone" });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    // authenticated=false → 不带 Authorization
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, "abc123");
  });

  test("响应无 token → invalidResponse，且不存 token", async () => {
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({})));
    const error = await pair("https://example.com", "1234").catch((e: unknown) => e);
    expect((error as ServerAPIError).code).toBe("invalidResponse");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  test("deviceName：web → Web 浏览器", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ token: "abc" })));
    await pair("https://example.com", "1234");
    expect(JSON.parse(lastFetchCall()[1].body as string)).toEqual({ pairingCode: "1234", deviceName: "Web 浏览器" });
  });

  test("deviceName：android → Android", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ token: "abc" })));
    await pair("https://example.com", "1234");
    expect(JSON.parse(lastFetchCall()[1].body as string)).toEqual({ pairingCode: "1234", deviceName: "Android" });
  });
});

describe("analyze", () => {
  const validEstimate = {
    name: "熟米饭",
    grams: 100,
    carbs: 30,
    protein: 2.6,
    fat: 0.3,
    kcal: 133,
    confidence: "high",
    note: "主食",
    ingredients: [{ name: "米饭", grams: 100, carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 }],
  };

  test("有效 estimate → 返回解析结果", async () => {
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({ estimate: validEstimate })));

    const result = await analyze("https://example.com", "一碗米饭");
    expect(result.name).toBe("熟米饭");
    expect(result.confidence).toBe("high");

    const [url, init] = lastFetchCall();
    expect(url).toBe("https://example.com/v1/ai/analyze-food");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ description: "一碗米饭" });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  test("响应缺 estimate → invalidResponse", async () => {
    mockFetch.mockResolvedValue(mockResponse(JSON.stringify({})));
    const error = await analyze("https://example.com", "x").catch((e: unknown) => e);
    expect((error as ServerAPIError).code).toBe("invalidResponse");
  });

  test("estimate 不合法（confidence 越界）→ ZodError", async () => {
    mockFetch.mockResolvedValue(
      mockResponse(
        JSON.stringify({
          estimate: {
            name: "x",
            grams: 1,
            carbs: 1,
            protein: 1,
            fat: 1,
            kcal: 1,
            confidence: "ultra",
            note: "",
            ingredients: [],
          },
        }),
      ),
    );
    const error = await analyze("https://example.com", "x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ZodError);
  });
});

describe("disconnect", () => {
  test("调用 tokenStore.delete（SecureStore.deleteItemAsync）", async () => {
    await disconnect();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
  });
});
