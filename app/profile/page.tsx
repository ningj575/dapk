"use client";

import { AccountMenu } from "@/components/account-menu";
import { AuthGuard } from "@/components/auth-guard";
import { notifyAuthChanged, type DakeUser, useAuthToken, useAuthUser } from "@/components/auth-state";
import { CalendarDays, Check, Circle, Mail, Pencil, UserRound, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

const navItems = [
  ["去水印", "/watermark-remover"],
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["视频生成", "/video-studio"],
  ["套餐", "/pricing"]
];

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || "请求失败");
  }
  return payload;
}

function formatDate(value?: string | null) {
  if (!value) return "暂无";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e5ded2] bg-[#faf9f7]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link className="flex items-baseline gap-2" href="/">
          <span className="font-display text-xl font-extrabold tracking-tight">Xinglu</span>
          <span className="text-xs font-medium text-text-tertiary">AI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(([label, href]) => (
            <Link key={label} href={href}>
              <span className="inline-flex h-10 items-center whitespace-nowrap rounded-[14px] px-4 text-sm font-semibold text-[#5f6674] transition hover:bg-[#ede8df] hover:text-[#101827]">
                {label}
              </span>
            </Link>
          ))}
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
}

function InfoRow({
  label,
  icon,
  children,
  helper
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  helper?: string;
}) {
  return (
    <div className="border-b border-[#e5e0d8] pb-6 last:border-b-0 last:pb-0">
      <label className="block text-sm font-extrabold text-[#101827]">{label}</label>
      <div className="mt-3 flex min-h-10 items-center gap-2 text-base font-semibold text-[#101827]">
        {icon}
        {children}
      </div>
      {helper && <p className="mt-2 text-xs font-semibold text-[#697080]">{helper}</p>}
    </div>
  );
}

function ProfileContent() {
  const token = useAuthToken();
  const storedUser = useAuthUser();
  const [user, setUser] = useState<DakeUser | null>(storedUser);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(storedUser?.nickname || storedUser?.email?.split("@")[0] || "");
  const [saving, setSaving] = useState(false);

  const displayName = user?.nickname || user?.email?.split("@")[0] || "Xinglu用户";
  const email = user?.email || "暂无邮箱";
  const isActive = Number(user?.status ?? 1) === 1;

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await readApi<{ user: DakeUser }>(response);
      setUser(result.data.user);
      setNickname(result.data.user.nickname || result.data.user.email?.split("@")[0] || "");
      window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
      notifyAuthChanged();
    } catch (event) {
      setError(event instanceof Error ? event.message : "个人信息加载失败");
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchProfile();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchProfile]);

  async function saveNickname() {
    if (!token || saving) return;
    const nextName = nickname.trim();
    if (!nextName) {
      setError("用户名不能为空");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/user/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nickname: nextName })
      });
      const result = await readApi<{ user: DakeUser }>(response);
      setUser(result.data.user);
      setNickname(result.data.user.nickname || nextName);
      setEditing(false);
      window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
      notifyAuthChanged();
    } catch (event) {
      setError(event instanceof Error ? event.message : "用户名保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8fa] text-[#101827]">
      <AppHeader />
      <section className="mx-auto max-w-[920px] px-5 py-8 sm:px-8">
        <div>
          <h1 data-testid="profile-title" className="text-4xl font-black tracking-tight">个人中心</h1>
          <p className="mt-3 text-base font-semibold text-[#4f5968]">查看和管理您的个人信息</p>
        </div>

        {error && (
          <div className="mt-6 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {error}
          </div>
        )}

        <section data-testid="profile-basic" className="mt-8 rounded-[10px] border border-[#dce1e5] bg-white p-6 shadow-[0_1px_4px_rgba(16,24,39,0.08)]">
          <h2 className="text-xl font-extrabold">基本信息</h2>
          <p className="mt-2 text-sm font-semibold text-[#697080]">您的账户基本信息</p>

          <div className="mt-7 space-y-6">
            <InfoRow label="用户名" icon={<UserRound className="h-4 w-4 shrink-0 text-[#667085]" />}>
              {editing ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    data-testid="nickname-input"
                    className="h-10 flex-1 rounded-[6px] border border-[#dce1e5] bg-white px-3 text-base font-semibold outline-none transition focus:border-[#101827] focus:ring-4 focus:ring-[#101827]/5"
                    value={nickname}
                    maxLength={30}
                    onChange={(event) => setNickname(event.target.value)}
                  />
                  <button
                    type="button"
                    data-testid="save-nickname"
                    className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#101827] text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={() => void saveNickname()}
                    aria-label="保存用户名"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-[#dce1e5] bg-white text-[#596170]"
                    onClick={() => {
                      setNickname(displayName);
                      setEditing(false);
                    }}
                    aria-label="取消编辑"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-between gap-3">
                  <span className="truncate">{displayName}</span>
                  <button
                    type="button"
                    data-testid="edit-nickname"
                    className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[#dce1e5] bg-white px-4 text-sm font-extrabold text-[#101827] shadow-sm"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    编辑
                  </button>
                </div>
              )}
            </InfoRow>

            <InfoRow label="邮箱" icon={<Mail className="h-4 w-4 shrink-0 text-[#667085]" />} helper="邮箱地址不可修改">
              <span className="truncate">{email}</span>
            </InfoRow>

            <InfoRow label="注册时间" icon={<CalendarDays className="h-4 w-4 shrink-0 text-[#667085]" />}>
              <span>{formatDate(user?.created_at)}</span>
            </InfoRow>
          </div>
        </section>

        <section data-testid="profile-status" className="mt-6 rounded-[10px] border border-[#dce1e5] bg-white p-6 shadow-[0_1px_4px_rgba(16,24,39,0.08)]">
          <h2 className="text-xl font-extrabold">账户状态</h2>
          <p className="mt-2 text-sm font-semibold text-[#697080]">您的账户当前状态</p>
          <div className="mt-7 flex items-center gap-2 text-base font-extrabold">
            <Circle className={`h-3 w-3 fill-current ${isActive ? "text-[#19c05f]" : "text-red-500"}`} />
            <span className={isActive ? "text-[#13a151]" : "text-red-600"}>{isActive ? "账户正常" : "账户已停用"}</span>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
