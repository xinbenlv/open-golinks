/** 回归 Railway 旧 Bun 缺少 CompressionStream 时的生产页面响应。 */
import { expect, test } from "bun:test";
import { Hono } from "hono";
import { gunzipSync, inflateSync } from "node:zlib";
import { staticCompression } from "../src/middleware/static-compression";
const app = new Hono();
app.use("*", staticCompression);
app.get("/edit/test", c => c.html("<main>Proposed changes</main>"));
for (const encoding of ["gzip", "deflate"] as const) {
  test(`editor ${encoding} remains readable without CompressionStream`, async () => {
    const saved = globalThis.CompressionStream;
    try {
      globalThis.CompressionStream = undefined as any;
      const r = await app.request("/edit/test", { headers: { "Accept-Encoding": encoding } });
      expect(r.status).toBe(200);
      expect(r.headers.get("Content-Encoding")).toBe(encoding);
      expect(r.headers.get("Vary")).toContain("Accept-Encoding");
      const decode = encoding === "gzip" ? gunzipSync : inflateSync;
      expect(decode(Buffer.from(await r.arrayBuffer())).toString()).toBe("<main>Proposed changes</main>");
    } finally { globalThis.CompressionStream = saved; }
  });
}
test("identity and explicitly refused encodings remain uncompressed", async () => {
  const r = await app.request("/edit/test", { headers: { "Accept-Encoding": "gzip;q=0, deflate;q=0, identity" } });
  expect(r.status).toBe(200);
  expect(r.headers.get("Content-Encoding")).toBeNull();
  expect(await r.text()).toContain("Proposed changes");
});
