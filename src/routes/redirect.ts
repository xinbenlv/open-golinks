import { Hono } from "hono";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db/db.ts";

export const redirectRoute = new Hono();

// 保留路径: 这些不能被当作 slug
const RESERVED = new Set([
  "api",
  "auth",
  "create",
  "dashboard",
  "edit",
  "warn",
  "assets",
  "static",
  "favicon.ico",
  "robots.txt",
]);

// SLUG 格式验证 (与 schema CHECK 约束一致)
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/;

redirectRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  if (RESERVED.has(slug) || !SLUG_RE.test(slug)) {
    return c.notFound();
  }

  const [link] = await db
    .select({ url: schema.linksTable.url, slug: schema.linksTable.slug })
    .from(schema.linksTable)
    .where(
      and(
        eq(schema.linksTable.slug, slug),
        isNull(schema.linksTable.deletedAt),
      ),
    )
    .limit(1);

  if (!link) {
    return c.notFound();
  }

  // 异步累加访问数 + daily_visits UPSERT, 不阻塞 redirect
  // (queueMicrotask 在 Bun 里能让响应先 flush)
  queueMicrotask(() => {
    void recordVisit(slug).catch((err) => {
      console.error("[redirect] recordVisit failed", err);
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
