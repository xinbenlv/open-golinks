import { Hono } from "hono";
import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db, schema } from "../../db/db.ts";
import {
  optionalAuth,
  requireAuth,
  type AuthEnv,
  type AuthUser,
} from "../../middleware/auth.ts";
import { writeAudit } from "../../middleware/audit.ts";
import { anonymousWriteRateLimit } from "../../middleware/ratelimit.ts";

export const linksRoute = new Hono<AuthEnv>();

const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/);

const createLinkSchema = z.object({
  slug: slugSchema,
  url: z.string().url(),
});

const updateLinkSchema = z.object({
  url: z.string().url(),
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

function expectReturned<T>(row: T | undefined): T {
  if (!row) throw new Error("Database mutation returned no rows");
  return row;
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

// POST /api/v1/links - 创建短链. 登录用户写 owner_id; 匿名用户走 IP+UA 限流.
linksRoute.post("/", optionalAuth, anonymousWriteRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }
  const user = c.get("user");
  try {
    const [inserted] = await db
      .insert(schema.linksTable)
      .values({
        slug: parsed.data.slug,
        url: parsed.data.url,
        ownerId: user?.id ?? null,
      })
      .returning();
    const row = expectReturned(inserted);
    await writeAudit(c, "CREATE", row.slug, {
      after: { url: row.url, ownerId: row.ownerId },
    });
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

  const changedAt = new Date().toISOString();
  const urlHistory = [
    ...normalizeUrlHistory(existing.urlHistory),
    { url: existing.url, changedAt, changedBy: user.id },
  ];
  const [updated] = await db
    .update(schema.linksTable)
    .set({
      url: parsed.data.url,
      urlHistory,
      updatedAt: new Date(),
    })
    .where(eq(schema.linksTable.slug, slug))
    .returning();
  const row = expectReturned(updated);

  await writeAudit(c, "UPDATE", slug, {
    before: { url: existing.url },
    after: { url: row.url },
  });
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
