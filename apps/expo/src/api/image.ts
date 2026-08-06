import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

// 与 SwiftUI resizedForUpload(maxDimension: 1600) + jpegData(compressionQuality: 0.72) 一致：
// 最长边超过 1600px 才等比缩放，统一 JPEG 0.72，输出 base64 dataURL。
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;

export type PickedImage = {
  uri: string;
  dataURL: string;
  width: number;
  height: number;
  fileName?: string;
};

export async function pickPhoto(fromCamera: boolean): Promise<PickedImage | null> {
  if (fromCamera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("需要相机权限才能拍照。");
  }
  const result = fromCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const jpeg = await compressToJpeg(asset.uri, asset.width, asset.height);
  return { uri: jpeg.uri, dataURL: jpeg.dataURL, width: jpeg.width, height: jpeg.height, fileName: asset.fileName ?? undefined };
}

async function compressToJpeg(uri: string, width: number, height: number): Promise<PickedImage> {
  const largest = Math.max(width || 0, height || 0);
  let context = ImageManipulator.manipulate(uri);
  if (largest > MAX_DIMENSION) {
    // 只指定较长边，另一维传 null 自动保持比例。
    context =
      width >= height
        ? context.resize({ width: MAX_DIMENSION, height: null })
        : context.resize({ width: null, height: MAX_DIMENSION });
  }
  const imageRef = await context.renderAsync();
  const saved = await imageRef.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  return {
    uri: saved.uri,
    dataURL: `data:image/jpeg;base64,${saved.base64 ?? ""}`,
    width: saved.width,
    height: saved.height,
  };
}
