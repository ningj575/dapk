export async function downloadImage(src: string, filename = "dake-image.png") {
  if (!src || typeof window === "undefined") return;

  const safeName = filename || "dake-image.png";
  const downloadUrl = src.startsWith("data:")
    ? src
    : `/api/download-image?url=${encodeURIComponent(src)}&filename=${encodeURIComponent(safeName)}`;

  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const file = new File([blob], safeName, { type: blob.type || "image/png" });
    const nav = window.navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);

    if (isMobile && nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await nav.share({ files: [file], title: safeName });
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, safeName);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } catch {
    triggerDownload(downloadUrl, safeName);
  }
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
