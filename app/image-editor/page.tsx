"use client";

import { AccountMenu } from "@/components/account-menu";
import { AuthGuard } from "@/components/auth-guard";
import { notifyAuthChanged, type DakeUser, useAuthToken } from "@/components/auth-state";
import { ChevronDown, Download, Loader2, Plus, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import type { ClipboardEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  images?: string[];
  elapsedSeconds?: number;
  status?: "loading" | "done";
};

type UploadItem = {
  id: string;
  src: string;
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
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["套餐", "/pricing"]
];

const defaultModels = ["GPT-Image-2", "Nano Banana 2"];
const defaultImageSizes = ["1K", "2K", "4K"];
const aspectRatios = ["auto", "1:1", "3:4", "4:3", "16:9", "9:16"];
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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
          <span className="font-display text-xl font-extrabold tracking-tight">达客</span>
          <span className="text-xs font-medium text-text-tertiary">AI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(([label, href]) => {
            const selected = href === "/image-editor";
            return (
              <Link key={label} href={href}>
                <span className={`inline-flex h-10 items-center rounded-[14px] px-4 text-sm font-semibold transition ${selected ? "bg-[#101827] text-white" : "text-[#5f6674] hover:bg-[#ede8df] hover:text-[#101827]"}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
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
      const userMessage: Message = {
        id: id * 2,
        role: "user",
        text: record.prompt || "",
        images: uploadPaths
      };
      const assistantMessage: Message = {
        id: id * 2 + 1,
        role: "assistant",
        text: "",
        images: outputPaths,
        status: "done"
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
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [previewByMessage, setPreviewByMessage] = useState<Record<number, number>>({});
  const [lightboxImage, setLightboxImage] = useState("");
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);

  const count = 1;
  const modelOptions = useMemo(() => (modelConfigs.length > 0 ? modelConfigs.map((item) => item.model_name) : defaultModels), [modelConfigs]);
  const imageSizeOptions = useMemo(() => configuredResolutions(modelConfigs, model), [model, modelConfigs]);
  const activeImageSize = imageSizeOptions.includes(imageSize) ? imageSize : imageSizeOptions[0] || "1K";
  const cost = configuredCost(modelConfigs, model, activeImageSize, 50);

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
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const freeSlots = Math.max(0, 10 - uploadItems.length);
    if (freeSlots === 0) {
      setError("最多上传 10 张图片");
      return;
    }

    const selected = imageFiles.slice(0, freeSlots);
    if (imageFiles.length > freeSlots) {
      setError("最多上传 10 张图片，已自动保留前 10 张");
    }

    const nextItems = await Promise.all(
      selected.map((file, index) =>
        new Promise<UploadItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ id: `${Date.now()}-${index}-${file.name}`, src: String(reader.result || "") });
          reader.readAsDataURL(file);
        })
      )
    );
    setUploadItems((items) => [...items, ...nextItems]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onInputDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void onFilesChange(event.dataTransfer.files);
  }

  function onInputPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files || []).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      void onFilesChange(files);
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
        const failed = (result.data.tasks || []).filter((task) => task.status === "failed");
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

  async function generate() {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || generating || !token) return;

    setGenerating(true);
    setError("");
    const startedAt = Date.now();
    const referenceImages = uploadItems.map((item) => item.src);
    const messageId = Date.now();
    const loadingMessageId = messageId + 1;
    const userMessage: Message = {
      id: messageId,
      role: "user",
      text: cleanPrompt,
      images: referenceImages
    };
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: "assistant",
      text: "",
      status: "loading"
    };
    setMessages((items) => [...items, userMessage, loadingMessage]);
    setPrompt("");
    setUploadItems([]);
    if (inputRef.current) inputRef.current.value = "";

    try {
      const response = await fetch(`${apiBase}/api/universal-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: cleanPrompt,
          model,
          resolution: activeImageSize,
          size: aspectRatio,
          count,
          reference_count: referenceImages.length,
          images: referenceImages
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
      setMessages((items) => items.filter((message) => message.id !== loadingMessageId));
      setError(event instanceof Error ? event.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#faf9f7] text-[#101827]">
      <AppHeader />

      <section className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col px-4 pb-[260px] pt-8 sm:px-6 sm:pb-[220px]">
        {messages.length === 0 ? (
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
            {messages.map((message) => (
              <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "user" ? (
                  <UserMessageContent text={message.text} images={message.images || []} />
                ) : (
                  <AssistantMessageContent
                    message={message}
                    selectedIndex={previewByMessage[message.id] || 0}
                    onSelect={(index) => setPreviewByMessage((current) => ({ ...current, [message.id]: index }))}
                    onPreview={setLightboxImage}
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
              onClick={() => inputRef.current?.click()}
            >
              <Plus className="h-5 w-5" />
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
                prompt.trim() && !generating
                  ? "bg-[#101827] text-white shadow-[0_12px_28px_-20px_rgba(16,24,39,0.85)] hover:bg-[#2b3344]"
                  : "bg-[#ebe9e5] text-[#596170] opacity-80"
              }`}
              disabled={!prompt.trim() || generating}
              onClick={() => void generate()}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              一键生成{cost}积分
            </button>
          </div>
        </div>
      </section>
      {lightboxImage && <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage("")} />}
    </main>
  );
}

function UserMessageContent({ text, images }: { text: string; images: string[] }) {
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
      <div className="max-w-[620px] rounded-[18px] bg-[#f0efed] px-4 py-3 text-left shadow-sm">
        <p className="whitespace-pre-wrap text-base font-normal leading-7 text-[#0d0d0d]">{text}</p>
      </div>
    </div>
  );
}

function AssistantMessageContent({
  message,
  selectedIndex,
  onSelect,
  onPreview
}: {
  message: Message;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onPreview: (src: string) => void;
}) {
  if (message.status === "loading") {
    return <GenerationLoadingCard />;
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
        messageId={message.id}
        selectedIndex={selectedIndex}
        canDownload={false}
        onSelect={onSelect}
        onOpen={onPreview}
      />
    </div>
  );
}

function GenerationLoadingCard() {
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
      <p className="mb-4 text-sm font-semibold text-[#697080]">正在生成更细致的图片，请稍候。</p>
      <div className="overflow-hidden rounded-[28px] bg-[#f2f2f1] px-6 py-8 shadow-sm">
        <div className="grid gap-x-5 gap-y-5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
          {dots.map((dot) => (
            <span
              key={dot.index}
              className="universal-image-loading-dot h-1.5 w-1.5 rounded-full bg-[#8d8d8d]"
              style={{ animationDelay: `${dot.delay}ms`, opacity: dot.opacity }}
            />
          ))}
        </div>
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
  messageId,
  selectedIndex,
  canDownload,
  onSelect,
  onOpen
}: {
  images: string[];
  messageId: number;
  selectedIndex: number;
  canDownload: boolean;
  onSelect: (index: number) => void;
  onOpen: (src: string) => void;
}) {
  const activeIndex = Math.min(selectedIndex, images.length - 1);
  const activeImage = images[activeIndex] || images[0];

  return (
    <div data-testid="image-preview" className={`grid gap-3 ${images.length > 1 ? "max-w-[560px] md:grid-cols-[minmax(0,480px)_64px]" : "max-w-[420px]"}`}>
      <div className="overflow-hidden rounded-[14px] border border-[#ded8cd] bg-white shadow-sm">
        <button type="button" className="block w-full" onClick={() => onOpen(activeImage)} aria-label="放大查看图片">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeImage} alt={`预览图 ${activeIndex + 1}`} className="aspect-square w-full object-cover" />
        </button>
        {canDownload && (
          <a
            className="flex h-10 items-center justify-center gap-2 border-t border-[#eee7dd] text-xs font-extrabold text-[#101827] transition hover:bg-[#f6f5f3]"
            href={activeImage}
            download={`dake-universal-${messageId}-${activeIndex + 1}.png`}
          >
            <Download className="h-4 w-4" />
            下载图片
          </a>
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
              <img src={src} alt={`缩略图 ${index + 1}`} className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101827]/72 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex max-h-full w-full max-w-[920px] flex-col rounded-[22px] bg-white p-4 shadow-[0_28px_90px_-36px_rgba(16,24,39,0.9)]" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f0efed] text-[#101827] transition hover:bg-[#e4e0d8]"
          onClick={onClose}
          aria-label="关闭预览"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mt-10 flex min-h-0 justify-center overflow-auto rounded-[16px] bg-[#f6f5f3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="生成图片预览" className="max-h-[72vh] w-auto max-w-full object-contain" />
        </div>
        <a
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#101827] px-6 text-sm font-extrabold text-white transition hover:bg-[#2b3344]"
          href={src}
          download="dake-image.png"
          target="_blank"
          rel="noreferrer"
        >
          <Download className="h-4 w-4" />
          下载图片
        </a>
      </div>
    </div>
  );
}

function SelectControl({ value, options, onChange, testId }: { value: string; options: string[]; onChange: (value: string) => void; testId?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

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
        className="inline-flex h-8 max-w-[82px] items-center gap-1 rounded-full bg-white px-1 text-[11px] font-extrabold text-[#596170] hover:bg-[#f6f5f3] sm:max-w-none sm:text-xs"
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
