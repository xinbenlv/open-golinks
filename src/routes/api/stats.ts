import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../db/db.ts";
import { requireAuth, type AuthEnv } from "../../middleware/auth.ts";
import { getStatsSummaryForSlugs, queryStatsForSlugs } from "../../lib/ga4.ts";

export const statsRoute = new Hono<AuthEnv>();

const summaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(370).default(30),
});

const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/);

const statsQuerySchema = z.object({
  range: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(180)]).default(7),
  groupBy: z.enum(["path", "date"]).default("path"),
  limit: z.number().int().min(1).max(180).default(10),
  pathRegex: z.string().trim().max(180).optional(),
  usePathPlusQueryString: z.boolean().default(false),
  slug: slugSchema.optional(),
});

statsRoute.get("/summary", requireAuth, async (c) => {
  const parsed = summaryQuerySchema.safeParse({
    days: c.req.query("days") ?? undefined,
  });
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }

  const user = c.get("user")!;
  const rows = await db
    .select({ slug: schema.linksTable.slug })
    .from(schema.linksTable)
    .where(
      and(
        eq(schema.linksTable.ownerId, user.id),
        isNull(schema.linksTable.deletedAt),
      ),
    );

  try {
    const summary = await getStatsSummaryForSlugs(
      rows.map((row) => row.slug),
      parsed.data.days,
    );
    return c.json(summary);
  } catch (err) {
    console.error("[stats] summary failed", err);
    return c.json({ error: "STATS_UNAVAILABLE" }, 500);
  }
});

statsRoute.post("/query", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = statsQuerySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }

  const conditions = [
    isNull(schema.linksTable.deletedAt),
  ];
  if (parsed.data.slug) {
    conditions.push(eq(schema.linksTable.slug, parsed.data.slug));
  }
  const rows = await db
    .select({ slug: schema.linksTable.slug })
    .from(schema.linksTable)
    .where(and(...conditions));

  if (parsed.data.slug && !rows.length) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  try {
    const result = await queryStatsForSlugs({
      slugs: rows.map((row) => row.slug),
      allLinks: !parsed.data.slug,
      range: parsed.data.range,
      groupBy: parsed.data.groupBy,
      limit: parsed.data.limit,
      pathRegex: parsed.data.pathRegex,
      usePathPlusQueryString: parsed.data.usePathPlusQueryString,
    });
    return c.json(result);
  } catch (err) {
    console.error("[stats] query failed", err);
    return c.json({ error: "STATS_UNAVAILABLE" }, 500);
  }
});
