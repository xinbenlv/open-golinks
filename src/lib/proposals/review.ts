/** 审核只接受当前 owner/admin，链接、提议、历史与审计原子提交。 */
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { normalizeMetadata } from "../identity";
import { privateHash, submissionMetadata } from "./metadata";
import { canReview, dto, fail, lockedLink, proposals } from "./store";
import { reviewSchema } from "./validation";
import type { Context } from "hono";
import type { AuthEnv } from "../../middleware/auth";
import { db, schema } from "../../db/db";
export async function reviewProposal(c: Context<AuthEnv>) {
  const parsed = reviewSchema.safeParse(await c.req.json().catch(() => null));
  if (
    !parsed.success ||
    !z.string().uuid().safeParse(c.req.param("id")!).success
  )
    return c.json({ error: "INVALID_INPUT" }, 400);
  return db.transaction(async (tx) => {
    const link = await lockedLink(tx, c.req.param("slug")!);
    const user = c.get("user")!;
    if (!(await canReview(tx, link.ownerId, user.id))) fail(403, "FORBIDDEN");
    const [proposal] = await tx
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.id, c.req.param("id")!),
          eq(proposals.linkSlug, link.slug),
        ),
      )
      .for("update");
    if (!proposal) fail(404, "NOT_FOUND");
    if (proposal.status !== "pending") fail(409, "ALREADY_REVIEWED");
    const approved = parsed.data.decision === "approve";
    if (approved && link.revision !== proposal.baseRevision)
      fail(409, "STALE_PROPOSAL");
    const now = new Date();
    let revision = link.revision;
    if (approved) {
      const history = Array.isArray(link.urlHistory)
        ? [...link.urlHistory]
        : [];
      if (link.url !== proposal.after.url)
        history.push({
          url: link.url,
          changedAt: now.toISOString(),
          changedBy: user.id,
          changedByLabel: user.email ?? user.id,
          proposedByLabel: proposal.proposer,
          proposalId: proposal.id,
          proposedBy: proposal.proposerId,
        });
      const [updated] = await tx
        .update(schema.linksTable)
        .set({
          url: proposal.after.url,
          ...(proposal.after.isPublic !== undefined ? { isPublic: proposal.after.isPublic } : {}),
          metadata: {
            ...normalizeMetadata(link.metadata),
            description: proposal.after.description,
            ...(proposal.after.tags !== undefined ? { tags: proposal.after.tags } : {}),
          },
          urlHistory: history,
          updatedAt: now,
        })
        .where(eq(schema.linksTable.slug, link.slug))
        .returning();
      revision = updated!.revision;
    }
    const [reviewed] = await tx
      .update(proposals)
      .set({
        status: approved ? "approved" : "rejected",
        reviewedAt: now,
        reviewerId: user.id,
        reviewer: user.email ?? "Reviewer",
        reason: parsed.data.reason,
      })
      .where(eq(proposals.id, proposal.id))
      .returning();
    await tx
      .insert(schema.auditLogsTable)
      .values({
        linkSlug: link.slug,
        actorId: user.id,
        actorIpHash: privateHash(submissionMetadata(c).ip),
        action: approved ? "APPROVE_PROPOSAL" : "REJECT_PROPOSAL",
        diff: { before: proposal.before, after: proposal.after },
        metadata: {
          proposalId: proposal.id,
          proposerId: proposal.proposerId,
          reason: parsed.data.reason,
        },
      });
    return c.json({ proposal: dto(reviewed!, revision) });
  });
}
