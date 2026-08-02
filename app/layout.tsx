import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "餐标｜每日饮食指标与逐餐记录",
  description: "把健身 Excel 方案转化为每日、每餐目标，支持文字与图片 AI 识餐、记录食物并实时判断是否超标。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "餐标｜把目标落到每一餐",
    description: "自动生成每日与逐餐指标，支持 AI 看图识餐、记录食物、判断超标并获得下一口建议。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "餐标——把目标落到每一餐" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "餐标｜把目标落到每一餐",
    description: "自动生成每日与逐餐指标，支持 AI 看图识餐、记录食物、判断超标并获得下一口建议。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
