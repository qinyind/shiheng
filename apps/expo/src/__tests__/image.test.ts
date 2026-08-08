/// <reference types="jest" />
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator } from "expo-image-manipulator";
import { pickPhoto, type PickedImage } from "../api/image";

// ---- expo-image-picker 打桩 ----
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// ---- expo-image-manipulator 打桩：manipulate → resize(链式) → renderAsync → saveAsync ----
// 工厂内直接建 jest.fn，不引用模块级变量（避免 jest.mock 提升导致的 TDZ）。
jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: "jpeg" },
}));

// 构造可链式的 manipulate 上下文；saveAsync 返回压缩结果。
function buildContext() {
  const saveAsync = jest.fn().mockResolvedValue({
    uri: "file:///tmp/compressed.jpg",
    base64: "abc123",
    width: 853,
    height: 569,
  });
  const ctx = {
    resize: jest.fn().mockReturnThis(),
    renderAsync: jest.fn().mockResolvedValue({ saveAsync }),
  };
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue(ctx);
  return { ctx, saveAsync };
}

const asset = (overrides: Record<string, unknown>) => ({ uri: "file:///asset.jpg", width: 1000, height: 800, ...overrides });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("相机拍照", () => {
  test("权限被拒 → 抛错，不调 launchCameraAsync", async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await expect(pickPhoto(true)).rejects.toThrow("需要相机权限才能拍照。");
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  test("用户取消 → 返回 null", async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
    await expect(pickPhoto(true)).resolves.toBeNull();
  });

  test("assets 为空 → 返回 null", async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [] });
    await expect(pickPhoto(true)).resolves.toBeNull();
  });

  test("拍照成功 → 最长边 >1600 且宽≥高 → resize width:1600，返回 PickedImage", async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [asset({ uri: "file:///camera.jpg", width: 3000, height: 2000, fileName: "photo.jpg" })],
    });
    const { ctx, saveAsync } = buildContext();

    const result = await pickPhoto(true);

    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({ mediaTypes: ["images"], quality: 1 });
    expect(ctx.resize).toHaveBeenCalledWith({ width: 1600, height: null });
    expect(ctx.renderAsync).toHaveBeenCalled();
    expect(saveAsync).toHaveBeenCalledWith({ format: "jpeg", compress: 0.72, base64: true });

    const expected: PickedImage = {
      uri: "file:///tmp/compressed.jpg",
      dataURL: "data:image/jpeg;base64,abc123",
      width: 853,
      height: 569,
      fileName: "photo.jpg",
    };
    expect(result).toEqual(expected);
  });
});

describe("图库选择", () => {
  test("调用 launchImageLibraryAsync，不调 launchCameraAsync", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [asset({ width: 1000, height: 800 })],
    });
    buildContext();

    await pickPhoto(false);

    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({ mediaTypes: ["images"], quality: 1 });
  });

  test("最长边 ≤1600 → 不 resize", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [asset({ width: 1000, height: 800 })],
    });
    const { ctx } = buildContext();

    await pickPhoto(false);

    expect(ctx.resize).not.toHaveBeenCalled();
    expect(ctx.renderAsync).toHaveBeenCalled();
  });

  test("高度 > 宽度 → resize height:1600", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [asset({ width: 1000, height: 3000 })],
    });
    const { ctx } = buildContext();

    await pickPhoto(false);

    expect(ctx.resize).toHaveBeenCalledWith({ width: null, height: 1600 });
  });

  test("无 fileName → fileName 为 undefined", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [asset({ width: 1000, height: 800 })],
    });
    buildContext();

    const result = await pickPhoto(false);

    expect(result).not.toBeNull();
    expect(result!.fileName).toBeUndefined();
    expect(result!.dataURL).toBe("data:image/jpeg;base64,abc123");
  });
});
