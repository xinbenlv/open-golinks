import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { redirectRoute } from "./routes/redirect.ts";
import { healthRoute } from "./routes/api/health.ts";
import { linksRoute } from "./routes/api/links.ts";

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

// API 路由 (兼容 v2-next /api/v1/* 命名空间, 但具体 schema 可能演进)
app.route("/api/v1/health", healthRoute);
app.route("/api/v1/links", linksRoute);

// 短链重定向: GET /:slug -> 302 to target_url
// 必须在静态资源之前注册, 否则会被 SPA fallback 吞掉
app.route("/", redirectRoute);

// 生产环境托管 Vite 构建的 SPA
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist/web" }));
  app.get("*", serveStatic({ path: "./dist/web/index.html" }));
}

const port = Number(process.env.PORT ?? 3000);
console.log(`[server] listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
