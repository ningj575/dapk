"use client";

import { clearAuth, useAuthUser } from "@/components/auth-state";
import { ChevronDown, CircleUserRound, Coins, FileClock, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function AccountMenu() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const user = useAuthUser();

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const email = user?.email || "未登录账号";
  const displayName = user?.nickname || email.split("@")[0] || "达客用户";
  const credits = typeof user?.credits === "number" ? user.credits : 0;

  function goTo(path: string) {
    setOpen(false);
    router.push(path);
  }

  function logout() {
    clearAuth();
    setOpen(false);
    router.replace("/?login=1");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="account-menu-trigger"
        className="flex h-11 max-w-[220px] items-center gap-2 rounded-full border border-[#ded8cd] bg-white px-2.5 pl-2 text-sm font-semibold text-[#4f5766] shadow-[0_1px_2px_rgba(16,24,39,0.04)] transition hover:border-[#c9c0b2] hover:text-[#101827]"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#101827] text-xs font-extrabold text-white">
          AI
        </span>
        <span className="hidden max-w-[130px] truncate sm:inline">{displayName}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[280px] overflow-hidden rounded-2xl border border-[#e5ded2] bg-white shadow-[0_24px_70px_-34px_rgba(16,24,39,0.5)]">
          <div className="border-b border-[#eee7dd] bg-[#fbfaf7] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#101827] text-sm font-extrabold text-white">
                AI
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-[#101827]">{displayName}</p>
                <p className="mt-0.5 truncate text-xs text-[#7a8190]">{email}</p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              data-testid="account-profile"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#4f5766] transition hover:bg-[#f6f5f3] hover:text-[#101827]"
              onClick={() => goTo("/profile")}
            >
              <CircleUserRound className="h-4 w-4 text-[#8b93a1]" />
              个人中心
            </button>
            <button
              type="button"
              data-testid="account-credits"
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#4f5766] transition hover:bg-[#f6f5f3] hover:text-[#101827]"
              onClick={() => goTo("/credits")}
            >
              <span className="flex items-center gap-3">
                <Coins className="h-4 w-4 text-amber-500" />
                积分
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700">{credits}</span>
            </button>
            <button
              type="button"
              data-testid="account-records"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#4f5766] transition hover:bg-[#f6f5f3] hover:text-[#101827]"
              onClick={() => goTo("/generation-records")}
            >
              <FileClock className="h-4 w-4 text-[#8b93a1]" />
              生成记录
            </button>
          </div>

          <div className="border-t border-[#eee7dd] p-2">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
