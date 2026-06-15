"use client";

import { useAuthToken } from "@/components/auth-state";
import { Check, Headphones, ImagePlus, MessageCircle, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ApiResponse<T> = { code: number; message: string; data: T };
type SupportMode = "wechat" | "feedback" | null;
type SupportSettings = { qr_code?: string; service_time?: string };

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const maxImages = 3;

function makeQrCode() {
  const cells = Array.from({ length: 21 }, (_, y) =>
    Array.from({ length: 21 }, (_, x) => {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (finder) {
        const localX = x < 7 ? x : x - 14;
        const localY = y < 7 ? y : y - 14;
        return localX === 0 || localX === 6 || localY === 0 || localY === 6 || (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4);
      }
      return (x * 17 + y * 31 + x * y) % 5 === 0 || (x + y) % 11 === 0;
    })
  );
  const blocks = cells
    .flatMap((row, y) => row.map((active, x) => (active ? `<rect x="${x * 6}" y="${y * 6}" width="5" height="5" rx="1" fill="#111827"/>` : "")))
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="170" height="170" viewBox="0 0 170 170"><rect width="170" height="170" rx="14" fill="#fff"/><g transform="translate(22 22)">${blocks}</g><circle cx="85" cy="85" r="17" fill="#101827"/><path d="M75 83c0-6 5-10 11-10s11 4 11 10-5 10-11 10c-1 0-3 0-4-.5l-6 2 2-5c-2-2-3-4-3-6.5z" fill="#fff"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveMediaUrl(src: string) {
  const value = src.trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${apiBase}${value.startsWith("/") ? value : `/${value}`}`;
}

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || "提交失败");
  return payload;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function SupportFloating() {
  const token = useAuthToken();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startTop: number; moved: boolean } | null>(null);
  const ignoreClickRef = useRef(false);
  const fallbackQrCode = useMemo(() => makeQrCode(), []);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SupportMode>(null);
  const [supportSettings, setSupportSettings] = useState<SupportSettings>({});
  const [floatTop, setFloatTop] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const qrCode = resolveMediaUrl(supportSettings.qr_code || "") || fallbackQrCode;
  const serviceTime = (supportSettings.service_time || "9:00-22:00").trim() || "9:00-22:00";
  const hiddenOnPage = pathname === "/pricing";
  const menuBelow = floatTop !== null && floatTop < 190;

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/api/support-settings`)
      .then(readApi<SupportSettings>)
      .then((payload) => {
        if (active) setSupportSettings(payload.data || {});
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const storageKey = "dake_support_float_top";
    const initPosition = () => {
      const minTop = 72;
      const maxTop = Math.max(minTop, window.innerHeight - 88);
      const saved = Number(window.localStorage.getItem(storageKey));
      const defaultTop = window.innerWidth < 640 ? window.innerHeight - 196 : window.innerHeight - 96;
      setFloatTop(clamp(Number.isFinite(saved) ? saved : defaultTop, minTop, maxTop));
    };
    initPosition();

    const handleResize = () => {
      setFloatTop((current) => {
        const minTop = 72;
        const maxTop = Math.max(minTop, window.innerHeight - 88);
        const next = clamp(current ?? window.innerHeight - 96, minTop, maxTop);
        window.localStorage.setItem(storageKey, String(Math.round(next)));
        return next;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (floatTop === null) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: floatTop,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaY) > 3) {
      drag.moved = true;
    }
    const minTop = 72;
    const maxTop = Math.max(minTop, window.innerHeight - 88);
    setFloatTop(clamp(drag.startTop + deltaY, minTop, maxTop));
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      ignoreClickRef.current = true;
      setTimeout(() => {
        ignoreClickRef.current = false;
      }, 0);
    }
    setFloatTop((current) => {
      const next = current ?? drag.startTop;
      window.localStorage.setItem("dake_support_float_top", String(Math.round(next)));
      return next;
    });
  };

  const toggleSupport = () => {
    if (ignoreClickRef.current) return;
    setOpen((value) => !value);
  };

  const resetFeedback = () => {
    setDescription("");
    setImages([]);
    setNotice("");
  };

  const closeModal = () => {
    setMode(null);
    setNotice("");
  };

  const selectImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const slots = Math.max(0, maxImages - images.length);
    const urls = await Promise.all(picked.slice(0, slots).map(fileToDataUrl));
    setImages((current) => [...current, ...urls].slice(0, maxImages));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submitFeedback = async () => {
    const content = description.trim();
    if (!content) {
      setNotice("请先填写问题描述");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      await readApi<{ id: number }>(
        await fetch(`${apiBase}/api/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ description: content, images })
        })
      );
      setNotice("提交成功，我们会尽快处理");
      window.setTimeout(() => {
        resetFeedback();
        setMode(null);
      }, 900);
    } catch (event) {
      setNotice(event instanceof Error ? event.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (hiddenOnPage) {
    return null;
  }

  return (
    <>
      <div className="fixed right-5 z-[80]" style={{ top: floatTop ?? undefined, bottom: floatTop === null ? 144 : "auto" }}>
        {open && (
          <div className={`absolute right-0 w-40 overflow-hidden rounded-2xl border border-[#e2e7ec] bg-white p-2 shadow-[0_18px_45px_-24px_rgba(16,24,39,0.55)] ${menuBelow ? "top-[68px]" : "bottom-[68px]"}`}>
            <button data-testid="support-contact" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-[#101827] transition hover:bg-[#f1f4f7]" type="button" onClick={() => setMode("wechat")}>
              <MessageCircle className="h-4 w-4" />
              联系客服
            </button>
            <button data-testid="support-feedback" className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-[#101827] transition hover:bg-[#f1f4f7]" type="button" onClick={() => setMode("feedback")}>
              <Send className="h-4 w-4" />
              问题反馈
            </button>
          </div>
        )}
        <button
          data-testid="support-trigger"
          className="flex h-14 w-14 touch-none items-center justify-center rounded-full bg-[#101827] text-white shadow-[0_16px_32px_-16px_rgba(16,24,39,0.9)] transition hover:-translate-y-0.5 hover:bg-black"
          type="button"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={toggleSupport}
          aria-label="客服"
        >
          <Headphones className="h-6 w-6" />
        </button>
      </div>

      {mode === "wechat" && (
        <div data-testid="wechat-modal" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101827]/45 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-[372px] overflow-hidden rounded-[28px] border border-white/70 bg-[#fbfaf7] px-7 pb-8 pt-9 text-center text-[#101827] shadow-[0_30px_90px_-35px_rgba(16,24,39,0.55)]">
            <button className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-[#687083] transition hover:bg-[#ece7de] hover:text-[#101827]" type="button" onClick={closeModal} aria-label="关闭">
              <X className="h-5 w-5" />
            </button>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101827] text-white shadow-[0_16px_34px_-22px_rgba(16,24,39,0.85)]">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-black">微信扫码联系客服</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mx-auto mt-7 h-[170px] w-[170px] rounded-2xl border border-[#e9e1d7] bg-white p-2 shadow-sm" src={qrCode} alt="微信客服二维码" />
            <p className="mt-5 text-sm font-semibold text-[#5f6674]">使用微信扫一扫，立即咨询</p>
            <a className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#171d2a] bg-[#101827] text-base font-black text-white shadow-[0_18px_40px_-16px_rgba(16,24,39,0.42)] transition hover:-translate-y-px hover:bg-[#151f31]" href="weixin://" role="button">
              <MessageCircle className="h-5 w-5" />
              打开微信客服
            </a>
            <p className="mt-5 text-sm font-medium text-[#8a94a3]">客服时间：{serviceTime}</p>
          </div>
        </div>
      )}

      {mode === "feedback" && (
        <div data-testid="feedback-modal" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101827]/45 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-[584px] overflow-hidden rounded-[28px] border border-white/70 bg-[#fbfaf7] text-[#101827] shadow-[0_30px_90px_-35px_rgba(16,24,39,0.55)]">
            <div className="border-b border-[#ebe5dc] bg-[#fbfaf7] px-4 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">问题反馈</h2>
                  <p className="mt-2 text-sm font-semibold text-[#697080]">我们非常重视您的反馈</p>
                </div>
                <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#687083] transition hover:bg-[#ece7de] hover:text-[#101827]" type="button" onClick={closeModal} aria-label="关闭">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="px-4 py-6 sm:px-6">
              <label className="text-sm font-black">
                问题描述 <span className="text-[#e14b5d]">*</span>
              </label>
              <textarea
                data-testid="feedback-description"
                className="mt-3 h-32 w-full resize-none rounded-2xl border border-[#ddd6ca] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#101827] shadow-[0_1px_2px_rgba(16,24,39,0.03)] outline-none transition placeholder:text-[#9aa0aa] focus:border-[#101827]"
                maxLength={500}
                placeholder="请详细描述您遇到的问题，以便我们更好地为您服务..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <div className="mt-2 text-right text-xs font-semibold text-[#8a94a3]">{description.length}/500</div>

              <div className="mt-5 text-sm font-black">图片上传</div>
              <div className="mt-3 flex flex-wrap gap-3">
                {images.map((src, index) => (
                  <div key={src} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[#e9e1d7] bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="h-full w-full object-cover" src={src} alt={`反馈图片 ${index + 1}`} />
                    <button className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white group-hover:flex" type="button" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="移除图片">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {images.length < maxImages && (
                  <button className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border border-dashed border-[#cfc7ba] bg-white text-sm font-semibold text-[#697080] transition hover:border-[#101827] hover:text-[#101827]" type="button" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-6 w-6" />
                    <span className="mt-1">上传图片</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} className="hidden" type="file" accept="image/*" multiple onChange={(event) => void selectImages(event.target.files)} />

              {notice && (
                <div className={`mt-5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${notice.includes("成功") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-red-200 bg-red-50 text-red-600"}`}>
                  {notice.includes("成功") && <Check className="h-4 w-4" />}
                  {notice}
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button className="h-12 rounded-[18px] border border-[#ded8cd] bg-white text-base font-black text-[#101827] transition hover:bg-[#ece7de]" type="button" onClick={closeModal}>
                  取消
                </button>
                <button data-testid="feedback-submit" className="h-12 rounded-[18px] border border-[#171d2a] bg-[#101827] text-base font-black text-white shadow-[0_18px_40px_-16px_rgba(16,24,39,0.42)] transition hover:-translate-y-px hover:bg-[#151f31] disabled:cursor-not-allowed disabled:border-[#d7d1c7] disabled:bg-[#e6e1d8] disabled:text-[#9aa0aa] disabled:shadow-none" type="button" disabled={submitting || !description.trim()} onClick={() => void submitFeedback()}>
                  {submitting ? "提交中..." : "提交"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
