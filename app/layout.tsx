import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SupportFloating } from "@/components/support-floating";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xinglu AI | AI神器，图片免费去除水印、电商主图、详情图生成与商品图片精修工具",
  description:
    "Xinglu AI神器 GPT Image 2 + Nano Banana 2 提供图片免费去除水印、电商主图生成、电商详情图生成、AI电商套图生成、视频生成，覆盖国内外主流电商平台。",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
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
        <Script
          id="baidu-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
var _hmt = window._hmt || [];
window._hmt = _hmt;
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?f80abeff353ecaf34413968917c80d8e";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();
            `.trim()
          }}
        />
      </body>
    </html>
  );
}
