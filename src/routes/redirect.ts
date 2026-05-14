import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db/db.ts";
import { newGaClientId, reportRedirectToGA4 } from "../lib/ga4.ts";

export const redirectRoute = new Hono();

// 保留路径: 这些不能被当作 slug
const RESERVED = new Set([
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
]);

// SLUG 格式验证 (与 schema CHECK 约束一致)
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/;

redirectRoute.get("/:slug", async (c, next) => {
  const slug = c.req.param("slug");

  // 保留路径或非法 slug 格式: 不处理, 交给后续中间件 (静态资源 / SPA fallback)
  if (RESERVED.has(slug) || !SLUG_RE.test(slug)) {
    return next();
  }

  const [link] = await db
    .select({
      url: schema.linksTable.url,
      slug: schema.linksTable.slug,
      deletedAt: schema.linksTable.deletedAt,
    })
    .from(schema.linksTable)
    .where(eq(schema.linksTable.slug, slug))
    .limit(1);

  if (!link) {
    // slug 格式合法但还没被创建: 把用户送到 /edit/<slug> 让他直接创建,
    // 而不是 404. 跟 go/links 的 "没找到就创建" 体验一致.
    return c.redirect(`/edit/${slug}`, 302);
  }

  if (link.deletedAt) {
    return c.text("Not found", 404);
  }

  const existingClientId = getCookie(c, "_ga");
  const clientId = existingClientId || newGaClientId();
  if (!existingClientId) {
    setCookie(c, "_ga", clientId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "Lax",
      secure: new URL(c.req.url).protocol === "https:",
    });
  }

  // 异步累加访问数 + daily_visits UPSERT, 不阻塞 redirect
  // (queueMicrotask 在 Bun 里能让响应先 flush)
  queueMicrotask(() => {
    void recordVisit(slug).catch((err) => {
      console.error("[redirect] recordVisit failed", err);
    });
  });
  queueMicrotask(() => {
    void reportRedirectToGA4({
      clientId,
      slug,
      userAgent: c.req.header("user-agent"),
      referer: c.req.header("referer"),
    }).catch((err) => {
      console.error("[redirect] GA4 report failed", err);
    });
  });

  return c.redirect(link.url, 302);
});

async function recordVisit(slug: string) {
  // 累加 visits 计数 + 当日 daily_visits UPSERT
  await db.transaction(async (tx) => {
    await tx
      .update(schema.linksTable)
      .set({ visits: sql`${schema.linksTable.visits} + 1` })
      .where(eq(schema.linksTable.slug, slug));

    await tx
      .insert(schema.dailyVisitsTable)
      .values({
        linkSlug: slug,
        date: new Date(),
        count: 1,
      })
      .onConflictDoUpdate({
        target: [
          schema.dailyVisitsTable.linkSlug,
          schema.dailyVisitsTable.date,
        ],
        set: { count: sql`${schema.dailyVisitsTable.count} + 1` },
      });
  });
}
