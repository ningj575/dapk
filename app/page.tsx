"use client";

import { LoginDialog } from "@/components/login-dialog";
import { useAuthToken, useClientReady } from "@/components/auth-state";
import {
  ArrowRight,
  Camera,
  Eraser,
  LayoutGrid,
  Loader2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type HeroToolKey = "image-editor" | "studio-genesis" | "ecom-studio" | "video-studio";

const HOME_DRAFT_KEY = "dake_home_generation_draft";

const heroTools: Array<{ key: HeroToolKey; label: string; href: string; placeholders: string[] }> = [
  {
    key: "image-editor",
    label: "图像创作",
    href: "/image-editor",
    placeholders: [
      "输入创意描述，直接生成商品海报或场景图",
      "例如：哑光陶瓷水杯摆放在原木窗台，自然光漫射，简约 ins 风产品摄影",
      "支持上传参考图，并设置目标尺寸后一键生成"
    ]
  },
  {
    key: "studio-genesis",
    label: "电商主图",
    href: "/studio-genesis",
    placeholders: [
      "上传商品图，自动分析并生成整套电商主图",
      "例如：银框偏光太阳镜，突出夏日出行、高级质感与防晒属性",
      "支持同一商品多角度展示，AI 会智能规划主图、场景图与卖点图"
    ]
  },
  {
    key: "ecom-studio",
    label: "电商详情图",
    href: "/ecom-studio",
    placeholders: [
      "上传商品图，自动分析并生成整套电商详情图",
      "输入补充诉求，例如：浅棕复古双肩包，突出通勤、旅行与日常搭配场景",
      "支持同一商品多角度展示，AI 会智能规划详情图、场景图与卖点图"
    ]
  },
  {
    key: "video-studio",
    label: "产品视频",
    href: "/video-studio",
    placeholders: [
      "上传一张产品图，AI 导演自动输出产品视频分镜",
      "例如：聚焦手表金属表盘光泽，打造高级轻奢的数码穿搭氛围感画面",
      "适合产品宣传短视频、详情页视频和投放素材方案"
    ]
  }
];

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
    desc: "精修/海报/广告/社媒\n一句话生成创意设计",
    icon: LayoutGrid,
    gradient: "from-teal-500 to-emerald-600",
    glow: "rgba(20,184,166,0.5)",
    href: "/image-editor"
  },
  {
    title: "电商主图",
    desc: "一键打造高吸引力商品主图\n覆盖国内跨境各大主流电商平台",
    icon: Camera,
    gradient: "from-blue-500 to-indigo-600",
    glow: "rgba(99,102,241,0.5)",
    href: "/studio-genesis"
  },
  {
    title: "电商详情图",
    desc: "自动搭建全套商品详情页面板块\n卖点、参数、场景素材一站式生成",
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
    beforeSrc: `${API_BASE_URL}/images/showcase/watermark_before.jpg`,
    afterSrc: `${API_BASE_URL}/images/showcase/watermark_after.jpg`,
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
    afterLabel: "Xinglu 设计稿",
    beforeSrc: `${API_BASE_URL}/images/showcase/universal_before.jpg`,
    afterSrc: `${API_BASE_URL}/images/showcase/universal_after.jpg`,
    aspectRatio: "1078 / 719",
    href: "/image-editor"
  },
  {
    showcaseKey: "main_image",
    index: "03",
    title: "电商主图生成",
    subtitle: "上传商品原图即可智能解析产品材质、核心卖点，自动生成适配全平台规范的专业电商主图",
    points: [
      ["商品智能识别", "自动抓取材质、色彩、纹理与产品卖点，省去人工梳理步骤"],
      ["多平台一键适配", "覆盖跨境、国内主流电商平台，自动匹配各平台尺寸与规范"],
      ["品牌视觉可控", "自由调整场景灯光、画面构图，保障商品辨识度与品牌风格统一"]
    ],
    beforeLabel: "原图",
    afterLabel: "Xinglu 效果",
    beforeSrc: `${API_BASE_URL}/images/showcase/main_before.jpg`,
    afterSrc: `${API_BASE_URL}/images/showcase/main_after.jpg`,
    aspectRatio: "1078 / 719",
    href: "/studio-genesis"
  },
  {
    showcaseKey: "detail_image",
    index: "04",
    title: "电商详情图生成",
    subtitle: "基于多视角产品原图智能拆解页面结构，自动化规划详情模块，批量输出整套电商详情视觉素材",
    points: [
      ["智能模块规划", "围绕产品核心卖点自动梳理详情内容，搭建清晰流畅的信息展示层级"],
      ["全平台规格适配", "一键切换海内外各平台版式、尺寸标准，无需反复调整重复返工"],
      ["并行批量出图", "单次产品解析即可同步产出多张详情素材，大幅缩短新品上架与营销投放周期"]
    ],
    beforeLabel: "原图",
    afterLabel: "Xinglu 效果",
    beforeSrc: `${API_BASE_URL}/images/showcase/detail_before.jpg`,
    afterSrc: `${API_BASE_URL}/images/showcase/detail_after.jpg`,
    aspectRatio: "1078 / 958",
    href: "/ecom-studio"
  },
  {
    showcaseKey: "video_generation",
    index: "05",
    title: "视频生成",
    subtitle: "上传产品图或参考素材，AI 自动规划镜头语言与运动节奏，快速生成适合商品展示、投放和详情页使用的产品视频。",
    points: [
      ["产品视频分镜", "根据商品主体、卖点和场景自动拆解镜头，减少人工策划成本"],
      ["多模式创作", "支持一键生成、首尾帧和视频复刻等常用视频生产流程"],
      ["适配营销投放", "围绕产品质感、场景氛围和卖点表达输出更适合转化的视频素材"]
    ],
    beforeLabel: "产品素材",
    afterLabel: "视频效果",
    beforeSrc: `${API_BASE_URL}/images/showcase/video_before.jpg`,
    afterSrc: `${API_BASE_URL}/images/showcase/video_after.jpg`,
    aspectRatio: "16 / 9",
    href: "/video-studio"
  }
];

type HomeShowcaseImage = {
  key: string;
  title?: string;
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
  const [redirectTo, setRedirectTo] = useState("/watermark-remover");
  const [showcaseImages, setShowcaseImages] = useState<HomeShowcaseImage[] | null>(null);
  const [heroTool, setHeroTool] = useState<HeroToolKey>("image-editor");
  const [heroPrompt, setHeroPrompt] = useState("");
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [heroUploading, setHeroUploading] = useState(false);
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const token = useAuthToken();
  const ready = Boolean(useClientReady());
  const openLogin = (target = "/watermark-remover") => {
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
        setShowcaseImages(rows.filter((row: HomeShowcaseImage) => row.key));
      })
      .catch(() => {
        if (!cancelled) setShowcaseImages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeHeroTool = heroTools.find((item) => item.key === heroTool) || heroTools[0];

  useEffect(() => {
    const samples = activeHeroTool.placeholders.length ? activeHeroTool.placeholders : [""];
    let sampleIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer = 0;

    const tick = () => {
      const current = samples[sampleIndex % samples.length];
      setAnimatedPlaceholder(current.slice(0, charIndex));
      if (!deleting && charIndex < current.length) {
        charIndex += 1;
        timer = window.setTimeout(tick, 72);
        return;
      }
      if (!deleting && charIndex >= current.length) {
        deleting = true;
        timer = window.setTimeout(tick, 1500);
        return;
      }
      if (deleting && charIndex > 0) {
        charIndex -= 1;
        timer = window.setTimeout(tick, 44);
        return;
      }
      deleting = false;
      sampleIndex += 1;
      timer = window.setTimeout(tick, 420);
    };

    setAnimatedPlaceholder("");
    tick();
    return () => window.clearTimeout(timer);
  }, [heroTool]);

  function readImageFile(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });
  }

  async function onHeroFiles(files?: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, 6 - heroImages.length));
    if (selected.length === 0) return;
    setHeroUploading(true);
    try {
      const images = await Promise.all(selected.map(readImageFile));
      setHeroImages((current) => [...current, ...images].slice(0, 6));
    } finally {
      setHeroUploading(false);
      if (heroInputRef.current) heroInputRef.current.value = "";
    }
  }

  function startHeroGenerate() {
    const target = activeHeroTool.href;
    window.localStorage.setItem(
      HOME_DRAFT_KEY,
      JSON.stringify({
        target,
        prompt: heroPrompt.trim(),
        images: heroImages,
        createdAt: Date.now()
      })
    );
    if (token) {
      router.push(target);
      return;
    }
    setRedirectTo(target);
    setLoginOpen(true);
  }

  const showcaseDefaults = new Map(showcases.map((showcase) => [showcase.showcaseKey, showcase]));
  const renderedShowcases = (showcaseImages || [])
    .map((remote, orderIndex) => {
      const showcase = showcaseDefaults.get(remote.key);
      if (!showcase) return null;
      return {
        ...showcase,
        index: String(orderIndex + 1).padStart(2, "0"),
        title: remote.title || showcase.title,
        beforeSrc: resolveMediaUrl(remote.before_src),
        afterSrc: resolveMediaUrl(remote.after_src),
        aspectRatio: remote.aspect_ratio || showcase.aspectRatio
      };
    })
    .filter((showcase): showcase is (typeof showcases)[number] => Boolean(showcase));

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#101827]">
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} redirectTo={redirectTo} />
      <header className="sticky top-0 z-50 w-full bg-[#faf9f7]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-5 sm:px-8">
          <button className="flex items-center gap-2" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span className="font-display text-xl font-extrabold tracking-tight text-[#101827]">Xinglu</span>
            <span className="text-xs font-medium text-text-tertiary">AI</span>
          </button>
          <button
            className="press-scale inline-flex h-9 items-center justify-center gap-2 rounded-[0.9rem] border border-[#171d2a] bg-[#101827] px-4 text-sm font-semibold text-[#f8f4ee] shadow-[0_2px_8px_rgba(16,24,39,0.08),0_14px_34px_-12px_rgba(16,24,39,0.38)] transition-all duration-200 hover:-translate-y-px hover:bg-[#151f31]"
            type="button"
            onClick={() => openLogin("/watermark-remover")}
          >
            {token ? "立即体验" : "免费体验"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-8 pt-12 sm:px-8 sm:pb-12 sm:pt-16">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(219,220,255,0.45),rgba(255,255,255,0.72)_48%,rgba(229,247,215,0.42))]" />
          <div className="relative mx-auto flex max-w-[1120px] flex-col items-center">
            <h1 className="max-w-[1060px] text-center font-display text-[42px] font-extrabold leading-[1.12] tracking-tight text-[#080b12] sm:text-[52px]">
              <span className="dake-gradient-text">Xinglu AI</span> 一句话，完成专业电商套图
            </h1>
            <p className="mt-6 text-center text-base font-medium tracking-[0.03em] text-[#737987] sm:text-xl">以极致 AI 创意，助推商业价值增长</p>

            <div className="mt-9 w-full max-w-[1000px] rounded-[32px] bg-white/84 p-5 shadow-[0_24px_80px_-48px_rgba(16,24,39,0.52)] ring-1 ring-white/80 backdrop-blur-xl sm:p-8">
              <div className="flex flex-wrap items-center gap-8 px-1 sm:gap-12">
                {heroTools.map((item) => (
                  <button
                    key={item.key}
                    className={`relative pb-3 text-[18px] font-extrabold transition ${heroTool === item.key ? "text-[#101827]" : "text-[#8b909b] hover:text-[#101827]"}`}
                    type="button"
                    onClick={() => setHeroTool(item.key)}
                  >
                    {item.label}
                    {heroTool === item.key && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-[#edd53a]" />}
                  </button>
                ))}
              </div>

              <div className="relative mt-5">
                <textarea
                  className="min-h-[150px] w-full resize-none rounded-[24px] border-0 bg-[#f4f3f2] px-5 py-5 text-base font-normal leading-8 text-[#0d0d0d] outline-none sm:min-h-[168px] sm:text-lg"
                  value={heroPrompt}
                  onChange={(event) => setHeroPrompt(event.target.value)}
                />
                {!heroPrompt && (
                  <div className="pointer-events-none absolute left-5 top-5 pr-5 text-[18px] font-normal leading-8 text-[#9aa0aa]">
                    <span>{animatedPlaceholder}</span>
                    <span className="dake-type-cursor" />
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <input ref={heroInputRef} className="hidden" type="file" accept="image/*" multiple onChange={(event) => void onHeroFiles(event.target.files)} />
                  {heroImages.map((src, index) => (
                    <div key={`${src.slice(0, 32)}-${index}`} className="group relative h-12 w-12 overflow-hidden rounded-[14px] border border-[#e3ded5] bg-[#f4f3f2]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`上传参考图 ${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute inset-0 hidden items-center justify-center bg-[#101827]/58 text-white group-hover:flex"
                        onClick={() => setHeroImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        aria-label="移除参考图"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#ece7de] bg-white text-[#101827] shadow-[0_10px_28px_-20px_rgba(16,24,39,0.55)] transition hover:bg-[#f7f5f1]"
                    onClick={() => heroInputRef.current?.click()}
                    disabled={heroUploading || heroImages.length >= 6}
                    aria-label="上传图片"
                  >
                    {heroUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-[26px] font-light leading-none">+</span>}
                  </button>
                </div>

                <button
                  type="button"
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[16px] bg-[#7c3aed] px-7 text-base font-extrabold text-white shadow-[0_18px_40px_-22px_rgba(124,58,237,0.75)] transition hover:-translate-y-px hover:bg-[#6d28d9]"
                  onClick={startHeroGenerate}
                >
                  <Sparkles className="h-5 w-5" />
                  立即生成
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex items-center overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_28%_18%,rgba(251,191,146,0.14),transparent),radial-gradient(ellipse_50%_45%_at_72%_28%,rgba(167,215,198,0.11),transparent),radial-gradient(ellipse_45%_40%_at_50%_82%,rgba(196,181,219,0.09),transparent)]" />
          <div className="relative mx-auto w-full max-w-[1440px] px-5 sm:px-8">
            <div className="flex flex-col items-center text-center">
              <h1 className="hidden max-w-[1100px] font-display text-[clamp(3.25rem,7vw,5.5rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[#101827]">
                一键上传 高级出圈
              </h1>
              <p className="hidden mt-7 max-w-[580px] text-base leading-8 text-[#69707f] sm:text-lg sm:leading-9">
                GPT Image 2 + Nano Banana 2 双引擎驱动。深耕电商主图、详情页制作，上传即出稿，省去外包开销与漫长定稿周期。
              </p>

              <div className="grid w-full max-w-[1400px] grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {featureCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      className="group glass-card relative flex min-h-[250px] flex-col overflow-hidden rounded-[2rem] p-8 text-left transition-all duration-500 ease-out hover:-translate-y-1.5 hover:border-white/70 sm:min-h-[270px] lg:p-8 xl:min-h-[280px]"
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
                      <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br ${card.gradient} text-white shadow-[0_18px_34px_-18px_rgba(16,24,39,0.65)] ring-1 ring-white/25 transition-all duration-500 group-hover:scale-105 group-hover:shadow-xl`}>
                        <Icon className="h-10 w-10" strokeWidth={1.8} />
                      </div>
                      <div className="relative mt-7 flex min-h-[44px] items-center justify-between gap-4">
                        <h3 className="whitespace-nowrap text-[1.7rem] font-extrabold leading-tight tracking-tight text-[#101827] transition-transform duration-300 group-hover:-translate-x-0.5 2xl:text-3xl">
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
          © 2026 Xinglu AI. All rights reserved.
        </div>
      </footer>
      <style jsx global>{`
        .dake-gradient-text {
          background: linear-gradient(95deg, #ff3f8f 0%, #8b5cf6 38%, #14b8a6 72%, #ff8a3d 100%);
          background-size: 240% 240%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: dakeGradientFlow 5.2s ease-in-out infinite;
        }

        @keyframes dakeGradientFlow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .dake-type-cursor {
          display: inline-block;
          width: 1px;
          height: 1.15em;
          margin-left: 3px;
          vertical-align: -0.18em;
          background: #7c3aed;
          animation: dakeTypeCursorBlink 0.9s steps(2, start) infinite;
        }

        @keyframes dakeTypeCursorBlink {
          0%,
          45% {
            opacity: 1;
          }
          46%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
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
    <section className="relative overflow-hidden bg-[#faf9f7] px-5 py-14 sm:px-8 sm:py-[4.5rem]">
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
