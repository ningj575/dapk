"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyAuthChanged } from "@/components/auth-state";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
};

export function LoginDialog({ open, onOpenChange, redirectTo = "/image-editor" }: LoginDialogProps) {
  const [view, setView] = useState<"login" | "register" | "forgot">("login");
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "info">("info");
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  function saveAuth(token: string, user: unknown) {
    window.localStorage.setItem("dake_token", token);
    window.localStorage.setItem("dake_user", JSON.stringify(user));
    notifyAuthChanged();
  }

  function enterWorkspace(token: string, user: unknown) {
    saveAuth(token, user);
    handleOpenChange(false);
    router.push(redirectTo);
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen && typeof window !== "undefined") {
      window.setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 0);
    }
  }

  async function requestApi(path: string, body: Record<string, string>) {
    const response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.code !== 0) {
      throw new Error(payload?.message || "请求失败，请稍后重试");
    }
    return payload.data;
  }

  function switchView(nextView: "login" | "register" | "forgot") {
    setView(nextView);
    setCodeSent(false);
    setCode("");
    setDevCode("");
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setMessageType("info");
    setRedirecting(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function sendCode() {
    setMessage("");
    setMessageType("info");
    setDevCode("");
    setLoading(true);
    try {
      const data = await requestApi(view === "forgot" ? "/api/auth/send-reset-code" : "/api/auth/send-code", { email });
      setCodeSent(true);
      setDevCode(data?.dev_code || "");
      setMessage("验证码已发送到你的邮箱。");
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证码发送失败");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function submitAuth() {
    setMessage("");
    setMessageType("info");
    if ((view === "register" || view === "forgot") && password.length < 6) {
      setMessage("密码至少需要 6 位");
      setMessageType("error");
      return;
    }
    if (view === "forgot" && password !== confirmPassword) {
      setMessage("两次输入的新密码不一致");
      setMessageType("error");
      return;
    }
    setLoading(true);
    try {
      if (view === "forgot") {
        await requestApi("/api/auth/reset-password", { email, password, code, confirm_password: confirmPassword });
        switchView("login");
        setMessage("密码已重置，请使用新密码登录");
        setMessageType("success");
        return;
      }
      const data = view === "login"
        ? await requestApi("/api/auth/login", { email, password })
        : await requestApi("/api/auth/register", { email, password, code });
      if (view === "register") {
        saveAuth(data.token, data.user);
        setMessage("注册成功，即将进入工作台...");
        setMessageType("success");
        setRedirecting(true);
        window.setTimeout(() => {
          handleOpenChange(false);
          router.push(redirectTo);
        }, 2000);
        return;
      }
      enterWorkspace(data.token, data.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-[#101827]/45 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[calc(100vw-2rem)] max-w-[430px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/70 bg-[#fbfaf7] p-0 shadow-[0_30px_90px_-35px_rgba(16,24,39,0.55)] outline-none data-[state=open]:animate-fade-in">
          <div className="relative border-b border-[#ebe5dc] px-7 pb-6 pt-7">
            <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-teal-300/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 top-8 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl" />
            <button
              className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[#687083] transition hover:bg-[#ece7de] hover:text-[#101827]"
              aria-label="关闭登录弹窗"
              type="button"
              onClick={() => handleOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <Dialog.Title className="relative pr-12 font-display text-[1.7rem] font-extrabold tracking-tight text-[#101827]">
              {view === "login" ? "邮箱登录" : view === "register" ? "邮箱注册" : "重置密码"}
            </Dialog.Title>
            <Dialog.Description className="relative mt-2 text-sm leading-6 text-[#6f7480]">
              {view === "login" ? "使用邮箱和密码进入电商生图工作台。" : view === "register" ? "使用邮箱、密码和邮箱验证码完成注册。" : "输入邮箱验证码和新密码，完成密码重置。"}
            </Dialog.Description>
          </div>

          <div className="px-7 py-6">
            {view !== "forgot" && <div className="mb-5 grid grid-cols-2 rounded-[17px] bg-[#eee9df] p-1">
              <button
                type="button"
                className={`flex h-10 items-center justify-center gap-2 rounded-[14px] text-sm font-semibold transition ${
                  view === "login" ? "bg-white text-[#101827] shadow-sm" : "text-[#727987] hover:text-[#101827]"
                }`}
                onClick={() => switchView("login")}
              >
                <Mail className="h-4 w-4" />
                邮箱登录
              </button>
              <button
                type="button"
                className={`flex h-10 items-center justify-center gap-2 rounded-[14px] text-sm font-semibold transition ${
                  view === "register" ? "bg-white text-[#101827] shadow-sm" : "text-[#727987] hover:text-[#101827]"
                }`}
                onClick={() => switchView("register")}
              >
                <ShieldCheck className="h-4 w-4" />
                邮箱注册
              </button>
            </div>}

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitAuth();
              }}
            >
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#717786]">邮箱地址</span>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#ddd6ca] bg-white px-4 shadow-[0_1px_2px_rgba(16,24,39,0.03)] focus-within:border-[#101827]">
                  <Mail className="h-4 w-4 text-[#9aa0aa]" />
                  <input
                    required
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a3a8b2]"
                    placeholder="name@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#717786]">{view === "forgot" ? "新密码" : "登录密码"}</span>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#ddd6ca] bg-white px-4 shadow-[0_1px_2px_rgba(16,24,39,0.03)] focus-within:border-[#101827]">
                  <LockKeyhole className="h-4 w-4 text-[#9aa0aa]" />
                  <input
                    required
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a3a8b2]"
                    minLength={view === "login" ? undefined : 6}
                    placeholder={view === "forgot" ? "请输入至少 6 位新密码" : "请输入密码"}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button className="text-[#a3a8b2] transition hover:text-[#101827]" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {view === "forgot" && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-[#717786]">确认新密码</span>
                  <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#ddd6ca] bg-white px-4 shadow-[0_1px_2px_rgba(16,24,39,0.03)] focus-within:border-[#101827]">
                    <LockKeyhole className="h-4 w-4 text-[#9aa0aa]" />
                    <input
                      required
                      minLength={6}
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a3a8b2]"
                      placeholder="请再次输入新密码"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <button className="text-[#a3a8b2] transition hover:text-[#101827]" type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "隐藏确认密码" : "显示确认密码"}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
              )}

              {(view === "register" || view === "forgot") && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-[#717786]">邮箱验证码</span>
                  <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#ddd6ca] bg-white px-4 shadow-[0_1px_2px_rgba(16,24,39,0.03)] focus-within:border-[#101827]">
                    <ShieldCheck className="h-4 w-4 text-[#9aa0aa]" />
                    <input
                      required
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a3a8b2]"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="请输入 6 位验证码"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                    />
                    <button
                      className="shrink-0 rounded-full border border-[#ded8cd] bg-[#f6f5f3] px-3 py-1.5 text-xs font-bold text-[#101827] transition hover:bg-[#ece7de]"
                      type="button"
                      disabled={loading || !email}
                      onClick={sendCode}
                    >
                      {loading ? "发送中" : codeSent ? "已发送" : "获取验证码"}
                    </button>
                  </div>
                  {codeSent && <p className="mt-2 text-xs font-medium text-teal-700">验证码已发送到你的邮箱。{devCode && `本地调试验证码：${devCode}`}</p>}
                </label>
              )}

              {view === "login" && <div className="flex items-center justify-between text-xs text-[#777d8a]">
                <label className="flex items-center gap-2">
                  <input className="h-4 w-4 rounded border-[#d9d1c5] accent-[#101827]" type="checkbox" />
                  记住我
                </label>
                <button type="button" className="font-semibold text-[#101827] hover:underline" onClick={() => switchView("forgot")}>
                  忘记密码？
                </button>
              </div>}

              <button
                type="submit"
                disabled={loading || redirecting}
                className="press-scale flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#171d2a] bg-[#101827] text-sm font-semibold text-[#f8f4ee] shadow-[0_2px_8px_rgba(16,24,39,0.08),0_18px_40px_-16px_rgba(16,24,39,0.42)] transition hover:-translate-y-px hover:bg-[#151f31]"
              >
                {loading || redirecting ? "处理中..." : view === "login" ? "进入工作台" : view === "register" ? "注册并进入工作台" : "重置密码"}
                <ArrowRight className="h-4 w-4" />
              </button>

              {message && (
                <p
                  className={`rounded-2xl border px-3 py-2 text-center text-xs font-semibold ${
                    messageType === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : messageType === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-[#e9e1d7] bg-[#f6f5f3] text-[#697080]"
                  }`}
                >
                  {message}
                </p>
              )}

              <button
                className="w-full text-center text-xs font-semibold text-[#697080] transition hover:text-[#101827]"
                type="button"
                onClick={() => switchView(view === "login" ? "register" : "login")}
              >
                {view === "login" ? "没有账号？立即注册" : view === "register" ? "已有账号？返回邮箱登录" : "想起密码？返回邮箱登录"}
              </button>
            </form>

            <div className="mt-5 rounded-2xl border border-[#e9e1d7] bg-white/65 p-4">
              {["注册送体验积分", "支持淘宝/天猫/京东/Amazon 模板", "可免费去除水印、生成电商主图与详情图"].map((item) => (
                <div key={item} className="flex items-center gap-2 py-1 text-xs font-medium text-[#666d7c]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
