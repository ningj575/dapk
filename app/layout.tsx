import type { Metadata } from "next";
import { SupportFloating } from "@/components/support-floating";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xinglu AI | 图片免费去除水印、电商主图、详情图生成与商品图片精修工具",
  description:
    "Xinglu AI GPT Image 2 + Nano Banana 2 提供图片免费去除水印、电商主图生成、电商详情图生成、AI电商套图生成、视频生成，覆盖国内外主流电商平台。",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <SupportFloating />
      </body>
    </html>
  );
}
