import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../db/db.ts";
import { requireAuth, type AuthEnv } from "../../middleware/auth.ts";
import { getStatsSummaryForSlugs } from "../../lib/ga4.ts";

export const statsRoute = new Hono<AuthEnv>();

const summaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
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
