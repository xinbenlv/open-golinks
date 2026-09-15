/** 静态 HTML/CSS/JS 按浏览器能力压缩；Vary 防止缓存混用编码版本。 */
import type { MiddlewareHandler } from "hono";
import { compress } from "hono/compress";
const compressResponse = compress();
export const staticCompression: MiddlewareHandler = async (c, next) => {
  await compressResponse(c, next);
  c.header("Vary", "Accept-Encoding", { append: true });
};
