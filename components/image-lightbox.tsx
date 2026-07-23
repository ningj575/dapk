"use client";

import { downloadImage } from "@/lib/download-image";
import { ChevronLeft, ChevronRight, Download, Loader2, Minus, Plus, X, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";

type ImageLightboxProps = {
  images: string[];
  initialIndex?: number;
  filenamePrefix?: string;
  onClose: () => void;
};

const DEFAULT_SCALE = 0.6;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

export function ImageLightbox({ images, initialIndex = 0, filenamePrefix = "xinglu-image", onClose }: ImageLightboxProps) {
  const cleanImages = useMemo(() => images.filter(Boolean), [images]);
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(cleanImages.length - 1, 0)));
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [loading, setLoading] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const activeImage = cleanImages[index] || cleanImages[0] || "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(cleanImages.length - 1, 0)));
    setScale(DEFAULT_SCALE);
    setPan({ x: 0, y: 0 });
    setLoading(true);
  }, [cleanImages.length, initialIndex]);

  useEffect(() => {
    setLoading(true);
    setPan({ x: 0, y: 0 });
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

  useEffect(() => {
    const stopPageZoom = (event: globalThis.WheelEvent) => {
      const overlay = overlayRef.current;
      if (!event.ctrlKey || !overlay || !overlay.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      setScale((current) => clampScale(current + (event.deltaY < 0 ? 0.12 : -0.12)));
    };
    document.addEventListener("wheel", stopPageZoom, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", stopPageZoom, { capture: true });
  }, []);

  function move(step: number) {
    if (cleanImages.length <= 1) return;
    setIndex((current) => {
      const next = (current + step + cleanImages.length) % cleanImages.length;
      setScale(DEFAULT_SCALE);
      setPan({ x: 0, y: 0 });
      setLoading(true);
      return next;
    });
  }

  function updateScale(next: number) {
    const value = clampScale(next);
    setScale(value);
    if (value <= DEFAULT_SCALE) setPan({ x: 0, y: 0 });
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    updateScale(scale + (event.deltaY < 0 ? 0.12 : -0.12));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (scale <= 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const start = dragStartRef.current;
    setPan({
      x: start.panX + event.clientX - start.x,
      y: start.panY + event.clientY - start.y,
    });
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  if (!mounted || !activeImage) return null;

  const lightbox = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center bg-black/90 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
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

      <div className="flex h-full w-full flex-col items-center justify-center gap-5" onClick={(event) => event.stopPropagation()} onWheel={onWheel}>
        <div
          className={`relative flex min-h-0 max-h-[calc(100vh-150px)] w-full touch-none items-center justify-center overflow-hidden ${scale > 1 ? dragging ? "cursor-grabbing" : "cursor-grab" : "cursor-default"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
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
            className={`max-h-full max-w-full select-none rounded-[10px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-opacity duration-150 ${loading ? "opacity-0" : "opacity-100"}`}
            draggable={false}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})` }}
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

  return createPortal(lightbox, document.body);
}
