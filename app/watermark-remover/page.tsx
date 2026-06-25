"use client";

import { AccountMenu } from "@/components/account-menu";
import { AuthGuard } from "@/components/auth-guard";
import { notifyAuthChanged, refreshAuthUser, type DakeUser, useAuthToken, useAuthUser } from "@/components/auth-state";
import { downloadImage } from "@/lib/download-image";
import { AlertCircle, Download, ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

type ModelConfig = {
  module: string;
  model_name: string;
  provider: string;
  api_model: string;
  status: number;
  cost_auto: number;
  cost_1k: number;
  cost_2k: number;
  cost_3k: number;
  cost_4k: number;
  supported_resolutions?: string;
  resolutions?: string[];
};

type ImageTask = {
  id: number;
  task_index: number;
  task_id: string;
  status: string;
  image_url?: string;
  error_message?: string;
};

type TaskPayload = {
  id: number;
  status: string;
  done: boolean;
  images: string[];
  tasks: ImageTask[];
  cost_credits?: number;
  user?: DakeUser;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const navItems = [
  ["去水印", "/watermark-remover"],
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["套餐", "/pricing"]
];

function mediaUrl(src: string) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  return `${apiBase}${src.startsWith("/") ? src : `/${src}`}`;
}

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || "请求失败");
  return payload;
}

function configuredCost(config?: ModelConfig) {
  if (!config) return 30;
  return config.cost_auto || config.cost_2k || config.cost_1k || 30;
}

function defaultResolution(config?: ModelConfig) {
  const values = config?.resolutions?.length
    ? config.resolutions
    : String(config?.supported_resolutions || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  return values.includes("2K") ? "2K" : values[0] || "2K";
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e5ded2] bg-[#faf9f7]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link className="flex items-baseline gap-2" href="/">
          <span className="font-display text-xl font-extrabold tracking-tight">达客</span>
          <span className="text-xs font-medium text-text-tertiary">AI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(([label, href]) => (
            <Link key={label} href={href}>
              <span className={`inline-flex h-10 items-center whitespace-nowrap rounded-[14px] px-4 text-sm font-semibold transition ${href === "/watermark-remover" ? "bg-[#101827] text-white" : "text-[#5f6674] hover:bg-[#ede8df] hover:text-[#101827]"}`}>
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

function WatermarkRemoverContent() {
  const token = useAuthToken();
  const user = useAuthUser();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sourceImage, setSourceImage] = useState("");
  const [resultImage, setResultImage] = useState("");
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const activeConfig = modelConfigs[0];
  const modelName = activeConfig?.model_name || "Seedream-5.0";
  const resolution = defaultResolution(activeConfig);
  const cost = configuredCost(activeConfig);
  const insufficientCredits = typeof user?.credits === "number" && cost > Number(user?.credits || 0);
  const canGenerate = Boolean(sourceImage) && !generating && !insufficientCredits;

  useEffect(() => {
    if (!token) return;
    void refreshAuthUser(apiBase).catch(() => undefined);
  }, [token]);

  useEffect(() => {
    fetch(`${apiBase}/api/model-configs?module=watermark_remover`)
      .then((response) => response.json())
      .then((payload) => setModelConfigs(((payload?.data?.configs || []) as ModelConfig[]).filter(Boolean)))
      .catch(() => setModelConfigs([]));
  }, []);

  async function onFilesChange(files?: FileList | null) {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
    setSourceImage(dataUrl);
    setResultImage("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function pollTask(recordId: number) {
    const maxAttempts = 180;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const response = await fetch(`${apiBase}/api/image-task-status?id=${recordId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await readApi<TaskPayload>(response);
      if (result.data.user) {
        window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
        notifyAuthChanged();
      }
      const image = mediaUrl(result.data.images?.[0] || "");
      if (image) setResultImage(image);
      if (result.data.done) {
        const failed = (result.data.tasks || []).find((task) => task.status === "failed");
        if (!image) throw new Error(failed?.error_message || "去水印失败");
        return;
      }
    }
    throw new Error("去水印任务仍在处理中，请稍后到生成记录查看结果");
  }

  async function removeWatermark() {
    if (!sourceImage || !token || generating || insufficientCredits) return;
    setGenerating(true);
    setError("");
    setResultImage("");
    try {
      const response = await fetch(`${apiBase}/api/watermark-remove`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: sourceImage,
          model: modelName,
          resolution,
          ratio: "auto"
        })
      });
      const result = await readApi<TaskPayload>(response);
      if (result.data.user) {
        window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
        notifyAuthChanged();
      }
      await pollTask(result.data.id);
    } catch (event) {
      setError(event instanceof Error ? event.message : "去水印失败");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#101827]">
      <AppHeader />
      <section className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8">
        <div className="mx-auto mb-10 flex max-w-[860px] flex-col items-center text-center">
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-[#f2c15d] bg-[#fffaf0] px-4 text-sm font-extrabold text-[#c46a00]">
            <Sparkles className="h-4 w-4" />
            AI 去水印
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-[#101827] sm:text-6xl">去水印</h1>
          <p className="mt-6 max-w-[780px] text-base font-medium leading-8 text-[#5f6674] sm:text-lg">
            自动识别图片中的各种水印、文字、Logo，智能填充背景，不留痕迹。
          </p>
          <div className="mt-6 flex w-full max-w-[1056px] items-center gap-3 rounded-lg border border-[#f2c15d] bg-[#fffaf0] px-4 py-3 text-left text-sm font-extrabold text-[#d36a00]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>去水印图片仅临时展示，系统不会留存资源，为避免图片丢失，请立即下载至本地保存。</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.92fr)]">
          <section className="rounded-[30px] border border-[#ded8cd] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,39,0.03)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold">上传原图</h2>
                <p className="mt-1 text-sm text-[#697080]">点击上传需要去水印的图片。</p>
              </div>
              {sourceImage && (
                <button className="rounded-full p-2 text-[#697080] hover:bg-[#f0efec] hover:text-[#101827]" type="button" onClick={() => { setSourceImage(""); setResultImage(""); }}>
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={(event) => void onFilesChange(event.target.files)} />
            <button
              type="button"
              className="flex min-h-[420px] w-full items-center justify-center overflow-hidden rounded-[26px] border-2 border-dashed border-[#ded8cd] bg-[#f4f2ee] p-4 text-center transition hover:border-[#bfb6aa] hover:bg-[#f1eee8] sm:min-h-[520px]"
              onClick={() => inputRef.current?.click()}
            >
              {sourceImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sourceImage} alt="待去水印图片" className="max-h-[420px] w-full rounded-[20px] object-contain sm:max-h-[560px]" />
              ) : (
                <span className="flex flex-col items-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#808898] shadow-sm">
                    <Upload className="h-7 w-7" />
                  </span>
                  <span className="mt-5 text-base font-bold">上传要去水印的图片</span>
                  <span className="mt-2 text-sm font-semibold text-[#7a8190]">支持 JPG、PNG、WebP</span>
                </span>
              )}
            </button>
          </section>

          <section className="rounded-[30px] border border-[#ded8cd] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,39,0.03)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold">去水印结果</h2>
                <p className="mt-1 text-sm text-[#697080]">结果生成后会显示在这里。</p>
              </div>
              {resultImage && (
                <button className="studio-tool-btn" type="button" onClick={() => void downloadImage(resultImage, "dake-watermark-removed.png")}>
                  <Download className="h-4 w-4" />
                  下载
                </button>
              )}
            </div>
            <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-[26px] bg-[#f6f3ed] p-4 sm:min-h-[520px]">
              {generating ? (
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_18px_42px_-24px_rgba(16,24,39,0.55)]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </span>
                  <p className="mt-5 text-base font-extrabold">正在去除水印...</p>
                  <p className="mt-2 text-sm font-semibold text-[#697080]">图片处理通常需要几十秒，请耐心等待</p>
                </div>
              ) : resultImage ? (
                <button type="button" className="block w-full" onClick={() => setPreviewOpen(true)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resultImage} alt="去水印结果" className="max-h-[420px] w-full rounded-[20px] object-contain sm:max-h-[560px]" />
                </button>
              ) : (
                <div className="flex flex-col items-center text-center text-[#8f97a5]">
                  <ImagePlus className="h-12 w-12" />
                  <p className="mt-5 max-w-[320px] text-sm font-semibold leading-7">上传图片后点击立即去水印，处理结果会出现在这里。</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-[#ded8cd] bg-white p-5">
          <button
            data-testid="watermark-remove-button"
            type="button"
            className="press-scale flex h-14 w-full items-center justify-center gap-2 rounded-[1.4rem] border border-[#172033] bg-[#101827] text-base font-bold text-[#f8f4ee] shadow-[0_14px_30px_-14px_rgba(16,24,39,0.38)] transition hover:-translate-y-px disabled:border-[#d7d2c7] disabled:bg-[#e7e2d9] disabled:text-[#8b8478]"
            disabled={!canGenerate}
            onClick={() => void removeWatermark()}
          >
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {generating ? "处理中..." : "立即去水印"}
          </button>
          <p className="mt-3 text-center text-sm font-semibold text-[#697080]">{sourceImage ? `本次预计消耗 ${cost} 积分` : "请先上传要去水印的图片"}</p>
          {insufficientCredits && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              积分不足
              <Link className="ml-3 font-bold underline underline-offset-4" href="/pricing">购买积分</Link>
            </div>
          )}
          {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        </section>
      </section>

      {previewOpen && resultImage && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07101f]/75 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="relative flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e7ecf0] px-5 py-4">
              <p className="text-sm font-bold text-[#5f6674]">去水印结果预览</p>
              <div className="flex items-center gap-2">
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101827] text-white transition hover:bg-black" type="button" onClick={() => void downloadImage(resultImage, "dake-watermark-removed.png")} aria-label="下载图片">
                  <Download className="h-4 w-4" />
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2f5] text-[#5f6674] hover:text-[#101827]" type="button" onClick={() => setPreviewOpen(false)} aria-label="关闭">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f4f8fb] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="max-h-[76vh] w-auto max-w-full rounded-2xl object-contain shadow-sm" src={resultImage} alt="去水印结果预览" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function WatermarkRemoverPage() {
  return (
    <AuthGuard>
      <WatermarkRemoverContent />
    </AuthGuard>
  );
}
