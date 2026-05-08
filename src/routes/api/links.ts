import { Hono } from "hono";
import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db, schema } from "../../db/db.ts";

export const linksRoute = new Hono();

const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/);

const createLinkSchema = z.object({
  slug: slugSchema,
  url: z.string().url(),
});

// GET /api/v1/links - 列出最近的公开链接 (stub, 实际应分页 + 鉴权)
linksRoute.get("/", async (c) => {
  const rows = await db
    .select({
      slug: schema.linksTable.slug,
      url: schema.linksTable.url,
      visits: schema.linksTable.visits,
      createdAt: schema.linksTable.createdAt,
    })
    .from(schema.linksTable)
    .where(
      and(
        eq(schema.linksTable.isPublic, true),
        isNull(schema.linksTable.deletedAt),
      ),
    )
    .orderBy(desc(schema.linksTable.createdAt))
    .limit(50);
  return c.json({ links: rows });
});

// POST /api/v1/links - 创建短链 (stub, 还未接 Turnstile + 指纹)
linksRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }
  try {
    const [row] = await db
      .insert(schema.linksTable)
      .values({
        slug: parsed.data.slug,
        url: parsed.data.url,
      })
      .returning();
    return c.json({ link: row }, 201);
  } catch (err: unknown) {
    // Drizzle 把底层 postgres 错误包成 DrizzleQueryError, 真正的 code 在 .cause 上.
    const e = err as { code?: string; cause?: { code?: string } };
    const code = e.code ?? e.cause?.code;
    if (code === "23505") {
      return c.json({ error: "SLUG_TAKEN" }, 409);
    }
    throw err;
  }
});

// GET /api/v1/links/:slug
linksRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const [row] = await db
    .select()
    .from(schema.linksTable)
    .where(
      and(
        eq(schema.linksTable.slug, slug),
        isNull(schema.linksTable.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ link: row });
});
