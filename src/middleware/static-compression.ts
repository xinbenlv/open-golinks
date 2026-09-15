/** 静态压缩使用 zlib，兼容没有 CompressionStream 的 Railway Bun。 */
import type { MiddlewareHandler } from "hono";
import { gzip, deflate } from "node:zlib";
import { promisify } from "node:util";
const encoders = { gzip: promisify(gzip), deflate: promisify(deflate) };
export const staticCompression: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Vary", "Accept-Encoding", { append: true });
  const response = c.res;
  if (c.req.method === "HEAD" || !response.body || response.headers.has("Content-Encoding") ||
      /\bno-transform\b/i.test(response.headers.get("Cache-Control") ?? "") ||
      !/text\/|javascript|json|svg\+xml/i.test(response.headers.get("Content-Type") ?? "")) return;
  const accepted = (c.req.header("Accept-Encoding") ?? "").split(",").map(value => {
    const [name, ...params] = value.trim().split(";");
    const q = params.find(p => p.trim().startsWith("q="));
    return { name, quality: q ? Number(q.trim().slice(2)) : 1 };
  }).filter(item => item.quality > 0).sort((a, b) => b.quality - a.quality);
  const encoding = accepted.find(item => item.name === "gzip" || item.name === "deflate")?.name as keyof typeof encoders | undefined;
  if (!encoding) return;
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  const compressed = await encoders[encoding](Buffer.from(body));
  headers.delete("Content-Length");
  headers.set("Content-Encoding", encoding);
  const etag = headers.get("ETag");
  if (etag && !etag.startsWith("W/")) headers.set("ETag", `W/${etag}`);
  c.res = new Response(new Uint8Array(compressed), { status: response.status, statusText: response.statusText, headers });
};
