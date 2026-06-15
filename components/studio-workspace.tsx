"use client";

import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileImage,
  ImagePlus,
  Images,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Plus,
  Send,
  Sparkles,
  Upload,
  WandSparkles,
  X
} from "lucide-react";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { notifyAuthChanged, type DakeUser, useAuthToken, useAuthUser } from "@/components/auth-state";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type StudioMode = "genesis" | "detail";
type DetailMode = "connected" | "separate";
type StudioPhase = "idle" | "planning" | "preview" | "complete";
type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

type MainImagePayload = {
  id: number;
  status?: string;
  images: string[];
  tasks?: Array<{ id: number; task_id: string; status: string; image_url?: string }>;
  cost_credits: number;
  user: DakeUser;
};
type ImageTaskStatusPayload = {
  id: number;
  status: string;
  done: boolean;
  images: string[];
  tasks: Array<{ id: number; task_id: string; status: string; image_url?: string; error_message?: string }>;
  user: DakeUser;
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

const navItems = [
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["套餐", "/pricing"]
];

const defaultModelOptions = ["GPT Image 2", "Nano Banana 2"];
const ratios = {
  genesis: ["1:1 方图", "2:3 竖版", "3:2 横版", "3:4 竖版", "4:3 横版", "4:5 竖版", "5:4 横版", "9:16 长图"],
  detail: ["3:4 竖版", "1:1 方图", "4:5 竖图", "9:16 长图"]
};
const languageOptions = [
  "无文字(纯视觉)",
  "English · 英语",
  "中文",
  "日本語 · 日语",
  "한국어 · 韩语",
  "Español · 西班牙语",
  "Français · 法语",
  "Deutsch · 德语",
  "Português · 葡萄牙语",
  "العربية · 阿拉伯语",
  "Русский · 俄语",
  "ภาษาไทย · 泰语",
  "Tiếng Việt · 越南语",
  "Bahasa Melayu · 马来语",
  "Bahasa Indonesia · 印尼语"
];
const quantityOptions = Array.from({ length: 10 }, (_, index) => `${index + 1} 张`);
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function mediaUrl(src: string) {
  if (!src) return "";
  if (src.startsWith("data:") || /^https?:\/\//i.test(src)) return src;
  return `${apiBase}${src.startsWith("/") ? src : `/${src}`}`;
}

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || "请求失败");
  }
  return payload;
}

function configuredCost(configs: ModelConfig[], model: string, resolution: string, fallback: number) {
  const config = configs.find((item) => item.model_name === model);
  if (!config) return fallback;
  const lower = resolution.toLowerCase();
  if (lower.includes("4k")) return config.cost_4k || fallback;
  if (lower.includes("3k")) return config.cost_3k || fallback;
  if (lower.includes("2k")) return config.cost_2k || fallback;
  if (lower.includes("1k")) return config.cost_1k || fallback;
  return config.cost_auto || config.cost_1k || fallback;
}

function configuredResolutions(configs: ModelConfig[], model: string) {
  const config = configs.find((item) => item.model_name === model);
  const values = config?.resolutions?.length
    ? config.resolutions
    : String(config?.supported_resolutions || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  return (values.length > 0 ? values : ["1K", "2K", "4K"]).map((item) => resolutionLabel(item));
}

function resolutionLabel(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "AUTO") return "自动 auto";
  if (normalized === "1K") return "标清 1K";
  if (normalized === "2K") return "高清 2K";
  if (normalized === "3K") return "精细 3K";
  if (normalized === "4K") return "超清 4K";
  return value;
}

const detailModules = [
  ["hero-visual", "首屏主视觉", "传递核心价值"],
  ["core-selling-point", "核心卖点图", "突出差异化优势"],
  ["usage-scene", "使用场景图", "呈现真实使用场景"],
  ["multi-angle", "多角度图", "多角度呈现外观"],
  ["scene-atmosphere", "场景氛围图", "展示使用场景"],
  ["product-detail", "商品细节图", "放大材质与工艺"],
  ["brand-story", "品牌故事图", "传达品牌理念"],
  ["size-capacity-spec", "尺寸/容量/尺码图", "展示规格信息"],
  ["before-after", "效果对比图", "使用前后效果对比"],
  ["spec-table", "详细规格/参数表", "展示详细商品数据"],
  ["craft-process", "工艺制作图", "展示工艺制作过程"],
  ["accessories-gifts", "配件/赠品图", "明确收货的所有物品"],
  ["series-display", "系列展示图", "多色或多 SKU 展示"],
  ["ingredients", "商品成分图", "展示配方/材质/成分"],
  ["after-sales", "售后保障图", "说明质保退换政策"],
  ["usage-tips", "使用建议图", "商品使用的注意事项"],
  ["buyer-show", "买家秀", "真实用户视角"]
];

export function StudioWorkspace({ initialMode }: { initialMode: StudioMode }) {
  const token = useAuthToken();
  const user = useAuthUser();
  const [mode, setMode] = useState<StudioMode>(initialMode);
  const detailMode: DetailMode = "separate";
  const [genesisLanguage, setGenesisLanguage] = useState("中文");
  const [genesisModel, setGenesisModel] = useState(defaultModelOptions[0]);
  const [genesisRatio, setGenesisRatio] = useState("1:1 方图");
  const [genesisResolution, setGenesisResolution] = useState("标清 1K");
  const [genesisQuantity, setGenesisQuantity] = useState("1 张");
  const [detailLanguage, setDetailLanguage] = useState("中文");
  const [detailModel, setDetailModel] = useState(defaultModelOptions[0]);
  const [detailRatio, setDetailRatio] = useState("3:4 竖版");
  const [detailResolution, setDetailResolution] = useState("标清 1K");
  const [detailQuantity, setDetailQuantity] = useState("1 张");
  const [brief, setBrief] = useState("");
  const [genesisUploads, setGenesisUploads] = useState<string[]>([]);
  const [detailUploads, setDetailUploads] = useState<string[]>([]);
  const [mainImages, setMainImages] = useState<string[]>([]);
  const [mainError, setMainError] = useState("");
  const [detailImages, setDetailImages] = useState<string[]>([]);
  const [detailError, setDetailError] = useState("");
  const [detailProductName, setDetailProductName] = useState("");
  const [detailProductDescription, setDetailProductDescription] = useState("");
  const [genesisPhase, setGenesisPhase] = useState<StudioPhase>("idle");
  const [detailPhase, setDetailPhase] = useState<StudioPhase>("idle");
  const [mainConfigs, setMainConfigs] = useState<ModelConfig[]>([]);
  const [detailConfigs, setDetailConfigs] = useState<ModelConfig[]>([]);
  const genesisModelOptions = useMemo(() => (mainConfigs.length > 0 ? mainConfigs.map((item) => item.model_name) : defaultModelOptions), [mainConfigs]);
  const detailModelOptions = useMemo(() => (detailConfigs.length > 0 ? detailConfigs.map((item) => item.model_name) : defaultModelOptions), [detailConfigs]);
  const genesisResolutionOptions = useMemo(() => configuredResolutions(mainConfigs, genesisModel), [genesisModel, mainConfigs]);
  const detailResolutionOptions = useMemo(() => configuredResolutions(detailConfigs, detailModel), [detailModel, detailConfigs]);
  const activeGenesisResolution = genesisResolutionOptions.includes(genesisResolution) ? genesisResolution : genesisResolutionOptions[0] || "标清 1K";
  const activeDetailResolution = detailResolutionOptions.includes(detailResolution) ? detailResolution : detailResolutionOptions[0] || "标清 1K";

  useEffect(() => {
    Promise.all([
      fetch(`${apiBase}/api/model-configs?module=main_image`).then((response) => response.json()),
      fetch(`${apiBase}/api/model-configs?module=detail_image`).then((response) => response.json())
    ])
      .then(([mainPayload, detailPayload]) => {
        const nextMainConfigs = (mainPayload?.data?.configs || []) as ModelConfig[];
        const nextDetailConfigs = (detailPayload?.data?.configs || []) as ModelConfig[];
        setMainConfigs(nextMainConfigs);
        setDetailConfigs(nextDetailConfigs);
        if (nextMainConfigs.length > 0) {
          const nextModel = nextMainConfigs.some((item) => item.model_name === defaultModelOptions[0]) ? defaultModelOptions[0] : nextMainConfigs[0].model_name;
          setGenesisModel(nextModel);
          setGenesisResolution(configuredResolutions(nextMainConfigs, nextModel)[0] || "标清 1K");
        }
        if (nextDetailConfigs.length > 0) {
          const nextModel = nextDetailConfigs.some((item) => item.model_name === defaultModelOptions[0]) ? defaultModelOptions[0] : nextDetailConfigs[0].model_name;
          setDetailModel(nextModel);
          setDetailResolution(configuredResolutions(nextDetailConfigs, nextModel)[0] || "标清 1K");
        }
      })
      .catch(() => {
        setMainConfigs([]);
        setDetailConfigs([]);
      });
  }, []);

  const pageCopy = useMemo(
    () =>
      mode === "genesis"
        ? {
            badge: "电商主图规划",
            title: "主图生成",
            subtitle: "AI 智能分析产品风格与文案，一键生成专业主图"
          }
        : {
            badge: "详情页规划",
            title: "详情图生成",
            subtitle: "上传产品实拍图，AI 自动理解产品结构与卖点，快速生成多视角、多场景的电商详情图集。 无需设计基础，几分钟内完成从单图到完整详情页的视觉升级。"
          },
    [mode]
  );

  const activeModel = mode === "genesis" ? genesisModel : detailModel;
  const activeRatio = mode === "genesis" ? genesisRatio : detailRatio;
  const activePhase = mode === "genesis" ? genesisPhase : detailPhase;
  const activeUploads = mode === "genesis" ? genesisUploads : detailUploads;
  const quantityCount = Number.parseInt(genesisQuantity, 10) || 1;
  const detailQuantityCount = Number.parseInt(detailQuantity, 10) || 1;
  const mainImageCost = configuredCost(mainConfigs, genesisModel, activeGenesisResolution, 30) * quantityCount;
  const detailImageCost = configuredCost(detailConfigs, detailModel, activeDetailResolution, 30) * detailQuantityCount;
  const activeCost = mode === "genesis" ? mainImageCost : detailImageCost;
  const hasCreditSnapshot = typeof user?.credits === "number";
  const canFillGenesis = genesisUploads.length > 0 && brief.trim().length > 0;
  const canFillDetail = detailUploads.length > 0 && detailProductName.trim().length > 0;
  const insufficientCredits = (mode === "genesis" ? canFillGenesis : canFillDetail) && hasCreditSnapshot && activeCost > Number(user?.credits || 0);

  function switchMode(nextMode: StudioMode) {
    setMode(nextMode);
    window.history.replaceState(null, "", nextMode === "genesis" ? "/studio-genesis" : "/ecom-studio");
  }

  function changeGenesisModel(nextModel: string) {
    setGenesisModel(nextModel);
    setGenesisResolution(configuredResolutions(mainConfigs, nextModel)[0] || "标清 1K");
  }

  function changeDetailModel(nextModel: string) {
    setDetailModel(nextModel);
    setDetailResolution(configuredResolutions(detailConfigs, nextModel)[0] || "标清 1K");
  }

  async function pollImageTasks(recordId: number, setImages: (updater: (current: string[]) => string[]) => void) {
    const maxAttempts = 180;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
      const response = await fetch(`${apiBase}/api/image-task-status?id=${recordId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await readApi<ImageTaskStatusPayload>(response);
      window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
      notifyAuthChanged();
      setImages(() => result.data.images || []);
      if (result.data.done) {
        const failed = result.data.tasks.filter((task) => task.status === "failed");
        if (failed.length > 0 && (result.data.images || []).length === 0) {
          throw new Error(failed[0].error_message || "生成失败");
        }
        return result.data;
      }
    }
    throw new Error("生成任务仍在处理中，请稍后到生成记录查看结果");
  }

  async function generate() {
    if (mode === "genesis") {
      const cleanBrief = brief.trim();
      if (!token || !canFillGenesis || insufficientCredits || isGenerating) return;

      setGenesisPhase("planning");
      setMainError("");
      setMainImages([]);

      try {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        setGenesisPhase("preview");
        const response = await fetch(`${apiBase}/api/main-image`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: cleanBrief,
            model: genesisModel,
            ratio: genesisRatio,
            language: genesisLanguage,
            resolution: activeGenesisResolution,
            count: quantityCount,
            reference_count: genesisUploads.length,
            images: genesisUploads
          })
        });
        const result = await readApi<MainImagePayload>(response);
        window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
        notifyAuthChanged();
        await pollImageTasks(result.data.id, setMainImages);
        setGenesisPhase("complete");
      } catch (event) {
        setMainError(event instanceof Error ? event.message : "生成失败");
        setGenesisPhase(mainImages.length > 0 ? "complete" : "idle");
      }
      return;
    }
    if (!token || !canFillDetail || insufficientCredits || isGenerating) return;
    setDetailPhase("planning");
    setDetailError("");
    setDetailImages([]);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      setDetailPhase("preview");
      const response = await fetch(`${apiBase}/api/detail-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product_name: detailProductName.trim(),
          product_description: detailProductDescription.trim(),
          model: detailModel,
          ratio: detailRatio,
          language: detailLanguage,
          resolution: activeDetailResolution,
          count: detailQuantityCount,
          reference_count: detailUploads.length,
          images: detailUploads
        })
      });
      const result = await readApi<MainImagePayload>(response);
      window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
      notifyAuthChanged();
      await pollImageTasks(result.data.id, setDetailImages);
      setDetailPhase("complete");
    } catch (event) {
      setDetailError(event instanceof Error ? event.message : "生成失败");
      setDetailPhase(detailImages.length > 0 ? "complete" : "idle");
    }
  }

  const isGenerating = activePhase === "planning" || activePhase === "preview";

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#101827]">
      <AppHeader activeMode={mode} onModeChange={switchMode} />
      <main className="relative">
        <section className="mx-auto max-w-[1280px] px-5 pb-24 pt-20 sm:px-8 sm:pt-24">
          <div className="text-center">
            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${mode === "genesis" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {mode === "genesis" ? <Megaphone className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
              {pageCopy.badge}
            </span>
            <h1 className="mt-5 font-display text-[clamp(2.2rem,5vw,3.4rem)] font-extrabold leading-tight tracking-[-0.035em]">{pageCopy.title}</h1>
            <p className="mx-auto mt-4 max-w-[680px] text-base leading-8 text-[#697080]">{pageCopy.subtitle}</p>
          </div>

          {mode === "genesis" && <GenesisStepper phase={genesisPhase} />}

          <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(420px,0.86fr)] lg:items-start">
            <div className="space-y-6">
              <UploadCard
                title="产品素材"
                subtitle={mode === "genesis" ? "上传清晰、干净、光线稳定的产品图。" : "上传清晰的产品图片"}
                items={activeUploads}
                setItems={mode === "genesis" ? setGenesisUploads : setDetailUploads}
              />

              {mode === "genesis" ? (
                <>
                  <GenesisInputs brief={brief} setBrief={setBrief} />
                  <SettingsPanel
                    mode={mode}
                    language={genesisLanguage}
                    setLanguage={setGenesisLanguage}
                    quantity={genesisQuantity}
                    setQuantity={setGenesisQuantity}
                    model={genesisModel}
                    setModel={changeGenesisModel}
                    modelOptions={genesisModelOptions}
                    ratio={genesisRatio}
                    setRatio={setGenesisRatio}
                    resolution={activeGenesisResolution}
                    setResolution={setGenesisResolution}
                    resolutionOptions={genesisResolutionOptions}
                  />
                </>
              ) : (
                <DetailInputs
                  productName={detailProductName}
                  setProductName={setDetailProductName}
                  productDescription={detailProductDescription}
                  setProductDescription={setDetailProductDescription}
                  language={detailLanguage}
                  setLanguage={setDetailLanguage}
                  quantity={detailQuantity}
                  setQuantity={setDetailQuantity}
                  model={detailModel}
                  setModel={changeDetailModel}
                  modelOptions={detailModelOptions}
                  ratio={detailRatio}
                  setRatio={setDetailRatio}
                  resolution={activeDetailResolution}
                  setResolution={setDetailResolution}
                  resolutionOptions={detailResolutionOptions}
                />
              )}

              <ActionPanel
                mode={mode}
                detailMode={detailMode}
                isGenerating={isGenerating}
                canGenerate={mode === "genesis" ? canFillGenesis : canFillDetail}
                costCredits={activeCost}
                insufficientCredits={insufficientCredits}
                errorMessage={mode === "genesis" ? mainError : detailError}
                onGenerate={generate}
              />
            </div>

            <ResultPanel mode={mode} phase={activePhase} detailMode={detailMode} quantity={mode === "genesis" ? genesisQuantity : detailQuantity} ratio={activeRatio} model={activeModel} images={mode === "genesis" ? mainImages : detailImages} />
          </div>
        </section>
      </main>
    </div>
  );
}

function AppHeader({ activeMode, onModeChange }: { activeMode: StudioMode; onModeChange: (mode: StudioMode) => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e5ded2] bg-[#faf9f7]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link className="flex items-baseline gap-2" href="/">
          <span className="font-display text-xl font-extrabold tracking-tight">达客</span>
          <span className="text-xs font-medium text-text-tertiary">AI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(([label, href]) => {
            const selected = (activeMode === "genesis" && label === "主图") || (activeMode === "detail" && label === "详情图");
            const button = (
              <span className={`inline-flex h-10 items-center rounded-[14px] px-4 text-sm font-semibold transition ${selected ? "bg-[#101827] text-white" : "text-[#5f6674] hover:bg-[#ede8df] hover:text-[#101827]"}`}>
                {label}
              </span>
            );
            if (label === "主图") {
              return (
                <button key={label} type="button" onClick={() => onModeChange("genesis")}>
                  {button}
                </button>
              );
            }
            if (label === "详情图") {
              return (
                <button key={label} type="button" onClick={() => onModeChange("detail")}>
                  {button}
                </button>
              );
            }
            return (
              <Link key={label} href={href}>
                {button}
              </Link>
            );
          })}
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
        <button aria-label="Dismiss" className="absolute right-8 hidden text-[#9a9184] md:block" type="button">
          <X className="h-4 w-4" />
        </button>
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

function GenesisStepper({ phase }: { phase: StudioPhase }) {
  const steps = ["输入", "生成", "生成中", "完成"];
  const activeIndex = phase === "complete" ? 3 : phase === "preview" ? 2 : phase === "planning" ? 1 : 0;
  return (
    <div data-testid="genesis-stepper" className="mx-auto mt-12 grid w-full max-w-[640px] grid-cols-4 gap-1 text-center text-xs font-semibold text-[#7c8492] sm:mt-16 sm:flex sm:items-center sm:justify-center sm:gap-5 sm:text-sm">
      {steps.map((step, index) => (
        <div key={step} data-testid="genesis-step" className="min-w-0 sm:flex sm:shrink-0 sm:items-center sm:gap-5">
          <span className={`mx-auto flex min-w-0 flex-col items-center gap-1 sm:flex-row sm:gap-2 ${index <= activeIndex ? "font-bold text-[#101827]" : ""}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs transition sm:h-8 sm:w-8 sm:text-sm ${index <= activeIndex ? "bg-[#101827] text-white shadow-[0_10px_24px_-16px_rgba(16,24,39,0.75)]" : "bg-[#f0efec]"}`}>{index + 1}</span>
            <span className="max-w-full truncate">{step}</span>
          </span>
          {index < steps.length - 1 && <span className={`hidden h-px w-14 sm:block ${index < activeIndex ? "bg-[#101827]" : "bg-[#d8d1c6]"}`} />}
        </div>
      ))}
    </div>
  );
}

function UploadCard({ title, subtitle, items, setItems }: { title: string; subtitle: string; items: string[]; setItems: (items: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onFilesChange(files?: FileList | null) {
    if (!files || files.length === 0) return;
    const freeSlots = Math.max(0, 6 - items.length);
    const selected = Array.from(files).slice(0, freeSlots);
    const nextItems = await Promise.all(
      selected.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(file);
          })
      )
    );
    setItems([...items, ...nextItems]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="rounded-[28px] border border-[#ded8cd] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,39,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0efec] text-[#808898]">
            <FileImage className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">{title}</h2>
            <p className="mt-1 text-sm text-[#697080]">{subtitle}</p>
          </div>
        </div>
        <span className="text-sm font-semibold text-[#7b8391]">{items.length}/6</span>
      </div>
      <div
        className="mt-6 min-h-[180px] cursor-pointer rounded-[24px] border-2 border-dashed border-[#ded8cd] bg-[#f4f2ee] px-4 py-6 text-center transition hover:border-[#bfb6aa] hover:bg-[#f1eee8]"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input ref={inputRef} data-testid="product-upload-input" className="hidden" type="file" accept="image/*" multiple onChange={(event) => void onFilesChange(event.target.files)} />
        {items.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {items.map((src, index) => (
              <div key={`${src}-${index}`} data-testid="product-upload-preview" className="group relative aspect-square overflow-hidden rounded-2xl border border-[#ded8cd] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`产品素材 ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-[#101827]/75 text-white group-hover:flex"
                  onClick={(event) => {
                    event.stopPropagation();
                    setItems(items.filter((_, itemIndex) => itemIndex !== index));
                  }}
                  aria-label="移除产品素材"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col items-center justify-center">
          <Upload className="h-7 w-7 text-[#8b93a1]" />
          <p className="mt-4 max-w-[480px] text-sm font-bold leading-7">
            多图上传建议仅上传必要的视角或 sku 图，图片不是越多越好
          </p>
        </div>
      </div>
    </section>
  );
}

function GenesisInputs({ brief, setBrief }: { brief: string; setBrief: (value: string) => void }) {
  return (
    <>
      <TextCard icon={<WandSparkles className="h-5 w-5" />} title="设计简报" subtitle="描述产品名称、核心卖点和希望呈现的主图风格。" value={brief} setValue={setBrief} placeholder="描述你的产品名称、核心卖点和想要的主图风格。" />
    </>
  );
}

function TextCard({ icon, title, subtitle, value, setValue, placeholder }: { icon: ReactNode; title: string; subtitle: string; value: string; setValue: (value: string) => void; placeholder: string }) {
  return (
    <section className="rounded-[28px] border border-[#ded8cd] bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0efec] text-[#808898]">{icon}</div>
        <div>
          <h2 className="text-xl font-extrabold">{title}</h2>
          <p className="mt-1 text-sm text-[#697080]">{subtitle}</p>
        </div>
      </div>
      <textarea className="studio-input studio-textarea-tall mt-5 resize-none py-4 leading-6" maxLength={300} placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} />
      <p className="mt-2 text-right text-xs text-[#8a919e]">最多 300 字，当前 {value.length}/300</p>
    </section>
  );
}

function DetailInputs({
  productName,
  setProductName,
  productDescription,
  setProductDescription,
  language,
  setLanguage,
  quantity,
  setQuantity,
  model,
  setModel,
  modelOptions,
  ratio,
  setRatio,
  resolution,
  setResolution,
  resolutionOptions
}: {
  productName: string;
  setProductName: (value: string) => void;
  productDescription: string;
  setProductDescription: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  quantity: string;
  setQuantity: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  modelOptions: string[];
  ratio: string;
  setRatio: (value: string) => void;
  resolution: string;
  setResolution: (value: string) => void;
  resolutionOptions: string[];
}) {
  return (
    <>
      <section className="rounded-[28px] border border-[#ded8cd] bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0efec] text-[#808898]">
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">生成设置</h2>
            <p className="mt-1 text-sm text-[#697080]">填写产品名称和描述，AI 会按这些内容生成详情图。</p>
          </div>
        </div>
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#566070]">产品名称（必填）</span>
            <input className="studio-input" maxLength={60} placeholder="例如：高弹舒适跑鞋" value={productName} onChange={(event) => setProductName(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#566070]">产品描述（选填）</span>
            <textarea className="studio-input h-32 resize-none py-4 leading-6" maxLength={300} placeholder="材质、卖点、目标人群、圣诞节氛围、卧室场景风格等" value={productDescription} onChange={(event) => setProductDescription(event.target.value)} />
            <span className="mt-2 block text-xs leading-5 text-[#8a919e]">描述写关键词、卖点、材质、场景风格等重要信息即可，不需要长篇大论，不写描述也可以。</span>
          </label>
        </div>

        <div className="mt-6 border-t border-[#ebe5da] pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="输出语言"><SelectLike value={language} onChange={setLanguage} options={languageOptions} /></Field>
            <Field label="生成数量"><SelectLike value={quantity} onChange={setQuantity} options={quantityOptions} /></Field>
            <Field label="模型"><SelectLike value={model} onChange={setModel} options={modelOptions} /></Field>
            <Field label="宽高比"><SelectLike value={ratio} onChange={setRatio} options={ratios.detail} /></Field>
          </div>
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-[#7d8492]">分辨率</p>
            <div className="flex flex-wrap gap-2">
              {resolutionOptions.map((item) => (
                <button key={item} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${resolution === item ? "bg-[#101827] text-white" : "border border-[#ded8cd] bg-[#f6f3ed] text-[#697080] hover:text-[#101827]"}`} type="button" onClick={() => setResolution(item)}>
                  {item}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-[#697080]">分辨率1K的图片用于电商平台清晰度完全足够。</p>
          </div>
        </div>
      </section>
    </>
  );
}

function SettingsPanel({
  mode,
  language,
  setLanguage,
  quantity,
  setQuantity,
  model,
  setModel,
  modelOptions,
  ratio,
  setRatio,
  resolution,
  setResolution,
  resolutionOptions
}: {
  mode: StudioMode;
  language: string;
  setLanguage: (value: string) => void;
  quantity: string;
  setQuantity: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  modelOptions: string[];
  ratio: string;
  setRatio: (value: string) => void;
  resolution: string;
  setResolution: (value: string) => void;
  resolutionOptions: string[];
}) {
  return (
    <section className="rounded-[28px] border border-[#ded8cd] bg-white p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="输出语言"><SelectLike value={language} onChange={setLanguage} options={languageOptions} /></Field>
        {mode === "genesis" && <Field label="生成数量"><SelectLike value={quantity} onChange={setQuantity} options={quantityOptions} /></Field>}
        <Field label="模型"><SelectLike value={model} onChange={setModel} options={modelOptions} /></Field>
        <Field label="宽高比"><SelectLike value={ratio} onChange={setRatio} options={ratios[mode]} /></Field>
      </div>
      <div className="mt-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-[#7d8492]">分辨率</p>
        <div className="flex flex-wrap gap-2">
              {resolutionOptions.map((item) => (
                <button key={item} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${resolution === item ? "bg-[#101827] text-white" : "border border-[#ded8cd] bg-[#f6f3ed] text-[#697080] hover:text-[#101827]"}`} type="button" onClick={() => setResolution(item)}>
                  {item}
                </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#697080]">分辨率1K的图片用于电商平台清晰度完全足够。</p>
      </div>
    </section>
  );
}

function ActionPanel({
  mode,
  detailMode,
  isGenerating,
  canGenerate,
  costCredits,
  insufficientCredits,
  errorMessage,
  onGenerate
}: {
  mode: StudioMode;
  detailMode: DetailMode;
  isGenerating: boolean;
  canGenerate: boolean;
  costCredits: number;
  insufficientCredits: boolean;
  errorMessage: string;
  onGenerate: () => void;
}) {
  const disabled = !canGenerate || insufficientCredits;
  const label = mode === "genesis" ? "生成主图" : detailMode === "connected" ? "生成一键长图" : "生成详情图";
  const cost = `消耗 ${costCredits} 积分`;
  const helperText = insufficientCredits ? cost : disabled ? (mode === "genesis" ? "请先上传产品素材并填写设计简报" : "请先上传产品素材并填写产品名称") : cost;
  return (
    <section className="rounded-[28px] border border-[#ded8cd] bg-white p-6">
      <button data-testid="main-generate-button" className="press-scale flex h-14 w-full items-center justify-center gap-2 rounded-[1.4rem] border border-[#172033] bg-[#101827] text-base font-bold text-[#f8f4ee] shadow-[0_14px_30px_-14px_rgba(16,24,39,0.38)] transition hover:-translate-y-px disabled:border-[#d7d2c7] disabled:bg-[#e7e2d9] disabled:text-[#8b8478]" disabled={disabled || isGenerating} type="button" onClick={onGenerate}>
        {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {isGenerating ? "生成中..." : label}
      </button>
      <p className="mt-3 text-center text-sm font-semibold text-[#697080]">{helperText}</p>
      {insufficientCredits && (
        <div data-testid="main-insufficient-credits" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          积分不足
          <Link className="ml-3 font-bold underline underline-offset-4" href="/pricing">购买积分</Link>
        </div>
      )}
      {errorMessage && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</p>}
    </section>
  );
}

function ResultPanel({ mode, phase, detailMode, quantity, ratio, model, images }: { mode: StudioMode; phase: string; detailMode: DetailMode; quantity: string; ratio: string; model: string; images: string[] }) {
  const hasOutput = images.length > 0 || phase === "complete";
  const [detailPreviewOpen, setDetailPreviewOpen] = useState(false);
  function downloadAllImages() {
    images.forEach((image, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = mediaUrl(image);
        link.download = `dake-${mode === "genesis" ? "main" : "detail"}-image-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 120);
    });
  }
  async function downloadStitchedImage() {
    if (images.length === 0) return;
    const loaded = await Promise.all(
      images.map(
        (src) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = mediaUrl(src);
          })
      )
    );
    const width = Math.max(...loaded.map((image) => image.naturalWidth || 1024));
    const height = loaded.reduce((sum, image) => sum + Math.round(((image.naturalHeight || 1024) * width) / (image.naturalWidth || width)), 0);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    let y = 0;
    loaded.forEach((image) => {
      const drawHeight = Math.round(((image.naturalHeight || 1024) * width) / (image.naturalWidth || width));
      context.drawImage(image, 0, y, width, drawHeight);
      y += drawHeight;
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "dake-detail-stitched.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <section className="rounded-[30px] border border-[#ded8cd] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,39,0.03)]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold">{mode === "genesis" ? "实时预览" : detailMode === "connected" ? "一键长图结果区" : "详情页结果"}</h2>
            <p className="mt-1 text-sm text-[#697080]">{mode === "genesis" ? "先上传产品图并填写简报，再开始生图。" : "生成后的详情页会显示在这里。"}</p>
          </div>
          {mode !== "genesis" && (
            <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
              <button className="studio-tool-btn min-w-[112px] flex-1 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none" type="button" disabled={images.length === 0} onClick={() => setDetailPreviewOpen(true)}><Images className="h-4 w-4" />拼接预览</button>
              <button className="studio-tool-btn min-w-[92px] flex-1 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none" type="button" disabled={images.length === 0} onClick={downloadAllImages}><Download className="h-4 w-4" />下载</button>
            </div>
          )}
        </div>

        {!hasOutput && phase === "idle" && (
          <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[24px] bg-[#f6f3ed] px-6 text-center">
            <ImagePlus className="h-12 w-12 text-[#8f97a5]" />
            <p className="mt-5 max-w-[360px] text-base leading-7 text-[#697080]">
              {mode === "genesis" ? "上传产品图并填写设计简报。点击生成主图，等待生成完成。" : "上传同款商品参考图、填写产品名称和产品描述，点击“生成详情图”开始。"}
            </p>
          </div>
        )}

        {mode === "genesis" && phase !== "idle" && <GenesisResult quantity={quantity} images={images} phase={phase} />}
        {mode !== "genesis" && phase !== "idle" && <DetailResult quantity={quantity} images={images} phase={phase} onOpenPreview={() => setDetailPreviewOpen(true)} />}
        {detailPreviewOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#101827]/55 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="flex max-h-[68vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_-36px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between gap-4 border-b border-[#ebe5da] px-5 py-4">
                <div>
                  <h3 className="font-extrabold">拼接预览</h3>
                  <p className="mt-1 text-xs text-[#697080]">按生成顺序纵向拼接为详情页长图</p>
                </div>
                <button className="rounded-full p-2 text-[#697080] hover:bg-[#f0efec] hover:text-[#101827]" type="button" onClick={() => setDetailPreviewOpen(false)} aria-label="关闭拼接预览">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[40vh] overflow-y-auto bg-[#f6f3ed] p-4">
                <div className="mx-auto max-w-[260px] overflow-hidden rounded-[22px] border border-[#e1dbd0] bg-white shadow-[0_18px_50px_-32px_rgba(16,24,39,0.4)]">
                  {images.map((image, index) => (
                    <div key={`${image}-stitched-preview-${index}`} className="border-b border-[#ebe5da] last:border-b-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="aspect-[3/4] w-full object-cover" src={mediaUrl(image)} alt={`详情图拼接预览 ${index + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#ebe5da] px-5 py-4">
                <button className="studio-tool-btn" type="button" onClick={() => setDetailPreviewOpen(false)}>关闭</button>
                <button className="studio-tool-btn bg-[#101827] text-white" type="button" onClick={() => void downloadStitchedImage()}>
                  <Download className="h-4 w-4" />
                  下载长图
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </aside>
  );
}

function formatEstimateUnit(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}分钟${rest}s` : `${minutes}分钟`;
}

function mainImageEstimate(count: number) {
  const safeCount = Math.max(1, count);
  return `${formatEstimateUnit(safeCount * 15)} ~ ${formatEstimateUnit(safeCount * 30)}`;
}

function detailImageEstimate(count: number) {
  const safeCount = Math.max(1, count);
  return `${formatEstimateUnit(safeCount * 30)} ~ ${formatEstimateUnit(safeCount * 45)}`;
}

function GeneratingState({ mode, count }: { mode: StudioMode; count: number }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[24px] bg-[#f6f3ed] px-6 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      <h3 className="mt-5 text-xl font-extrabold">{mode === "genesis" ? "正在生成主图蓝图..." : "AI 正在规划详情页结构..."}</h3>
      <div className="mt-5 h-2 w-full max-w-[360px] overflow-hidden rounded-full bg-[#e5ded2]">
        <div className="h-full w-2/3 rounded-full bg-blue-500" />
      </div>
      <p className="mt-4 text-sm text-[#697080]">{mode === "genesis" ? `预计 ${mainImageEstimate(count)}` : "预计 15 ~ 40s"}</p>
    </div>
  );
}

function GenesisResult({ quantity, images, phase }: { quantity: string; images: string[]; phase: string }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const count = Number.parseInt(quantity, 10) || 1;
  const displayImages = images.map((image) => mediaUrl(image));
  const activePreview = previewIndex === null ? "" : displayImages[previewIndex] || "";
  const isGenerating = phase === "planning" || phase === "preview";
  const movePreview = (step: number) => {
    setPreviewIndex((current) => {
      if (current === null || images.length === 0) return current;
      return (current + step + images.length) % images.length;
    });
  };

  if (images.length > 0) {
    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((image, index) => {
            const displayImage = displayImages[index] || mediaUrl(image);
            return (
            <div key={`${image}-${index}`} className="group relative overflow-hidden rounded-[22px] border border-[#e1dbd0] bg-[#f6f3ed]">
              <button className="block aspect-square w-full p-4" type="button" onClick={() => setPreviewIndex(index)} aria-label={`预览主图 ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="h-full w-full rounded-[18px] object-cover" src={displayImage} alt={`主图结果 ${index + 1}`} />
              </button>
              <a className="absolute bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#101827] opacity-0 shadow-[0_10px_24px_-14px_rgba(16,24,39,0.65)] transition hover:bg-[#101827] hover:text-white group-hover:opacity-100" href={displayImage} download={`dake-main-image-${index + 1}.png`} onClick={(event) => event.stopPropagation()} aria-label="下载图片">
                <Download className="h-4 w-4" />
              </a>
            </div>
            );
          })}
          {Array.from({ length: Math.max(0, count - images.length) }).map((_, slotIndex) => {
            const index = images.length + slotIndex;
            const activeLoading = isGenerating;
            return (
              <div key={`main-image-loading-${index}`} className="overflow-hidden rounded-[22px] border border-[#e1dbd0] bg-[#f6f3ed]">
                <MainImageProgressSlot active={activeLoading} index={index} />
              </div>
            );
          })}
        </div>
        {activePreview && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07101f]/75 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="relative flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#e7ecf0] px-5 py-4">
                <p className="text-sm font-bold text-[#5f6674]">{previewIndex! + 1} / {images.length}</p>
                <div className="flex items-center gap-2">
                  <a className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101827] text-white transition hover:bg-black" href={activePreview} download={`dake-main-image-${previewIndex! + 1}.png`} aria-label="下载图片">
                    <Download className="h-4 w-4" />
                  </a>
                  <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2f5] text-[#5f6674] hover:text-[#101827]" type="button" onClick={() => setPreviewIndex(null)} aria-label="关闭">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#f4f8fb] p-4">
                {images.length > 1 && (
                  <button className="absolute left-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#101827] shadow-lg transition hover:bg-[#101827] hover:text-white" type="button" onClick={() => movePreview(-1)} aria-label="上一张">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="max-h-[76vh] w-auto max-w-full rounded-2xl object-contain shadow-sm" src={activePreview} alt="主图预览" />
                {images.length > 1 && (
                  <button className="absolute right-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#101827] shadow-lg transition hover:bg-[#101827] hover:text-white" type="button" onClick={() => movePreview(1)} aria-label="下一张">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[22px] border border-[#e1dbd0] bg-[#f6f3ed]">
          <MainImageProgressSlot active={isGenerating} index={index} />
        </div>
      ))}
    </div>
  );
}

function MainImageProgressSlot({ active, index }: { active: boolean; index: number }) {
  return (
    <div className="aspect-square p-4">
      <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-[#fffdf9] via-[#f4f1ea] to-[#ebe3d8]">
        {active ? (
          <div className="flex flex-col items-center gap-4 text-[#101827]">
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_18px_42px_-24px_rgba(16,24,39,0.55)]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </span>
            <span className="text-sm font-semibold text-[#697080]">正在生成第 {index + 1} 张</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-[#8f97a5]">
            <ImagePlus className="h-9 w-9" />
            <span className="text-sm font-semibold">等待生成</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailResult({ quantity, images, phase, onOpenPreview }: { quantity: string; images: string[]; phase: string; onOpenPreview: () => void }) {
  const count = Number.parseInt(quantity, 10) || 1;
  const isGenerating = phase === "planning" || phase === "preview";
  const displayImages = images.map((image) => mediaUrl(image));
  return (
    <div className="space-y-4">
      {isGenerating && <p className="text-sm font-semibold text-[#697080]">预计 {detailImageEstimate(count)}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {images.map((image, index) => {
          const displayImage = displayImages[index] || mediaUrl(image);
          return (
          <div key={`${image}-detail-card-${index}`} className="group relative overflow-hidden rounded-[22px] border border-[#e1dbd0] bg-[#f6f3ed]">
            <button className="block aspect-[3/4] w-full p-4" type="button" onClick={onOpenPreview} aria-label={`查看详情图 ${index + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-full w-full rounded-[18px] object-cover" src={displayImage} alt={`详情图结果 ${index + 1}`} />
            </button>
            <a className="absolute bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#101827] opacity-0 shadow-[0_10px_24px_-14px_rgba(16,24,39,0.65)] transition hover:bg-[#101827] hover:text-white group-hover:opacity-100" href={displayImage} download={`dake-detail-image-${index + 1}.png`} onClick={(event) => event.stopPropagation()} aria-label="下载图片">
              <Download className="h-4 w-4" />
            </a>
          </div>
          );
        })}
        {Array.from({ length: Math.max(0, count - images.length) }).map((_, slotIndex) => {
          const index = images.length + slotIndex;
          const activeLoading = isGenerating;
          return (
            <div key={`detail-image-loading-${index}`} className="overflow-hidden rounded-[22px] border border-[#e1dbd0] bg-[#f6f3ed]">
              <DetailImageProgressSlot active={activeLoading} index={index} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailImageProgressSlot({ active, index }: { active: boolean; index: number }) {
  return (
    <div className="aspect-[3/4] p-4">
      <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-[#fffdf9] via-[#f4f1ea] to-[#ebe3d8]">
        {active ? (
          <div className="flex flex-col items-center gap-4 text-[#101827]">
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_18px_42px_-24px_rgba(16,24,39,0.55)]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </span>
            <span className="text-sm font-semibold text-[#697080]">正在生成第 {index + 1} 张</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-[#8f97a5]">
            <ImagePlus className="h-9 w-9" />
            <span className="text-sm font-semibold">等待生成</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block min-w-0 max-w-full">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.06em] text-[#7d8492]">{label}</span>
      {children}
    </div>
  );
}

function SelectLike({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative min-w-0 max-w-full"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setOpen(false);
      }}
    >
      <button className="studio-input flex w-full min-w-0 max-w-full items-center justify-between gap-3 pr-4 text-left text-sm" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#8b93a1] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 w-full overflow-y-auto rounded-2xl border border-[#d8d1c6] bg-white py-2 shadow-[0_18px_42px_-26px_rgba(16,24,39,0.45)]" role="listbox">
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition ${selected ? "bg-[#101827] font-bold text-white" : "text-[#101827] hover:bg-[#f0efec]"}`}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{option}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
