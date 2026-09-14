"use client";

import { AccountMenu } from "@/components/account-menu";
import { AnnouncementButton } from "@/components/announcement-button";
import { MobileWorkspaceMenu, WorkspaceNav } from "@/components/workspace-nav";
import { AuthGuard } from "@/components/auth-guard";
import { notifyAuthChanged, type DakeUser, useAuthToken, useAuthUser } from "@/components/auth-state";
import {
  Check,
  CircleDollarSign,
  Coins,
  CreditCard,
  Crown,
  QrCode,
  Rocket,
  Sparkles,
  WandSparkles,
  X,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type CreditPackage = {
  key: string;
  name: string;
  points: number;
  price: string;
  original_price: string | null;
  save_text: string | null;
  badge: string | null;
  tone: "starter" | "basic" | "popular" | "pro" | "business";
  features: string[];
  is_experience?: boolean;
};

type PackagePayload = {
  user: DakeUser;
  has_recharged: boolean;
  packages: CreditPackage[];
  payment_methods: PaymentMethodInfo[];
  payment?: {
    method: PaymentMethod;
    mode: "pc" | "wap" | "native" | "jsapi" | "jsapi_oauth" | "support";
    order_no: string;
    pay_url?: string;
    code_url?: string;
    qr_code?: string;
    service_time?: string;
    title?: string;
    desc?: string;
  };
};

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

type PaymentMethod = "wechat" | "alipay" | "support";

type PaymentMethodInfo = {
  key: PaymentMethod;
  name: string;
  desc: string;
};

type RechargeOrderStatusPayload = {
  order_no: string;
  status: string;
  paid: boolean;
  points: number;
  amount: string;
  payment_method: string;
  paid_at?: string;
  user: DakeUser;
};

const navItems = [
  ["去水印", "/watermark-remover"],
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["视频生成", "/video-studio"],
  ["套餐", "/pricing"]
];

const toneStyles = {
  starter: {
    icon: Sparkles,
    iconClass: "bg-[#f3eefb] text-[#7b4bb2]",
    ring: "border-[#d8d1c6]",
    button: "bg-[#101827] hover:bg-[#2b3344]",
    badge: "bg-[#101827]",
    accent: "text-[#7b4bb2]"
  },
  basic: {
    icon: CircleDollarSign,
    iconClass: "bg-[#edf4fb] text-[#2772a7]",
    ring: "border-[#d8d1c6]",
    button: "bg-[#101827] hover:bg-[#2b3344]",
    badge: "bg-[#101827]",
    accent: "text-[#2772a7]"
  },
  popular: {
    icon: Zap,
    iconClass: "bg-[#f5ecfb] text-[#9d45b4]",
    ring: "border-[#101827]",
    button: "bg-[#101827] hover:bg-[#2b3344]",
    badge: "bg-[#101827]",
    accent: "text-[#8a3ba1]"
  },
  pro: {
    icon: Crown,
    iconClass: "bg-[#fff2df] text-[#d67a16]",
    ring: "border-[#d8d1c6]",
    button: "bg-[#101827] hover:bg-[#2b3344]",
    badge: "bg-[#101827]",
    accent: "text-[#b86410]"
  },
  business: {
    icon: Rocket,
    iconClass: "bg-[#edf1f4] text-[#596170]",
    ring: "border-[#d8d1c6]",
    button: "bg-[#101827] hover:bg-[#2b3344]",
    badge: "bg-[#101827]",
    accent: "text-[#596170]"
  }
} satisfies Record<CreditPackage["tone"], {
  icon: typeof Sparkles;
  iconClass: string;
  ring: string;
  button: string;
  badge: string;
  accent: string;
}>;

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function formatPoints(points: number) {
  return new Intl.NumberFormat("en-US").format(points);
}

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(value)}`;
}

function resolveMediaUrl(src?: string) {
  const value = String(src || "").trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${apiBase}${value.startsWith("/") ? value : `/${value}`}`;
}

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || "请求失败");
  }
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

function PaymentDialog({
  item,
  method,
  methods,
  paying,
  redirecting,
  onClose,
  onMethodChange,
  onConfirm
}: {
  item: CreditPackage | null;
  method: PaymentMethod;
  methods: PaymentMethodInfo[];
  paying: boolean;
  redirecting: boolean;
  onClose: () => void;
  onMethodChange: (method: PaymentMethod) => void;
  onConfirm: () => void;
}) {
  if (!item) return null;

  const methodIcons = {
    wechat: { icon: QrCode, iconClass: "text-[#06b48a]" },
    alipay: { icon: CreditCard, iconClass: "text-[#176bff]" },
    support: { icon: QrCode, iconClass: "text-[#101827]" }
  };

  return (
    <div data-testid="payment-dialog" className="fixed inset-0 z-[90] flex items-center justify-center bg-[#101827]/35 px-4 backdrop-blur-sm">
      <section className="w-full max-w-[440px] rounded-[8px] border border-[#e1dbd1] bg-[#f8fafb] p-6 shadow-[0_30px_90px_-45px_rgba(16,24,39,0.9)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#101827]">选择支付方式</h2>
            <p className="mt-2 text-sm font-semibold text-[#697080]">
              充值 {formatPoints(item.points)} 积分，支付金额 ¥{item.price}
            </p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#697080] transition hover:bg-[#eceff2] hover:text-[#101827]"
            aria-label="关闭"
            disabled={redirecting}
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {methods.map((payMethod) => {
            const Icon = methodIcons[payMethod.key]?.icon || QrCode;
            const selected = method === payMethod.key;
            return (
              <button
                key={payMethod.key}
                type="button"
                data-testid={`payment-${payMethod.key}`}
                className="flex h-[68px] w-full items-center gap-4 rounded-[7px] border border-[#e1e5e8] bg-[#f8fafb] px-4 text-left transition hover:border-[#cfd5db] hover:bg-white"
                disabled={redirecting}
                onClick={() => onMethodChange(payMethod.key)}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? "border-[#101827]" : "border-[#e6eaee]"}`}>
                  {selected && <span className="h-2 w-2 rounded-full bg-[#101827]" />}
                </span>
                <Icon className={`h-5 w-5 ${methodIcons[payMethod.key]?.iconClass || "text-[#101827]"}`} />
                <span>
                  <span className="block text-base font-extrabold text-[#101827]">{payMethod.name}</span>
                  <span className="mt-0.5 block text-sm font-semibold text-[#697080]">{payMethod.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="payment-cancel"
            className="h-10 rounded-[7px] border border-[#e1e5e8] bg-white text-sm font-extrabold text-[#374151] shadow-sm transition hover:bg-[#f3f4f6]"
            disabled={redirecting}
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            data-testid="payment-confirm"
            className="h-10 rounded-[7px] bg-[#101827] text-sm font-extrabold text-white shadow-sm transition hover:bg-[#2b3344] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={paying || redirecting}
            onClick={onConfirm}
          >
            {redirecting ? "正在跳转..." : paying ? "支付中..." : "确认支付"}
          </button>
        </div>

        {redirecting && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-[#697080]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d6dbe1] border-t-[#101827]" />
            正在打开支付页面，请稍候
          </div>
        )}
      </section>
    </div>
  );
}

function WechatNativeDialog({
  payment,
  token,
  onClose,
  onPaid
}: {
  payment: PackagePayload["payment"] | null;
  token: string | null;
  onClose: () => void;
  onPaid: (payload: RechargeOrderStatusPayload) => void;
}) {
  const codeUrl = payment?.code_url || payment?.pay_url || "";
  const orderNo = payment?.order_no || "";
  const [statusText, setStatusText] = useState("正在等待扫码支付结果");

  useEffect(() => {
    if (!codeUrl || !orderNo || !token) return;
    let stopped = false;

    async function checkOrderStatus() {
      try {
        const response = await fetch(`${apiBase}/api/packages/order-status?order_no=${encodeURIComponent(orderNo)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await readApi<RechargeOrderStatusPayload>(response);
        if (stopped) return;
        if (result.data.paid) {
          setStatusText("支付成功，正在跳转...");
          onPaid(result.data);
          window.setTimeout(() => {
            window.location.href = `/payment-success?type=recharge&order_no=${encodeURIComponent(result.data.order_no)}`;
          }, 500);
          return;
        }
        if (result.data.status === "failed") {
          setStatusText("订单已失效，请关闭后重新发起支付");
          return;
        }
        setStatusText("正在等待扫码支付结果");
      } catch {
        if (!stopped) {
          setStatusText("正在等待扫码支付结果");
        }
      }
    }

    void checkOrderStatus();
    const timer = window.setInterval(() => {
      void checkOrderStatus();
    }, 3000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [codeUrl, orderNo, token, onPaid]);

  if (!codeUrl) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#101827]/45 px-4 backdrop-blur-sm">
      <section className="w-full max-w-[420px] rounded-[10px] border border-[#e1dbd1] bg-white p-6 text-center shadow-[0_30px_90px_-45px_rgba(16,24,39,0.9)]">
        <button className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#697080] transition hover:bg-[#f0f2f4] hover:text-[#101827]" type="button" onClick={onClose} aria-label="关闭">
          <X className="h-5 w-5" />
        </button>
        <h2 className="mt-1 text-xl font-extrabold text-[#101827]">微信扫码支付</h2>
        <p className="mt-2 text-sm font-semibold text-[#697080]">请使用微信扫描二维码完成充值</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mx-auto mt-5 h-[260px] w-[260px] rounded-[8px] border border-[#e5e7eb] bg-white p-2" src={qrImageUrl(codeUrl)} alt="微信支付二维码" />
        <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-[#697080]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d6dbe1] border-t-[#101827]" />
          {statusText}
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-[#8a94a3]">支付成功后页面会自动跳转，请不要关闭当前窗口。</p>
      </section>
    </div>
  );
}

function SupportPaymentDialog({ payment, onClose }: { payment: PackagePayload["payment"] | null; onClose: () => void }) {
  if (payment?.mode !== "support") return null;
  const qrCode = resolveMediaUrl(payment.qr_code || "");
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#101827]/45 px-4 backdrop-blur-sm">
      <section className="w-full max-w-[420px] rounded-[10px] border border-[#e1dbd1] bg-white p-6 text-center shadow-[0_30px_90px_-45px_rgba(16,24,39,0.9)]">
        <button className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#697080] transition hover:bg-[#f0f2f4] hover:text-[#101827]" type="button" onClick={onClose} aria-label="关闭">
          <X className="h-5 w-5" />
        </button>
        <h2 className="mt-1 text-xl font-extrabold text-[#101827]">{payment.title || "联系客服充值"}</h2>
        <p className="mt-2 text-sm font-semibold text-[#697080]">{payment.desc || "请联系客服人工充值。"}</p>
        {qrCode ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="mx-auto mt-5 h-[220px] w-[220px] rounded-2xl border border-[#e9e1d7] bg-white p-2 shadow-sm" src={qrCode} alt="客服二维码" />
        ) : (
          <div className="mx-auto mt-5 flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-dashed border-[#d8d1c6] bg-[#faf9f7] px-4 text-sm font-bold text-[#697080]">
            暂未配置客服二维码
          </div>
        )}
        <p className="mt-4 text-xs font-semibold text-[#8a94a3]">服务时间：{payment.service_time || "9:00-22:00"}</p>
      </section>
    </div>
  );
}

function PricingContent() {
  const token = useAuthToken();
  const storedUser = useAuthUser();
  const [payload, setPayload] = useState<PackagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingKey, setPayingKey] = useState("");
  const [paymentRedirecting, setPaymentRedirecting] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wechat");
  const [nativePayment, setNativePayment] = useState<PackagePayload["payment"] | null>(null);
  const [supportPayment, setSupportPayment] = useState<PackagePayload["payment"] | null>(null);

  const user = payload?.user || storedUser;
  const balance = typeof user?.credits === "number" ? user.credits : 0;
  const paymentMethods = useMemo(() => payload?.payment_methods || [], [payload]);

  const fetchPackages = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/packages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await readApi<PackagePayload>(response);
      setPayload(result.data);
      window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
      notifyAuthChanged();
    } catch (event) {
      setError(event instanceof Error ? event.message : "套餐加载失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPackages();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPackages]);

  const packages = useMemo(() => {
    const rows = payload?.packages || [];
    const hasExperience = rows.some((item) => item.is_experience || item.key === "experience");
    return rows
      .filter((item) => !(hasExperience && (item.tone === "business" || item.key === "business" || item.key === "professional" || item.name.includes("专业"))))
      .slice(0, 4);
  }, [payload]);

  function openPaymentDialog(item: CreditPackage) {
    const firstMethod = paymentMethods[0]?.key;
    if (!firstMethod) {
      setError("暂无可用支付方式，请联系管理员");
      return;
    }
    setPaymentMethod(firstMethod);
    setSelectedPackage(item);
    setError("");
  }

  const handleWechatPaid = useCallback((order: RechargeOrderStatusPayload) => {
    window.localStorage.setItem("dake_user", JSON.stringify(order.user));
    notifyAuthChanged();
    setPayload((current) => current ? { ...current, user: order.user, has_recharged: true } : current);
  }, []);

  async function confirmPayment() {
    if (!token || !selectedPackage || payingKey || paymentRedirecting) return;
    setPayingKey(selectedPackage.key);
    setPaymentRedirecting(false);
    setError("");
    let redirectStarted = false;
    try {
      const response = await fetch(`${apiBase}/api/packages/purchase`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          package_key: selectedPackage.key,
          payment_method: paymentMethod
        })
      });
      const result = await readApi<PackagePayload>(response);
      const payment = result.data.payment;
      if (payment?.mode === "support") {
        setSupportPayment(payment);
        setSelectedPackage(null);
        setPayload(result.data);
        return;
      }
      if (payment?.method === "wechat" && (payment.code_url || payment.pay_url)) {
        setNativePayment({
          ...payment,
          mode: "native",
          code_url: payment.code_url || payment.pay_url
        });
        setSelectedPackage(null);
        setPaymentRedirecting(false);
        return;
      }
      if (payment?.mode === "native" && payment.code_url) {
        setNativePayment(payment);
        setSelectedPackage(null);
        return;
      }
      if (payment?.pay_url) {
        redirectStarted = true;
        setPaymentRedirecting(true);
        window.location.href = payment.pay_url;
        return;
      }
      setPayload(result.data);
      if (result.data.user) {
        window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
        notifyAuthChanged();
      }
      setSelectedPackage(null);
    } catch (event) {
      setError(event instanceof Error ? event.message : "充值失败");
      setPaymentRedirecting(false);
    } finally {
      if (!redirectStarted) {
        setPayingKey("");
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#101827]">
      <AppHeader />

      <section className="mx-auto max-w-[1440px] px-5 pb-16 pt-10 sm:px-8 lg:pt-12">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#101827] text-white shadow-[0_20px_50px_-28px_rgba(16,24,39,0.65)]">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 data-testid="pricing-title" className="mt-5 font-display text-4xl font-black tracking-tight text-[#101827] sm:text-5xl">积分充值</h1>
          <p className="mt-4 text-base font-semibold text-[#697080]">选择适合您的积分套餐，解锁更多AI图片处理功能</p>
        </div>

        <div data-testid="credit-balance" className="mx-auto mt-10 flex max-w-[520px] items-center justify-center gap-5 rounded-[18px] border border-[#ded8cd] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(16,24,39,0.04)]">
          <Coins className="h-6 w-6 text-[#596170]" />
          <span className="text-sm font-bold text-[#586272]">当前余额：</span>
          <strong className="font-display text-4xl font-black text-[#101827]">{formatPoints(balance)}</strong>
          <span className="text-base font-bold text-[#586272]">积分</span>
        </div>

        {error && (
          <div className="mx-auto mt-6 max-w-[520px] rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-16 text-center text-sm font-bold text-[#697080]">正在加载套餐...</div>
        ) : (
          <div className="mx-auto mt-10 grid max-w-[1440px] grid-cols-1 justify-center gap-6 sm:grid-cols-[repeat(auto-fit,minmax(276px,300px))]">
            {packages.map((item) => {
              const style = toneStyles[item.tone];
              const Icon = style.icon;
              const paying = payingKey === item.key;
              return (
                <article
                  key={item.key}
                  data-testid={`package-${item.key}`}
                  className={`relative mx-auto flex min-h-[424px] w-full max-w-[340px] flex-col rounded-[10px] border-2 ${style.ring} bg-white px-7 pb-7 pt-8 shadow-[0_2px_9px_rgba(16,24,39,0.08)] sm:max-w-none`}
                >
                  {item.badge && (
                    <div className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full ${style.badge} px-4 py-1.5 text-xs font-black text-white shadow-sm`}>
                      ✣ {item.badge}
                    </div>
                  )}
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${style.iconClass}`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="mt-8 text-center">
                    <h2 className="whitespace-nowrap font-display text-2xl font-black tracking-normal">
                      {formatPoints(item.points)} <span className="text-xl">积分</span>
                    </h2>
                    <div className="mt-6 flex items-end justify-center gap-2">
                      <span className="font-display text-3xl font-black">¥{item.price}</span>
                      {item.original_price && (
                        <span className="pb-1 text-sm font-bold text-[#777f8f] line-through">¥{item.original_price}</span>
                      )}
                    </div>
                    {item.save_text && <p className={`mt-4 text-sm font-black ${style.accent}`}>{item.save_text}</p>}
                  </div>

                  <ul className="mt-auto space-y-3 pt-10 text-sm font-semibold text-[#202837]">
                    {item.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className="h-4 w-4 shrink-0 text-[#596170]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className={`mt-6 h-11 rounded-md ${style.button} text-sm font-black text-white shadow-[0_10px_22px_-18px_rgba(16,24,39,0.8)] transition disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={Boolean(payingKey)}
                    data-testid={`purchase-${item.key}`}
                    onClick={() => openPaymentDialog(item)}
                  >
                    {paying ? "处理中..." : "立即充值"}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        <div className="mx-auto mt-10 flex max-w-[1120px] items-center justify-between gap-4 rounded-[14px] border border-[#e5ded2] bg-white px-5 py-4 text-sm font-semibold text-[#697080]">
          <span>套餐购买成功后积分会立即到账。</span>
          <Link className="inline-flex items-center gap-2 rounded-full bg-[#101827] px-4 py-2 text-xs font-black text-white" href="/credits?type=recharge">
            <Coins className="h-4 w-4" />
            查看充值记录
          </Link>
        </div>
      </section>

      <PaymentDialog
        item={selectedPackage}
        method={paymentMethod}
        methods={paymentMethods}
        paying={Boolean(payingKey)}
        redirecting={paymentRedirecting}
        onClose={() => {
          if (!paymentRedirecting) setSelectedPackage(null);
        }}
        onMethodChange={setPaymentMethod}
        onConfirm={() => void confirmPayment()}
      />
      <WechatNativeDialog
        payment={nativePayment}
        token={token}
        onClose={() => setNativePayment(null)}
        onPaid={handleWechatPaid}
      />
      <SupportPaymentDialog payment={supportPayment} onClose={() => setSupportPayment(null)} />
    </main>
  );
}

export default function PricingPage() {
  return (
    <AuthGuard>
      <PricingContent />
    </AuthGuard>
  );
}
