"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export const workspaceNavItems = [
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["视频生成", "/video-studio"],
  ["去水印", "/watermark-remover"],
  ["充值", "/pricing"]
] as const;

const navScrollKey = "xinglu_workspace_nav_scroll_left";

export function WorkspaceNav({
  activeHref,
  activeLabel,
  onModeChange
}: {
  activeHref?: string;
  activeLabel?: string;
  onModeChange?: (mode: "genesis" | "detail") => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const saved = Number(window.sessionStorage.getItem(navScrollKey) || "0");
    window.requestAnimationFrame(() => {
      nav.scrollLeft = Number.isFinite(saved) ? saved : 0;
    });
  }, []);

  function saveScroll() {
    const nav = navRef.current;
    if (!nav) return;
    window.sessionStorage.setItem(navScrollKey, String(nav.scrollLeft));
  }

  return (
    <nav
      ref={navRef}
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none] md:flex-none md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
      onScroll={saveScroll}
    >
      {workspaceNavItems.map(([label, href]) => {
        const selected = activeHref ? href === activeHref : activeLabel === label;
        const button = (
          <span className={`inline-flex h-10 items-center whitespace-nowrap rounded-[14px] px-4 text-sm font-semibold transition ${selected ? "bg-[#101827] text-white" : "text-[#5f6674] hover:bg-[#ede8df] hover:text-[#101827]"}`}>
            {label}
          </span>
        );
        if (onModeChange && label === "主图") {
          return (
            <button key={label} type="button" onClick={() => { saveScroll(); onModeChange("genesis"); }}>
              {button}
            </button>
          );
        }
        if (onModeChange && label === "详情图") {
          return (
            <button key={label} type="button" onClick={() => { saveScroll(); onModeChange("detail"); }}>
              {button}
            </button>
          );
        }
        return (
          <Link key={label} href={href} onClick={saveScroll}>
            {button}
          </Link>
        );
      })}
    </nav>
  );
}
