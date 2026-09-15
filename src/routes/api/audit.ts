/** owner/admin 历史包含修改者与提议者；匿名详情按原 30 天期限保留。 */
import { canReview } from "../../lib/proposals/store";
import { Hono } from "hono";
import {
  and,
  desc,
  eq,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../db/db.ts";
import { requireAuth, type AuthEnv } from "../../middleware/auth.ts";

export const auditRoute = new Hono<AuthEnv>();

const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/);

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

function encodeCursor(row: { timestamp: Date; id: string }) {
  return Buffer.from(
    JSON.stringify({ timestamp: row.timestamp.toISOString(), id: row.id }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { timestamp?: string; id?: string };
    if (!parsed.timestamp || !parsed.id) return null;
    const timestamp = new Date(parsed.timestamp);
    if (Number.isNaN(timestamp.getTime())) return null;
    return { timestamp, id: parsed.id };
  } catch {
    return null;
  }
}

auditRoute.get("/:slug", requireAuth, async (c) => {
  c.header("Cache-Control", "private, no-store");
  c.header("Vary", "Authorization");
  const slug = c.req.param("slug");
  const slugParsed = slugSchema.safeParse(slug);
  if (!slugParsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: slugParsed.error.issues }, 400);
  }

  const parsed = auditQuerySchema.safeParse({
    limit: c.req.query("limit") ?? undefined,
    cursor: c.req.query("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }

  return db.transaction(async (tx) => {
  const user = c.get("user")!;
  const [link] = await tx
    .select({
      slug: schema.linksTable.slug,
      ownerId: schema.linksTable.ownerId,
    })
    .from(schema.linksTable)
    .where(
      and(
        eq(schema.linksTable.slug, slugParsed.data),
        isNull(schema.linksTable.deletedAt),
      ),
    )
    .limit(1);

  if (!link) return c.json({ error: "NOT_FOUND" }, 404);
  if (!(await canReview(tx, link.ownerId, user.id))) return c.json({ error: "FORBIDDEN" }, 403);

  const conditions: SQL[] = [
    eq(schema.auditLogsTable.linkSlug, slugParsed.data),
    ne(schema.auditLogsTable.action, "VISIT"),
  ];
  if (parsed.data.cursor) {
    const cursor = decodeCursor(parsed.data.cursor);
    if (!cursor) return c.json({ error: "INVALID_CURSOR" }, 400);
    conditions.push(
      or(
        lt(schema.auditLogsTable.timestamp, cursor.timestamp),
        and(
          eq(schema.auditLogsTable.timestamp, cursor.timestamp),
          lt(schema.auditLogsTable.id, cursor.id),
        ),
      )!,
    );
  }

  const rows = await db
    .select({
      id: schema.auditLogsTable.id,
      action: schema.auditLogsTable.action,
      actorId: schema.auditLogsTable.actorId,
      actorEmail: schema.usersTable.email,
      actorFingerprint: schema.auditLogsTable.actorFingerprint,
      timestamp: schema.auditLogsTable.timestamp,
      diff: schema.auditLogsTable.diff,
      metadata: schema.auditLogsTable.metadata,
      proposer: schema.linkProposalsTable.proposer,
      proposerId: schema.linkProposalsTable.proposerId,
      submittedAt: schema.linkProposalsTable.submittedAt,
      requestMetadata: schema.linkProposalsTable.requestMetadata,
    })
    .from(schema.auditLogsTable)
    .leftJoin(schema.usersTable, eq(schema.auditLogsTable.actorId, schema.usersTable.id))
    .leftJoin(schema.linkProposalsTable, sql`${schema.linkProposalsTable.id}::text = ${schema.auditLogsTable.metadata}->>'proposalId'`)
    .where(and(...conditions))
    .orderBy(desc(schema.auditLogsTable.timestamp), desc(schema.auditLogsTable.id))
    .limit(parsed.data.limit + 1);

  const page = rows.slice(0, parsed.data.limit);
  const nextCursor = rows.length > parsed.data.limit
    ? encodeCursor(page[page.length - 1]!)
    : null;

  return c.json({
    logs: page.map((row) => ({
      ...row,
      timestamp: row.timestamp.toISOString(),
      requestMetadata: undefined,
      anonymousDetails: !row.proposerId && row.requestMetadata && "ip" in row.requestMetadata && row.submittedAt && row.submittedAt.getTime() >= Date.now() - 30 * 86400000 ? row.requestMetadata : undefined,
    })),
    nextCursor,
  });
  });
});
