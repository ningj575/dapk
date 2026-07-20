"use client";

import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Download,
  Film,
  History,
  ImagePlus,
  Images,
  Layers3,
  Loader2,
  Play,
  RefreshCcw,
  Sparkles,
  Video,
  WandSparkles,
  X,
  Zap
} from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { AccountMenu } from "@/components/account-menu";
import { notifyAuthChanged, useAuthToken } from "@/components/auth-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Mode = "one-click-2" | "first-last-2" | "video-rep-4";
type ResultTab = "result" | "videos" | "assets";
type UploadPreview = {
  id: string;
  src: string;
  name: string;
  video: boolean;
};
type VideoJob = {
  id: string;
  status: "generating" | "complete" | "failed";
  title: string;
  meta: string;
  mode: Mode;
  src: string;
  poster: string;
  progress?: number;
  cost_credits?: number;
  error_message?: string;
};
type VideoModelConfig = {
  mode: Mode;
  model_name: string;
  provider: string;
  api_model: string;
  ratios: string[];
  resolutions: string[];
  durations: string[];
  costs: Record<string, Record<string, number>>;
};
type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};
type VideoGeneratePayload = {
  record: VideoJob;
  cost_credits: number;
  user: unknown;
};
type VideoRecordsPayload = {
  records: VideoJob[];
};
type VideoTaskStatusPayload = {
  record: VideoJob;
};
type VideoAssetsPayload = {
  assets: UploadPreview[];
};
type VideoModelConfigsPayload = {
  configs: VideoModelConfig[];
};
type ReferenceImagesPayload = {
  images: Array<{ path: string; url: string }>;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || "请求失败");
  }
  return payload;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function uploadVideoImageAssets(assets: Array<UploadPreview & { role?: string }>, token: string) {
  const dataImages = assets.filter((asset) => !asset.video && asset.src.startsWith("data:image/"));
  if (dataImages.length === 0) return assets;
  const response = await fetch(`${apiBase}/api/reference-images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ images: dataImages.map((asset) => asset.src) })
  });
  const result = await readApi<ReferenceImagesPayload>(response);
  const uploaded = result.data.images || [];
  let uploadIndex = 0;
  return assets.map((asset) => {
    if (asset.video || !asset.src.startsWith("data:image/")) return asset;
    const item = uploaded[uploadIndex++];
    return item?.url ? { ...asset, src: item.url } : asset;
  });
}

const navItems = [
  ["去水印", "/watermark-remover"],
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["视频生成", "/video-studio"],
  ["套餐", "/pricing"]
];

const modes = [
  { key: "one-click-2", label: "一键生成", hint: "产品图智能生成", icon: WandSparkles },
  { key: "first-last-2", label: "首尾帧", hint: "首帧 + 尾帧", icon: Layers3 },
  { key: "video-rep-4", label: "视频复刻", hint: "参考视频", icon: Video }
] as const;

const templateTabs = [
  { key: "video-rep-4", label: "视频复刻", hint: "参考视频", result: "复刻结果视频", poster: "https://shopix-ai.company/video-demo/fashion-result-poster.jpg", video: "https://shopix-ai.company/video-demo/fashion-result.mp4" },
  { key: "one-click-2", label: "一键生成", hint: "三图成片", result: "面包包佩戴视频", poster: "https://shopix-ai.company/video-demo/bread-demo-poster.jpg", video: "https://shopix-ai.company/video-demo/bread-demo-result.mp4" },
  { key: "first-last-2", label: "首尾帧", hint: "首帧 + 尾帧", result: "精华液首尾帧视频", poster: "https://shopix-ai.company/video-demo/serum-first-frame.jpg", video: "https://shopix-ai.company/video-demo/serum-first-last-result.mp4" }
] as const;

const breadImages = [
  ["https://shopix-ai.company/video-demo/bread-bag-front.jpg", "正面佩戴图"],
  ["https://shopix-ai.company/video-demo/bread-bag-open.jpg", "收纳细节图"],
  ["https://shopix-ai.company/video-demo/bread-plush-pair.jpg", "材质近景图"]
];

export default function VideoStudioPage() {
  const token = useAuthToken();
  const savedAssetKeys = useRef<Set<string>>(new Set());
  const [showTemplates, setShowTemplates] = useState(false);
  const [mode, setMode] = useState<Mode>("one-click-2");
  const [tab, setTab] = useState<ResultTab>("result");
  const [phase, setPhase] = useState<"idle" | "analyzing" | "generating" | "complete">("idle");
  const [prompts, setPrompts] = useState<Record<Mode, string>>({
    "one-click-2": "",
    "first-last-2": "",
    "video-rep-4": ""
  });
  const [model, setModel] = useState("Sora2");
  const [ratio, setRatio] = useState("9:16");
  const [duration, setDuration] = useState("5s");
  const [resolution, setResolution] = useState("720p");
  const [videoConfigs, setVideoConfigs] = useState<VideoModelConfig[]>([]);
  const [oneClickAssets, setOneClickAssets] = useState<UploadPreview[]>([]);
  const [firstFrameAssets, setFirstFrameAssets] = useState<UploadPreview[]>([]);
  const [lastFrameAssets, setLastFrameAssets] = useState<UploadPreview[]>([]);
  const [repProductAssets, setRepProductAssets] = useState<UploadPreview[]>([]);
  const [repVideoAssets, setRepVideoAssets] = useState<UploadPreview[]>([]);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [lastGenerated, setLastGenerated] = useState<VideoJob | null>(null);
  const [serverAssets, setServerAssets] = useState<UploadPreview[]>([]);
  const [error, setError] = useState("");
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [videoConfigLoaded, setVideoConfigLoaded] = useState(false);

  const prompt = prompts[mode] || "";
  const setPrompt = useCallback((value: string) => {
    setPrompts((current) => ({ ...current, [mode]: value }));
  }, [mode]);

  const activeVideoConfig = useMemo(
    () => videoConfigs.find((config) => config.mode === mode && config.model_name === model) || videoConfigs.find((config) => config.mode === mode),
    [mode, model, videoConfigs]
  );

  const visibleModes = useMemo(() => {
    if (!videoConfigLoaded) return [...modes];
    const enabledModes = new Set(videoConfigs.map((config) => config.mode));
    return modes.filter((item) => enabledModes.has(item.key));
  }, [videoConfigLoaded, videoConfigs]);

  const modelOptions = useMemo(() => videoConfigs.filter((config) => config.mode === mode).map((config) => config.model_name), [mode, videoConfigs]);
  const ratioOptions = activeVideoConfig?.ratios?.length ? activeVideoConfig.ratios : ["9:16", "16:9", "1:1"];
  const resolutionOptions = activeVideoConfig?.resolutions?.length ? activeVideoConfig.resolutions : ["720p", "1080p"];
  const durationOptions = activeVideoConfig?.durations?.length ? activeVideoConfig.durations : ["5s", "8s", "10s"];
  const cost = activeVideoConfig?.costs?.[resolution]?.[duration] ?? 300;

  const localUploadedAssets = useMemo(
    () => [...oneClickAssets, ...firstFrameAssets, ...lastFrameAssets, ...repProductAssets, ...repVideoAssets],
    [firstFrameAssets, lastFrameAssets, oneClickAssets, repProductAssets, repVideoAssets]
  );

  const uploadedAssets = useMemo(() => {
    const known = new Set<string>();
    return [...localUploadedAssets, ...serverAssets].filter((asset) => {
      const key = `${asset.name}-${asset.src.slice(0, 80)}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
  }, [localUploadedAssets, serverAssets]);

  const localAssetsWithRoles = useMemo(() => [
    ...oneClickAssets.map((asset) => ({ ...asset, mode: "one-click-2", role: "one_click_image" })),
    ...firstFrameAssets.map((asset) => ({ ...asset, mode: "first-last-2", role: "first_frame" })),
    ...lastFrameAssets.map((asset) => ({ ...asset, mode: "first-last-2", role: "last_frame" })),
    ...repProductAssets.map((asset) => ({ ...asset, mode: "video-rep-4", role: "rep_product" })),
    ...repVideoAssets.map((asset) => ({ ...asset, mode: "video-rep-4", role: "rep_video" }))
  ], [firstFrameAssets, lastFrameAssets, oneClickAssets, repProductAssets, repVideoAssets]);

  const canGenerate = useMemo(() => {
    if (!activeVideoConfig) return false;
    const hasPrompt = prompt.trim().length > 0;
    if (mode === "one-click-2") return hasPrompt && oneClickAssets.length > 0;
    if (mode === "first-last-2") return firstFrameAssets.length > 0 && lastFrameAssets.length > 0;
    return repProductAssets.length > 0 && repVideoAssets.length > 0;
  }, [activeVideoConfig, firstFrameAssets.length, lastFrameAssets.length, mode, oneClickAssets.length, prompt, repProductAssets.length, repVideoAssets.length]);

  const refreshRemoteData = useCallback(async () => {
    if (!token) return;
    setLoadingRemote(true);
    try {
      const [recordsResponse, assetsResponse] = await Promise.all([
        fetch(`${apiBase}/api/video-generations`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/video-assets`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const records = await readApi<VideoRecordsPayload>(recordsResponse);
      const assets = await readApi<VideoAssetsPayload>(assetsResponse);
      setJobs(records.data.records || []);
      setServerAssets(assets.data.assets || []);
    } catch (event) {
      setError(event instanceof Error ? event.message : "加载视频数据失败");
    } finally {
      setLoadingRemote(false);
    }
  }, [token]);

  const refreshVideoConfigs = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/video-model-configs`);
      const result = await readApi<VideoModelConfigsPayload>(response);
      setVideoConfigs(result.data.configs || []);
    } catch (event) {
      setError(event instanceof Error ? event.message : "加载视频模型配置失败");
    } finally {
      setVideoConfigLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshVideoConfigs();
      void refreshRemoteData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshRemoteData, refreshVideoConfigs]);

  useEffect(() => {
    if (!videoConfigLoaded) return;
    if (visibleModes.length > 0 && !visibleModes.some((item) => item.key === mode)) {
      setMode(visibleModes[0].key);
    }
  }, [mode, videoConfigLoaded, visibleModes]);

  useEffect(() => {
    const configs = videoConfigs.filter((config) => config.mode === mode);
    if (configs.length === 0) return;
    const current = configs.find((config) => config.model_name === model) || configs[0];
    if (current.model_name !== model) setModel(current.model_name);
    if (!current.ratios.includes(ratio)) setRatio(current.ratios[0] || "9:16");
    if (!current.resolutions.includes(resolution)) setResolution(current.resolutions[0] || "720p");
    if (!current.durations.includes(duration)) setDuration(current.durations[0] || "5s");
  }, [duration, mode, model, ratio, resolution, videoConfigs]);

  useEffect(() => {
    if (!token || localUploadedAssets.length === 0) return;
    const assets = localAssetsWithRoles.filter((asset) => {
      if (asset.src.startsWith("data:")) return false;
      const key = `${asset.name}-${asset.src.slice(0, 80)}`;
      if (savedAssetKeys.current.has(key)) return false;
      savedAssetKeys.current.add(key);
      return true;
    });
    if (assets.length === 0) return;

    const timer = window.setTimeout(async () => {
      try {
        await fetch(`${apiBase}/api/video-assets`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ assets })
        });
        void refreshRemoteData();
      } catch {
        // Upload preview persistence is helpful, but should not interrupt editing.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [localAssetsWithRoles, localUploadedAssets.length, token, refreshRemoteData]);

  function assetsForCurrentMode() {
    if (mode === "one-click-2") {
      return oneClickAssets.map((asset) => ({ ...asset, role: "one_click_image" }));
    }
    if (mode === "first-last-2") {
      return [
        ...firstFrameAssets.map((asset) => ({ ...asset, role: "first_frame" })),
        ...lastFrameAssets.map((asset) => ({ ...asset, role: "last_frame" }))
      ];
    }
    return [
      ...repProductAssets.map((asset) => ({ ...asset, role: "rep_product" })),
      ...repVideoAssets.map((asset) => ({ ...asset, role: "rep_video" }))
    ];
  }

  async function generate() {
    if (!canGenerate || phase === "generating" || phase === "analyzing" || !token) return;
    setError("");
    setPhase("generating");
    setTab("result");
    try {
      const readyAssets = await uploadVideoImageAssets(assetsForCurrentMode(), token);
      const response = await fetch(`${apiBase}/api/video-generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode,
          prompt,
          model,
          ratio,
          duration,
          resolution,
          assets: readyAssets
        })
      });
      const result = await readApi<VideoGeneratePayload>(response);
      window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
      notifyAuthChanged();
      const job = result.data.record;
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setLastGenerated(job);
      setPhase(job.status === "complete" ? "complete" : "generating");
      setTab("result");
      if (job.status === "generating") {
        void pollVideoResult(job.id);
      }
    } catch (event) {
      setError(event instanceof Error ? event.message : "视频生成失败");
      setPhase("idle");
    }
  }

  async function pollVideoResult(recordId: string) {
    for (let index = 0; index < 72; index += 1) {
      await wait(5000);
      if (!token) return;
      try {
        const response = await fetch(`${apiBase}/api/video-task-status?id=${encodeURIComponent(recordId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const result = await readApi<VideoTaskStatusPayload>(response);
        const next = result.data.record;
        if (next) {
          setJobs((current) => [next, ...current.filter((item) => item.id !== next.id)]);
          setLastGenerated(next);
          if (next.status === "complete") {
            setPhase("complete");
            return;
          }
          if (next.status === "failed") {
            setPhase("idle");
            setError(next.error_message || "视频生成失败");
            return;
          }
        }
      } catch {
        // Keep polling; transient network failures should not stop a submitted task.
      }
    }
  }

  if (showTemplates) {
    return <TemplateShowcase onBack={() => setShowTemplates(false)} onEnter={(nextMode) => { setMode(nextMode); setShowTemplates(false); }} />;
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-[#faf9f7] text-[#101827]">
      <AppHeader />
      <main className="relative">
        <section className="mx-auto max-w-[1100px] px-5 pb-24 pt-16 sm:px-8 sm:pt-20">
          <div className="relative text-center">
            <button className="mb-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ded8cd] bg-white px-3 text-[11px] font-medium text-[#697080] transition hover:border-[#8b93a1] hover:text-[#101827] sm:absolute sm:right-0 sm:top-0 sm:mb-0" type="button" onClick={() => setShowTemplates(true)}>
              <Play className="h-3 w-3" />
              看模板
            </button>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-medium text-blue-700">
              <Film className="h-4 w-4" />
              视频生成
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#101827] sm:text-4xl">上传素材，生成你自己的视频</h1>
          </div>

          <div className="mt-8 w-full overflow-x-auto">
            <div className="inline-flex items-center gap-1 rounded-full border border-[#ded8cd]/70 bg-[#f2f0ec] p-0.5 whitespace-nowrap">
              {visibleModes.map((item) => {
                const Icon = item.icon;
                const active = mode === item.key;
                return (
                  <button key={item.key} className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "border border-[#ded8cd] bg-white text-[#101827] shadow-sm" : "text-[#697080] hover:text-[#101827]"}`} type="button" onClick={() => setMode(item.key)}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <section className="rounded-[30px] border border-[#ded8cd] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:p-7">
              {visibleModes.length > 0 ? (
                <ModeEditor mode={mode} prompt={prompt} setPrompt={setPrompt} model={model} setModel={setModel} modelOptions={modelOptions} ratio={ratio} setRatio={setRatio} ratioOptions={ratioOptions} duration={duration} setDuration={setDuration} durationOptions={durationOptions} resolution={resolution} setResolution={setResolution} resolutionOptions={resolutionOptions} cost={cost} phase={phase} canGenerate={canGenerate} onGenerate={generate} oneClickAssets={oneClickAssets} setOneClickAssets={setOneClickAssets} firstFrameAssets={firstFrameAssets} setFirstFrameAssets={setFirstFrameAssets} lastFrameAssets={lastFrameAssets} setLastFrameAssets={setLastFrameAssets} repProductAssets={repProductAssets} setRepProductAssets={setRepProductAssets} repVideoAssets={repVideoAssets} setRepVideoAssets={setRepVideoAssets} />
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-[#ded8cd] bg-[#fbfaf8] px-6 text-center text-sm font-semibold text-[#697080]">
                  暂无可用视频生成模式，请在后台开启视频模型配置。
                </div>
              )}
            </section>

            <section className="rounded-[30px] border border-[#ded8cd] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="inline-flex rounded-full border border-[#ded8cd] bg-[#f0efec] p-1">
                  {[
                    ["result", Film, "结果"],
                    ["videos", History, "后台和最近"],
                    ["assets", Images, "素材库"]
                  ].map(([key, Icon, label]) => (
                    <button key={key as string} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${tab === key ? "bg-white text-[#101827] shadow-sm" : "text-[#697080] hover:text-[#101827]"}`} type="button" onClick={() => setTab(key as ResultTab)}>
                      <Icon className="h-3 w-3" />
                      {label as string}
                    </button>
                  ))}
                </div>
                {tab === "result" ? (
                  <div className="h-8 w-8" />
                ) : (
                  <button className="flex h-8 items-center gap-1 rounded-full border border-[#ded8cd] bg-white px-3 text-xs font-semibold text-[#697080] transition hover:border-[#8b93a1] hover:text-[#101827] disabled:opacity-60" type="button" disabled={loadingRemote} onClick={() => void refreshRemoteData()}>
                    <RefreshCcw className={`h-3.5 w-3.5 ${loadingRemote ? "animate-spin" : ""}`} />
                    刷新
                  </button>
                )}
              </div>

              {error && <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
              {tab === "result" && <ResultPanel phase={phase} job={lastGenerated} />}
              {tab === "videos" && <RecentPanel jobs={jobs} />}
              {tab === "assets" && <AssetsPanel assets={uploadedAssets} />}
            </section>
          </div>
        </section>
      </main>
    </div>
    </AuthGuard>
  );
}

function TemplateShowcase({ onBack, onEnter }: { onBack: () => void; onEnter: (mode: Mode) => void }) {
  const [selected, setSelected] = useState<Mode>("one-click-2");
  const active = templateTabs.find((item) => item.key === selected) ?? templateTabs[0];

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#101827]">
      <AppHeader />
      <main className="mx-auto max-w-[1120px] px-5 pb-24 pt-16 sm:px-8 sm:pt-20">
        <div className="relative text-center">
          <button className="mb-4 inline-flex h-9 items-center gap-2 rounded-full border border-[#ded8cd] bg-white px-4 text-xs font-bold text-[#697080] transition hover:border-[#8b93a1] hover:text-[#101827] sm:absolute sm:left-0 sm:top-0 sm:mb-0" type="button" onClick={onBack}>
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            返回
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-800">
            <Film className="h-4 w-4" />
            视频模板
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.035em] text-[#101827] sm:text-4xl">先看 3 个效果</h1>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
          <section className="rounded-[28px] border border-[#ded8cd] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:p-6">
            <div className="grid gap-2 sm:grid-cols-3">
              {templateTabs.map((item) => {
                const activeTab = selected === item.key;
                return (
                  <button key={item.key} className={`group min-h-[92px] rounded-2xl border p-3 text-left transition ${activeTab ? "border-[#101827] bg-[#101827] text-white shadow-sm" : "border-[#ded8cd] bg-[#f6f5f3] text-[#101827] hover:border-[#8b93a1]"}`} type="button" onClick={() => setSelected(item.key)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${activeTab ? "bg-white/10 text-white" : "bg-white text-[#697080]"}`}>
                        <Film className="h-4 w-4" />
                      </span>
                      {activeTab && <BadgeCheck className="h-4 w-4" />}
                    </div>
                    <p className="mt-3 text-sm font-bold">{item.label}</p>
                    <p className={`mt-1 text-[11px] leading-snug ${activeTab ? "text-white/70" : "text-[#697080]"}`}>{item.hint}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[24px] border border-[#ded8cd] bg-[#f6f5f3] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a919e]">模板</p>
                  <h2 className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em] text-[#101827]">{active.label}</h2>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">就绪</span>
              </div>

              {selected === "one-click-2" && (
                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  {breadImages.map(([src, label]) => <ImageTile key={src} src={src} label={label} />)}
                </div>
              )}
              {selected === "video-rep-4" && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ImageTile src="https://shopix-ai.company/video-demo/fashion-product.jpg" label="产品图" aspect="aspect-[3/4]" />
                  <div className="relative overflow-hidden rounded-2xl border border-[#ded8cd] bg-black aspect-[3/4]">
                    <video className="h-full w-full object-cover" muted playsInline poster="https://shopix-ai.company/video-demo/fashion-reference-poster.jpg" preload="none" src="https://shopix-ai.company/video-demo/fashion-reference.mp4" />
                    <span className="absolute inset-x-2 bottom-2 rounded-full bg-white/90 px-2 py-1 text-center text-[10px] font-semibold text-[#101827] shadow-sm">产品图 + 参考视频</span>
                  </div>
                </div>
              )}
              {selected === "first-last-2" && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <ImageTile src="https://shopix-ai.company/video-demo/serum-first-frame.jpg" label="首帧" aspect="aspect-[4/5]" />
                  <ImageTile src="https://shopix-ai.company/video-demo/serum-last-frame.jpg" label="尾帧" aspect="aspect-[4/5]" />
                </div>
              )}

              <button className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#101827] text-sm font-bold text-white shadow-[0_14px_30px_-18px_rgba(16,24,39,0.45)]" type="button" onClick={() => onEnter(selected)}>
                开始生成
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#ded8cd] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:p-6">
            <p className="mb-3 text-sm font-bold text-[#101827]">{active.result}</p>
            <div className="relative mx-auto aspect-[9/16] max-h-[620px] w-full max-w-[360px] overflow-hidden rounded-[26px] bg-zinc-950 shadow-[0_22px_60px_-28px_rgba(0,0,0,0.55)]">
              <video key={active.video} className="h-full w-full object-cover" controls muted playsInline poster={active.poster} preload="none" src={active.video} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ModeEditor({
  mode,
  prompt,
  setPrompt,
  model,
  setModel,
  modelOptions,
  ratio,
  setRatio,
  ratioOptions,
  duration,
  setDuration,
  durationOptions,
  resolution,
  setResolution,
  resolutionOptions,
  cost,
  phase,
  canGenerate,
  onGenerate,
  oneClickAssets,
  setOneClickAssets,
  firstFrameAssets,
  setFirstFrameAssets,
  lastFrameAssets,
  setLastFrameAssets,
  repProductAssets,
  setRepProductAssets,
  repVideoAssets,
  setRepVideoAssets
}: {
  mode: Mode;
  prompt: string;
  setPrompt: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  modelOptions: string[];
  ratio: string;
  setRatio: (value: string) => void;
  ratioOptions: string[];
  duration: string;
  setDuration: (value: string) => void;
  durationOptions: string[];
  resolution: string;
  setResolution: (value: string) => void;
  resolutionOptions: string[];
  cost: number;
  phase: string;
  canGenerate: boolean;
  onGenerate: () => void;
  oneClickAssets: UploadPreview[];
  setOneClickAssets: (items: UploadPreview[]) => void;
  firstFrameAssets: UploadPreview[];
  setFirstFrameAssets: (items: UploadPreview[]) => void;
  lastFrameAssets: UploadPreview[];
  setLastFrameAssets: (items: UploadPreview[]) => void;
  repProductAssets: UploadPreview[];
  setRepProductAssets: (items: UploadPreview[]) => void;
  repVideoAssets: UploadPreview[];
  setRepVideoAssets: (items: UploadPreview[]) => void;
}) {
  return (
    <div className="space-y-4">
      {mode === "one-click-2" && <OneClickForm items={oneClickAssets} onChange={setOneClickAssets} />}
      {mode === "first-last-2" && <FirstLastForm firstItems={firstFrameAssets} onFirstChange={setFirstFrameAssets} lastItems={lastFrameAssets} onLastChange={setLastFrameAssets} />}
      {mode === "video-rep-4" && <VideoReplicationForm productItems={repProductAssets} onProductChange={setRepProductAssets} videoItems={repVideoAssets} onVideoChange={setRepVideoAssets} />}

      {mode === "one-click-2" && (
        <textarea className="studio-input min-h-[62px] resize-none py-4 leading-6" maxLength={500} placeholder={placeholderForMode(mode)} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      )}
      {mode !== "one-click-2" && (
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-[#7d8492]">提示词</span>
          <textarea className="studio-input min-h-[96px] resize-none py-4 leading-6" maxLength={500} placeholder={placeholderForMode(mode)} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
      )}

      <div className="border-t border-[#e5ded2] pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <PillSelect value={model} onChange={setModel} options={modelOptions.length ? modelOptions : ["Sora2", "Veo3"]} icon={<Sparkles className="h-3.5 w-3.5" />} />
            <PillSelect value={ratio} onChange={setRatio} options={ratioOptions.length ? ratioOptions : ["9:16", "16:9", "1:1"]} icon={<Video className="h-3.5 w-3.5" />} />
            <Segmented value={resolution} onChange={setResolution} options={resolutionOptions.length ? resolutionOptions : ["720p", "1080p"]} />
            <PillSelect value={duration} onChange={setDuration} options={durationOptions.length ? durationOptions : ["5s", "8s", "10s"]} icon={<Clock className="h-3.5 w-3.5" />} />
          </div>
          <div className="flex items-center justify-end gap-4">
            <span className="text-sm font-semibold text-[#697080]">{cost} 积分</span>
            <button className={`press-scale flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold shadow-[0_14px_30px_-18px_rgba(16,24,39,0.35)] transition ${canGenerate && phase !== "generating" && phase !== "analyzing" ? "bg-[#101827] text-white hover:bg-black" : "bg-[#e7e2d9] text-[#8b8478]"}`} disabled={!canGenerate || phase === "generating" || phase === "analyzing"} type="button" onClick={onGenerate}>
              {phase === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "one-click-2" ? <Zap className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {phase === "generating" ? "生成中..." : "生成视频"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-right text-[11px] text-[#697080]">视频生成通常需要 2-5 分钟，请耐心等待</p>
      </div>
    </div>
  );
}

function VideoReplicationForm({ productItems, onProductChange, videoItems, onVideoChange }: { productItems: UploadPreview[]; onProductChange: (items: UploadPreview[]) => void; videoItems: UploadPreview[]; onVideoChange: (items: UploadPreview[]) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <UploadBox title="新主体/产品图" desc="JPG / PNG · 最多 5 张" compact items={productItems} onChange={onProductChange} />
        <UploadBox title="原视频" desc="MP4 / MOV · 最大 50MB · 最长 15 秒" video compact items={videoItems} onChange={onVideoChange} />
      </div>
    </div>
  );
}

function OneClickForm({ items, onChange }: { items: UploadPreview[]; onChange: (items: UploadPreview[]) => void }) {
  return (
    <UploadBox title="添加图片" desc="上传产品图，AI 自动生成专业分镜方案" large items={items} onChange={onChange} />
  );
}

function FirstLastForm({ firstItems, onFirstChange, lastItems, onLastChange }: { firstItems: UploadPreview[]; onFirstChange: (items: UploadPreview[]) => void; lastItems: UploadPreview[]; onLastChange: (items: UploadPreview[]) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <UploadBox title="首帧" desc="视频开始画面" compact items={firstItems} onChange={onFirstChange} />
      <UploadBox title="尾帧" desc="视频结束画面" compact items={lastItems} onChange={onLastChange} />
    </div>
  );
}

function UploadBox({ title, desc, items, onChange, video = false, compact = false, large = false }: { title: string; desc: string; items: UploadPreview[]; onChange: (items: UploadPreview[]) => void; video?: boolean; compact?: boolean; large?: boolean }) {
  const maxFiles = video ? 1 : large ? 6 : 5;

  async function onFiles(files?: FileList | null) {
    if (!files || files.length === 0) return;
    const slots = Math.max(0, maxFiles - items.length);
    const selected = Array.from(files).slice(0, slots);
    const previews = await Promise.all(
      selected.map(
        (file, index) =>
          new Promise<UploadPreview>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `${Date.now()}-${index}-${file.name}`,
                name: file.name,
                src: String(reader.result || ""),
                video
              });
            reader.readAsDataURL(file);
          })
      )
    );
    onChange(video ? previews.slice(0, 1) : [...items, ...previews]);
  }

  return (
    <label className={`block cursor-pointer rounded-2xl border-2 border-dashed border-[#ded8cd] bg-[#fbfaf8] p-4 transition hover:border-[#9ba1ad] ${large ? "min-h-[180px]" : compact ? "min-h-[150px]" : "min-h-[190px]"}`}>
      <input className="hidden" type="file" accept={video ? "video/*,.mp4,.mov" : "image/*"} multiple={!video} onChange={(event) => { void onFiles(event.target.files); event.currentTarget.value = ""; }} />
      {items.length > 0 ? (
        <div className={video ? "space-y-3" : "grid grid-cols-3 gap-3 sm:grid-cols-5"}>
          {items.map((item) => (
            <div key={item.id} className={`${video ? "aspect-video" : "aspect-square"} group relative overflow-hidden rounded-2xl border border-[#ded8cd] bg-white`}>
              {item.video ? (
                <video className="h-full w-full object-cover" src={item.src} controls muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="h-full w-full object-cover" src={item.src} alt={item.name} />
              )}
              <button
                className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-[#101827]/75 text-white group-hover:flex"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onChange(items.filter((entry) => entry.id !== item.id));
                }}
                aria-label="移除素材"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={`flex h-full flex-col items-center justify-center text-center ${large ? "min-h-[150px]" : "min-h-[120px]"}`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0efec] text-[#697080]">
            {video ? <Film className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
          </div>
          <p className="mt-3 text-sm font-extrabold">{title}</p>
          <p className="mt-1 max-w-[300px] text-xs leading-5 text-[#697080]">{desc}</p>
        </div>
      )}
      {items.length > 0 && <p className="mt-3 text-center text-xs font-semibold text-[#697080]">点击空白区域可继续上传，最多 {maxFiles} 个素材</p>}
    </label>
  );
}

function ResultPanel({ phase, job }: { phase: string; job: VideoJob | null }) {
  const generated = phase === "complete" && job?.status === "complete" && Boolean(job.src);
  const progress = Math.max(0, Math.min(100, job?.status === "complete" ? 100 : job?.progress ?? 0));
  return (
    <div className="space-y-4">
      <div className={`${generated ? "mx-auto aspect-[9/16] max-h-[620px] max-w-[360px] overflow-hidden bg-zinc-950 p-0" : "bg-[#fbfaf8] p-6 sm:p-8"} relative w-full rounded-[26px] border border-[#ded8cd] shadow-[0_22px_60px_-36px_rgba(0,0,0,0.24)]`}>
        {phase === "generating" || phase === "analyzing" ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center text-[#101827]">
            <Loader2 className="h-8 w-8 animate-spin text-[#101827]" />
            <div className="mt-4 h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-[#e8e4dd]">
              <div className="h-full rounded-full bg-[#101827] transition-all" style={{ width: `${Math.max(6, progress)}%` }} />
            </div>
            <p className="mt-2 text-xs font-semibold text-[#101827]">{progress}%</p>
            <p className="mt-4 text-sm font-bold">{phase === "analyzing" ? "AI 正在拆解参考视频..." : "视频生成中"}</p>
            <p className="mt-2 text-xs text-[#697080]">视频生成通常需要 2-5 分钟，请耐心等待</p>
          </div>
        ) : generated ? (
          <video className="h-full w-full object-cover" controls muted playsInline poster={job.poster} preload="none" src={job.src} />
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center text-[#697080]">
            <div className="space-y-4 text-left text-sm">
              {["上传产品图片", "选择模式和模型，填写提示词", "点击生成，等待时可以继续切换模式并行创建任务"].map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold text-[#101827] shadow-sm">{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {generated && (
        <div className="flex items-center justify-end gap-3">
          <a className="studio-tool-btn" href={job.src} download target="_blank" rel="noreferrer">
            <Download className="h-3.5 w-3.5" />
            下载
          </a>
        </div>
      )}
    </div>
  );
}

function RecentPanel({ jobs }: { jobs: VideoJob[] }) {
  if (jobs.length === 0) {
    return <EmptyState icon={<History className="h-6 w-6" />} title="暂无生成记录" desc="生成视频后，这里会显示完成视频或生成中的任务。" />;
  }

  return (
    <div className="space-y-3">
      <span className="text-xs text-[#697080]">{jobs.length} 个任务 / 结果</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {jobs.map((job) => (
          <div key={job.id} className="overflow-hidden rounded-2xl border border-[#ded8cd] bg-[#f6f5f3] text-left">
            <div className="relative aspect-video bg-[#e8e4dd]">
              {job.status === "complete" && job.src ? (
                <video className="h-full w-full object-cover" controls muted playsInline poster={job.poster} preload="none" src={job.src} />
              ) : job.status === "failed" ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs font-semibold text-red-600">
                  生成失败
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-[#697080]" />
                  <span className="text-[10px] font-semibold text-[#697080]">{Math.max(0, Math.min(99, job.progress ?? 0))}%</span>
                </div>
              )}
              <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold ${job.status === "complete" ? "bg-emerald-100 text-emerald-700" : job.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{job.status === "complete" ? "完成" : job.status === "failed" ? "失败" : "生成中"}</span>
              {job.status === "complete" && job.src && (
                <a className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#101827] shadow-sm transition hover:bg-white" href={job.src} download target="_blank" rel="noreferrer" aria-label="下载视频">
                  <Download className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="px-3 py-2.5">
              <p className="text-xs font-medium text-[#101827]">{job.title}</p>
              <p className="mt-1 text-[10px] text-[#697080]">{job.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetsPanel({ assets }: { assets: UploadPreview[] }) {
  if (assets.length === 0) {
    return <EmptyState icon={<Images className="h-6 w-6" />} title="暂无素材" desc="通过视频生成模块上传的图片或视频会显示在这里。" />;
  }

  return (
    <div className="space-y-3">
      <span className="text-xs text-[#697080]">视频生成模块上传的素材</span>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {assets.map((asset) => (
          <div key={asset.id} className="relative aspect-square overflow-hidden rounded-xl border border-[#ded8cd] bg-[#f6f5f3]">
            {asset.video ? (
              <>
                <video className="h-full w-full object-cover" muted playsInline preload="metadata" src={asset.src} />
                <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <Play className="h-5 w-5 text-white drop-shadow" />
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.src} alt={asset.name} className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#ded8cd] bg-[#fbfaf8] px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#697080] shadow-sm">{icon}</div>
      <p className="mt-4 text-sm font-bold text-[#101827]">{title}</p>
      <p className="mt-1 text-xs text-[#697080]">{desc}</p>
    </div>
  );
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
              <span className={`inline-flex h-10 items-center rounded-[14px] px-4 text-sm font-semibold transition ${label === "视频生成" ? "bg-[#101827] text-white" : "text-[#5f6674] hover:bg-[#ede8df] hover:text-[#101827]"}`}>{label}</span>
            </Link>
          ))}
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
}

function AnnouncementBar() {
  return (
    <div className="border-b border-[#eadfca] bg-[#fff8e8]">
      <div className="mx-auto flex h-10 max-w-[1280px] items-center justify-center gap-4 px-5 text-xs font-medium text-[#5f6674]">
        <span>GPT Image 2 最强图像模型 + 人脸视频生成，全部上线</span>
        <Link className="font-bold text-[#101827]" href="/image-editor">生成图片 <ArrowRight className="inline h-3 w-3" /></Link>
        <Link className="font-bold text-[#101827]" href="/video-studio">生成视频 <ArrowRight className="inline h-3 w-3" /></Link>
        <button aria-label="Dismiss" className="absolute right-8 hidden text-[#9a9184] md:block" type="button"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function FloatingPromos() {
  return (
    <div className="pointer-events-none absolute left-0 top-2 z-10 hidden w-[180px] space-y-4 xl:block">
      <Link className="pointer-events-auto flex h-11 items-center gap-2 rounded-r-[16px] border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 shadow-sm" href="/profile">
        <Sparkles className="h-4 w-4" />
        小皮皮推荐官活动
      </Link>
      <Link className="pointer-events-auto flex h-11 items-center gap-2 rounded-r-[16px] border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 shadow-sm" href="/pricing">
        <CircleDollarSign className="h-4 w-4" />
        首充 / 累充优惠
      </Link>
    </div>
  );
}

function ImageTile({ src, label, aspect = "aspect-square" }: { src: string; label: string; aspect?: string }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-[#ded8cd] bg-white ${aspect}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      <div className="absolute inset-x-2 bottom-2 rounded-full bg-white/90 px-2 py-1 text-center text-[10px] font-semibold text-[#101827] shadow-sm backdrop-blur">{label}</div>
    </div>
  );
}

function PillSelect({ value, onChange, options, icon }: { value: string; onChange: (value: string) => void; options: string[]; icon: React.ReactNode }) {
  return (
    <div className="relative">
      <select className="h-9 appearance-none rounded-full border border-[#ded8cd] bg-white pl-8 pr-8 text-xs font-semibold text-[#697080] outline-none transition hover:border-[#9ba1ad] hover:text-[#101827]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a919e]">{icon}</span>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a919e]" />
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div className="flex h-9 items-center gap-1 rounded-full border border-[#ded8cd] bg-white p-1">
      {options.map((option) => (
        <button key={option} className={`rounded-full px-3 py-1 text-xs font-bold transition ${value === option ? "bg-[#101827] text-white" : "text-[#697080] hover:text-[#101827]"}`} type="button" onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function placeholderForMode(mode: Mode) {
  if (mode === "video-rep-4") return "按原视频节奏复刻，主体产品严格替换为用户上传产品，保持构图、灯光、动作、音频氛围一致。";
  if (mode === "first-last-2") return "描述首帧到尾帧之间的动作变化、镜头运动、氛围和主体细节。";
  return "描述视频风格：如 广告大片、快节奏短视频、电影感、治愈风...";
}

function modeLabel(mode: Mode) {
  if (mode === "video-rep-4") return "视频复刻";
  if (mode === "first-last-2") return "首尾帧";
  return "一键生成";
}
