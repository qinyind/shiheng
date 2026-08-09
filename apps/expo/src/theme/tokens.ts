import { Platform } from "react-native";

// 与 Web 版 app/globals.css 的 12 色 token 保持一致，保证三端观感统一。
// B 色板（暖绿洗净）：保留暖纸底，去掉双绿墙；宏量色橙/绿/金与主绿不撞。
export const colors = {
  ink: "#1a221c",
  muted: "#6a7268",
  paper: "#f7f5f0",
  card: "#fffefb",
  line: "#e5e2d8",
  green: "#1b5e4a",
  lime: "#c5d96a",
  orange: "#e09a5a",
  red: "#d6453d",
  carb: "#e09a5a",
  protein: "#4a9a7a",
  fat: "#c4a84a",
  // 次级填充色（暖系灰绿，承接纸底）
  field: "#f5f2eb",
  quick: "#f0eee6",
  formula: "#f0eee6",
  toggle: "#f0eee6",
  heroText: "#f8faf3",
  heroTextSoft: "rgba(255,255,255,.78)",
  // 配额卡独立于普通卡片的绿调描边
  sumBorder: "#cfd8c8",
  dangerBg: "#fdeee9",
  successBg: "#f0f4dd",
  successBorder: "#d3dcae",
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
