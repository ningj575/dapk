const activeDownloads = new Set<string>();

export async function downloadImage(src: string, filename = "dake-image.png") {
  if (!src || typeof window === "undefined") return;

  const safeName = filename || "dake-image.png";
  const downloadKey = `${src}::${safeName}`;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);

  if (activeDownloads.has(downloadKey)) {
    showDownloadToast("正在准备下载，请稍候...");
    return;
  }

  activeDownloads.add(downloadKey);
  showDownloadToast(isMobile ? "正在准备图片..." : "正在启动下载...");

  try {
    if (isMobile) {
      await downloadOnMobile(src, safeName);
    } else {
      triggerDownload(src, safeName);
    }
  } catch {
    showDownloadToast("下载启动失败，请稍后重试");
  } finally {
    window.setTimeout(() => {
      activeDownloads.delete(downloadKey);
      hideDownloadToast();
    }, 3000);
  }
}

async function downloadOnMobile(src: string, filename: string) {
  const response = await fetch(src, { mode: "cors" });
  if (!response.ok) throw new Error("download failed");

  const blob = await response.blob();
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

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
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
  toast.style.zIndex = "9999";
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
