const activeDownloads = new Set<string>();

export async function downloadImage(src: string, filename = "dake-image.png") {
  if (!src || typeof window === "undefined") return;

  const safeName = filename || "dake-image.png";
  const downloadKey = `${src}::${safeName}`;
  const userAgent = window.navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const isAndroidWeChat = /Android/i.test(userAgent) && /MicroMessenger/i.test(userAgent);

  if (activeDownloads.has(downloadKey)) {
    showDownloadToast("正在准备下载，请稍候...");
    return;
  }

  activeDownloads.add(downloadKey);
  showDownloadToast(isAndroidWeChat ? "正在准备可保存图片..." : isMobile ? "正在准备图片..." : "正在启动下载...");

  try {
    if (isAndroidWeChat) {
      await showWeChatSaveImage(src, safeName);
    } else if (isMobile) {
      await downloadOnMobile(src, safeName);
    } else {
      downloadOnDesktop(src, safeName);
    }
  } catch {
    fallbackOpenImage(src, isMobile);
  } finally {
    window.setTimeout(() => {
      activeDownloads.delete(downloadKey);
      hideDownloadToast();
    }, 3000);
  }
}

function downloadOnDesktop(src: string, filename: string) {
  triggerDownload(getDownloadUrl(src, filename), filename);
}

async function downloadOnMobile(src: string, filename: string) {
  const blob = await fetchImageBlob(getDownloadUrl(src, filename));
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const navigatorWithShare = window.navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (navigatorWithShare.share && (!navigatorWithShare.canShare || navigatorWithShare.canShare({ files: [file] }))) {
    await navigatorWithShare.share({ files: [file], title: filename });
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  triggerDownload(objectUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function showWeChatSaveImage(src: string, filename: string) {
  const blob = await fetchImageBlob(getDownloadUrl(src, filename));
  const dataUrl = await blobToDataUrl(blob);
  showImageSaveOverlay(dataUrl);
  showDownloadToast("长按图片保存到手机相册");
}

async function fetchImageBlob(url: string) {
  if (url.startsWith("data:")) {
    const response = await fetch(url);
    return response.blob();
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("download failed");
  return response.blob();
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("image read failed"));
    reader.readAsDataURL(blob);
  });
}

function getDownloadUrl(src: string, filename: string) {
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;

  const url = new URL(src, window.location.href);
  if (url.origin === window.location.origin) return url.toString();

  return `/api/download-image?url=${encodeURIComponent(url.toString())}&filename=${encodeURIComponent(filename)}`;
}

function fallbackOpenImage(src: string, isMobile: boolean) {
  if (isMobile) {
    showImageSaveOverlay(src);
    showDownloadToast("长按图片保存到手机相册");
    return;
  }

  showDownloadToast("下载启动失败，请稍后重试");
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function showImageSaveOverlay(src: string) {
  let overlay = document.getElementById("dake-image-save-overlay");
  if (overlay) overlay.remove();

  overlay = document.createElement("div");
  overlay.id = "dake-image-save-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "10000";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.gap = "14px";
  overlay.style.background = "rgba(16,24,39,.88)";
  overlay.style.padding = "22px";
  overlay.style.boxSizing = "border-box";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "关闭");
  close.style.position = "absolute";
  close.style.right = "18px";
  close.style.top = "18px";
  close.style.width = "38px";
  close.style.height = "38px";
  close.style.border = "0";
  close.style.borderRadius = "999px";
  close.style.background = "rgba(255,255,255,.16)";
  close.style.color = "#fff";
  close.style.fontSize = "26px";
  close.style.lineHeight = "38px";
  close.style.cursor = "pointer";
  close.onclick = () => overlay?.remove();

  const tip = document.createElement("div");
  tip.textContent = "长按图片保存到手机相册";
  tip.style.color = "#fff";
  tip.style.fontSize = "15px";
  tip.style.fontWeight = "700";
  tip.style.textAlign = "center";

  const subTip = document.createElement("div");
  subTip.textContent = "如微信未弹出保存菜单，请点右上角选择在浏览器打开";
  subTip.style.color = "rgba(255,255,255,.72)";
  subTip.style.fontSize = "12px";
  subTip.style.textAlign = "center";

  const image = document.createElement("img");
  image.src = src;
  image.alt = "待保存图片";
  image.style.display = "block";
  image.style.maxWidth = "100%";
  image.style.maxHeight = "72vh";
  image.style.objectFit = "contain";
  image.style.borderRadius = "16px";
  image.style.background = "#fff";
  image.style.boxShadow = "0 24px 80px -36px rgba(0,0,0,.7)";
  image.style.setProperty("-webkit-touch-callout", "default");
  image.style.userSelect = "auto";

  overlay.append(close, image, tip, subTip);
  document.body.appendChild(overlay);
}

function showDownloadToast(text: string) {
  const toast = getDownloadToast();
  toast.textContent = text;
  toast.style.opacity = "1";
  toast.style.transform = "translate(-50%, 0)";
}

function hideDownloadToast() {
  const toast = document.getElementById("dake-download-toast");
  if (!toast) return;
  toast.style.opacity = "0";
  toast.style.transform = "translate(-50%, 12px)";
}

function getDownloadToast() {
  let toast = document.getElementById("dake-download-toast");
  if (toast) return toast;

  toast = document.createElement("div");
  toast.id = "dake-download-toast";
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = "24px";
  toast.style.zIndex = "10001";
  toast.style.maxWidth = "calc(100vw - 32px)";
  toast.style.borderRadius = "999px";
  toast.style.background = "#101827";
  toast.style.color = "#fff";
  toast.style.padding = "10px 16px";
  toast.style.fontSize = "13px";
  toast.style.fontWeight = "700";
  toast.style.boxShadow = "0 16px 38px -18px rgba(16,24,39,.7)";
  toast.style.opacity = "0";
  toast.style.pointerEvents = "none";
  toast.style.transform = "translate(-50%, 12px)";
  toast.style.transition = "opacity .18s ease, transform .18s ease";
  document.body.appendChild(toast);
  return toast;
}
