import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "食衡｜每日饮食指标与逐餐记录",
  description: "根据训练方案生成每日、每餐目标，支持文字与图片 AI 识餐、记录食物并实时判断是否超标。",
  manifest: "/manifest.webmanifest?v=shiheng-2",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "食衡" },
  icons: {
    icon: [
      { url: "/favicon.svg?v=shiheng-2", type: "image/svg+xml" },
      { url: "/icon-192.png?v=shiheng-2", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.svg?v=shiheng-2",
    apple: "/apple-touch-icon.png?v=shiheng-2",
  },
  openGraph: {
    title: "食衡｜把目标落到每一餐",
    description: "自动生成每日与逐餐指标，支持 AI 看图识餐、记录食物、判断超标并获得下一口建议。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "食衡——把目标落到每一餐" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "食衡｜把目标落到每一餐",
    description: "自动生成每日与逐餐指标，支持 AI 看图识餐、记录食物、判断超标并获得下一口建议。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d6b4d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
