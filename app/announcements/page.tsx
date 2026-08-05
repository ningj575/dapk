"use client";

import { AccountMenu } from "@/components/account-menu";
import { AnnouncementButton } from "@/components/announcement-button";
import { AuthGuard } from "@/components/auth-guard";
import { useAuthToken } from "@/components/auth-state";
import { MobileWorkspaceMenu, WorkspaceNav } from "@/components/workspace-nav";
import { Bell, Clock3 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ApiResponse<T> = { code: number; message: string; data: T };
type Announcement = {
  id: number;
  title: string;
  detail: string;
  content?: string;
  created_at: string;
  is_read?: boolean;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || "请求失败");
  return payload;
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
          <AnnouncementButton />
          <AccountMenu />
          <MobileWorkspaceMenu />
        </div>
      </div>
    </header>
  );
}

function formatTime(value: string) {
  const date = new Date(String(value || "").replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function AnnouncementsContent() {
  const token = useAuthToken();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnnouncements = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/announcements`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await readApi<{ announcements: Announcement[] }>(response);
      setRows(payload.data.announcements || []);
      await fetch(`${apiBase}/api/announcements/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "公告加载失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  return (
    <main className="min-h-screen bg-[#f4f7fa] px-5 py-8 text-[#101827] sm:px-8">
      <div className="mx-auto max-w-[1120px]">
        <section className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101827] text-white shadow-[0_16px_42px_-26px_rgba(16,24,39,0.65)]">
            <Bell className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">公告</h1>
            <p className="mt-1 text-sm font-medium text-[#697080]">查看系统通知、产品更新和重要提醒。</p>
          </div>
        </section>

        <section className="mt-8 rounded-[22px] border border-[#e5ded2] bg-white p-4 shadow-[0_22px_60px_-46px_rgba(16,24,39,0.5)] sm:p-6">
          {loading && <div className="rounded-2xl bg-[#f6f5f3] px-5 py-8 text-center text-sm font-medium text-[#697080]">公告加载中...</div>}
          {!loading && error && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className="rounded-2xl bg-[#f6f5f3] px-5 py-12 text-center text-sm font-medium text-[#697080]">暂无公告</div>
          )}
          {!loading && !error && rows.length > 0 && (
            <div className="space-y-4">
              {rows.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#e9e2d8] bg-[#fffdf9] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-extrabold text-[#101827]">{item.title}</h2>
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#8b93a1]">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatTime(item.created_at)}
                      </div>
                    </div>
                    {!item.is_read && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">未读</span>}
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-base font-normal leading-8 text-[#0d0d0d]">
                    {item.detail || item.content || ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AnnouncementsPage() {
  return (
    <AuthGuard>
      <AppHeader />
      <AnnouncementsContent />
    </AuthGuard>
  );
}
