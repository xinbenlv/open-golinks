import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { webBrand } from "../lib/brand";

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function QrCanvas({
  value,
  caption,
  addLogo,
}: {
  value: string;
  caption: string;
  addLogo: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    if (!canvas) return;
    const canvasEl = canvas;

    async function draw() {
      const size = 240;
      const padding = 20;
      const captionText = caption.trim();
      const captionHeight = captionText ? 54 : 0;
      const width = size + padding * 2;
      const height = width + captionHeight;
      const dpr = window.devicePixelRatio || 1;
      canvasEl.width = width * dpr;
      canvasEl.height = height * dpr;
      canvasEl.style.width = `${width}px`;
      canvasEl.style.height = `${height}px`;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
      const quiet = 4;
      const modules = qr.modules.size;
      const cell = Math.floor(size / (modules + quiet * 2));
      const actualSize = cell * (modules + quiet * 2);
      const offset = Math.floor((size - actualSize) / 2);
      ctx.fillStyle = "#101014";
      for (let row = 0; row < modules; row += 1) {
        for (let col = 0; col < modules; col += 1) {
          if (qr.modules.get(row, col)) {
            ctx.fillRect(
              padding + offset + (col + quiet) * cell,
              padding + offset + (row + quiet) * cell,
              cell,
              cell,
            );
          }
        }
      }

      if (addLogo) {
        const centerX = width / 2;
        const centerY = padding + size / 2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(centerX - 34, centerY - 34, 68, 68);
        if (webBrand.logoUrl) {
          try {
            const image = await loadImageElement(webBrand.logoUrl);
            if (cancelled) return;
            ctx.drawImage(image, centerX - 29, centerY - 29, 58, 58);
          } catch {
            ctx.fillStyle = webBrand.brandColor;
            ctx.fillRect(centerX - 26, centerY - 26, 52, 52);
          }
        }
        if (!webBrand.logoUrl) {
          ctx.fillStyle = webBrand.brandColor;
          ctx.fillRect(centerX - 26, centerY - 26, 52, 52);
          ctx.fillStyle = webBrand.brandForegroundColor;
          ctx.font = "700 22px Inter, ui-sans-serif, system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("o/", centerX, centerY + 1);
        }
      }

      if (captionText) {
        ctx.fillStyle = "#101014";
        ctx.font = "18px Inter, ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(captionText, width / 2, padding + size + 16, width - padding * 2);
      }
    }

    draw().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [addLogo, caption, value]);

  return <canvas ref={ref} className="qr-preview" aria-label="QR preview" />;
}
