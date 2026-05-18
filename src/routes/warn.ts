import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db/db.ts";
import { getRuntimeBrandConfig } from "../lib/brand.ts";

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
  const brand = getRuntimeBrandConfig();
  const escapedProductName = escapeHtml(brand.productName);
  const escapedWarningIconHref = escapeHtml(brand.warningIconHref);
  const escapedBrand = escapeHtml(brand.brandColor);
  const escapedBrandSoft = escapeHtml(brand.brandSoftColor);
  const escapedBrandLight = escapeHtml(brand.lightBrandColor);
  const escapedBrandSoftLight = escapeHtml(brand.lightBrandSoftColor);
  const escapedAction = escapeHtml(brand.actionPrimaryColor);
  const escapedActionHover = escapeHtml(brand.actionPrimaryHoverColor);
  const escapedActionForeground = escapeHtml(brand.actionPrimaryForegroundColor);
  const escapedActionLight = escapeHtml(brand.lightActionPrimaryColor);
  const escapedActionHoverLight = escapeHtml(brand.lightActionPrimaryHoverColor);
  const escapedActionForegroundLight = escapeHtml(brand.lightActionPrimaryForegroundColor);
  const escapedWarning = escapeHtml(brand.warningColor);
  const escapedWarningSoft = escapeHtml(brand.warningSoftColor);
  const escapedWarningForeground = escapeHtml(brand.warningForegroundColor);
  const escapedWarningLight = escapeHtml(brand.lightWarningColor);
  const escapedWarningSoftLight = escapeHtml(brand.lightWarningSoftColor);
  const escapedWarningForegroundLight = escapeHtml(brand.lightWarningForegroundColor);
  return c.html(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="${escapedWarningIconHref}" />
    <title>${escapedProductName}: External link warning</title>
    <style>
      :root {
        color-scheme: dark light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --brand: ${escapedBrand};
        --brand-soft: ${escapedBrandSoft};
        --action-primary: ${escapedAction};
        --action-primary-hover: ${escapedActionHover};
        --action-primary-foreground: ${escapedActionForeground};
        --warning: ${escapedWarning};
        --warning-soft: ${escapedWarningSoft};
        --warning-foreground: ${escapedWarningForeground};
      }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #101014; color: #f6f1ed; }
      main { width: min(92vw, 560px); border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 32px; background: #18181f; box-shadow: 0 24px 80px rgba(0,0,0,.36); }
      .badge { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 999px; background: var(--warning-soft); color: var(--warning); font-size: 13px; font-weight: 700; margin-bottom: 16px; }
      h1 { margin: 0 0 12px; font-size: clamp(24px, 5vw, 34px); line-height: 1.08; }
      p { color: #c9c1bc; line-height: 1.65; }
      code { display: block; overflow-wrap: anywhere; padding: 14px; border-radius: 8px; background: #23232d; color: #ffd7c2; border-left: 3px solid var(--warning); }
      .meta { font-size: 14px; }
      .product { color: var(--brand); }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
      a { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 18px; border-radius: 8px; text-decoration: none; font-weight: 650; }
      .btn-proceed { background: var(--action-primary); color: var(--action-primary-foreground); }
      .btn-proceed:hover { background: var(--action-primary-hover); }
      .btn-claim { border: 1px solid var(--warning); color: var(--warning); }
      .btn-cancel { border: 1px solid rgba(255,255,255,.18); color: #f6f1ed; }
      @media (prefers-color-scheme: light) {
        :root {
          --brand: ${escapedBrandLight};
          --brand-soft: ${escapedBrandSoftLight};
          --action-primary: ${escapedActionLight};
          --action-primary-hover: ${escapedActionHoverLight};
          --action-primary-foreground: ${escapedActionForegroundLight};
          --warning: ${escapedWarningLight};
          --warning-soft: ${escapedWarningSoftLight};
          --warning-foreground: ${escapedWarningForegroundLight};
        }
        body { background: #fafaf7; color: #18181b; }
        main { border-color: rgba(0,0,0,.10); background: #ffffff; box-shadow: 0 24px 80px rgba(24,24,27,.10); }
        p { color: #52525b; }
        code { background: #f4f4f5; color: #27272a; }
        .btn-cancel { border-color: rgba(0,0,0,.16); color: #18181b; }
      }
    </style>
  </head>
  <body>
    <main class="warn">
      <div class="badge">External warning</div>
      <h1><span class="product">${escapedProductName}</span> 即将跳转外部链接</h1>
      <p>You are about to visit:</p>
      <code class="dest">${escapedUrl}</code>
      <p class="meta">Short link: /${escapedSlug}</p>
      <div class="actions">
        <a href="/${encodeURIComponent(link.slug)}?confirm=1" class="btn-proceed">继续访问 Proceed</a>
        <a href="/claim/${encodeURIComponent(link.slug)}" class="btn-claim">Login to Claim</a>
        <a href="/" class="btn-cancel">取消 Cancel</a>
      </div>
    </main>
  </body>
</html>`);
});
