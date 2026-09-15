/** 审核事务和公开 DTO；所有写入先锁链接，避免审核/删除/转移竞态。 */
import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "../../db/db";
import { normalizeMetadata } from "../identity";
import type { ProposalDTO, ProposalValues } from "./types";

export const proposals = schema.linkProposalsTable;
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type ProposalRow = typeof proposals.$inferSelect;
export function fail(
  status: 400 | 403 | 404 | 409 | 429,
  message: string,
): never {
  throw new HTTPException(status, {
    res: Response.json({ error: message }, { status }),
  });
}
export function values(
  link: typeof schema.linksTable.$inferSelect,
): ProposalValues {
  const metadata = normalizeMetadata(link.metadata);
  return {
    url: link.url,
    description:
      typeof metadata.description === "string" ? metadata.description : "",
  };
}
export function dto(row: ProposalRow, revision: number): ProposalDTO {
  return {
    id: row.id,
    before: row.before,
    after: row.after,
    note: row.note,
    proposer: row.proposer,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewer: row.reviewer,
    reason: row.reason,
    stale: row.status === "pending" && row.baseRevision !== revision,
  };
}
export async function lockedLink(tx: Transaction, slug: string) {
  const [link] = await tx
    .select()
    .from(schema.linksTable)
    .where(eq(schema.linksTable.slug, slug))
    .for("update");
  if (!link || link.deletedAt) fail(404, "NOT_FOUND");
  return link;
}
export async function canReview(
  tx: Transaction,
  ownerId: string | null,
  userId?: string,
) {
  if (!userId) return false;
  const [user] = await tx
    .select({ role: schema.usersTable.role })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.id, userId))
    .for("share");
  return Boolean(user && (ownerId === userId || user.role === "admin"));
}
export async function rateLimit(tx: Transaction, ipHash: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${ipHash}, 0))`,
  );
  const [counts] = await tx
    .select({
      minute: sql<number>`count(*) filter (where ${proposals.submittedAt} > now() - interval '1 minute')::int`,
      hour: sql<number>`count(*)::int`,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.ipHash, ipHash),
        sql`${proposals.submittedAt} > now() - interval '1 hour'`,
      ),
    );
  if (counts!.minute >= 5 || counts!.hour >= 30) fail(429, "RATE_LIMITED");
}
