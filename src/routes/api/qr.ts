import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../../db/db.ts";
import { QR_MAX_CAPTION_LENGTH, renderQrPng } from "../../lib/qr.ts";

export const qrApiRoute = new Hono();

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/;

function publicBaseUrl(requestUrl: string) {
  return (process.env.PUBLIC_BASE_URL || new URL(requestUrl).origin).replace(/\/$/, "");
}

function parseAddLogo(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes";
}

function metadataCaption(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as { caption?: unknown }).caption;
  return typeof value === "string" ? value : "";
}

function metadataAddLogo(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return true;
  return (metadata as { addLogo?: unknown }).addLogo !== false;
}

async function findQrLink(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  const [link] = await db
    .select({
      slug: schema.linksTable.slug,
      url: schema.linksTable.url,
      metadata: schema.linksTable.metadata,
    })
    .from(schema.linksTable)
    .where(
      and(
        eq(schema.linksTable.slug, slug),
        isNull(schema.linksTable.deletedAt),
      ),
    )
    .limit(1);
  return link ?? null;
}

qrApiRoute.get("/:slug", async (c) => {
  const format = c.req.query("format") ?? "png";
  if (format !== "png") return c.json({ error: "UNSUPPORTED_FORMAT" }, 400);

  const slug = c.req.param("slug");
  const link = await findQrLink(slug);
  if (!link) return c.json({ error: "NOT_FOUND" }, 404);

  const shortUrl = `${publicBaseUrl(c.req.url)}/${link.slug}`;
  const fallbackCaption = metadataCaption(link.metadata) || shortUrl;
  const caption = c.req.query("caption") ?? (
    Array.from(fallbackCaption).length <= QR_MAX_CAPTION_LENGTH ? fallbackCaption : `/${link.slug}`
  );
  if (Array.from(caption).length > QR_MAX_CAPTION_LENGTH) {
    return c.json({ error: "CAPTION_TOO_LONG" }, 400);
  }

  const png = renderQrPng(shortUrl, {
    caption,
    addLogo: c.req.query("logo") === undefined
      ? metadataAddLogo(link.metadata)
      : parseAddLogo(c.req.query("logo")),
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=300",
    },
  });
});
