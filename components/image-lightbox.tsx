"use client";

import { downloadImage } from "@/lib/download-image";
import { ChevronLeft, ChevronRight, Download, Loader2, Minus, Plus, X, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useState, type WheelEvent } from "react";

type ImageLightboxProps = {
  images: string[];
  initialIndex?: number;
  filenamePrefix?: string;
  onClose: () => void;
};

const DEFAULT_SCALE = 0.6;

export function ImageLightbox({ images, initialIndex = 0, filenamePrefix = "xinglu-image", onClose }: ImageLightboxProps) {
  const cleanImages = useMemo(() => images.filter(Boolean), [images]);
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(cleanImages.length - 1, 0)));
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [loading, setLoading] = useState(true);
  const activeImage = cleanImages[index] || cleanImages[0] || "";

  useEffect(() => {
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(cleanImages.length - 1, 0)));
    setScale(DEFAULT_SCALE);
    setLoading(true);
  }, [cleanImages.length, initialIndex]);

  useEffect(() => {
    setLoading(true);
  }, [activeImage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function move(step: number) {
    if (cleanImages.length <= 1) return;
    setIndex((current) => {
      const next = (current + step + cleanImages.length) % cleanImages.length;
      setScale(DEFAULT_SCALE);
      setLoading(true);
      return next;
    });
  }

  function updateScale(next: number) {
    setScale(Math.min(4, Math.max(0.25, Number(next.toFixed(2)))));
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    updateScale(scale + (event.deltaY < 0 ? 0.12 : -0.12));
  }

  if (!activeImage) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/86 px-4 py-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" onClick={onClose}>
      <button
        className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#101827] shadow-lg transition hover:bg-[#f0f0f0]"
        type="button"
        onClick={onClose}
        aria-label="关闭预览"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        className="absolute bottom-5 right-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#101827] shadow-lg transition hover:bg-[#f0f0f0]"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void downloadImage(activeImage, `${filenamePrefix}-${index + 1}.png`);
        }}
        aria-label="下载图片"
      >
        <Download className="h-5 w-5" />
      </button>

      {cleanImages.length > 1 && (
        <button
          className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#101827] shadow-lg transition hover:bg-[#f0f0f0]"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            move(-1);
          }}
          aria-label="上一张"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {cleanImages.length > 1 && (
        <button
          className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#101827] shadow-lg transition hover:bg-[#f0f0f0]"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            move(1);
          }}
          aria-label="下一张"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div className="flex h-full w-full max-w-[calc(100vw-32px)] flex-col items-center justify-center gap-5" onClick={(event) => event.stopPropagation()} onWheel={onWheel}>
        <div className="relative flex min-h-0 max-h-[calc(100vh-150px)] w-full items-center justify-center overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={activeImage}
            src={activeImage}
            alt={`图片预览 ${index + 1}`}
            className={`max-h-full max-w-full select-none rounded-[10px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-150 ${loading ? "opacity-0" : "opacity-100"}`}
            draggable={false}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            style={{ transform: `scale(${scale})` }}
          />
        </div>

        <div className="flex h-11 items-center gap-1 rounded-full bg-white px-2 text-sm font-semibold text-[#101827] shadow-[0_16px_38px_rgba(0,0,0,0.28)]">
          <ZoomIn className="ml-2 h-4 w-4 text-[#5f6674]" />
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ececec] transition hover:bg-[#dedede]" type="button" onClick={() => updateScale(scale - 0.25)} aria-label="缩小">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-14 text-center">{Math.round(scale * 100)}%</span>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ececec] transition hover:bg-[#dedede]" type="button" onClick={() => updateScale(scale + 0.25)} aria-label="放大">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
