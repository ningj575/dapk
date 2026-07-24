"use client";

import { AccountMenu } from "@/components/account-menu";
import { MobileWorkspaceMenu, WorkspaceNav } from "@/components/workspace-nav";
import { AuthGuard } from "@/components/auth-guard";
import { useAuthToken } from "@/components/auth-state";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Coins, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type ApiResponse<T> = { code: number; message: string; data: T };
type LogType = "all" | "consume" | "recharge" | "refund";
type CreditLog = {
  id: number;
  type: LogType;
  title: string;
  remark: string;
  change_amount: number;
  before_credits: number;
  after_credits: number;
  created_at: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const navItems = [
  ["去水印", "/watermark-remover"],
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["视频生成", "/video-studio"],
  ["套餐", "/pricing"]
];

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || "请求失败");
  return payload;
}

function parseLogType(value: string | null): LogType {
  return value === "consume" || value === "recharge" || value === "refund" ? value : "all";
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e5ded2] bg-[#faf9f7]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link className="flex items-baseline gap-2" href="/">
          <span className="font-display text-xl font-extrabold tracking-tight">Xinglu</span>
          <span className="text-xs font-medium text-text-tertiary">AI</span>
        </Link>
        <WorkspaceNav />
        <div className="-mr-4 flex items-center gap-1 sm:mr-0 sm:gap-2">
          <AccountMenu />
          <MobileWorkspaceMenu />
        </div>
      </div>
    </header>
  );
}

function formatTime(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function displayCreditRemark(remark: string) {
  const text = String(remark || "").trim();
  if (text === "Image generation task") return "AI生图消耗";
  if (/Watermark/i.test(text)) return "去水印消耗";
  if (/Universal image/i.test(text)) return "万能生图消耗";
  if (/Main image/i.test(text)) return "主图生成消耗";
  if (/Detail image/i.test(text)) return "详情图生成消耗";
  if (/Video/i.test(text)) return "视频生成消耗";
  if (/^视频生成消耗/u.test(text)) return "视频生成消耗";
  if (/^视频生成失败退回/u.test(text)) return "视频生成失败退回";
  return text;
}

function displayCreditTitle(log: CreditLog) {
  const remark = displayCreditRemark(log.remark);
  if (remark.includes("去水印")) return "去水印";
  if (remark.includes("主图")) return "主图生成";
  if (remark.includes("详情")) return "详情图生成";
  if (remark.includes("万能")) return "万能生图";
  if (remark.includes("视频")) return "视频生成";
  return log.title === "场景图生成" ? "AI生图" : log.title;
}

function isRefundLog(log: CreditLog) {
  const text = `${log.type || ""} ${log.remark || ""} ${log.title || ""}`;
  return log.type === "refund" || /退|失败退回|refund/i.test(text);
}

function rechargePackageName(log: CreditLog) {
  if (log.type !== "recharge") return "";
  return String(log.remark || "")
    .replace(/^前台套餐充值[：:\s-]*/u, "")
    .replace(/^套餐充值[：:\s-]*/u, "")
    .trim();
}

function CreditContent() {
  const token = useAuthToken();
  const searchParams = useSearchParams();
  const routeType = parseLogType(searchParams.get("type"));
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [type, setType] = useState<LogType>(routeType);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    const nextType = parseLogType(searchParams.get("type"));
    setType(nextType);
    setPage(1);
  }, [searchParams]);

  const fetchLogs = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), type });
      const response = await fetch(`${apiBase}/api/credit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal
      });
      const result = await readApi<{ logs: CreditLog[]; total: number }>(response);
      setLogs(result.data.logs || []);
      setTotal(result.data.total || 0);
    } catch (event) {
      if (event instanceof Error && event.name === "AbortError") return;
      setError(event instanceof Error ? event.message : "积分记录加载失败");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [page, token, type]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void fetchLogs(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [fetchLogs]);

  const tabs = useMemo(() => [
    ["all", "全部", null],
    ["consume", "消费", ArrowUpRight],
    ["recharge", "充值", ArrowDownLeft],
    ["refund", "退还", RotateCcw]
  ] as const, []);

  return (
    <main className="min-h-screen bg-[#f4f8fb] text-[#101827]">
      <AppHeader />
      <section className="mx-auto max-w-[760px] px-4 py-8">
        <div className="rounded-xl border border-[#dfe5ea] bg-white p-6 shadow-[0_12px_34px_-28px_rgba(16,24,39,0.45)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101827] text-white shadow-sm">
              <Coins className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-black">积分记录</h1>
          </div>
          <p className="mt-2 text-sm text-[#5f6674]">查看您的积分消费、充值和退还记录</p>

          <div className="mt-6 grid grid-cols-4 gap-1 rounded-lg bg-[#eef2f5] p-1">
            {tabs.map(([key, label, Icon]) => (
              <button key={key} className={`flex h-8 items-center justify-center gap-2 rounded-md text-sm font-bold transition ${type === key ? "bg-white text-[#101827] shadow-sm" : "text-[#4f5968] hover:text-[#101827]"}`} type="button" onClick={() => { setType(key); setPage(1); }}>
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {label}
              </button>
            ))}
          </div>

          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</div>}

          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="py-12 text-center text-base font-normal text-[#0d0d0d]">正在加载积分记录...</div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-base font-normal text-[#0d0d0d]">暂无积分记录</div>
            ) : logs.map((log) => {
              const positive = log.change_amount > 0;
              const Icon = positive ? ArrowDownLeft : ArrowUpRight;
              const packageName = rechargePackageName(log);
              return (
                <article key={log.id} className="flex items-center justify-between gap-4 rounded-lg border border-[#e5eaf0] bg-white px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="min-w-0 truncate text-base font-normal text-[#0d0d0d]">
                          {displayCreditTitle(log)}
                          {packageName && <span className="ml-1 text-xs text-[#697080]">（{packageName}）</span>}
                        </h2>
                        {isRefundLog(log) && <span className="rounded-full border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">退还</span>}
                      </div>
                      <p className="mt-1 text-sm font-normal text-[#697080]">{formatTime(log.created_at)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-base font-normal ${positive ? "text-emerald-600" : "text-rose-500"}`}>{positive ? "+" : ""}{log.change_amount}</p>
                    <p className="mt-1 text-base font-normal text-[#0d0d0d]">余额 {log.after_credits}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-center gap-4 text-sm">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe5ea] bg-white disabled:opacity-40" disabled={page <= 1} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-base font-normal text-[#0d0d0d]">{page} / {totalPages}</span>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe5ea] bg-white disabled:opacity-40" disabled={page >= totalPages} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-xs text-[#5f6674]">共 {total} 条</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function CreditsPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<main className="min-h-screen bg-[#f4f8fb]" />}>
        <CreditContent />
      </Suspense>
    </AuthGuard>
  );
}
