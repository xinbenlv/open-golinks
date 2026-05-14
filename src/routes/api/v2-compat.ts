import { Hono } from "hono";
import { z } from "zod";
import {
  and,
  desc,
  eq,
  isNull,
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

export const v2CompatRoute = new Hono<AuthEnv>();

const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/);

const editSchema = z.object({
  golink: slugSchema,
  dest: z.string().url(),
  addLogo: z.boolean().optional(),
  caption: z.string().max(100).optional(),
});

type LinkRow = typeof schema.linksTable.$inferSelect;

type UrlHistoryEntry = {
  url?: unknown;
  changedAt?: unknown;
  changed_at?: unknown;
  timestamp?: unknown;
};

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function normalizeHistory(value: unknown): Array<{ dest: string; timestamp: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: UrlHistoryEntry) => {
    const url = entry.url;
    const timestamp = entry.changedAt ?? entry.changed_at ?? entry.timestamp;
    if (typeof url !== "string") return [];
    return [
      {
        dest: url,
        timestamp: typeof timestamp === "string" ? timestamp : "",
      },
    ];
  });
}

function isOwner(row: Pick<LinkRow, "ownerId">, user: AuthUser | undefined) {
  return Boolean(user && row.ownerId === user.id);
}

function legacyAuthor(row: Pick<LinkRow, "ownerId">, user: AuthUser | undefined) {
  if (!row.ownerId) return "anonymous";
  return isOwner(row, user) && user?.email ? user.email : "registered";
}

function legacyLink(row: LinkRow, user: AuthUser | undefined) {
  const metadata = normalizeMetadata(row.metadata);
  return {
    goLink: row.slug,
    createdTime: row.createdAt,
    updatedTimed: row.updatedAt,
    destHistory: normalizeHistory(row.urlHistory),
    goDest: row.url,
    author: legacyAuthor(row, user),
    addLogo: metadata.addLogo === true,
    caption: typeof metadata.caption === "string" ? metadata.caption : "",
    user: user
      ? { emails: user.email ? [{ value: user.email }] : [] }
      : null,
    editable: isOwner(row, user),
  };
}

async function findLink(slug: string) {
  const [row] = await db
    .select()
    .from(schema.linksTable)
    .where(eq(schema.linksTable.slug, slug))
    .limit(1);
  return row;
}

function nextCompatMetadata(
  existing: unknown,
  input: z.infer<typeof editSchema>,
) {
  const metadata = normalizeMetadata(existing);
  if (input.addLogo !== undefined) metadata.addLogo = input.addLogo;
  if (input.caption !== undefined) metadata.caption = input.caption;
  return metadata;
}

function editSuccess(row: LinkRow, user: AuthUser | undefined) {
  const metadata = normalizeMetadata(row.metadata);
  return {
    title: "Edit",
    msg: "Your link is created/updated successsfully!",
    msgType: "success",
    golink: row.slug,
    oldDest: row.url,
    author: legacyAuthor(row, user),
    addLogo: metadata.addLogo === true,
    caption: typeof metadata.caption === "string" ? metadata.caption : "",
    user: user
      ? { emails: user.email ? [{ value: user.email }] : [] }
      : null,
    editable: isOwner(row, user),
  };
}

// GET /api/v2/link/:slug - master-compatible link lookup.
v2CompatRoute.get("/link/:slug", optionalAuth, async (c) => {
  const parsed = slugSchema.safeParse(c.req.param("slug"));
  if (!parsed.success) return c.json([]);

  const row = await findLink(parsed.data);
  if (!row || row.deletedAt) return c.json([]);
  return c.json([legacyLink(row, c.get("user"))]);
});

// GET /api/v2/available/:slug - master-compatible availability boolean.
v2CompatRoute.get("/available/:slug", async (c) => {
  const parsed = slugSchema.safeParse(c.req.param("slug"));
  if (!parsed.success) return c.json(false);

  const row = await findLink(parsed.data);
  return c.json(!row || Boolean(row.deletedAt));
});

// POST /api/v2/edit - create links anonymously; update only by current owner.
v2CompatRoute.post("/edit", optionalAuth, anonymousWriteRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, 400);
  }

  const user = c.get("user");
  const existing = await findLink(parsed.data.golink);
  if (existing && !existing.deletedAt) {
    if (!isOwner(existing, user)) {
      return c.json({ error: "FORBIDDEN" }, 403);
    }

    const urlHistory = existing.url === parsed.data.dest
      ? Array.isArray(existing.urlHistory) ? existing.urlHistory : []
      : [
          ...(Array.isArray(existing.urlHistory) ? existing.urlHistory : []),
          {
            url: existing.url,
            changedAt: new Date().toISOString(),
            changedBy: user!.id,
          },
        ];
    const metadata = nextCompatMetadata(existing.metadata, parsed.data);
    const [updated] = await db
      .update(schema.linksTable)
      .set({
        url: parsed.data.dest,
        urlHistory,
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(schema.linksTable.slug, parsed.data.golink))
      .returning();
    if (!updated) return c.json({ error: "NOT_FOUND" }, 404);

    await writeAudit(c, "UPDATE", updated.slug, {
      before: { url: existing.url },
      after: { url: updated.url },
    });
    return c.json(editSuccess(updated, user));
  }

  if (existing?.deletedAt) {
    if (!isOwner(existing, user)) return c.json({ error: "SLUG_TAKEN" }, 409);

    const [restored] = await db
      .update(schema.linksTable)
      .set({
        url: parsed.data.dest,
        deletedAt: null,
        urlHistory: [],
        visits: 0,
        isPublic: false,
        metadata: nextCompatMetadata(existing.metadata, parsed.data),
        updatedAt: new Date(),
      })
      .where(eq(schema.linksTable.slug, parsed.data.golink))
      .returning();
    if (!restored) return c.json({ error: "NOT_FOUND" }, 404);

    await writeAudit(c, "CREATE", restored.slug, {
      before: { deletedAt: existing.deletedAt, url: existing.url },
      after: { url: restored.url, ownerId: restored.ownerId },
    });
    return c.json(editSuccess(restored, user));
  }

  const [inserted] = await db
    .insert(schema.linksTable)
    .values({
      slug: parsed.data.golink,
      url: parsed.data.dest,
      ownerId: user?.id ?? null,
      isPublic: false,
      metadata: nextCompatMetadata(null, parsed.data),
    })
    .returning();
  if (!inserted) throw new Error("Database mutation returned no rows");

  await writeAudit(c, "CREATE", inserted.slug, {
    after: { url: inserted.url, ownerId: inserted.ownerId },
  });
  return c.json(editSuccess(inserted, user));
});

// GET /api/v2/my-links - legacy path, Supabase Bearer auth only.
v2CompatRoute.get("/my-links", requireAuth, async (c) => {
  const user = c.get("user")!;
  const rows = await db
    .select()
    .from(schema.linksTable)
    .where(
      and(
        eq(schema.linksTable.ownerId, user.id),
        isNull(schema.linksTable.deletedAt),
      ),
    )
    .orderBy(desc(schema.linksTable.createdAt))
    .limit(50);

  return c.json(rows.map((row) => legacyLink(row, user)));
});
