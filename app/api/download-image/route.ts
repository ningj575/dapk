import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawUrl = searchParams.get("url") || "";
  const filename = sanitizeFilename(searchParams.get("filename") || "xinglu-image.png");

  if (!/^https?:\/\//i.test(rawUrl)) {
    return NextResponse.json({ message: "Invalid image url" }, { status: 400 });
  }

  try {
    const response = await fetch(rawUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "XingluAI-ImageDownloader/1.0"
      }
    });

    if (!response.ok || !response.body) {
      return NextResponse.json({ message: "Image download failed" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeRFC5987(filename)}`);
    headers.set("Cache-Control", "no-store");

    return new NextResponse(response.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ message: "Image download failed" }, { status: 502 });
  }
}

function sanitizeFilename(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return cleaned || "xinglu-image.png";
}

function encodeRFC5987(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
