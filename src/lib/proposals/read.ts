/** 按归属分页列出提议，私有详情单独鉴权和过期处理。 */
import { z } from "zod";
import { getCookie } from "hono/cookie";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { privateHash } from "./metadata";
import { canReview, dto, fail, lockedLink, proposals } from "./store";
import { cookieName, cursorSchema } from "./validation";
import type { Context } from "hono";
import type { AuthEnv } from "../../middleware/auth";
import { db, schema } from "../../db/db";
export async function listProposals(c: Context<AuthEnv>) {
  let cursor: z.infer<typeof cursorSchema> | null = null;
  if (c.req.query("cursor")) {
    try {
      cursor = cursorSchema.parse(
        JSON.parse(Buffer.from(c.req.query("cursor")!, "base64url").toString()),
      );
    } catch {
      return c.json({ error: "INVALID_CURSOR" }, 400);
    }
  }
  const status = c.req.query("status") ?? "pending";
  if (!["pending", "history"].includes(status))
    return c.json({ error: "INVALID_STATUS" }, 400);
  return db.transaction(async (tx) => {
    const link = await lockedLink(tx, c.req.param("slug")!);
    const reviewer = await canReview(tx, link.ownerId, c.get("user")?.id);
    const token = getCookie(c, cookieName);
    const identity = c.get("user")?.id;
    if (!reviewer && !identity && !token)
      return c.json({ canReview: false, proposals: [], nextCursor: null });
    const rows = await tx
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.linkSlug, link.slug),
          status === "pending"
            ? eq(proposals.status, "pending")
            : sql`${proposals.status} <> 'pending'`,
          reviewer
            ? undefined
            : identity
              ? eq(proposals.proposerId, identity)
              : eq(proposals.anonymousHash, privateHash(token!)),
          cursor
            ? or(
                lt(proposals.submittedAt, new Date(cursor.time)),
                and(
                  eq(proposals.submittedAt, new Date(cursor.time)),
                  lt(proposals.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(proposals.submittedAt), desc(proposals.id))
      .limit(21);
    const page = rows.slice(0, 20);
    const last = page.at(-1);
    return c.json({
      canReview: reviewer,
      proposals: page.map((p) => dto(p, link.revision)),
      nextCursor:
        rows.length > 20 && last
          ? Buffer.from(
              JSON.stringify({
                time: last.submittedAt.toISOString(),
                id: last.id,
              }),
            ).toString("base64url")
          : null,
    });
  });
}

export async function inspectProposal(c: Context<AuthEnv>) {
  if (!z.string().uuid().safeParse(c.req.param("id")!).success)
    return c.json({ error: "INVALID_INPUT" }, 400);
  return db.transaction(async (tx) => {
    const link = await lockedLink(tx, c.req.param("slug")!);
    if (!(await canReview(tx, link.ownerId, c.get("user")!.id)))
      fail(403, "FORBIDDEN");
    const [row] = await tx
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.id, c.req.param("id")!),
          eq(proposals.linkSlug, link.slug),
        ),
      );
    if (!row) fail(404, "NOT_FOUND");
    return c.json({
      metadata:
        row.submittedAt.getTime() < Date.now() - 30 * 86400000
          ? null
          : row.requestMetadata,
    });
  });
}
