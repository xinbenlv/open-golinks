/**
 * Regression test for: GET /dashboard → 404.
 *
 * 起因: src/routes/redirect.ts 的 RESERVED 分支错误地 `return c.notFound()`,
 *      导致 `/dashboard` 等保留路径在被 SPA fallback 接管前就被短路成 404.
 *
 * 修复: RESERVED / 非法格式 slug 必须 `return next()`, 把请求让给后续中间件
 *      (静态资源 + SPA fallback).
 *
 * 这个测试锁住该行为: 所有 RESERVED slug 必须穿透到 SPA fallback, 而不是 404.
 *
 * 设计取舍: 不直接 import src/server.ts (会拉起真实的 serveStatic + 依赖 dist/web 产物),
 *           而是只 import redirectRoute, 用一个 sentinel handler 模拟 SPA fallback.
 *           这样测试不依赖前端构建, 跑得快, 失败信号也更聚焦在 redirect 路由上.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import type { Hono as HonoType } from "hono";

let app: HonoType;

const SPA_SENTINEL = "SPA_FALLBACK";

// src/routes/redirect.ts 顶部声明的 RESERVED. 复制一份是有意为之:
// 测试要能在 RESERVED 被偷偷修改时报警, 而不是默默跟着改.
const EXPECTED_RESERVED = [
  "api",
  "auth",
  "claim",
  "create",
  "dashboard",
  "edit",
  "login",
  "warn",
  "assets",
  "static",
  "favicon.ico",
  "robots.txt",
] as const;

beforeAll(async () => {
  // db/db.ts 在模块顶层校验 DATABASE_URL, 必须在动态 import 之前注入.
  // postgres-js 在第一次 query 之前不会真正连接, 所以 stub URL 是安全的;
  // 本测试也不会触发任何 query (RESERVED 分支在 query 之前就 next() 出去了).
  process.env.DATABASE_URL ??= "postgres://stub:stub@127.0.0.1:5432/stub";

  const { Hono } = await import("hono");
  const { redirectRoute } = await import("../../src/routes/redirect.ts");

  // 复现 src/server.ts 的注册顺序: redirectRoute 在 SPA fallback 之前.
  app = new Hono();
  app.route("/", redirectRoute);
  app.get("*", (c) => c.text(SPA_SENTINEL, 200));
});

describe("redirect route: reserved-slug fallthrough", () => {
  it.each(EXPECTED_RESERVED.map((s) => [s]))(
    "GET /%s 必须穿透到 SPA fallback (回归: 不能被 redirectRoute 短路成 404)",
    async (slug) => {
      const res = await app.request(`/${slug}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(SPA_SENTINEL);
    },
  );

  it("GET /dashboard 是原始 bug 的最小复现, 单独断言一次", async () => {
    const res = await app.request("/dashboard");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SPA_SENTINEL);
  });

  it("非法格式 slug (单字符) 也必须穿透, 不应返回 404", async () => {
    const res = await app.request("/X");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SPA_SENTINEL);
  });

  it("非法格式 slug (大写字母) 也必须穿透", async () => {
    const res = await app.request("/HELLO");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SPA_SENTINEL);
  });
});
