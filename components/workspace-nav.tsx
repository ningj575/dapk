"use client";

import { Coins, Eraser, Images, LayoutTemplate, Menu, Sparkles, Video, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const workspaceNavItems = [
  ["万能生图", "/image-editor", WandSparkles],
  ["主图", "/studio-genesis", Images],
  ["详情图", "/ecom-studio", LayoutTemplate],
  ["视频生成", "/video-studio", Video],
  ["去水印", "/watermark-remover", Eraser],
  ["充值", "/pricing", Coins]
] as const;

type WorkspaceMode = "genesis" | "detail";

function isSelected(activeHref: string | undefined, activeLabel: string | undefined, href: string, label: string) {
  return activeHref ? href === activeHref : activeLabel === label;
}

function NavAction({
  href,
  label,
  children,
  onModeChange,
  onClick,
  className
}: {
  href: string;
  label: string;
  children: ReactNode;
  onModeChange?: (mode: WorkspaceMode) => void;
  onClick?: () => void;
  className?: string;
}) {
  if (onModeChange && href === "/studio-genesis") {
    return (
      <button className={className} type="button" onClick={() => { onClick?.(); onModeChange("genesis"); }}>
        {children}
      </button>
    );
  }
  if (onModeChange && href === "/ecom-studio") {
    return (
      <button className={className} type="button" onClick={() => { onClick?.(); onModeChange("detail"); }}>
        {children}
      </button>
    );
  }
  return (
    <Link className={className} href={href} onClick={onClick}>
      {children}
    </Link>
  );
}

export function WorkspaceNav({
  activeHref,
  activeLabel,
  onModeChange
}: {
  activeHref?: string;
  activeLabel?: string;
  onModeChange?: (mode: WorkspaceMode) => void;
}) {
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {workspaceNavItems.map(([label, href]) => {
        const selected = isSelected(activeHref, activeLabel, href, label);
        return (
          <NavAction key={label} href={href} label={label} onModeChange={onModeChange}>
            <span className={`inline-flex h-10 items-center whitespace-nowrap rounded-[14px] px-4 text-sm font-semibold transition ${selected ? "bg-[#101827] text-white" : "text-[#5f6674] hover:bg-[#ede8df] hover:text-[#101827]"}`}>
              {label}
            </span>
          </NavAction>
        );
      })}
    </nav>
  );
}

export function MobileWorkspaceMenu({
  activeHref,
  activeLabel,
  onModeChange
}: {
  activeHref?: string;
  activeLabel?: string;
  onModeChange?: (mode: WorkspaceMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full text-[#5f6674] transition hover:bg-[#ede8df] hover:text-[#101827]"
        onClick={() => setOpen((value) => !value)}
        aria-label="打开功能菜单"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[90] w-[340px] max-w-[calc(100vw-24px)] rounded-[18px] border border-[#e5ded2] bg-white p-3 shadow-[0_24px_70px_-34px_rgba(16,24,39,0.55)]">
          <div className="space-y-1">
            {workspaceNavItems.map(([label, href, Icon]) => {
              const selected = isSelected(activeHref, activeLabel, href, label);
              return (
                <NavAction key={label} className="block w-full text-left" href={href} label={label} onModeChange={onModeChange} onClick={() => setOpen(false)}>
                  <span className={`flex h-12 w-full items-center gap-3 rounded-[10px] px-4 text-sm font-bold transition ${selected ? "bg-[#101827] text-white" : "text-[#5f6674] hover:bg-[#f6f5f3] hover:text-[#101827]"}`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </span>
                </NavAction>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
