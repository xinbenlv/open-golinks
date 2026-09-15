/** 提交提议与审计同事务写入，签发匿名归属 cookie。 */
import { randomBytes } from "node:crypto";
import { getCookie, setCookie } from "hono/cookie";
import { locate } from "./geoip";
import { privateHash, submissionMetadata } from "./metadata";
import { dto, fail, lockedLink, proposals, rateLimit, values } from "./store";
import { cookieName, inputSchema } from "./validation";
import type { Context } from "hono";
import type { AuthEnv } from "../../middleware/auth";
import { db, schema } from "../../db/db";
export async function submitProposal(c: Context<AuthEnv>) {
  const parsed = inputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "INVALID_INPUT" }, 400);
  const input = parsed.data;
  if (JSON.stringify(input.before) === JSON.stringify(input.after))
    return c.json({ error: "NO_CHANGES" }, 400);
  const metadata = submissionMetadata(c);
  const user = c.get("user");
  if (!user) metadata.location = await locate(metadata.ip);
  const ipHash = privateHash(metadata.ip);
  const existingToken = getCookie(c, cookieName);
  const token =
    existingToken && /^[a-f0-9]{64}$/.test(existingToken)
      ? existingToken
      : randomBytes(32).toString("hex");
  const result = await db.transaction(async (tx) => {
    await rateLimit(tx, ipHash);
    const link = await lockedLink(tx, c.req.param("slug")!);
    const before = values(link);
    if (
      link.revision !== input.baseRevision ||
      before.url !== input.before.url ||
      before.description !== input.before.description ||
      (input.before.isPublic !== undefined && before.isPublic !== input.before.isPublic) ||
      (input.before.tags !== undefined && JSON.stringify(before.tags) !== JSON.stringify(input.before.tags))
    )
      fail(409, "STALE_LINK");
    const [row] = await tx
      .insert(proposals)
      .values({
        linkSlug: link.slug,
        baseRevision: link.revision,
        proposerId: user?.id ?? null,
        anonymousHash: user ? null : privateHash(token),
        proposer:
          user?.email ?? (user ? "Signed-in member" : "Anonymous visitor"),
        before,
        after: { ...input.after, ...(input.after.tags !== undefined ? { tags: [...new Set(input.after.tags)] } : {}) },
        note: input.note,
        ipHash,
        requestMetadata: user ? { accountId: user.id, email: user.email ?? null } : metadata,
        submittedAt: new Date(),
      })
      .returning();
    await tx
      .insert(schema.auditLogsTable)
      .values({
        linkSlug: link.slug,
        actorId: user?.id ?? null,
        actorIpHash: ipHash,
        action: "PROPOSE",
        diff: { before, after: input.after },
        metadata: { proposalId: row!.id },
      });
    return dto(row!, link.revision);
  });
  if (!user)
    setCookie(c, cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/api/v1/links",
      maxAge: 60 * 60 * 24 * 365,
    });
  return c.json({ proposal: result }, 201);
}
