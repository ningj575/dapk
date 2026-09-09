'use client';
import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function BaiduAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 路由切换上报PV
  useEffect(() => {
    if ((window as any)._hmt) {
      const url = pathname + searchParams.toString();
      (window as any)._hmt.push(['_trackPageview', url]);
    }
  }, [pathname, searchParams]);

  return (
    <Script
      id="baidu-tongji"
      src="https://hm.baidu.com/hm.js?f80abeff353ecaf34413968917c80d8e"
      strategy="afterInteractive"
    />
  );
}
