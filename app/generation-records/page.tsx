"use client";

import { AccountMenu } from "@/components/account-menu";
import { AuthGuard } from "@/components/auth-guard";
import { useAuthToken } from "@/components/auth-state";
import { downloadImage } from "@/lib/download-image";
import { ChevronLeft, ChevronRight, Clock3, Download, ImageIcon, Search, Sparkles, Video, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ApiResponse<T> = { code: number; message: string; data: T };
type FilterType = "all" | "image" | "video";
type GenerationRecord = {
  id: number;
  type: string;
  title?: string;
  prompt?: string;
  image_url?: string;
  media_url?: string;
  media_type?: "image" | "video";
  poster?: string;
  model?: string;
  status: string;
  cost_credits: number;
  created_at: string;
};
type RecordCounts = {
  all: number;
  image: number;
  video: number;
};
type GenerationRecordsPayload = {
  records: GenerationRecord[];
  total: number;
  page: number;
  page_size: number;
  counts: RecordCounts;
};
type PreviewImage = {
  images: string[];
  index: number;
  title: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const filterTabs: Array<[FilterType, string, keyof RecordCounts, LucideIcon]> = [
  ["all", "全部", "all", Sparkles],
  ["image", "图片", "image", ImageIcon],
  ["video", "视频", "video", Video]
];
const navItems = [
  ["去水印", "/watermark-remover"],
  ["万能生图", "/image-editor"],
  ["主图", "/studio-genesis"],
  ["详情图", "/ecom-studio"],
  ["视频生成", "/video-studio"],
  ["套餐", "/pricing"]
];

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
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(([label, href]) => (
            <Link key={label} href={href}>
              <span className="inline-flex h-10 items-center whitespace-nowrap rounded-[14px] px-4 text-sm font-semibold text-[#5f6674] transition hover:bg-[#ede8df] hover:text-[#101827]">{label}</span>
            </Link>
          ))}
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
}

function formatDate(value?: string) {
  if (!value) return "刚刚";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  if (diff > 0 && diff < 86400000) {
    const hours = Math.max(1, Math.floor(diff / 3600000));
    return hours <= 1 ? "刚刚" : `${hours}小时前`;
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function recordMedia(record: GenerationRecord) {
  if (record.media_type === "video" || record.type === "video_generation") {
    return { type: "video" as const, src: mediaUrl(record.media_url || record.image_url || ""), poster: mediaUrl(record.poster || "") };
  }
  const images = splitMediaUrls(record.media_url || record.image_url || "");
  const fallback = makePlaceholder(record);
  const resolvedImages = images.length > 0 ? images : [fallback];
  return { type: "image" as const, src: resolvedImages[0], images: resolvedImages, poster: "" };
}

function isFailedImageRecord(record: GenerationRecord) {
  const isVideo = record.media_type === "video" || record.type === "video_generation";
  const hasImages = splitMediaUrls(record.media_url || record.image_url || "").length > 0;
  return !isVideo && String(record.status || "").toLowerCase() === "failed" && !hasImages;
}

function isHiddenGenerationRecord(record: GenerationRecord) {
  const isVideo = record.media_type === "video" || record.type === "video_generation";
  const status = String(record.status || "").toLowerCase();
  const hasMedia = splitMediaUrls(record.media_url || record.image_url || "").length > 0;
  if (isVideo) {
    return status !== "success" || !hasMedia;
  }
  return isFailedImageRecord(record);
}

function splitMediaUrls(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => mediaUrl(item));
}

function makePlaceholder(record: GenerationRecord) {
  const text = encodeHtml((record.title || record.prompt || "AI 生成作品").slice(0, 30));
  const model = encodeHtml(record.model || typeLabel(record.type));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540" viewBox="0 0 720 540"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f7f1e7"/><stop offset="1" stop-color="#cfe7e3"/></linearGradient></defs><rect width="720" height="540" rx="26" fill="url(#g)"/><circle cx="566" cy="104" r="74" fill="#101827" opacity=".08"/><rect x="64" y="70" width="592" height="322" rx="28" fill="#fff" opacity=".7"/><path d="M112 330l128-132 96 92 76-76 196 116v62H112z" fill="#101827" opacity=".16"/><text x="70" y="455" fill="#101827" font-family="Arial" font-size="32" font-weight="800">${text}</text><text x="70" y="496" fill="#697080" font-family="Arial" font-size="18" font-weight="700">${model}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function encodeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function typeLabel(type: string) {
  if (type === "video_generation") return "视频";
  if (type === "main_image") return "主图";
  if (type === "detail_image") return "详情图";
  if (type === "universal_image") return "万能生图";
  if (type === "watermark_remover") return "去水印";
  return "图片";
}

function displayRecordTitle(record: GenerationRecord) {
  const title = String(record.title || "").trim();
  const titleMap: Record<string, string> = {
    "Main image generation": "主图生成",
    "Detail image generation": "详情图生成",
    "Universal image generation": "万能生图",
    "Watermark removal": "去水印",
    "Video generation": "视频生成",
    "AI generation": "AI 生成"
  };
  if (titleMap[title]) return titleMap[title];
  return title || record.prompt || typeLabel(record.type);
}

function mediaUrl(src: string) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  return `${apiBase}${src.startsWith("/") ? src : `/${src}`}`;
}

function GenerationRecordsContent() {
  const token = useAuthToken();
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<PreviewImage | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [serverCounts, setServerCounts] = useState<RecordCounts>({ all: 0, image: 0, video: 0 });
  const pageSize = 8;

  const fetchRecords = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        filter,
        keyword: query.trim(),
        exclude_type: "watermark_remover",
        hide_failed: "1"
      });
      const response = await fetch(`${apiBase}/api/generations?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await readApi<GenerationRecordsPayload>(response);
      setRecords(result.data.records || []);
      setTotal(Number(result.data.total || 0));
      setServerCounts(result.data.counts || { all: 0, image: 0, video: 0 });
    } catch (event) {
      setError(event instanceof Error ? event.message : "生成记录加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter, page, query, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchRecords(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchRecords]);

  const visibleRecords = useMemo(() => records.filter((record) => record.type !== "watermark_remover" && !isHiddenGenerationRecord(record)), [records]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return visibleRecords.filter((record) => {
      const media = recordMedia(record);
      if (filter !== "all" && media.type !== filter) return false;
      if (!keyword) return true;
      return `${record.title || ""} ${record.prompt || ""} ${record.model || ""}`.toLowerCase().includes(keyword);
    });
  }, [filter, query, visibleRecords]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const previewSrc = preview?.images[preview.index] || "";
  const movePreview = (step: number) => {
    setPreview((current) => {
      if (!current || current.images.length === 0) return current;
      return { ...current, index: (current.index + step + current.images.length) % current.images.length };
    });
  };

  return (
    <main className="min-h-screen bg-[#f4f8fb] text-[#101827]">
      <AppHeader />
      <section className="mx-auto max-w-[1120px] px-5 py-9 sm:px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#101827] text-white shadow-sm">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">生成记录</h1>
            <p className="mt-1 text-sm font-medium text-[#5f6674]">查看和管理你的所有 AI 生成作品</p>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
          生成的图片、视频记录仅临时保存24~72小时，请尽快下载到本地电脑！
        </div>

        <section className="mt-6 rounded-3xl border border-[#e1e7ec] bg-white p-4 shadow-[0_12px_34px_-28px_rgba(16,24,39,0.45)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {filterTabs.map(([key, label, countKey, Icon]) => (
                <button key={key} className={`flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${filter === key ? "bg-[#101827] text-white shadow-[0_12px_24px_-16px_rgba(16,24,39,0.85)]" : "bg-[#eef2f5] text-[#5f6674] hover:text-[#101827]"}`} type="button" onClick={() => { setFilter(key); setPage(1); }}>
                  <Icon className="h-4 w-4" />
                  {label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${filter === key ? "bg-white/15 text-white" : "bg-white text-[#8a94a3]"}`}>{serverCounts[countKey]}</span>
                </button>
              ))}
            </div>
            <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-[#dfe5ea] bg-white px-3 shadow-sm sm:w-[260px]">
              <Search className="h-4 w-4 text-[#9aa3ad]" />
              <input className="min-w-0 flex-1 bg-transparent text-base font-normal text-[#0d0d0d] outline-none placeholder:text-[#9aa3ad]" placeholder="搜索描述、模型..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
            </label>
          </div>

          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}
          {loading ? (
            <div className="py-16 text-center text-base font-normal text-[#0d0d0d]">正在加载生成记录...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-base font-normal text-[#0d0d0d]">暂无生成记录</div>
          ) : (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((record) => {
                const media = recordMedia(record);
                const title = displayRecordTitle(record);
                return (
                  <article key={record.id} className="overflow-hidden rounded-xl border border-[#dfe5ea] bg-white shadow-[0_8px_20px_-18px_rgba(16,24,39,0.5)]">
                    <div className="aspect-[4/3] overflow-hidden bg-[#eef2f5]">
                      {media.type === "video" ? (
                        <video className="h-full w-full object-cover" controls muted playsInline poster={media.poster} src={media.src} />
                      ) : (
                        <button className="block h-full w-full cursor-zoom-in" type="button" onClick={() => setPreview({ images: media.images, index: 0, title })} aria-label="查看图片">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="h-full w-full object-cover transition duration-200 hover:scale-[1.03]" src={media.src} alt={title} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 text-base font-normal text-[#0d0d0d]">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>{formatDate(record.created_at)}</span>
                      <span>·</span>
                      <span className="truncate">{record.model || typeLabel(record.type)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!loading && totalPages > 1 && (
            <div className="mt-7 flex items-center justify-center gap-3 text-sm font-semibold text-[#5f6674]">
              <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5ea] bg-white text-[#101827] disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="上一页">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>{page} / {totalPages}</span>
              <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5ea] bg-white text-[#101827] disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="下一页">
                <ChevronRight className="h-4 w-4" />
              </button>
              <span>共 {total} 条</span>
            </div>
          )}
        </section>
      </section>

      {preview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07101f]/75 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="relative flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e7ecf0] px-5 py-4">
              <h2 className="truncate text-base font-black text-[#101827]">图片预览</h2>
              <div className="flex items-center gap-2">
                <button className="inline-flex h-9 items-center gap-2 rounded-full bg-[#101827] px-4 text-sm font-bold text-white transition hover:bg-black" type="button" onClick={() => void downloadImage(previewSrc, `xinglu-generation-${preview.index + 1}.png`)}>
                  <Download className="h-4 w-4" />
                  下载
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2f5] text-[#5f6674] hover:text-[#101827]" type="button" onClick={() => setPreview(null)} aria-label="关闭">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#f4f8fb] p-4">
              {preview.images.length > 1 && (
                <button className="absolute left-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#101827] shadow-lg transition hover:bg-[#101827] hover:text-white" type="button" onClick={() => movePreview(-1)} aria-label="上一张">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="max-h-[76vh] w-auto max-w-full rounded-2xl object-contain shadow-sm" src={previewSrc} alt={preview.title} />
              {preview.images.length > 1 && (
                <button className="absolute right-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#101827] shadow-lg transition hover:bg-[#101827] hover:text-white" type="button" onClick={() => movePreview(1)} aria-label="下一张">
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GenerationRecordsPage() {
  return (
    <AuthGuard>
      <GenerationRecordsContent />
    </AuthGuard>
  );
}
