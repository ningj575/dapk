import type { Metadata } from "next";
import { SupportFloating } from "@/components/support-floating";
import "./globals.css";

export const metadata: Metadata = {
  title: "达客 AI | 电商生图、AI商品图生成与商品图片精修工具",
  description:
    "达客 AI 提供电商生图、AI商品图生成、电商主图生成、商品图片精修与详情页素材生成能力，覆盖国内外主流电商平台。"
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
