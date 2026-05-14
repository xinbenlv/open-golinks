import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db/db.ts";

export const warnRoute = new Hono();

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

warnRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (!SLUG_RE.test(slug)) return c.text("Not found", 404);

  const [link] = await db
    .select({
      slug: schema.linksTable.slug,
      url: schema.linksTable.url,
    })
    .from(schema.linksTable)
    .where(
      and(
        eq(schema.linksTable.slug, slug),
        isNull(schema.linksTable.deletedAt),
      ),
    )
    .limit(1);

  if (!link) return c.text("Not found", 404);

  const escapedSlug = escapeHtml(link.slug);
  const escapedUrl = escapeHtml(link.url);
  return c.html(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23ff7a45'/%3E%3Cpath d='M32 12 56 52H8L32 12Z' fill='%23101014'/%3E%3Ccircle cx='32' cy='45' r='3' fill='%23ff7a45'/%3E%3Cpath d='M30 25h4v15h-4z' fill='%23ff7a45'/%3E%3C/svg%3E" />
    <title>Warning: External link</title>
    <style>
      :root { color-scheme: dark light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #101014; color: #f6f1ed; }
      main { width: min(92vw, 560px); border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 32px; background: #18181f; box-shadow: 0 24px 80px rgba(0,0,0,.36); }
      h1 { margin: 0 0 12px; font-size: clamp(24px, 5vw, 34px); line-height: 1.08; }
      p { color: #c9c1bc; line-height: 1.65; }
      code { display: block; overflow-wrap: anywhere; padding: 14px; border-radius: 8px; background: #23232d; color: #ffd7c2; }
      .meta { font-size: 14px; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
      a { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 18px; border-radius: 8px; text-decoration: none; font-weight: 650; }
      .btn-proceed { background: #ff7a45; color: #210900; }
      .btn-cancel { border: 1px solid rgba(255,255,255,.18); color: #f6f1ed; }
    </style>
  </head>
  <body>
    <main class="warn">
      <h1>即将跳转外部链接</h1>
      <p>You are about to visit:</p>
      <code class="dest">${escapedUrl}</code>
      <p class="meta">Short link: /${escapedSlug}</p>
      <div class="actions">
        <a href="/${encodeURIComponent(link.slug)}?confirm=1" class="btn-proceed">继续访问 Proceed</a>
        <a href="/" class="btn-cancel">取消 Cancel</a>
      </div>
    </main>
  </body>
</html>`);
});
