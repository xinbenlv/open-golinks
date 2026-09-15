/** QR PNG 渲染与缓存；ZGZG 透明 logo 直接叠在二维码上。 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas, GlobalFonts, Image } from "@napi-rs/canvas";
import QRCode from "qrcode";
import { getRuntimeBrandConfig } from "./brand.ts";

export const QR_MAX_CAPTION_LENGTH = 100;

type RenderOptions = {
  caption?: string;
  addLogo?: boolean;
  size?: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 1000;
const cache = new Map<string, { expiresAt: number; png: Buffer }>();
let fontsLoaded = false;
let zgzgLogo: Image | null | undefined;

function loadFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  try {
    GlobalFonts.registerFromPath(
      resolve(import.meta.dir, "../assets/fonts/NotoSansCJKsc-Regular.otf"),
      "Noto Sans CJK SC",
    );
  } catch (err) {
    console.error("[qr] failed to register CJK font", err);
  }
}

function cacheKey(value: string, options: RenderOptions) {
  const brand = getRuntimeBrandConfig();
  return createHash("sha256")
    .update(
      JSON.stringify({
        brand: brand.theme,
        value,
        caption: options.caption ?? "",
        addLogo: options.addLogo === true,
        size: options.size ?? 320,
      }),
    )
    .digest("hex");
}

async function loadZgzgLogo() {
  if (zgzgLogo !== undefined) return zgzgLogo;
  try {
    const image = new Image();
    image.src = readFileSync(resolve(import.meta.dir, "../assets/img/zgzg-round-logo.png"));
    await image.decode();
    zgzgLogo = image;
  } catch (err) {
    console.error("[qr] failed to load ZGZG logo", err);
    zgzgLogo = null;
  }
  return zgzgLogo;
}

// 图片解码完成后再接受渲染，避免首次 PNG 只有留白而没有 logo。
const decodedZgzgLogo = await loadZgzgLogo();

function getCached(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.png;
}

function setCached(key: string, png: Buffer) {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, png });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function drawQrModules(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  value: string,
  x: number,
  y: number,
  size: number,
) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
  const quiet = 4;
  const modules = qr.modules.size;
  const oldCell = Math.floor(size / (modules + quiet * 2));
  const oldMargin = x + Math.floor((size - oldCell * modules) / 2);
  const margin = Math.round(oldMargin / 3);
  const cell = (size + x * 2 - margin * 2) / modules;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#101014";
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (qr.modules.get(row, col)) {
        ctx.fillRect(
          margin + Math.round(col * cell),
          margin + Math.round(row * cell),
          Math.round((col + 1) * cell) - Math.round(col * cell),
          Math.round((row + 1) * cell) - Math.round(row * cell),
        );
      }
    }
  }
}

function drawLogo(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  centerX: number,
  centerY: number,
) {
  const brand = getRuntimeBrandConfig();
  const size = 58;
  const x = centerX - size / 2;
  const y = centerY - size / 2;
  const logo = brand.theme === "zgzg" ? decodedZgzgLogo : null;
  ctx.fillStyle = "#ffffff";
  if (!logo) {
    ctx.fillRect(x - 7, y - 7, size + 14, size + 14);
  }
  if (logo) {
    ctx.drawImage(logo, x, y, size, size);
  } else {
    ctx.fillStyle = brand.brandColor;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = brand.brandForegroundColor;
    ctx.font = '700 24px "Noto Sans CJK SC", Inter, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("o/", centerX, centerY + 1);
  }
}

function wrapCaption(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  caption: string,
  maxWidth: number,
) {
  const chars = Array.from(caption.trim());
  const lines: string[] = [];
  let line = "";
  for (const char of chars) {
    const next = `${line}${char}`;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = char;
      if (lines.length === 2) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < 2) lines.push(line);
  return lines;
}

export function renderQrPng(value: string, options: RenderOptions = {}) {
  const caption = options.caption?.trim() ?? "";
  const addLogo = options.addLogo === true;
  const size = options.size ?? 320;
  const key = cacheKey(value, { caption, addLogo, size });
  const cached = getCached(key);
  if (cached) return cached;

  loadFonts();
  const padding = 26;
  const captionHeight = caption ? 72 : 0;
  const width = size + padding * 2;
  const height = width + captionHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawQrModules(ctx, value, padding, padding, size);

  if (addLogo) {
    drawLogo(ctx, width / 2, padding + size / 2);
  }

  if (caption) {
    ctx.fillStyle = "#101014";
    ctx.font = '20px "Noto Sans CJK SC", Inter, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const lines = wrapCaption(ctx, caption, width - padding * 2);
    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, padding + size + 16 + index * 26);
    });
  }

  const png = canvas.toBuffer("image/png");
  setCached(key, png);
  return png;
}
