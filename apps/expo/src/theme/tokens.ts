import { Platform } from "react-native";

// 与 Web 版 app/globals.css 的 12 色 token 保持一致，保证三端观感统一。
export const colors = {
  ink: "#18211b",
  muted: "#68736b",
  paper: "#f3f1e8",
  card: "#fffef9",
  line: "#d9ddd4",
  green: "#0d6b4d",
  lime: "#b9e44c",
  orange: "#ff8b4a",
  red: "#df4e42",
  carb: "#f4a261",
  protein: "#4f8f78",
  fat: "#c8b544",
  // globals.css 中出现的次级填充色
  field: "#f7f7f2",
  quick: "#f0f2ec",
  formula: "#eef2eb",
  toggle: "#f2f4ee",
  heroText: "#f7faee",
  summaryText: "#f8f9f3",
  heroTextSoft: "rgba(255,255,255,.75)",
  dangerBg: "#fdecea",
  successBg: "#eef6d9",
  successBorder: "#cadca4",
  white: "#ffffff",
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 13,
  panel: 22,
  hero: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 34,
} as const;

export const font = {
  family:
    Platform.select({
      ios: "PingFang SC",
      android: "sans-serif",
      default: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }) ?? "sans-serif",
  eyebrow: 12,
  small: 13,
  body: 16,
  h2: 21,
  hero: 42,
} as const;
