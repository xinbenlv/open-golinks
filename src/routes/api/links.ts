import { Hono } from "hono";
import { z } from "zod";
import {
  and,
  desc,
  eq,
  ilike,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db, schema } from "../../db/db.ts";
import {
  optionalAuth,
  requireAuth,
  type AuthEnv,
  type AuthUser,
} from "../../middleware/auth.ts";
import { writeAudit } from "../../middleware/audit.ts";
import { anonymousWriteRateLimit } from "../../middleware/ratelimit.ts";
import { isFingerprint } from "../../lib/fingerprint.ts";

export const linksRoute = new Hono<AuthEnv>();

const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/);

const createLinkSchema = z.object({
  slug: slugSchema,
  url: z.string().url(),
});

const metadataPatchSchema = z
  .object({
    show_warning: z.boolean(),
  })
  .strict();

const updateLinkSchema = z
  .object({
    url: z.string().url().optional(),
    metadata: metadataPatchSchema.optional(),
  })
  .strict()
  .refine((value) => value.url !== undefined || value.metadata !== undefined, {
    message: "url or metadata is required",
  });

const claimSchema = z.object({
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});

const transferSchema = z.object({
  toEmail: z.string().trim().email().max(255),
});

const listQuerySchema = z.object({
  owner: z.enum(["me", "public"]).default("public"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  q: z.string().trim().max(120).optional(),
});

type UrlHistoryEntry = {
  url: string;
  changedAt: string;
  changedBy: string;
};

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

function normalizeUrlHistory(value: unknown): UrlHistoryEntry[] {
  return Array.isArray(value) ? (value as UrlHistoryEntry[]) : [];
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function showWarning(metadata: unknown) {
  return normalizeMetadata(metadata).show_warning === true;
}

function legacyAuthorEmail(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { legacy_author_email?: unknown }).legacy_author_email;
  return typeof value === "string" ? value : null;
}

function expectReturned<T>(row: T | undefined): T {
  if (!row) throw new Error("Database mutation returned no rows");
  return row;
}

function encodeCursor(row: { createdAt: Date; slug: string }) {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), slug: row.slug }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { createdAt?: string; slug?: string };
    if (!parsed.createdAt || !parsed.slug) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, slug: parsed.slug };
  } catch {
    return null;
  }
}

async function findLink(slug: string) {
  const [row] = await db
    .select()
    .from(schema.linksTable)
    .where(eq(schema.linksTable.slug, slug))
    .limit(1);
  return row;
}

function ensureOwner(
  row: { ownerId: string | null; deletedAt: Date | null } | undefined,
  user: AuthUser,
) {
  if (!row || row.deletedAt) return "NOT_FOUND";
  if (row.ownerId !== user.id) return "FORBIDDEN";
  return null;
}

// GET /api/v1/links - public list or authenticated owner dashboard list.
linksRoute.get("/", optionalAuth, async (c) => {
  const parsed = listQuerySchema.safeParse({
    owner: c.req.query("owner") ?? undefined,
    limit: c.req.query("limit") ?? undefined,
    cursor: c.req.query("cursor") ?? undefined,
    q: c.req.query("q") ?? undefined,
  });
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }
  const { owner, limit, q } = parsed.data;
  const user = c.get("user");
  if (owner === "me" && !user) {
    return c.json({ error: "UNAUTHORIZED" }, 401);
  }

  const conditions: SQL[] = [isNull(schema.linksTable.deletedAt)];
  if (owner === "me" && user) {
    conditions.push(eq(schema.linksTable.ownerId, user.id));
  } else {
    conditions.push(eq(schema.linksTable.isPublic, true));
  }

  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(schema.linksTable.slug, pattern),
        ilike(schema.linksTable.url, pattern),
      )!,
    );
  }

  if (parsed.data.cursor) {
    const cursor = decodeCursor(parsed.data.cursor);
    if (!cursor) return c.json({ error: "INVALID_CURSOR" }, 400);
    conditions.push(
      or(
        lt(schema.linksTable.createdAt, cursor.createdAt),
        and(
          eq(schema.linksTable.createdAt, cursor.createdAt),
          lt(schema.linksTable.slug, cursor.slug),
        ),
      )!,
    );
  }

  const rows = await db
    .select({
      slug: schema.linksTable.slug,
      url: schema.linksTable.url,
      visits: schema.linksTable.visits,
      createdAt: schema.linksTable.createdAt,
      updatedAt: schema.linksTable.updatedAt,
      isPublic: schema.linksTable.isPublic,
    })
    .from(schema.linksTable)
    .where(and(...conditions))
    .orderBy(desc(schema.linksTable.createdAt), desc(schema.linksTable.slug))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeCursor(page[page.length - 1]!) : null;
  return c.json({ links: page, nextCursor });
});

// POST /api/v1/links - 创建短链. 登录用户写 owner_id; 匿名用户走 IP+UA 限流.
linksRoute.post("/", optionalAuth, anonymousWriteRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }
  const user = c.get("user");
  const fingerprint = c.req.header("x-fingerprint")?.toLowerCase();
  if (fingerprint && !isFingerprint(fingerprint)) {
    return c.json({ error: "INVALID_FINGERPRINT" }, 400);
  }
  try {
    const [inserted] = await db
      .insert(schema.linksTable)
      .values({
        slug: parsed.data.slug,
        url: parsed.data.url,
        ownerId: user?.id ?? null,
        createdByFingerprint: user ? null : fingerprint ?? null,
      })
      .returning();
    const row = expectReturned(inserted);
    await writeAudit(c, "CREATE", row.slug, {
      after: { url: row.url, ownerId: row.ownerId },
    }, {}, user ? null : fingerprint);
    return c.json({ link: row }, 201);
  } catch (err: unknown) {
    // Drizzle 把底层 postgres 错误包成 DrizzleQueryError, 真正的 code 在 .cause 上.
    if (pgCode(err) === "23505") {
      const existing = await findLink(parsed.data.slug);
      if (existing?.deletedAt && user && existing.ownerId === user.id) {
        const [updated] = await db
          .update(schema.linksTable)
          .set({
            url: parsed.data.url,
            deletedAt: null,
            urlHistory: [],
            visits: 0,
            updatedAt: new Date(),
          })
          .where(eq(schema.linksTable.slug, parsed.data.slug))
          .returning();
        const restored = expectReturned(updated);
        await writeAudit(c, "CREATE", restored.slug, {
          before: { deletedAt: existing.deletedAt, url: existing.url },
          after: { url: restored.url, ownerId: restored.ownerId },
        });
        return c.json({ link: restored }, 201);
      }
      return c.json({ error: "SLUG_TAKEN" }, 409);
    }
    throw err;
  }
});

// GET /api/v1/links/claimable - links current user can claim by fingerprint or legacy email.
linksRoute.get("/claimable", requireAuth, async (c) => {
  const fingerprint = c.req.query("fingerprint")?.toLowerCase();
  if (fingerprint && !isFingerprint(fingerprint)) {
    return c.json({ error: "INVALID_FINGERPRINT" }, 400);
  }

  const user = c.get("user")!;
  const matchers: SQL[] = [];
  if (fingerprint) {
    matchers.push(eq(schema.linksTable.createdByFingerprint, fingerprint));
  }
  if (user.email) {
    matchers.push(
      sql`lower(${schema.linksTable.metadata}->>'legacy_author_email') = ${user.email.toLowerCase()}`,
    );
  }
  if (!matchers.length) return c.json({ links: [] });

  const rows = await db
    .select({
      slug: schema.linksTable.slug,
      url: schema.linksTable.url,
      createdAt: schema.linksTable.createdAt,
    })
    .from(schema.linksTable)
    .where(
      and(
        isNull(schema.linksTable.ownerId),
        isNull(schema.linksTable.deletedAt),
        or(...matchers),
      ),
    )
    .orderBy(desc(schema.linksTable.createdAt))
    .limit(50);

  return c.json({ links: rows });
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

// POST /api/v1/links/:slug/claim - claim an anonymous link by fingerprint or legacy email.
linksRoute.post("/:slug/claim", requireAuth, async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json().catch(() => ({}));
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }

  const user = c.get("user")!;
  const existing = await findLink(slug);
  if (!existing || existing.deletedAt) return c.json({ error: "NOT_FOUND" }, 404);
  if (existing.ownerId) return c.json({ error: "ALREADY_OWNED" }, 409);

  const fingerprint = parsed.data.fingerprint?.toLowerCase();
  const fingerprintMatches =
    Boolean(fingerprint) && existing.createdByFingerprint === fingerprint;
  const legacyEmail = legacyAuthorEmail(existing.metadata);
  const legacyMatches =
    Boolean(user.email && legacyEmail) &&
    legacyEmail!.toLowerCase() === user.email!.toLowerCase();

  if (!fingerprintMatches && !legacyMatches) {
    return c.json({ error: "CLAIM_FORBIDDEN" }, 403);
  }

  const [updated] = await db
    .update(schema.linksTable)
    .set({ ownerId: user.id, updatedAt: new Date() })
    .where(eq(schema.linksTable.slug, slug))
    .returning();
  const row = expectReturned(updated);
  await writeAudit(
    c,
    "CLAIM",
    slug,
    { before: { ownerId: null }, after: { ownerId: user.id } },
    { claim_method: fingerprintMatches ? "fingerprint" : "legacy_email" },
    fingerprint,
  );
  return c.json({ link: row });
});

// POST /api/v1/links/:slug/transfer - owner-only ownership transfer by recipient email.
linksRoute.post("/:slug/transfer", requireAuth, async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json().catch(() => ({}));
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }

  const user = c.get("user")!;
  const toEmail = parsed.data.toEmail.toLowerCase();
  const [recipient] = await db
    .select({
      id: schema.usersTable.id,
      email: schema.usersTable.email,
    })
    .from(schema.usersTable)
    .where(sql`lower(${schema.usersTable.email}) = ${toEmail}`)
    .limit(1);

  if (!recipient) return c.json({ error: "USER_NOT_FOUND" }, 404);
  if (recipient.id === user.id) return c.json({ error: "SELF_TRANSFER" }, 400);

  const existing = await findLink(slug);
  const ownershipError = ensureOwner(existing, user);
  if (ownershipError === "NOT_FOUND") return c.json({ error: "NOT_FOUND" }, 404);
  if (ownershipError === "FORBIDDEN") return c.json({ error: "FORBIDDEN" }, 403);
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const [updated] = await db
    .update(schema.linksTable)
    .set({ ownerId: recipient.id, updatedAt: new Date() })
    .where(
      and(
        eq(schema.linksTable.slug, slug),
        eq(schema.linksTable.ownerId, user.id),
        isNull(schema.linksTable.deletedAt),
      ),
    )
    .returning();
  if (!updated) return c.json({ error: "FORBIDDEN" }, 403);
  const row = expectReturned(updated);

  await writeAudit(
    c,
    "TRANSFER",
    slug,
    { before: { ownerId: user.id }, after: { ownerId: recipient.id } },
    {
      from_owner_id: user.id,
      to_owner_id: recipient.id,
      to_email: recipient.email,
    },
  );
  return c.json({ link: row });
});

// PATCH /api/v1/links/:slug - owner-only URL update.
linksRoute.patch("/:slug", requireAuth, async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json().catch(() => null);
  const parsed = updateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }

  const user = c.get("user")!;
  const existing = await findLink(slug);
  const ownershipError = ensureOwner(existing, user);
  if (ownershipError === "NOT_FOUND") return c.json({ error: "NOT_FOUND" }, 404);
  if (ownershipError === "FORBIDDEN") return c.json({ error: "FORBIDDEN" }, 403);
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const nextUrl = parsed.data.url ?? existing.url;
  const urlHistory = parsed.data.url
    ? [
        ...normalizeUrlHistory(existing.urlHistory),
        { url: existing.url, changedAt: new Date().toISOString(), changedBy: user.id },
      ]
    : normalizeUrlHistory(existing.urlHistory);
  const metadata = parsed.data.metadata
    ? {
        ...normalizeMetadata(existing.metadata),
        show_warning: parsed.data.metadata.show_warning,
      }
    : existing.metadata;
  const diff: Record<string, unknown> = {};
  if (parsed.data.url) {
    diff.before = { ...(diff.before as object | undefined), url: existing.url };
    diff.after = { ...(diff.after as object | undefined), url: nextUrl };
  }
  if (parsed.data.metadata) {
    diff.before = {
      ...(diff.before as object | undefined),
      metadata: { show_warning: showWarning(existing.metadata) },
    };
    diff.after = {
      ...(diff.after as object | undefined),
      metadata: { show_warning: parsed.data.metadata.show_warning },
    };
  }

  const [updated] = await db
    .update(schema.linksTable)
    .set({
      url: nextUrl,
      urlHistory,
      metadata,
      updatedAt: new Date(),
    })
    .where(eq(schema.linksTable.slug, slug))
    .returning();
  const row = expectReturned(updated);

  await writeAudit(c, "UPDATE", slug, diff);
  return c.json({ link: row });
});

// DELETE /api/v1/links/:slug - owner-only soft delete.
linksRoute.delete("/:slug", requireAuth, async (c) => {
  const slug = c.req.param("slug");
  const user = c.get("user")!;
  const existing = await findLink(slug);
  const ownershipError = ensureOwner(existing, user);
  if (ownershipError === "NOT_FOUND") return c.json({ error: "NOT_FOUND" }, 404);
  if (ownershipError === "FORBIDDEN") return c.json({ error: "FORBIDDEN" }, 403);
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const deletedAt = new Date();
  await db
    .update(schema.linksTable)
    .set({ deletedAt, updatedAt: deletedAt })
    .where(eq(schema.linksTable.slug, slug));

  await writeAudit(c, "DELETE", slug, {
    before: { url: existing.url, deletedAt: existing.deletedAt },
    after: { deletedAt: deletedAt.toISOString() },
  });
  return c.body(null, 204);
});
