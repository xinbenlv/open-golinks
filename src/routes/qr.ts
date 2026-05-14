import { Hono } from "hono";
import type { Context } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db/db.ts";
import { QR_MAX_CAPTION_LENGTH, renderQrPng } from "../lib/qr.ts";

export const qrRoute = new Hono();

const SLUG_PNG_RE = /^([a-z0-9][a-z0-9-]{1,48}[a-z0-9]|[a-z0-9]{3})\.png$/;

function publicBaseUrl(requestUrl: string) {
  return (process.env.PUBLIC_BASE_URL || new URL(requestUrl).origin).replace(/\/$/, "");
}

function addLogo(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes";
}

async function renderCompatQr(c: Context, file: string, download: boolean) {
  const match = SLUG_PNG_RE.exec(file);
  if (!match) return null;
  const slug = match[1]!;
  const caption = c.req.query("caption") ?? "";
  if (Array.from(caption).length > QR_MAX_CAPTION_LENGTH) {
    return c.json({ error: "CAPTION_TOO_LONG" }, 400);
  }

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

  const png = renderQrPng(`${publicBaseUrl(c.req.url)}/${slug}`, {
    caption,
    addLogo: addLogo(c.req.query("addLogo")),
  });
  const headers = new Headers({
    "content-type": "image/png",
    "cache-control": "public, max-age=300",
  });
  if (download) {
    headers.set("content-disposition", `attachment; filename="${slug}.png"`);
  }
  return new Response(new Uint8Array(png), { headers });
}

qrRoute.get("/d/:file", async (c, next) => {
  const response = await renderCompatQr(c, c.req.param("file"), true);
  return response ?? next();
});

qrRoute.get("/:file", async (c, next) => {
  const response = await renderCompatQr(c, c.req.param("file"), false);
  return response ?? next();
});
