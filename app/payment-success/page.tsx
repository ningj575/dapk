"use client";

import { AccountMenu } from "@/components/account-menu";
import { AnnouncementButton } from "@/components/announcement-button";
import { AuthGuard } from "@/components/auth-guard";
import { MobileWorkspaceMenu, WorkspaceNav } from "@/components/workspace-nav";
import { CheckCircle2, Coins, WandSparkles } from "lucide-react";
import Link from "next/link";

function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e5ded2] bg-[#faf9f7]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link className="flex items-baseline gap-2" href="/">
          <span className="font-display text-xl font-extrabold tracking-tight">Xinglu</span>
          <span className="text-xs font-medium text-text-tertiary">AI</span>
        </Link>
        <WorkspaceNav activeHref="/pricing" />
        <div className="-mr-4 flex items-center gap-1 sm:mr-0 sm:gap-2">
          <AnnouncementButton />
          <AccountMenu />
          <MobileWorkspaceMenu activeHref="/pricing" />
        </div>
      </div>
    </header>
  );
}

export default function PaymentSuccessPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#faf9f7] text-[#101827]">
        <AppHeader />
        <section className="mx-auto flex max-w-[760px] flex-col items-center px-5 py-20 text-center sm:px-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#ecfdf3] text-[#16a34a] shadow-[0_18px_50px_-30px_rgba(22,163,74,0.75)]">
            <CheckCircle2 className="h-11 w-11" />
          </div>
          <h1 className="mt-7 font-display text-4xl font-black tracking-tight sm:text-5xl">支付成功</h1>
          <p className="mt-4 max-w-[560px] text-base font-semibold leading-8 text-[#697080]">
            积分已到账，可以继续生成图片或在积分记录中查看充值明细。
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#101827] px-7 text-sm font-black text-white shadow-[0_18px_42px_-28px_rgba(16,24,39,0.85)] transition hover:bg-[#2b3344]" href="/image-editor">
              <WandSparkles className="h-4 w-4" />
              继续生成
            </Link>
            <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#e1dbd1] bg-white px-7 text-sm font-black text-[#101827] shadow-sm transition hover:bg-[#f3f4f6]" href="/credits?type=recharge">
              <Coins className="h-4 w-4" />
              查看充值记录
            </Link>
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
