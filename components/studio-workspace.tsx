"use client";

import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileImage,
  ImagePlus,
  Images,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
  WandSparkles,
  X
} from "lucide-react";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { notifyAuthChanged, refreshAuthUser, type DakeUser, useAuthToken, useAuthUser } from "@/components/auth-state";
import { ImageLightbox } from "@/components/image-lightbox";
import { downloadImage } from "@/lib/download-image";
import type { DragEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type StudioMode = "genesis" | "detail";
type DetailMode = "connected" | "separate";
type StudioPhase = "idle" | "planning" | "preview" | "complete";
type GenesisEdition = "smart" | "professional";
type ModuleOption = [string, string, string];
type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

type MainImagePayload = {
  id: number;
  status?: string;
  images: string[];
  tasks?: ImageTask[];
  cost_credits: number;
  user: DakeUser;
};
type ImageTask = { id: number; task_index: number; task_id: string; status: string; image_url?: string; error_message?: string; progress?: number };
type ImageTaskStatusPayload = {
  id: number;
  status: string;
  done: boolean;
  images: string[];
  tasks: ImageTask[];
  user: DakeUser;
};
type ReferenceUploadPayload = {
  images: Array<{ path?: string; url?: string }>;
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
  ["去水印", "/watermark-remover"],
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["视频生成", "/video-studio"],
  ["套餐", "/pricing"]
];

const defaultModelOptions = ["GPT Image 2", "Nano Banana 2"];
const ratios = {
  genesis: ["1:1 方图", "2:3 竖版", "3:2 横版", "3:4 竖版", "4:3 横版", "16:9 宽图", "4:5 竖版", "5:4 横版", "9:16 长图"],
  detail: ["3:4 竖版", "1:1 方图", "16:9 宽图", "4:5 竖图", "9:16 长图"]
};
const languageOptions = [
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
const visualStyleOptions = ["简约清新风", "高级质感风", "活泼吸睛风", "复古怀旧风", "场景写实风", "科技未来风", "国风古韵风"];
const genesisModuleOptions: ModuleOption[] = [
  ["hero_kv", "首屏 KV", "建立第一眼识别"],
  ["overall_display", "整体展示", "完整形态与高级氛围"],
  ["detail_closeup", "细节特写", "放大材质与工艺"],
  ["usage_scene", "使用场景", "呈现真实使用状态"],
  ["multi_color", "多色套装", "展示多 SKU 与组合美感"],
  ["feature_compare", "功能对比", "参数、功效与差异说明"],
  ["package_display", "包装展示", "礼盒、配件与开箱细节"],
  ["trust_guarantee", "权益保障", "售后、质保与信任背书"]
] as const;
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const homeDraftKey = "dake_home_generation_draft";
const maxReferenceImageSize = 30 * 1024 * 1024;
const maxVisionReferenceImageSize = 9.5 * 1024 * 1024;

function mediaUrl(src: string) {
  if (!src) return "";
  if (src.startsWith("data:") || /^https?:\/\//i.test(src)) return src;
  return `${apiBase}${src.startsWith("/") ? src : `/${src}`}`;
}

function aspectRatioStyle(ratio: string) {
  const match = String(ratio || "").match(/(\d+)\s*:\s*(\d+)/);
  return match ? `${match[1]} / ${match[2]}` : "1 / 1";
}

function orderedTaskSlots(tasks: ImageTask[], quantity: string) {
  const count = Number.parseInt(quantity, 10) || 1;
  return Array.from({ length: count }, (_, index) => tasks.find((task) => Number(task.task_index) === index + 1) || null);
}

function imageBlobFromCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("图片压缩失败"));
    }, "image/jpeg", quality);
  });
}

function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    image.src = url;
  });
}

async function normalizeStudioReferenceImage(file: File): Promise<File> {
  if (file.size > maxReferenceImageSize) {
    throw new Error("单张参考图最大 30M");
  }
  if (file.size <= maxVisionReferenceImageSize || !file.type.startsWith("image/")) {
    return file;
  }

  const image = await loadImageFile(file);
  let maxSide = Math.min(4096, Math.max(image.naturalWidth, image.naturalHeight));
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];
  let fallback: File | null = null;

  for (let round = 0; round < 5; round += 1) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("图片压缩失败");
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const blob = await imageBlobFromCanvas(canvas, quality);
      const filename = file.name.replace(/\.[^.]+$/, "") || "reference-image";
      const compressed = new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
      fallback = compressed;
      if (blob.size <= maxVisionReferenceImageSize) {
        return compressed;
      }
    }
    maxSide = Math.max(1200, Math.round(maxSide * 0.72));
  }

  return fallback && fallback.size < file.size ? fallback : file;
}

async function uploadStudioReferenceImage(file: File, token: string): Promise<string[]> {
  const normalizedFile = await normalizeStudioReferenceImage(file);
  const formData = new FormData();
  formData.append("image", normalizedFile);
  const response = await fetch(`${apiBase}/api/reference-images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const result = await readApi<ReferenceUploadPayload>(response);
  return (result.data.images || [])
    .map((item) => item.url || item.path || "")
    .filter(Boolean)
    .map((src) => mediaUrl(src));
}

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();
  let payload: ApiResponse<T>;
  try {
    payload = JSON.parse(text) as ApiResponse<T>;
  } catch {
    if (response.status === 413) {
      throw new Error("图片过大，单张参考图最大 30M");
    }
    if (response.status === 504) {
      throw new Error("请求处理超时，请稍后重试");
    }
    throw new Error(response.ok ? "请求失败" : `请求失败（${response.status}）`);
  }
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

const detailModules: ModuleOption[] = [
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
  ["usage-tips", "使用建议图", "商品使用的注意事项"]
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
  const [genesisEdition, setGenesisEdition] = useState<GenesisEdition>("smart");
  const [genesisVisualStyle, setGenesisVisualStyle] = useState("");
  const [genesisModules, setGenesisModules] = useState<string[]>([]);
  const [detailLanguage, setDetailLanguage] = useState("中文");
  const [detailModel, setDetailModel] = useState(defaultModelOptions[0]);
  const [detailRatio, setDetailRatio] = useState("3:4 竖版");
  const [detailResolution, setDetailResolution] = useState("标清 1K");
  const [detailQuantity, setDetailQuantity] = useState("1 张");
  const [detailEdition, setDetailEdition] = useState<GenesisEdition>("professional");
  const [detailVisualStyle, setDetailVisualStyle] = useState("");
  const [detailSelectedModules, setDetailSelectedModules] = useState<string[]>([]);
  const [brief, setBrief] = useState("");
  const [genesisUploads, setGenesisUploads] = useState<string[]>([]);
  const [detailUploads, setDetailUploads] = useState<string[]>([]);
  const [mainImages, setMainImages] = useState<string[]>([]);
  const [mainTasks, setMainTasks] = useState<ImageTask[]>([]);
  const [mainRecordId, setMainRecordId] = useState<number | null>(null);
  const [mainError, setMainError] = useState("");
  const [detailImages, setDetailImages] = useState<string[]>([]);
  const [detailTasks, setDetailTasks] = useState<ImageTask[]>([]);
  const [detailRecordId, setDetailRecordId] = useState<number | null>(null);
  const [detailError, setDetailError] = useState("");
  const [retryingTaskId, setRetryingTaskId] = useState<number | null>(null);
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
            subtitle: "智能识别产品视觉风格与宣传文案，一键批量生成平台标准化专业主图"
          }
        : {
            badge: "详情页规划",
            title: "详情图生成",
            subtitle: "上传产品实拍图，智能识别产品结构、核心卖点，快速生成多角度、多场景全套详情视觉素材。"
          },
    [mode]
  );

  const activeModel = mode === "genesis" ? genesisModel : detailModel;
  const activeRatio = mode === "genesis" ? genesisRatio : detailRatio;
  const activePhase = mode === "genesis" ? genesisPhase : detailPhase;
  const activeUploads = mode === "genesis" ? genesisUploads : detailUploads;
  const quantityCount = genesisEdition === "professional" ? genesisModules.length : Number.parseInt(genesisQuantity, 10) || 1;
  const detailQuantityCount = detailEdition === "professional" ? detailSelectedModules.length : Number.parseInt(detailQuantity, 10) || 1;
  const mainImageCost = configuredCost(mainConfigs, genesisModel, activeGenesisResolution, 30) * quantityCount;
  const detailImageCost = configuredCost(detailConfigs, detailModel, activeDetailResolution, 30) * detailQuantityCount;
  const activeCost = mode === "genesis" ? mainImageCost : detailImageCost;
  const hasCreditSnapshot = typeof user?.credits === "number";
  const canFillGenesis = genesisUploads.length > 0 && brief.trim().length > 0 && (genesisEdition === "smart" || genesisModules.length > 0);
  const canFillDetail = detailUploads.length > 0 && detailProductDescription.trim().length > 0 && (detailEdition === "smart" || detailSelectedModules.length > 0);
  const insufficientCredits = (mode === "genesis" ? canFillGenesis : canFillDetail) && hasCreditSnapshot && activeCost > Number(user?.credits || 0);

  useEffect(() => {
    if (!token) return;
    void refreshAuthUser(apiBase).catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    try {
      const raw = window.localStorage.getItem(homeDraftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as { target?: string; prompt?: string; images?: string[]; createdAt?: number };
      const images = (Array.isArray(draft.images) ? draft.images : []).filter((src) => typeof src === "string" && src).slice(0, 6);
      if (draft.target === "/studio-genesis") {
        setMode("genesis");
        setBrief(String(draft.prompt || ""));
        setGenesisUploads(images);
        window.localStorage.removeItem(homeDraftKey);
      } else if (draft.target === "/ecom-studio") {
        setMode("detail");
        setDetailProductDescription(String(draft.prompt || ""));
        setDetailUploads(images);
        window.localStorage.removeItem(homeDraftKey);
      }
    } catch {
      window.localStorage.removeItem(homeDraftKey);
    }
  }, [token]);

  function switchMode(nextMode: StudioMode) {
    setMode(nextMode);
    window.history.replaceState(null, "", nextMode === "genesis" ? "/studio-genesis" : "/ecom-studio");
    if (token) void refreshAuthUser(apiBase).catch(() => undefined);
  }

  function changeGenesisModel(nextModel: string) {
    setGenesisModel(nextModel);
    setGenesisResolution(configuredResolutions(mainConfigs, nextModel)[0] || "标清 1K");
  }

  function changeDetailModel(nextModel: string) {
    setDetailModel(nextModel);
    setDetailResolution(configuredResolutions(detailConfigs, nextModel)[0] || "标清 1K");
  }

  async function pollImageTasks(recordId: number, setImages: (updater: (current: string[]) => string[]) => void, setTasks: (tasks: ImageTask[]) => void) {
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
      setTasks(result.data.tasks || []);
      if (result.data.done) {
        return result.data;
      }
    }
    throw new Error("生成任务仍在处理中，请稍后到生成记录查看结果");
  }

  async function retryTask(recordId: number | null, taskId: number, setImages: (updater: (current: string[]) => string[]) => void, setTasks: (tasks: ImageTask[]) => void, setPhase: (phase: StudioPhase) => void, setError: (message: string) => void) {
    if (!token || !recordId || retryingTaskId !== null) return;
    setRetryingTaskId(taskId);
    setError("");
    setPhase("preview");
    try {
      const response = await fetch(`${apiBase}/api/image-task-retry`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ task_id: taskId, record_id: recordId })
      });
      const result = await readApi<ImageTaskStatusPayload>(response);
      window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
      notifyAuthChanged();
      setImages(() => result.data.images || []);
      setTasks(result.data.tasks || []);
      await pollImageTasks(recordId, setImages, setTasks);
      setPhase("complete");
    } catch (event) {
      setError("生成失败");
      setPhase("complete");
    } finally {
      setRetryingTaskId(null);
    }
  }

  async function generate() {
    if (mode === "genesis") {
      const cleanBrief = brief.trim();
      const selectedModuleNames = genesisModuleOptions.filter(([key]) => genesisModules.includes(key)).map(([, title]) => title);
      if (!token || !canFillGenesis || insufficientCredits || isGenerating) return;

      setGenesisPhase("planning");
      setMainError("");
      setMainImages([]);
      setMainTasks([]);
      setMainRecordId(null);

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
            edition: genesisEdition,
            visual_style: genesisEdition === "professional" ? genesisVisualStyle.trim() : "",
            modules: genesisEdition === "professional" ? selectedModuleNames : [],
            images: genesisUploads
          })
        });
        const result = await readApi<MainImagePayload>(response);
        window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
        notifyAuthChanged();
        setMainRecordId(result.data.id);
        setMainTasks(result.data.tasks || []);
        const finalResult = await pollImageTasks(result.data.id, setMainImages, setMainTasks);
        if (finalResult.status === "failed" && (finalResult.images || []).length === 0) {
          setMainError("生成失败");
        }
        setGenesisPhase("complete");
      } catch (event) {
        setMainError("生成失败");
        setGenesisPhase(mainTasks.length > 0 || mainImages.length > 0 ? "complete" : "idle");
      }
      return;
    }
    const selectedDetailModuleNames = detailModules.filter(([key]) => detailSelectedModules.includes(key)).map(([, title]) => title);
    if (!token || !canFillDetail || insufficientCredits || isGenerating) return;
    setDetailPhase("planning");
    setDetailError("");
    setDetailImages([]);
    setDetailTasks([]);
    setDetailRecordId(null);
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
          product_name: "",
          product_description: detailProductDescription.trim(),
          model: detailModel,
          ratio: detailRatio,
          language: detailLanguage,
          resolution: activeDetailResolution,
          count: detailQuantityCount,
          edition: detailEdition,
          visual_style: detailEdition === "professional" ? detailVisualStyle.trim() : "",
          modules: detailEdition === "professional" ? selectedDetailModuleNames : [],
          reference_count: detailUploads.length,
          images: detailUploads
        })
      });
      const result = await readApi<MainImagePayload>(response);
      window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
      notifyAuthChanged();
      setDetailRecordId(result.data.id);
      setDetailTasks(result.data.tasks || []);
      const finalResult = await pollImageTasks(result.data.id, setDetailImages, setDetailTasks);
      if (finalResult.status === "failed" && (finalResult.images || []).length === 0) {
        setDetailError("生成失败");
      }
      setDetailPhase("complete");
    } catch (event) {
      setDetailError("生成失败");
      setDetailPhase(detailTasks.length > 0 || detailImages.length > 0 ? "complete" : "idle");
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

          {mode === "genesis" ? (
            <GenesisEditionSwitch value={genesisEdition} onChange={setGenesisEdition} />
          ) : (
            <GenesisEditionSwitch
              value={detailEdition}
              onChange={setDetailEdition}
              smartDescription="智能版 · AI 自动规划详情图内容与文案"
              professionalDescription="专业版 · 自主选择详情页模块与视觉风格"
            />
          )}

          <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(420px,0.86fr)] lg:items-start">
            <div className="space-y-6">
              <UploadCard
                title="产品素材"
                subtitle={mode === "genesis" ? "上传不同角度产品图或细节图效果更佳。" : "上传多视角、画面清晰的产品白底图，展示效果更佳"}
                items={activeUploads}
                setItems={mode === "genesis" ? setGenesisUploads : setDetailUploads}
                token={token || ""}
              />

              {mode === "genesis" ? (
                <>
                  <GenesisInputs brief={brief} setBrief={setBrief} />
                  <SettingsPanel
                    mode={mode}
                    genesisEdition={genesisEdition}
                    language={genesisLanguage}
                    setLanguage={setGenesisLanguage}
                    quantity={genesisQuantity}
                    setQuantity={setGenesisQuantity}
                    visualStyle={genesisVisualStyle}
                    setVisualStyle={setGenesisVisualStyle}
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
                  detailEdition={detailEdition}
                  productDescription={detailProductDescription}
                  setProductDescription={setDetailProductDescription}
                  language={detailLanguage}
                  setLanguage={setDetailLanguage}
                  quantity={detailQuantity}
                  setQuantity={setDetailQuantity}
                  visualStyle={detailVisualStyle}
                  setVisualStyle={setDetailVisualStyle}
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

              {mode === "genesis" && genesisEdition === "professional" && (
                <GenesisModuleSelector selected={genesisModules} onChange={setGenesisModules} />
              )}
              {mode === "detail" && detailEdition === "professional" && (
                <GenesisModuleSelector
                  title="详情页模块（多选）"
                  subtitle="每个模块对应生成 1 张详情图。"
                  options={detailModules}
                  selected={detailSelectedModules}
                  onChange={setDetailSelectedModules}
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
                disabledMessage={
                  mode === "genesis" && genesisEdition === "professional" && genesisUploads.length > 0 && brief.trim().length > 0 && genesisModules.length === 0
                    ? "请至少选择 1 个主图模块"
                    : mode === "detail" && detailEdition === "professional" && detailUploads.length > 0 && detailProductDescription.trim().length > 0 && detailSelectedModules.length === 0
                      ? "请至少选择 1 个详情页模块"
                      : undefined
                }
                onGenerate={generate}
              />
            </div>

            <ResultPanel
              mode={mode}
              phase={activePhase}
              detailMode={detailMode}
              quantity={mode === "genesis" ? `${Math.max(quantityCount, 1)} 张` : `${Math.max(detailQuantityCount, 1)} 张`}
              ratio={activeRatio}
              model={activeModel}
              images={mode === "genesis" ? mainImages : detailImages}
              tasks={mode === "genesis" ? mainTasks : detailTasks}
              retryingTaskId={retryingTaskId}
              onRetryTask={(taskId) =>
                mode === "genesis"
                  ? void retryTask(mainRecordId, taskId, setMainImages, setMainTasks, setGenesisPhase, setMainError)
                  : void retryTask(detailRecordId, taskId, setDetailImages, setDetailTasks, setDetailPhase, setDetailError)
              }
            />
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
          <span className="font-display text-xl font-extrabold tracking-tight">Xinglu</span>
          <span className="text-xs font-medium text-text-tertiary">AI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(([label, href]) => {
            const selected = (activeMode === "genesis" && label === "主图") || (activeMode === "detail" && label === "详情图");
            const button = (
              <span className={`inline-flex h-10 items-center whitespace-nowrap rounded-[14px] px-4 text-sm font-semibold transition ${selected ? "bg-[#101827] text-white" : "text-[#5f6674] hover:bg-[#ede8df] hover:text-[#101827]"}`}>
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

function GenesisEditionSwitch({
  value,
  onChange,
  smartDescription = "智能版 · AI 自动规划主图构图与文案",
  professionalDescription = "专业版 · 自主选择主图模块与视觉风格"
}: {
  value: GenesisEdition;
  onChange: (value: GenesisEdition) => void;
  smartDescription?: string;
  professionalDescription?: string;
}) {
  return (
    <div className="mx-auto mt-12 flex flex-col items-center gap-3 sm:mt-16">
      <div className="inline-flex rounded-full border border-[#e5ded2] bg-white p-1 shadow-[0_10px_30px_-24px_rgba(16,24,39,0.45)]">
        {[
          ["smart", "智能版"],
          ["professional", "专业版"]
        ].map(([key, label]) => {
          const active = value === key;
          return (
            <button
              key={key}
              className={`h-10 min-w-[86px] rounded-full px-5 text-sm font-bold transition ${active ? "bg-[#101827] text-white shadow-[0_12px_26px_-18px_rgba(16,24,39,0.8)]" : "text-[#697080] hover:text-[#101827]"}`}
              type="button"
              onClick={() => onChange(key as GenesisEdition)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-sm font-medium text-[#697080]">
        {value === "smart" ? smartDescription : professionalDescription}
      </p>
    </div>
  );
}

function GenesisModuleSelector({
  selected,
  onChange,
  options = genesisModuleOptions,
  title = "模块选择（多选）",
  subtitle = "每个模块对应生成 1 张主图。"
}: {
  selected: string[];
  onChange: (value: string[]) => void;
  options?: ModuleOption[];
  title?: string;
  subtitle?: string;
}) {
  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  }

  return (
    <section className="rounded-[28px] border border-[#ded8cd] bg-white p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold">{title}</h3>
          <p className="mt-1 text-sm text-[#697080]">{subtitle}</p>
        </div>
        <span className="text-xs font-medium text-[#8b909a]">已选 {selected.length}/{options.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map(([key, title, desc]) => {
          const active = selected.includes(key);
          return (
            <button
              key={key}
              className={`relative min-h-[82px] rounded-2xl border px-5 py-4 pr-12 text-left transition ${active ? "border-[#101827] bg-[#fbfaf8] shadow-[0_12px_30px_-24px_rgba(16,24,39,0.55)]" : "border-[#ded8cd] bg-[#fbfaf8] hover:border-[#101827]/55"}`}
              type="button"
              onClick={() => toggle(key)}
            >
              {active && (
                <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#101827] text-white">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </span>
              )}
              <span className="block text-base font-extrabold text-[#101827]">{title}</span>
              <span className="mt-2 block text-sm font-medium text-[#697080]">{desc}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function UploadCard({ title, subtitle, items, setItems, token }: { title: string; subtitle: string; items: string[]; setItems: (items: string[]) => void; token: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  async function uploadFiles(files?: FileList | File[] | null) {
    if (!files || files.length === 0 || uploading) return;
    if (!token) {
      setUploadError("请先登录后再上传图片");
      return;
    }
    const freeSlots = Math.max(0, 6 - items.length);
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, freeSlots);
    if (selected.length === 0) {
      setUploadError(freeSlots <= 0 ? "最多上传 6 张产品素材" : "请上传图片文件");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const nextItems: string[] = [];
      for (const file of selected) {
        const uploaded = await uploadStudioReferenceImage(file, token);
        nextItems.push(...uploaded);
      }
      setItems([...items, ...nextItems].slice(0, 6));
    } catch (event) {
      setUploadError(event instanceof Error ? event.message : "图片上传失败，请稍后重试");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onFilesChange(files?: FileList | null) {
    await uploadFiles(files);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!uploading) setDragActive(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    void uploadFiles(event.dataTransfer.files);
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
        className={`mt-6 min-h-[180px] cursor-pointer rounded-[24px] border-2 border-dashed px-4 py-6 text-center transition ${dragActive ? "border-[#101827] bg-[#eeeae2]" : "border-[#ded8cd] bg-[#f4f2ee] hover:border-[#bfb6aa] hover:bg-[#f1eee8]"}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
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
          {uploading ? <Loader2 className="h-7 w-7 animate-spin text-[#8b93a1]" /> : <Upload className="h-7 w-7 text-[#8b93a1]" />}
          <p className="mt-4 max-w-[480px] text-sm font-bold leading-7">
            {uploading ? "图片上传中..." : dragActive ? "松开鼠标上传产品素材" : "点击或拖拽图片到这里上传产品素材"}
          </p>
          {!uploading && !dragActive && <p className="mt-1 text-xs text-[#8a919e]">最多 6 张，单张最大 30M</p>}
          {uploadError && <p className="mt-3 text-sm font-semibold text-red-600">{uploadError}</p>}
        </div>
      </div>
    </section>
  );
}

function GenesisInputs({ brief, setBrief }: { brief: string; setBrief: (value: string) => void }) {
  return (
    <>
      <TextCard icon={<WandSparkles className="h-5 w-5" />} title="设计简报" subtitle="描述产品名称、核心卖点和具体参数。" value={brief} setValue={setBrief} placeholder="描述你的产品名称、核心卖点和产品具体参数。" />
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
  detailEdition,
  productDescription,
  setProductDescription,
  language,
  setLanguage,
  quantity,
  setQuantity,
  visualStyle,
  setVisualStyle,
  model,
  setModel,
  modelOptions,
  ratio,
  setRatio,
  resolution,
  setResolution,
  resolutionOptions
}: {
  detailEdition: GenesisEdition;
  productDescription: string;
  setProductDescription: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  quantity: string;
  setQuantity: (value: string) => void;
  visualStyle: string;
  setVisualStyle: (value: string) => void;
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
            <p className="mt-1 text-sm text-[#697080]">填写核心卖点，AI 会按这些内容生成详情图。</p>
          </div>
        </div>
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#566070]">核心卖点</span>
            <textarea className="studio-input h-40 resize-none py-4 leading-6" maxLength={500} placeholder={"建议包含以下信息生成更精准:  \n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.具体参数"} value={productDescription} onChange={(event) => setProductDescription(event.target.value)} />
          </label>
        </div>

        <div className="mt-6 border-t border-[#ebe5da] pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="输出语言"><SelectLike value={language} onChange={setLanguage} options={languageOptions} /></Field>
            {detailEdition === "smart" && <Field label="生成数量"><SelectLike value={quantity} onChange={setQuantity} options={quantityOptions} /></Field>}
            {detailEdition === "professional" && <Field label="视觉风格"><ComboSelectLike value={visualStyle} onChange={setVisualStyle} options={visualStyleOptions} placeholder="请选择，或直接输入" /></Field>}
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
  genesisEdition = "smart",
  language,
  setLanguage,
  quantity,
  setQuantity,
  visualStyle = "",
  setVisualStyle,
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
  genesisEdition?: GenesisEdition;
  language: string;
  setLanguage: (value: string) => void;
  quantity: string;
  setQuantity: (value: string) => void;
  visualStyle?: string;
  setVisualStyle?: (value: string) => void;
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
        {mode === "genesis" && genesisEdition === "smart" && <Field label="生成数量"><SelectLike value={quantity} onChange={setQuantity} options={quantityOptions} /></Field>}
        {mode === "genesis" && genesisEdition === "professional" && <Field label="视觉风格"><ComboSelectLike value={visualStyle} onChange={setVisualStyle || (() => undefined)} options={visualStyleOptions} placeholder="请选择，或直接输入" /></Field>}
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
  disabledMessage,
  onGenerate
}: {
  mode: StudioMode;
  detailMode: DetailMode;
  isGenerating: boolean;
  canGenerate: boolean;
  costCredits: number;
  insufficientCredits: boolean;
  errorMessage: string;
  disabledMessage?: string;
  onGenerate: () => void;
}) {
  const disabled = !canGenerate || insufficientCredits;
  const label = mode === "genesis" ? "生成主图" : detailMode === "connected" ? "生成一键长图" : "生成详情图";
  const cost = `消耗 ${costCredits} 积分`;
  const helperText = insufficientCredits ? cost : disabled ? (disabledMessage || (mode === "genesis" ? "请先上传产品素材并填写设计简报" : "请先上传产品素材并填写核心卖点")) : cost;
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

function ResultPanel({
  mode,
  phase,
  detailMode,
  quantity,
  ratio,
  images,
  tasks,
  retryingTaskId,
  onRetryTask
}: {
  mode: StudioMode;
  phase: string;
  detailMode: DetailMode;
  quantity: string;
  ratio: string;
  model: string;
  images: string[];
  tasks: ImageTask[];
  retryingTaskId: number | null;
  onRetryTask: (taskId: number) => void;
}) {
  const successfulImages = tasks.length > 0
    ? tasks
        .slice()
        .sort((a, b) => Number(a.task_index) - Number(b.task_index))
        .map((task) => task.image_url || "")
        .filter(Boolean)
    : images;
  const hasOutput = successfulImages.length > 0 || tasks.length > 0 || phase === "complete";
  const [detailPreviewOpen, setDetailPreviewOpen] = useState(false);
  const [detailLightboxIndex, setDetailLightboxIndex] = useState<number | null>(null);
  const detailDisplayImages = successfulImages.map((image) => mediaUrl(image));
  function downloadAllImages() {
    successfulImages.forEach((image, index) => {
      window.setTimeout(() => {
        void downloadImage(mediaUrl(image), `dake-${mode === "genesis" ? "main" : "detail"}-image-${index + 1}.png`);
      }, index * 120);
    });
  }
  async function downloadStitchedImage() {
    if (successfulImages.length === 0) return;
    const loaded = await Promise.all(
      successfulImages.map(
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
    await downloadImage(canvas.toDataURL("image/png"), "xinglu-detail-stitched.png");
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
              <button className="studio-tool-btn min-w-[112px] flex-1 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none" type="button" disabled={successfulImages.length === 0} onClick={() => setDetailPreviewOpen(true)}><Images className="h-4 w-4" />拼接预览</button>
              <button className="studio-tool-btn min-w-[92px] flex-1 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none" type="button" disabled={successfulImages.length === 0} onClick={downloadAllImages}><Download className="h-4 w-4" />下载</button>
            </div>
          )}
        </div>

        {!hasOutput && phase === "idle" && (
          <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[24px] bg-[#f6f3ed] px-6 text-center">
            <ImagePlus className="h-12 w-12 text-[#8f97a5]" />
            <p className="mt-5 max-w-[360px] text-base leading-7 text-[#697080]">
              {mode === "genesis" ? "上传产品图并填写设计简报。点击生成主图，等待生成完成。" : "上传同款商品参考图、填写核心卖点，点击“生成详情图”开始。"}
            </p>
          </div>
        )}

        {mode === "genesis" && phase !== "idle" && <GenesisResult quantity={quantity} ratio={ratio} images={images} tasks={tasks} phase={phase} retryingTaskId={retryingTaskId} onRetryTask={onRetryTask} />}
        {mode !== "genesis" && phase !== "idle" && <DetailResult quantity={quantity} ratio={ratio} images={images} tasks={tasks} phase={phase} retryingTaskId={retryingTaskId} onRetryTask={onRetryTask} onOpenPreview={setDetailLightboxIndex} />}
        {detailLightboxIndex !== null && (
          <ImageLightbox images={detailDisplayImages} initialIndex={detailLightboxIndex} filenamePrefix="xinglu-detail-image" onClose={() => setDetailLightboxIndex(null)} />
        )}
        {detailPreviewOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07101f]/75 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-[#ebe5da] px-5 py-4">
                <div>
                  <h3 className="font-extrabold">拼接预览</h3>
                  <p className="mt-1 text-xs text-[#697080]">按生成顺序纵向拼接为详情页长图</p>
                </div>
                <button className="rounded-full p-2 text-[#697080] hover:bg-[#f0efec] hover:text-[#101827]" type="button" onClick={() => setDetailPreviewOpen(false)} aria-label="关闭拼接预览">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[76vh] overflow-y-auto bg-[#f4f8fb] p-4">
                <div className="mx-auto max-w-[560px] overflow-hidden rounded-[22px] border border-[#e1dbd0] bg-white shadow-[0_18px_50px_-32px_rgba(16,24,39,0.4)]">
                  {successfulImages.map((image, index) => (
                    <div key={`${image}-stitched-preview-${index}`} className="border-b border-[#ebe5da] last:border-b-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="w-full bg-[#f7f5f1] object-contain" style={{ aspectRatio: aspectRatioStyle(ratio) }} src={mediaUrl(image)} alt={`详情图拼接预览 ${index + 1}`} />
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

function GenesisResult({ quantity, ratio, images, tasks, phase, retryingTaskId, onRetryTask }: { quantity: string; ratio: string; images: string[]; tasks: ImageTask[]; phase: string; retryingTaskId: number | null; onRetryTask: (taskId: number) => void }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const count = Number.parseInt(quantity, 10) || 1;
  const slots = tasks.length > 0 ? orderedTaskSlots(tasks, quantity) : [];
  const successfulImages = slots.length > 0
    ? slots.map((task) => task?.image_url || "").filter(Boolean)
    : images;
  const displayImages = successfulImages.map((image) => mediaUrl(image));
  const isGenerating = phase === "planning" || phase === "preview";

  if (slots.length > 0) {
    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {slots.map((task, index) => {
            const displayImage = task?.image_url ? mediaUrl(task.image_url) : "";
            const previewSlotIndex = displayImage ? displayImages.indexOf(displayImage) : -1;
            return (
              <ResultSlot
                key={task ? task.id : `main-slot-${index}`}
                mode="genesis"
                index={index}
                ratio={ratio}
                task={task}
                image={displayImage}
                active={isGenerating}
                retrying={retryingTaskId === task?.id}
                onRetry={() => task && onRetryTask(task.id)}
                onPreview={displayImage && previewSlotIndex >= 0 ? () => setPreviewIndex(previewSlotIndex) : undefined}
              />
            );
          })}
        </div>
        {previewIndex !== null && (
          <ImageLightbox images={displayImages} initialIndex={previewIndex} filenamePrefix="xinglu-main-image" onClose={() => setPreviewIndex(null)} />
        )}
      </>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <ResultSlot key={index} mode="genesis" index={index} ratio={ratio} task={null} image="" active={isGenerating} retrying={false} />
      ))}
    </div>
  );
}

function DetailResult({ quantity, ratio, images, tasks, phase, retryingTaskId, onRetryTask, onOpenPreview }: { quantity: string; ratio: string; images: string[]; tasks: ImageTask[]; phase: string; retryingTaskId: number | null; onRetryTask: (taskId: number) => void; onOpenPreview: (index: number) => void }) {
  const count = Number.parseInt(quantity, 10) || 1;
  const isGenerating = phase === "planning" || phase === "preview";
  const slots = tasks.length > 0 ? orderedTaskSlots(tasks, quantity) : [];
  return (
    <div className="space-y-4">
      {isGenerating && <p className="text-sm font-semibold text-[#697080]">预计 {detailImageEstimate(count)}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(slots.length > 0 ? slots : Array.from({ length: count }, () => null)).map((task, index) => (
          <ResultSlot
            key={task ? task.id : `detail-slot-${index}`}
            mode="detail"
            index={index}
            ratio={ratio}
            task={task}
            image={task?.image_url ? mediaUrl(task.image_url) : slots.length === 0 && images[index] ? mediaUrl(images[index]) : ""}
            active={isGenerating}
            retrying={retryingTaskId === task?.id}
            onRetry={() => task && onRetryTask(task.id)}
            onPreview={task?.image_url ? () => onOpenPreview(index) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ResultSlot({ mode, index, ratio, task, image, active, retrying, onRetry, onPreview }: { mode: StudioMode; index: number; ratio: string; task: ImageTask | null; image: string; active: boolean; retrying: boolean; onRetry?: () => void; onPreview?: () => void }) {
  const failed = task?.status === "failed";
  const waiting = !image && !failed;
  const progress = image ? 100 : Math.max(0, Math.min(99, Number(task?.progress || 0)));
  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-[#e1dbd0] bg-[#f6f3ed]">
      {waiting && (
        <>
          <div className="absolute right-3 top-3 z-10 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[#101827] shadow-sm">{progress}%</div>
          <div className="absolute inset-x-4 bottom-3 z-10 h-1.5 overflow-hidden rounded-full bg-white/85">
            <div className="h-full rounded-full bg-[#101827] transition-all" style={{ width: `${Math.max(6, progress)}%` }} />
          </div>
        </>
      )}
      <div className="p-4" style={{ aspectRatio: aspectRatioStyle(ratio) }}>
        <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-[#fffdf9] via-[#f4f1ea] to-[#ebe3d8]">
          {image ? (
            <>
              <button className="block h-full w-full" type="button" onClick={onPreview} aria-label={`预览${mode === "genesis" ? "主图" : "详情图"} ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="h-full w-full object-contain" src={image} alt={`${mode === "genesis" ? "主图" : "详情图"}结果 ${index + 1}`} />
              </button>
              <button className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#101827] opacity-0 shadow-[0_10px_24px_-14px_rgba(16,24,39,0.65)] transition hover:bg-[#101827] hover:text-white group-hover:opacity-100" type="button" onClick={(event) => { event.stopPropagation(); void downloadImage(image, `dake-${mode === "genesis" ? "main" : "detail"}-image-${index + 1}.png`); }} aria-label="下载图片">
                <Download className="h-4 w-4" />
              </button>
            </>
          ) : failed ? (
            <div className="flex h-full w-full flex-col items-center justify-center px-5 text-center">
              <X className="h-9 w-9 text-red-500" />
              <p className="mt-3 text-sm font-bold text-red-600">第 {index + 1} 张生成失败</p>
              <p className="mt-2 text-xs leading-5 text-[#7d8492]">生成失败</p>
              <button className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-[#101827] px-4 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-55" type="button" disabled={retrying} onClick={onRetry}>
                {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                重新生成
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-[#101827]">
              {active || waiting ? (
                <>
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_18px_42px_-24px_rgba(16,24,39,0.55)]">
                    <Loader2 className={`h-8 w-8 ${active ? "animate-spin" : ""}`} />
                  </span>
                  <span className="text-sm font-semibold text-[#697080]">{active ? `正在生成第 ${index + 1} 张` : "等待生成"}</span>
                </>
              ) : (
                <>
                  <ImagePlus className="h-9 w-9 text-[#8f97a5]" />
                  <span className="text-sm font-semibold text-[#8f97a5]">等待生成</span>
                </>
              )}
            </div>
          )}
        </div>
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

function ComboSelectLike({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
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
      <div className="studio-input flex w-full min-w-0 max-w-full items-center gap-3 pr-4 text-sm">
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#101827] outline-none placeholder:text-[#8b93a1]"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setOpen(true)}
        />
        <button className="shrink-0" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          <ChevronDown className={`h-4 w-4 text-[#8b93a1] transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
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
                onMouseDown={(event) => event.preventDefault()}
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
