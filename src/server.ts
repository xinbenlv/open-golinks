import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { redirectRoute } from "./routes/redirect.ts";
import { healthRoute } from "./routes/api/health.ts";
import { linksRoute } from "./routes/api/links.ts";
import { meRoute } from "./routes/api/me.ts";
import { versionRoute } from "./routes/api/version.ts";
import { BUILD_INFO, formatBuildLine } from "./build-info.ts";

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

// 所有响应携带 X-Build-* header, 便于在不改 API 合约的前提下做端到端追踪.
app.use("*", async (c, next) => {
  await next();
  c.header("X-Build-Version", BUILD_INFO.version);
  c.header("X-Build-Sha", BUILD_INFO.sha);
  c.header("X-Build-Time", BUILD_INFO.builtAt);
});

// API 路由 (兼容 v2-next /api/v1/* 命名空间, 但具体 schema 可能演进)
app.route("/api/v1/health", healthRoute);
app.route("/api/v1/links", linksRoute);
app.route("/api/v1/me", meRoute);
app.route("/api/v1/version", versionRoute);

// 短链重定向: GET /:slug -> 302 to target_url
// 必须在静态资源之前注册, 否则会被 SPA fallback 吞掉
app.route("/", redirectRoute);

// 生产环境托管 Vite 构建的 SPA
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist/web" }));
  app.get("*", serveStatic({ path: "./dist/web/index.html" }));
}

const port = Number(process.env.PORT ?? 3000);
console.log(`[build] open-golinks-v2-hono ${formatBuildLine()}${BUILD_INFO.branch ? ` (${BUILD_INFO.branch})` : ""}`);
console.log(`[server] listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
