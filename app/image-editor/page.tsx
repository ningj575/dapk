"use client";

import { AccountMenu } from "@/components/account-menu";
import { WorkspaceNav } from "@/components/workspace-nav";
import { AuthGuard } from "@/components/auth-guard";
import { notifyAuthChanged, refreshAuthUser, type DakeUser, useAuthToken } from "@/components/auth-state";
import { ImageLightbox } from "@/components/image-lightbox";
import { downloadImage } from "@/lib/download-image";
import { AlertTriangle, Check, ChevronDown, Copy, CornerDownLeft, Download, Loader2, Plus, RefreshCw, Send, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import type { ClipboardEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

type GenerationRequest = {
  prompt: string;
  model: string;
  resolution: string;
  aspectRatio: string;
  images: string[];
};

type Message = {
  id: number;
  conversationId: number;
  recordId?: number;
  role: "user" | "assistant";
  text: string;
  images?: string[];
  aspectRatio?: string;
  request?: GenerationRequest;
  retryRequest?: GenerationRequest;
  elapsedSeconds?: number;
  status?: "loading" | "done" | "failed";
};

type UploadItem = {
  id: string;
  src: string;
};

type ReferenceUploadPayload = {
  images: Array<{
    path: string;
    url: string;
  }>;
};

type ImageTask = {
  id: number;
  task_index: number;
  task_id: string;
  status: string;
  image_url?: string;
  error_message?: string;
};

type UniversalImagePayload = {
  id: number;
  status?: string;
  done?: boolean;
  images?: string[];
  tasks?: ImageTask[];
  cost_credits?: number;
  user?: DakeUser;
};

type ImageTaskStatusPayload = {
  id: number;
  status: string;
  done: boolean;
  images: string[];
  tasks: ImageTask[];
  user: DakeUser;
};

type GenerationRecord = {
  id: number | string;
  type: string;
  prompt?: string;
  image_url?: string;
  media_url?: string;
  uploaded_image_paths?: string;
  aspect_ratio?: string;
  resolution?: string;
  model?: string;
  model_name?: string;
  status?: string;
  error_message?: string;
  cost_credits?: number;
  created_at?: string;
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

const defaultModels = ["GPT-Image-2", "Nano Banana 2"];
const defaultImageSizes = ["1K", "2K", "4K"];
const aspectRatios = ["auto", "1:1", "3:4", "4:3", "16:9", "9:16"];
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const maxReferenceImageSize = 30 * 1024 * 1024;
const maxReferenceImageSizeText = "30M";
const homeDraftKey = "dake_home_generation_draft";

function aspectRatioStyle(value?: string) {
  const match = String(value || "").match(/(\d+)\s*:\s*(\d+)/);
  if (!match) return undefined;
  return `${match[1]} / ${match[2]}`;
}

function mediaUrl(src: string) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  return `${apiBase}${src.startsWith("/") ? src : `/${src}`}`;
}

function formatElapsed(seconds?: number) {
  if (!seconds || seconds < 1) return "思考了 1 秒";
  if (seconds < 60) return `思考了 ${seconds} 秒`;
  return `思考了 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();
  let payload: ApiResponse<T>;
  try {
    payload = JSON.parse(text) as ApiResponse<T>;
  } catch {
    if (response.status === 504) {
      throw new Error("图片上传处理超时，请稍后重试");
    }
    if (response.status === 413) {
      throw new Error("图片过大，单张参考图最大 30M");
    }
    throw new Error(response.ok ? "请求失败" : `请求失败（${response.status}）`);
  }
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || "请求失败");
  }
  return payload;
}

async function uploadReferenceImage(file: File, token: string): Promise<UploadItem[]> {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const response = await fetch(`${apiBase}/api/reference-images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    const result = await readApi<ReferenceUploadPayload>(response);
    return (result.data.images || []).map((item, index) => ({
      id: `${Date.now()}-${file.name}-${index}`,
      src: mediaUrl(item.url || item.path)
    }));
  } catch (event) {
    if (event instanceof TypeError) {
      throw new Error("图片上传失败，请检查网络或图片大小后重试");
    }
    throw event;
  }
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

async function compressImageFile(file: File): Promise<File> {
  if (file.size <= maxReferenceImageSize || !file.type.startsWith("image/")) return file;

  const image = await loadImageFile(file);
  let maxSide = Math.min(4096, Math.max(image.naturalWidth, image.naturalHeight));
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58];

  for (let round = 0; round < 4; round += 1) {
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
      if (blob.size <= maxReferenceImageSize || (round === 3 && quality === qualities[qualities.length - 1])) {
        const filename = file.name.replace(/\.[^.]+$/, "") || "pasted-image";
        return new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
      }
    }
    maxSide = Math.max(1200, Math.round(maxSide * 0.72));
  }

  return file;
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e5ded2] bg-[#faf9f7]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link className="flex items-baseline gap-2" href="/">
          <span className="font-display text-xl font-extrabold tracking-tight">Xinglu</span>
          <span className="text-xs font-medium text-text-tertiary">AI</span>
        </Link>
        <WorkspaceNav activeHref="/image-editor" />
        <AccountMenu />
      </div>
    </header>
  );
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
  return values.length > 0 ? values : defaultImageSizes;
}

function recordsToMessages(records: GenerationRecord[]): Message[] {
  return records
    .slice()
    .reverse()
    .flatMap((record) => {
      const id = Number(record.id) || Date.now();
      const uploadPaths = String(record.uploaded_image_paths || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map(mediaUrl);
      const outputPaths = String(record.media_url || record.image_url || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map(mediaUrl);
      const retryRequest: GenerationRequest = {
        prompt: record.prompt || "",
        model: record.model_name || record.model || defaultModels[0],
        resolution: record.resolution || "1K",
        aspectRatio: record.aspect_ratio || "auto",
        images: uploadPaths
      };
      const status = record.status === "failed" ? "failed" : outputPaths.length > 0 ? "done" : "loading";
      const userMessage: Message = {
        id: id * 2,
        conversationId: id,
        recordId: id,
        role: "user",
        text: record.prompt || "",
        images: uploadPaths,
        request: retryRequest
      };
      if (record.status === "failed" && outputPaths.length === 0) {
        return [userMessage];
      }
      const assistantMessage: Message = {
        id: id * 2 + 1,
        conversationId: id,
        recordId: id,
        role: "assistant",
        text: "",
        images: outputPaths,
        aspectRatio: record.aspect_ratio || "auto",
        retryRequest,
        status
      };
      return [userMessage, assistantMessage];
    });
}

function UniversalImageContent() {
  const token = useAuthToken();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(defaultModels[0]);
  const [imageSize, setImageSize] = useState("1K");
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [generating, setGenerating] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [previewByMessage, setPreviewByMessage] = useState<Record<number, number>>({});
  const [lightboxPreview, setLightboxPreview] = useState<{ images: string[]; index: number; prefix: string } | null>(null);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [hiddenConversationIds, setHiddenConversationIds] = useState<Set<number>>(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ conversationId: number; recordId?: number } | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);

  const count = 1;
  const modelOptions = useMemo(() => (modelConfigs.length > 0 ? modelConfigs.map((item) => item.model_name) : defaultModels), [modelConfigs]);
  const imageSizeOptions = useMemo(() => configuredResolutions(modelConfigs, model), [model, modelConfigs]);
  const activeImageSize = imageSizeOptions.includes(imageSize) ? imageSize : imageSizeOptions[0] || "1K";
  const cost = configuredCost(modelConfigs, model, activeImageSize, 50);
  const visibleMessages = useMemo(
    () => messages.filter((message) => !hiddenConversationIds.has(message.conversationId)),
    [hiddenConversationIds, messages]
  );

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
      if (draft.target !== "/image-editor") return;
      setPrompt(String(draft.prompt || ""));
      setUploadItems(
        (Array.isArray(draft.images) ? draft.images : [])
          .filter((src) => typeof src === "string" && src)
          .slice(0, 10)
          .map((src, index) => ({ id: `home-draft-${index}`, src }))
      );
      window.localStorage.removeItem(homeDraftKey);
    } catch {
      window.localStorage.removeItem(homeDraftKey);
    }
  }, [token]);

  useEffect(() => {
    fetch(`${apiBase}/api/model-configs?module=universal_image`)
      .then((response) => response.json())
      .then((payload) => {
        const configs = (payload?.data?.configs || []) as ModelConfig[];
        setModelConfigs(configs);
        if (configs.length > 0) {
          const nextModel = configs.some((item) => item.model_name === defaultModels[0]) ? defaultModels[0] : configs[0].model_name;
          setModel(nextModel);
          setImageSize(configuredResolutions(configs, nextModel)[0] || "1K");
        }
      })
      .catch(() => setModelConfigs([]));
  }, []);

  function changeModel(nextModel: string) {
    setModel(nextModel);
    setImageSize(configuredResolutions(modelConfigs, nextModel)[0] || "1K");
  }

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(`${apiBase}/api/generations?type=universal_image&limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then((response) => readApi<{ records: GenerationRecord[] }>(response))
      .then((result) => setMessages(recordsToMessages(result.data.records || [])))
      .catch((event) => {
        if ((event as Error).name !== "AbortError") {
          setError(event instanceof Error ? event.message : "历史记录加载失败");
        }
      });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, generating]);

  async function onFilesChange(files?: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    if (!token) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const oversizedFiles = imageFiles.filter((file) => file.size > maxReferenceImageSize);
    const validFiles = imageFiles.filter((file) => file.size <= maxReferenceImageSize);
    if (oversizedFiles.length > 0) {
      setError(`单张参考图最大 ${maxReferenceImageSizeText}，已跳过 ${oversizedFiles.length} 张超限图片`);
    }
    if (validFiles.length === 0) return;

    const freeSlots = Math.max(0, 10 - uploadItems.length);
    if (freeSlots === 0) {
      setError("最多上传 10 张图片");
      return;
    }

    const selected = validFiles.slice(0, freeSlots);
    if (validFiles.length > freeSlots) {
      setError("最多上传 10 张图片，已自动保留前 10 张");
    }

    setUploadingImages(true);
    try {
      const uploaded = await Promise.all(selected.map((file) => uploadReferenceImage(file, token)));
      const nextItems = uploaded.flat();
      setUploadItems((items) => [...items, ...nextItems]);
    } catch (event) {
      setError(event instanceof Error ? event.message : "图片上传失败");
    } finally {
      setUploadingImages(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onInputDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void onFilesChange(event.dataTransfer.files);
  }

  function onInputPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files || []).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      void (async () => {
        try {
          const normalizedFiles = await Promise.all(files.map((file) => compressImageFile(file)));
          void onFilesChange(normalizedFiles);
        } catch (error) {
          setError(error instanceof Error ? error.message : "图片读取失败");
        }
      })();
    }
  }

  async function pollUniversalImage(recordId: number, loadingMessageId: number, startedAt: number) {
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

      const images = (result.data.images || []).map(mediaUrl);
      const failed = (result.data.tasks || []).filter((task) => task.status === "failed");
      if (result.data.status === "failed" || (result.data.done && failed.length > 0 && images.length === 0)) {
        setMessages((items) =>
          items.map((message) =>
            message.id === loadingMessageId
              ? {
                  ...message,
                  images: [],
                  status: "failed",
                  elapsedSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000))
                }
              : message
          )
        );
        return;
      }
      if (images.length > 0) {
        setMessages((items) =>
          items.map((message) =>
            message.id === loadingMessageId
              ? {
                  ...message,
                  images,
                  status: "done",
                  elapsedSeconds: result.data.done ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : message.elapsedSeconds
                }
              : message
          )
        );
      }

      if (result.data.done) {
        if (images.length === 0) {
          throw new Error(failed[0]?.error_message || "生成失败");
        }
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        setMessages((items) =>
          items.map((message) =>
            message.id === loadingMessageId
              ? {
                  ...message,
                  status: "done",
                  elapsedSeconds,
                  images
                }
              : message
          )
        );
        return;
      }
    }

    throw new Error("生成任务仍在处理中，请稍后到生成记录查看结果");
  }

  async function submitGeneration(request: GenerationRequest) {
    if (!request.prompt || generating || !token) return;

    setGenerating(true);
    setError("");
    const startedAt = Date.now();
    const messageId = Date.now();
    const loadingMessageId = messageId + 1;
    const userMessage: Message = {
      id: messageId,
      conversationId: messageId,
      role: "user",
      text: request.prompt,
      images: request.images,
      request
    };
    const loadingMessage: Message = {
      id: loadingMessageId,
      conversationId: messageId,
      role: "assistant",
      text: "",
      aspectRatio: request.aspectRatio,
      retryRequest: request,
      status: "loading"
    };
    setMessages((items) => [...items, userMessage, loadingMessage]);

    try {
      const response = await fetch(`${apiBase}/api/universal-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: request.prompt,
          model: request.model,
          resolution: request.resolution,
          size: request.aspectRatio,
          count,
          reference_count: request.images.length,
          images: request.images
        })
      });
      const result = await readApi<UniversalImagePayload>(response);
      if (result.data.user) {
        window.localStorage.setItem("dake_user", JSON.stringify(result.data.user));
        notifyAuthChanged();
      }
      if (!result.data.id) {
        throw new Error("生成任务创建失败");
      }
      setMessages((items) =>
        items.map((message) =>
          message.conversationId === messageId
            ? {
                ...message,
                conversationId: result.data.id,
                recordId: result.data.id
              }
            : message
        )
      );

      const immediateImages = (result.data.images || []).map(mediaUrl);
      if (immediateImages.length === 0 || result.data.done === false || result.data.status === "processing") {
        await pollUniversalImage(result.data.id, loadingMessageId, startedAt);
        return;
      }

      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      setMessages((items) =>
        items.map((message) =>
          message.id === loadingMessageId
            ? {
                ...message,
                status: "done",
                elapsedSeconds,
                images: immediateImages
              }
            : message
        )
      );
    } catch (event) {
      setMessages((items) =>
        items.map((message) =>
          message.id === loadingMessageId
            ? {
                ...message,
                status: "failed",
                images: [],
                elapsedSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000))
              }
            : message
        )
      );
    } finally {
      setGenerating(false);
    }
  }

  async function generate() {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || generating || !token) return;
    const request: GenerationRequest = {
      prompt: cleanPrompt,
      model,
      resolution: activeImageSize,
      aspectRatio,
      images: uploadItems.map((item) => item.src)
    };
    setPrompt("");
    setUploadItems([]);
    if (inputRef.current) inputRef.current.value = "";
    await submitGeneration(request);
  }

  async function hideConversation(conversationId: number, recordId?: number) {
    const targetId = recordId || conversationId;
    if (!token || !targetId) return false;
    try {
      const response = await fetch(`${apiBase}/api/generations/hide`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: targetId })
      });
      await readApi<{ id: number }>(response);
      setHiddenConversationIds((current) => {
        const next = new Set(current);
        next.add(conversationId);
        next.add(targetId);
        return next;
      });
      return true;
    } catch (event) {
      setError(event instanceof Error ? event.message : "删除失败，请稍后重试");
      return false;
    }
  }

  async function copyPrompt(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text || "");
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => (current === message.id ? null : current)), 1600);
    } catch {
      setError("复制失败，请手动复制提示词");
    }
  }

  function quoteMessage(message: Message) {
    const request = message.request || {
      prompt: message.text || "",
      model,
      resolution: activeImageSize,
      aspectRatio,
      images: message.images || []
    };
    const nextModel = modelOptions.includes(request.model) ? request.model : model;
    const nextSizes = configuredResolutions(modelConfigs, nextModel);
    setModel(nextModel);
    setImageSize(nextSizes.includes(request.resolution) ? request.resolution : nextSizes[0] || request.resolution || "1K");
    setAspectRatio(request.aspectRatio || "auto");
    setPrompt(request.prompt || "");
    setUploadItems(
      Array.from(new Set(request.images || []))
        .slice(0, 10)
        .map((src, index) => ({ id: `quoted-${message.id}-${index}`, src }))
    );
    window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
  }

  async function confirmDeleteConversation() {
    if (!pendingDelete) return;
    setDeletingConversation(true);
    try {
      const deleted = await hideConversation(pendingDelete.conversationId, pendingDelete.recordId);
      if (deleted) {
        setPendingDelete(null);
      }
    } finally {
      setDeletingConversation(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#faf9f7] text-[#101827]">
      <AppHeader />

      <section className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col px-4 pb-[260px] pt-8 sm:px-6 sm:pb-[220px]">
        {visibleMessages.length === 0 ? (
          <div className="flex min-h-[52vh] flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#101827] text-white shadow-[0_18px_50px_-26px_rgba(16,24,39,0.75)]">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 data-testid="universal-title" className="mt-6 text-4xl font-black tracking-tight">万能生图</h1>
            <p className="mt-3 max-w-[560px] text-sm font-semibold leading-7 text-[#697080]">
              上传参考图或直接输入提示词，把完整需求发给模型生成图片。
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {visibleMessages.map((message) => (
              <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "user" ? (
                  <UserMessageContent
                    message={message}
                    copied={copiedMessageId === message.id}
                    onCopy={() => void copyPrompt(message)}
                    onQuote={() => quoteMessage(message)}
                    onDelete={() => setPendingDelete({ conversationId: message.conversationId, recordId: message.recordId })}
                  />
                ) : (
                  <AssistantMessageContent
                    message={message}
                    selectedIndex={previewByMessage[message.id] || 0}
                    onSelect={(index) => setPreviewByMessage((current) => ({ ...current, [message.id]: index }))}
                    onPreview={(index) => setLightboxPreview({ images: message.images || [], index, prefix: `xinglu-universal-${message.id}` })}
                    onRetry={(request) => void submitGeneration(request)}
                  />
                )}
              </article>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </section>

      <section className="fixed inset-x-0 bottom-0 z-40 bg-transparent px-4 pb-4">
        <div
          className={`mx-auto max-w-[1040px] rounded-[18px] border bg-white shadow-[0_24px_80px_-42px_rgba(16,24,39,0.55)] transition ${dragActive ? "border-[#101827] ring-4 ring-[#101827]/10" : "border-[#ded8cd]"}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragActive(false);
            }
          }}
          onDrop={onInputDrop}
        >
          {error && <div className="mx-4 mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</div>}
          <div className="relative min-h-[108px] px-4 pt-3">
            <input ref={inputRef} className="hidden" type="file" accept="image/*" multiple onChange={(event) => void onFilesChange(event.target.files)} />
            <div className="flex flex-wrap items-center gap-2">
              {uploadItems.map((item) => (
                <div key={item.id} data-testid="upload-preview" className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#ded8cd] bg-[#f6f5f3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt="上传图片预览" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute inset-0 hidden items-center justify-center bg-[#101827]/55 text-white group-hover:flex"
                    aria-label="移除上传图片"
                    onClick={() => setUploadItems((items) => items.filter((current) => current.id !== item.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-[#d8d1c6] text-[#596170] transition hover:bg-[#f6f5f3] hover:text-[#101827]"
              aria-label="上传图片"
              disabled={uploadingImages}
              onClick={() => inputRef.current?.click()}
            >
              {uploadingImages ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            </button>
            </div>
            <textarea
              data-testid="universal-prompt"
              className="min-h-[86px] w-full resize-none border-0 bg-transparent px-0 pb-3 pt-4 text-base font-normal leading-7 text-[#0d0d0d] outline-none placeholder:text-[#9aa1ad]"
              value={prompt}
              placeholder="输入提示词，例如：把这张陶瓷杯生成高级电商主图，白色背景，柔和光影，突出釉面质感..."
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={onInputPaste}
            />
          </div>

          <div className="flex flex-nowrap items-center gap-1 overflow-visible border-t border-[#eee7dd] px-2 py-2.5 sm:gap-3 sm:px-4 sm:py-3">

            <SelectControl value={model} options={modelOptions} onChange={changeModel} />
            <SelectControl value={activeImageSize} options={imageSizeOptions} onChange={setImageSize} />
            <SelectControl value={aspectRatio} options={aspectRatios} onChange={setAspectRatio} />

            <button
              type="button"
              data-testid="universal-generate"
              className={`ml-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-extrabold transition disabled:cursor-not-allowed sm:h-10 sm:gap-2 sm:px-5 sm:text-sm ${
                prompt.trim() && !generating && !uploadingImages
                  ? "bg-[#101827] text-white shadow-[0_12px_28px_-20px_rgba(16,24,39,0.85)] hover:bg-[#2b3344]"
                  : "bg-[#ebe9e5] text-[#596170] opacity-80"
              }`}
              disabled={!prompt.trim() || generating || uploadingImages}
              onClick={() => void generate()}
            >
              {generating || uploadingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              一键生成{cost}积分
            </button>
          </div>
        </div>
      </section>
      {lightboxPreview && <ImageLightbox images={lightboxPreview.images} initialIndex={lightboxPreview.index} filenamePrefix={lightboxPreview.prefix} onClose={() => setLightboxPreview(null)} />}
      {pendingDelete && (
        <DeleteConversationDialog
          deleting={deletingConversation}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDeleteConversation()}
        />
      )}
    </main>
  );
}

function UserMessageContent({
  message,
  copied,
  onCopy,
  onQuote,
  onDelete
}: {
  message: Message;
  copied: boolean;
  onCopy: () => void;
  onQuote: () => void;
  onDelete: () => void;
}) {
  const text = message.text;
  const images = message.images || [];
  const columns = images.length <= 4 ? Math.max(images.length, 1) : Math.ceil(images.length / 2);

  return (
    <div className="flex max-w-[820px] flex-col items-end gap-3">
      {images.length > 0 && (
        <div
          data-testid="user-upload-grid"
          className="flex max-w-full flex-wrap justify-end gap-1.5 sm:grid sm:overflow-x-auto sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
          style={{ gridTemplateColumns: `repeat(${columns}, 128px)` }}
        >
          {images.map((src, index) => (
            <div key={`${src}-${index}`} className="h-24 w-24 overflow-hidden rounded-[8px] bg-[#d1d1d3] sm:h-32 sm:w-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`参考图 ${index + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}
      <div className="group max-w-[620px] rounded-[18px] bg-[#f0efed] px-4 py-3 text-left shadow-sm">
        <p className="whitespace-pre-wrap text-base font-normal leading-7 text-[#0d0d0d]">{text}</p>
        <div className="mt-2 flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
          <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7a808c] transition hover:bg-white hover:text-[#101827]" onClick={onCopy} aria-label="复制提示词" title="复制">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7a808c] transition hover:bg-white hover:text-[#101827]" onClick={onQuote} aria-label="引用提示词" title="引用">
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7a808c] transition hover:bg-white hover:text-[#d92d20]" onClick={onDelete} aria-label="删除会话" title="删除">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConversationDialog({
  deleting,
  onCancel,
  onConfirm
}: {
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#101827]/28 px-4 backdrop-blur-[2px]" onClick={onCancel}>
      <div
        className="w-full max-w-[360px] rounded-[18px] bg-white p-5 text-[#101827] shadow-[0_24px_80px_-32px_rgba(16,24,39,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#ff9d00]" />
            <h2 className="text-base font-extrabold text-[#101827]">是否删除该条消息?</h2>
          </div>
          <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#8a909b] transition hover:bg-[#f0efed] hover:text-[#101827]" onClick={onCancel} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm font-normal leading-6 text-[#4f5663]">删除后，聊天记录不可恢复，对话内的文件也将被彻底删除</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="inline-flex h-10 min-w-[72px] items-center justify-center rounded-[10px] border border-[#ece8e1] bg-white px-5 text-sm font-semibold text-[#313846] transition hover:bg-[#f6f5f3]"
            onClick={onCancel}
            disabled={deleting}
          >
            取消
          </button>
          <button
            type="button"
            className="inline-flex h-10 min-w-[72px] items-center justify-center rounded-[10px] bg-[#ff3b3b] px-5 text-sm font-semibold text-white transition hover:bg-[#e42e2e] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssistantMessageContent({
  message,
  selectedIndex,
  onSelect,
  onPreview,
  onRetry
}: {
  message: Message;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onPreview: (index: number) => void;
  onRetry: (request: GenerationRequest) => void;
}) {
  if (message.status === "loading") {
    return <GenerationLoadingCard />;
  }

  if (message.status === "failed") {
    return (
      <GenerationLoadingCard
        failed
        onRetry={message.retryRequest ? () => onRetry(message.retryRequest as GenerationRequest) : undefined}
      />
    );
  }

  if (!message.images || message.images.length === 0) {
    return null;
  }

  return (
    <div className="max-w-[560px]">
      {message.elapsedSeconds ? (
        <p className="mb-3 text-base font-normal text-[#0d0d0d]">{formatElapsed(message.elapsedSeconds)}</p>
      ) : null}
      <ImagePreview
        images={message.images}
        aspectRatio={message.aspectRatio}
        messageId={message.id}
        selectedIndex={selectedIndex}
        canDownload={false}
        onSelect={onSelect}
        onOpen={onPreview}
      />
    </div>
  );
}

function GenerationLoadingCard({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) {
  const dots = Array.from({ length: 126 }, (_, index) => {
    const col = index % 14;
    const row = Math.floor(index / 14);
    const cluster = col > 8 || (col < 5 && row > 4) ? 1 : 0;
    const opacity = cluster ? 0.62 : 0.16 + ((col + row) % 4) * 0.05;
    const delay = (col * 73 + row * 113) % 1200;
    return { index, opacity, delay };
  });

  return (
    <div className="w-[min(480px,calc(100vw-32px))]">
      <p className={`mb-4 text-sm font-semibold ${failed ? "text-red-600" : "text-[#697080]"}`}>{failed ? "生图失败" : "正在生成更细致的图片，请稍候。"}</p>
      <div className="relative overflow-hidden rounded-[28px] bg-[#f2f2f1] px-6 py-8 shadow-sm">
        <div className="grid gap-x-5 gap-y-5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
          {dots.map((dot) => (
            <span
              key={dot.index}
              className={`${failed ? "" : "universal-image-loading-dot"} h-1.5 w-1.5 rounded-full bg-[#8d8d8d]`}
              style={{ animationDelay: `${dot.delay}ms`, opacity: dot.opacity }}
            />
          ))}
        </div>
        {failed ? (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {onRetry ? (
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#101827] shadow-sm transition hover:bg-[#101827] hover:text-white"
                type="button"
                onClick={onRetry}
                aria-label="重新生成"
                title="重新生成"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <style>{`
        @keyframes universalImageDotPulse {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(0.62);
          }
          45% {
            transform: translate3d(3px, -6px, 0) scale(1.35);
          }
          72% {
            transform: translate3d(-2px, 3px, 0) scale(0.9);
          }
        }
        .universal-image-loading-dot {
          animation: universalImageDotPulse 1.85s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function ImagePreview({
  images,
  aspectRatio,
  messageId,
  selectedIndex,
  canDownload,
  onSelect,
  onOpen
}: {
  images: string[];
  aspectRatio?: string;
  messageId: number;
  selectedIndex: number;
  canDownload: boolean;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
}) {
  const activeIndex = Math.min(selectedIndex, images.length - 1);
  const activeImage = images[activeIndex] || images[0];
  const imageAspectRatio = aspectRatioStyle(aspectRatio);
  const previewWidthClass = aspectRatio === "9:16" ? "max-w-[360px]" : aspectRatio === "16:9" ? "max-w-[640px]" : "max-w-[520px]";

  return (
    <div data-testid="image-preview" className={`grid gap-3 ${images.length > 1 ? "max-w-[680px] md:grid-cols-[minmax(0,560px)_64px]" : previewWidthClass}`}>
      <div className="overflow-hidden rounded-[14px] border border-[#ded8cd] bg-white shadow-sm">
        <button type="button" className="block w-full" onClick={() => onOpen(activeIndex)} aria-label="放大查看图片">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeImage} alt={`预览图 ${activeIndex + 1}`} className={`${imageAspectRatio ? "" : "max-h-[70vh]"} w-full bg-[#f6f5f3] object-contain`} style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : undefined} />
        </button>
        {canDownload && (
          <button
            className="flex h-10 items-center justify-center gap-2 border-t border-[#eee7dd] text-xs font-extrabold text-[#101827] transition hover:bg-[#f6f5f3]"
            type="button"
            onClick={() => void downloadImage(activeImage, `xinglu-universal-${messageId}-${activeIndex + 1}.png`)}
          >
            <Download className="h-4 w-4" />
            下载图片
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid content-start grid-cols-4 gap-2 md:grid-cols-1">
          {images.map((src, index) => (
            <button
              key={`${messageId}-thumb-${index}`}
              type="button"
              data-testid={`image-thumb-${index}`}
              className={`overflow-hidden rounded-[10px] border bg-white transition ${
                index === activeIndex ? "border-[#101827] ring-2 ring-[#101827]/12" : "border-[#ded8cd] hover:border-[#bfb6aa]"
              }`}
              onClick={() => onSelect(index)}
              aria-label={`预览第 ${index + 1} 张图`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`缩略图 ${index + 1}`} className="w-full bg-[#f6f5f3] object-contain" style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : { aspectRatio: "1 / 1" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectControl({ value, options, onChange, testId }: { value: string; options: string[]; onChange: (value: string) => void; testId?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const isModelSelect = options.some((option) => option === "GPT-Image-2" || option === "Nano Banana 2" || option === "Seedream-5.0");

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        data-testid={testId}
        className={`inline-flex h-8 items-center gap-1 rounded-full bg-white px-1.5 text-[11px] font-extrabold text-[#596170] hover:bg-[#f6f5f3] sm:max-w-none sm:text-xs ${isModelSelect ? "max-w-[104px] min-w-[96px]" : "max-w-[82px]"}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{value}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-[80] mb-2 min-w-[150px] overflow-hidden rounded-[14px] border border-[#ded8cd] bg-white py-1 shadow-[0_18px_44px_-22px_rgba(16,24,39,0.45)]">
          {options.map((option, index) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                data-testid={testId ? `${testId}-option-${index}` : undefined}
                className={`flex h-10 w-full items-center justify-between gap-3 px-3 text-left text-xs font-extrabold ${
                  selected ? "text-[#101827]" : "text-[#596170] hover:bg-[#f6f5f3] hover:text-[#101827]"
                }`}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span>{option}</span>
                {selected && <span>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ImageEditorPage() {
  return (
    <AuthGuard>
      <UniversalImageContent />
    </AuthGuard>
  );
}
