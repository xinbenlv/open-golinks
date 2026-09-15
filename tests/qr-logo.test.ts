/** 首次 QR 渲染包含 logo，logo 边界之外不增加白色缓冲区。 */
import { expect, test } from "bun:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { renderQrPng } from "../src/lib/qr";
test("first ZGZG render keeps logo and transparent outer corners", async () => {
  const previous = process.env.OPEN_GOLINK_THEME;
  process.env.OPEN_GOLINK_THEME = "zgzg";
  try {
    const pixels = async (logo: boolean) => {
      const image = await loadImage(renderQrPng("https://zgzg.li/handbook", { addLogo: logo }));
      const ctx = createCanvas(image.width, image.height).getContext("2d");
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height).data;
    };
    const [withLogo, plain] = await Promise.all([pixels(true), pixels(false)]);
    let red = 0;
    for (let y = 150; y < 222; y++) for (let x = 150; x < 222; x++) {
      const i = (y * 372 + x) * 4;
      if (withLogo[i]! > 120 && withLogo[i + 1]! < 70) red++;
      if (Math.abs(x - 186) >= 30 || Math.abs(y - 186) >= 30)
        expect([...withLogo.slice(i, i + 4)]).toEqual([...plain.slice(i, i + 4)]);
    }
    expect(red).toBeGreaterThan(500);
  } finally {
    if (previous === undefined) delete process.env.OPEN_GOLINK_THEME;
    else process.env.OPEN_GOLINK_THEME = previous;
  }
});
