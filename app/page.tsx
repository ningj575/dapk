"use client";

import { LoginDialog } from "@/components/login-dialog";
import { useAuthToken, useClientReady } from "@/components/auth-state";
import {
  ArrowRight,
  Camera,
  Eraser,
  LayoutGrid,
  WandSparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const featureCards = [
  {
    title: "AI去水印",
    desc: "免费移除图像中最烦人的水印\n智能填充背景，还原干净画面",
    icon: Eraser,
    gradient: "from-zinc-700 to-slate-950",
    glow: "rgba(16,24,39,0.45)",
    href: "/watermark-remover"
  },
  {
    title: "全能设计",
    desc: "海报/广告/社媒配图\n一句话生成创意设计",
    icon: LayoutGrid,
    gradient: "from-teal-500 to-emerald-600",
    glow: "rgba(20,184,166,0.5)",
    href: "/image-editor"
  },
  {
    title: "电商主图",
    desc: "上传商品图，快速生成高点击主图\n适配淘宝/天猫/京东/亚马逊等主流电商",
    icon: Camera,
    gradient: "from-blue-500 to-indigo-600",
    glow: "rgba(99,102,241,0.5)",
    href: "/studio-genesis"
  },
  {
    title: "详情页生成",
    desc: "智能生成商品详情页模块\n卖点、参数、场景展示一步完成",
    icon: WandSparkles,
    gradient: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.5)",
    href: "/ecom-studio"
  }
];

const platformRows = [
  ["淘宝", "天猫", "京东", "拼多多", "抖音电商", "快手电商", "小红书", "微信小店", "亚马逊", "Shopee", "Lazada"],
  ["抖音电商", "快手电商", "小红书", "微信小店", "亚马逊", "Shopee", "Lazada", "速卖通", "SHEIN", "TikTok Shop"]
];

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const showcases = [
  {
    showcaseKey: "watermark_remover",
    index: "01",
    title: "AI去水印",
    subtitle: "自动识别图片中的水印、文字与 Logo，智能补全背景纹理，快速获得干净自然的商品图片。",
    points: [
      ["智能识别水印", "自动定位文字、Logo、半透明水印等干扰元素"],
      ["背景自然填充", "根据周围纹理和光影补全画面，减少修图痕迹"],
      ["适合电商素材", "商品图、活动图、详情页素材都可快速清理后再使用"]
    ],
    beforeLabel: "带水印原图",
    afterLabel: "去水印结果",
    beforeSrc: "https://shopix-ai.company/images/showcase/refinement-lipstick-before.jpg",
    afterSrc: "https://shopix-ai.company/images/showcase/refinement-lipstick-after.png",
    aspectRatio: "3 / 4",
    href: "/watermark-remover"
  },
  {
    showcaseKey: "universal_design",
    index: "02",
    title: "全能设计",
    subtitle: "从一句提示词或一张参考图出发，快速生成海报、广告、社媒配图等创意设计稿。",
    points: [
      ["一句话出设计", "描述主题、风格和用途，即可生成完整创意画面"],
      ["多场景适配", "覆盖海报、广告图、社媒配图、活动物料等常用设计场景"],
      ["参考图辅助", "可结合参考图片控制产品元素、色彩与构图，减少反复沟通"]
    ],
    beforeLabel: "参考图",
    afterLabel: "达客 设计稿",
    beforeSrc: "https://shopix-ai.company/images/showcase/refinement-lipstick-before.jpg",
    afterSrc: "https://shopix-ai.company/images/showcase/refinement-lipstick-after.png",
    aspectRatio: "1078 / 719",
    href: "/image-editor"
  },
  {
    showcaseKey: "main_image",
    index: "03",
    title: "电商主图生成",
    subtitle: "上传商品原图后，达客会分析产品特征与卖点，生成适配平台要求的电商主图。",
    points: [
      ["商品特征分析", "自动识别材质、颜色、纹理与卖点，减少人工整理需求"],
      ["平台化适配", "覆盖 Amazon、TikTok Shop、淘宝、天猫、京东等主流电商平台"],
      ["品牌安全控制", "可控场景、灯光、构图与调性，保证商品识别度和品牌一致性"]
    ],
    beforeLabel: "原图",
    afterLabel: "达客 效果",
    beforeSrc: "https://shopix-ai.company/images/showcase/hero-left.png",
    afterSrc: "https://shopix-ai.company/images/showcase/hero-right.png",
    aspectRatio: "1078 / 719",
    href: "/studio-genesis"
  },
  {
    showcaseKey: "detail_image",
    index: "04",
    title: "详情页素材生成",
    subtitle: "从多角度参考图出发，自动规划详情页模块，并批量生成完整的电商详情页素材。",
    points: [
      ["达客 模块规划", "围绕核心卖点自动组织详情页内容与信息层级"],
      ["海内外平台适配", "不同平台版式与尺寸要求一键切换，不必重复返工"],
      ["批量高效生图", "一次分析后并发生成多张素材，加快新品上架和活动投放"]
    ],
    beforeLabel: "原图",
    afterLabel: "达客 效果",
    beforeSrc: "https://shopix-ai.company/images/showcase/detail-before.jpg",
    afterSrc: "https://shopix-ai.company/images/showcase/detail-right.png",
    aspectRatio: "1078 / 958",
    href: "/ecom-studio"
  }
];

type HomeShowcaseImage = {
  key: string;
  before_src?: string;
  after_src?: string;
  aspect_ratio?: string;
};

function resolveMediaUrl(src?: string) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  return `${API_BASE_URL}${src.startsWith("/") ? src : `/${src}`}`;
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/image-editor");
  const [showcaseImages, setShowcaseImages] = useState<Record<string, HomeShowcaseImage> | null>(null);
  const router = useRouter();
  const token = useAuthToken();
  const ready = Boolean(useClientReady());
  const openLogin = (target = "/image-editor") => {
    if (token) {
      router.push(target);
      return;
    }
    setRedirectTo(target);
    setLoginOpen(true);
  };

  useEffect(() => {
    if (ready && !token && new URLSearchParams(window.location.search).get("login") === "1") {
      window.setTimeout(() => setLoginOpen(true), 0);
    }
    if (ready && token) {
      window.setTimeout(() => setLoginOpen(false), 0);
    }
  }, [ready, token]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/home-showcases`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (cancelled || !payload || payload.code !== 0) return;
        const rows = Array.isArray(payload.data?.showcases) ? payload.data.showcases : [];
        const next = rows.reduce((acc: Record<string, HomeShowcaseImage>, row: HomeShowcaseImage) => {
          if (row.key) acc[row.key] = row;
          return acc;
        }, {});
        setShowcaseImages(next);
      })
      .catch(() => {
        if (!cancelled) setShowcaseImages({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const renderedShowcases = showcases.map((showcase) => {
    const remote = showcaseImages?.[showcase.showcaseKey];
    return {
      ...showcase,
      beforeSrc: showcaseImages ? resolveMediaUrl(remote?.before_src) : "",
      afterSrc: showcaseImages ? resolveMediaUrl(remote?.after_src) : "",
      aspectRatio: remote?.aspect_ratio || showcase.aspectRatio
    };
  });

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#101827]">
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} redirectTo={redirectTo} />
      <header className="sticky top-0 z-50 w-full bg-[#faf9f7]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-5 sm:px-8">
          <button className="flex items-center gap-2" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span className="font-display text-xl font-extrabold tracking-tight text-[#101827]">达客</span>
            <span className="text-xs font-medium text-text-tertiary">AI</span>
          </button>
          <button
            className="press-scale inline-flex h-9 items-center justify-center gap-2 rounded-[0.9rem] border border-[#171d2a] bg-[#101827] px-4 text-sm font-semibold text-[#f8f4ee] shadow-[0_2px_8px_rgba(16,24,39,0.08),0_14px_34px_-12px_rgba(16,24,39,0.38)] transition-all duration-200 hover:-translate-y-px hover:bg-[#151f31]"
            type="button"
            onClick={() => openLogin()}
          >
            立即体验
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[calc(100vh-64px)] items-center overflow-hidden pb-16 pt-20 sm:pb-24 sm:pt-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_28%_18%,rgba(251,191,146,0.14),transparent),radial-gradient(ellipse_50%_45%_at_72%_28%,rgba(167,215,198,0.11),transparent),radial-gradient(ellipse_45%_40%_at_50%_82%,rgba(196,181,219,0.09),transparent)]" />
          <div className="relative mx-auto w-full max-w-[1280px] px-5 sm:px-8">
            <div className="flex flex-col items-center text-center">
              <h1 className="max-w-[1100px] font-display text-[clamp(3.25rem,7vw,5.5rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[#101827]">
                一键上传 高级出圈
              </h1>
              <p className="mt-7 max-w-[580px] text-base leading-8 text-[#69707f] sm:text-lg sm:leading-9">
                GPT Image 2 + Nano Banana 2 双引擎驱动。深耕电商主图、详情页制作，上传即出稿，省去外包开销与漫长定稿周期。
              </p>

              <div className="mt-20 grid w-full max-w-[1240px] grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
                {featureCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      className="group glass-card relative min-h-[250px] overflow-hidden rounded-[2rem] p-8 text-left transition-all duration-500 ease-out hover:-translate-y-1.5 hover:border-white/70 sm:min-h-[270px] sm:p-10"
                      type="button"
                      onClick={() => openLogin(card.href)}
                    >
                      <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-gradient-to-br from-white/20 via-white/5 to-transparent opacity-70 blur-2xl transition-opacity duration-700 group-hover:opacity-100" />
                      <div className="pointer-events-none absolute right-10 top-12 grid grid-cols-5 gap-2 opacity-25">
                        {Array.from({ length: 20 }).map((_, index) => (
                          <span key={index} className="h-1.5 w-1.5 rounded-full" style={{ background: card.glow }} />
                        ))}
                      </div>
                      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${card.glow}, transparent)` }} />
                      <div className={`relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br ${card.gradient} text-white shadow-[0_18px_34px_-18px_rgba(16,24,39,0.65)] ring-1 ring-white/25 transition-all duration-500 group-hover:scale-105 group-hover:shadow-xl`}>
                        <Icon className="h-10 w-10" strokeWidth={1.8} />
                      </div>
                      <div className="relative mt-7 flex items-center gap-5">
                        <h3 className="text-3xl font-extrabold tracking-tight text-[#101827] transition-transform duration-300 group-hover:-translate-x-0.5">
                          {card.title}
                        </h3>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#101827]/45 shadow-[0_12px_28px_-18px_rgba(16,24,39,0.7)] transition-all duration-500 group-hover:text-[#101827]">
                          <ArrowRight className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                      <p className="relative mt-5 whitespace-pre-line text-base leading-8 text-[#707787]">{card.desc}</p>
                    </button>
                  );
                })}
              </div>

            </div>
          </div>
        </section>

        {renderedShowcases.map((showcase) => (
          <Showcase key={showcase.index} {...showcase} onOpen={openLogin} />
        ))}

      </main>

      <footer className="border-t border-[#e5ded2] bg-[#faf9f7] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1280px] items-center justify-center text-sm text-[#777d8a]">
          © 2026 达客 AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function PlatformMarquee({ onOpen }: { onOpen: (target?: string) => void }) {
  return (
    <div className="mt-14 w-full max-w-[1060px]">
      <div className="relative overflow-hidden rounded-[2rem] border border-[#e4dfd5] bg-[#f6f3ed] px-3 py-3 shadow-[0_1px_2px_rgba(16,24,39,0.03),0_22px_48px_-34px_rgba(16,24,39,0.16)] sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#f6f3ed] to-transparent sm:w-20" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#f6f3ed] to-transparent sm:w-20" />
        <div className="space-y-3 sm:space-y-4">
          {platformRows.map((row, rowIndex) => (
            <div key={row.join("-")} className="overflow-hidden">
              <div
                className="flex w-max gap-2.5"
                style={{
                  animation: `marquee ${rowIndex === 0 ? 34 : 32}s linear infinite`,
                  animationDirection: rowIndex === 0 ? "normal" : "reverse"
                }}
              >
                {[...row, ...row, ...row].map((platform, index) => (
                  <span
                    key={`${platform}-${index}`}
                    className="inline-flex h-9 shrink-0 items-center rounded-full border border-[#d9d6cf] bg-[#fffdf9] px-4 text-[13px] font-semibold text-[#4a5463] shadow-[0_1px_2px_rgba(16,24,39,0.03)] sm:h-10 sm:px-5 sm:text-[14px]"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center text-sm font-semibold text-[#697080]">已适配国内外30+主流电商风格与尺寸规范</p>
      <button
        className="press-scale mx-auto mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-[1rem] border border-[#171d2a] bg-[#101827] px-6 text-sm font-semibold text-[#f8f4ee] shadow-[0_2px_8px_rgba(16,24,39,0.08),0_18px_40px_-12px_rgba(16,24,39,0.42)] transition hover:-translate-y-px hover:bg-[#151f31]"
        type="button"
        onClick={() => onOpen()}
      >
        立即体验
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

type ShowcaseProps = (typeof showcases)[number] & {
  onOpen: (target?: string) => void;
};

function Showcase({ index, title, subtitle, points, beforeLabel, afterLabel, beforeSrc, afterSrc, aspectRatio, href, onOpen }: ShowcaseProps) {
  return (
    <section className="relative overflow-hidden bg-[#faf9f7] px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1080px]">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[#ebe6dd] bg-white px-2 text-[11px] font-bold text-[#b3aaa0] shadow-sm">
            {index}
          </span>
          <h2 className="mt-5 font-display text-[clamp(2.15rem,5vw,3.6rem)] font-extrabold leading-tight tracking-[-0.035em] text-[#101827]">
            {title}
          </h2>
          <p className="mt-4 max-w-[620px] text-sm leading-7 text-[#858c98] sm:text-base">
            {subtitle}
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-[880px] gap-3 md:grid-cols-3">
          {points.map(([heading, body]) => (
            <div key={heading} className="rounded-[14px] border border-[#e8e3db] bg-white/88 px-4 py-3 text-left shadow-[0_1px_2px_rgba(16,24,39,0.025)]">
              <h3 className="text-xs font-extrabold text-[#222936]">{heading}</h3>
              <p className="mt-2 text-[11px] leading-5 text-[#7a828f]">{body}</p>
            </div>
          ))}
        </div>

        <button className="group mx-auto mt-8 block w-full max-w-[1080px] text-left" type="button" onClick={() => onOpen(href)}>
          <div className="overflow-hidden rounded-[22px] border border-[#e8e2d8] bg-white shadow-[0_1px_2px_rgba(16,24,39,0.04),0_22px_68px_-42px_rgba(16,24,39,0.36)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_2px_6px_rgba(16,24,39,0.05),0_30px_80px_-44px_rgba(16,24,39,0.42)]">
            <div className="relative grid grid-cols-2 overflow-hidden bg-[#f6f5f3]" style={{ aspectRatio }}>
              <div className="relative overflow-hidden border-r border-[#e7e1d7] bg-white">
                {beforeSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`${title} ${beforeLabel}`} className="h-full w-full object-cover" loading="eager" src={beforeSrc} />
                ) : (
                  <div className="h-full w-full bg-[#f2f0eb]" aria-label={`${title} ${beforeLabel}加载中`} />
                )}
              </div>
              <div className="relative overflow-hidden bg-white">
                {afterSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`${title} ${afterLabel}`} className="h-full w-full object-cover" loading="eager" src={afterSrc} />
                ) : (
                  <div className="h-full w-full bg-[#f2f0eb]" aria-label={`${title} ${afterLabel}加载中`} />
                )}
              </div>
              <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#e7e1d7] bg-white text-[#b7ada2] shadow-[0_6px_18px_rgba(16,24,39,0.12)]">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="grid h-12 grid-cols-2 border-t border-[#ebe6dd] bg-white text-center text-[11px] font-bold text-[#a49c93]">
              <div className="flex items-center justify-center border-r border-[#ebe6dd]">{beforeLabel}</div>
              <div className="flex items-center justify-center">{afterLabel}</div>
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}
