import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type postgres from "postgres";
import { normalizeEmail } from "../../src/lib/identity.ts";

export type SqlClient = postgres.Sql | postgres.TransactionSql;

export type PublicUserRow = {
  id: string;
  email: string;
  role: string;
  created_at: Date;
};

export type AuthIdentity = {
  id: string;
  email: string | null;
};

export type AuthIdentityMap = {
  ids: Set<string>;
  byId: Map<string, AuthIdentity>;
  byEmail: Map<string, AuthIdentity[]>;
  source: "supabase-admin-api";
  total: number;
};

export type ResolveOwnerResult =
  | {
      status: "mapped";
      email: string;
      ownerId: string;
      authUserExisted: boolean;
      createdAuthUser: boolean;
      mirrorAlreadyValid: boolean;
      syntheticPublicUserIds: string[];
    }
  | {
      status: "would_create";
      email: string;
      ownerId: null;
      authUserExisted: false;
      createdAuthUser: false;
      mirrorAlreadyValid: false;
      syntheticPublicUserIds: string[];
    }
  | {
      status: "invalid_email" | "public_email_conflict" | "auth_email_conflict" | "auth_id_email_conflict" | "create_failed";
      email: string | null;
      ownerId: null;
      authUserExisted: false;
      createdAuthUser: false;
      mirrorAlreadyValid: false;
      syntheticPublicUserIds: string[];
      reason: string;
    };

export type ResolveOwnerOptions = {
  apply: boolean;
};

export function createSupabaseAdminClientFromEnv(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secret) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL 和 SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY 必须设置");
  }
  return createClient(supabaseUrl, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function authIdentity(user: User): AuthIdentity {
  return {
    id: user.id,
    email: normalizeEmail(user.email) ?? null,
  };
}

export async function loadAuthIdentityMap(
  supabase: SupabaseClient,
): Promise<AuthIdentityMap> {
  const identities: AuthIdentity[] = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`Supabase Auth listUsers failed: ${error.message}`);
    const users = data.users.map(authIdentity);
    identities.push(...users);
    if (users.length < perPage) break;
  }
  return buildAuthIdentityMap(identities);
}

export function buildAuthIdentityMap(users: AuthIdentity[]): AuthIdentityMap {
  const ids = new Set<string>();
  const byId = new Map<string, AuthIdentity>();
  const byEmail = new Map<string, AuthIdentity[]>();
  for (const user of users) {
    ids.add(user.id);
    byId.set(user.id, user);
    if (!user.email) continue;
    const existing = byEmail.get(user.email) ?? [];
    existing.push(user);
    byEmail.set(user.email, existing);
  }
  return {
    ids,
    byId,
    byEmail,
    source: "supabase-admin-api",
    total: users.length,
  };
}

function addAuthIdentity(map: AuthIdentityMap, identity: AuthIdentity) {
  map.ids.add(identity.id);
  map.byId.set(identity.id, identity);
  if (!identity.email) return;
  const existing = map.byEmail.get(identity.email) ?? [];
  existing.push(identity);
  map.byEmail.set(identity.email, existing);
  map.total += 1;
}

export async function loadPublicUsers(sql: SqlClient): Promise<PublicUserRow[]> {
  return Array.from(await sql<PublicUserRow[]>`
    SELECT id::text, email, role, created_at
    FROM public.users
    ORDER BY lower(email), id
  `);
}

export function indexPublicUsersByEmail(
  rows: PublicUserRow[],
): Map<string, PublicUserRow[]> {
  const byEmail = new Map<string, PublicUserRow[]>();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    const existing = byEmail.get(email) ?? [];
    existing.push(row);
    byEmail.set(email, existing);
  }
  return byEmail;
}

export async function resolveOwnerByEmail(
  rawEmail: unknown,
  publicUsers: PublicUserRow[],
  authMap: AuthIdentityMap,
  supabase: SupabaseClient,
  options: ResolveOwnerOptions,
): Promise<ResolveOwnerResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) {
    return unresolved("invalid_email", null, [], "legacy author 不是有效 email");
  }

  const publicUsersByEmail = indexPublicUsersByEmail(publicUsers);
  const mirrorRows = publicUsersByEmail.get(email) ?? [];
  if (mirrorRows.length > 1) {
    return unresolved(
      "public_email_conflict",
      email,
      mirrorRows.map((row) => row.id),
      "public.users 中同一个 canonical email 有多行",
    );
  }

  const mirror = mirrorRows[0];
  if (mirror && authMap.ids.has(mirror.id)) {
    const authUser = authMap.byId.get(mirror.id);
    if (authUser?.email && authUser.email !== email) {
      return unresolved(
        "auth_id_email_conflict",
        email,
        [],
        `public.users.id 对应的 Auth user email 是 ${authUser.email}`,
      );
    }
    return {
      status: "mapped",
      email,
      ownerId: mirror.id,
      authUserExisted: true,
      createdAuthUser: false,
      mirrorAlreadyValid: true,
      syntheticPublicUserIds: [],
    };
  }

  const syntheticPublicUserIds = mirror ? [mirror.id] : [];
  const authMatches = authMap.byEmail.get(email) ?? [];
  if (authMatches.length > 1) {
    return unresolved(
      "auth_email_conflict",
      email,
      syntheticPublicUserIds,
      "Supabase Auth 中同一个 canonical email 有多个用户",
    );
  }
  if (authMatches.length === 1) {
    const authUser = authMatches[0]!;
    return {
      status: "mapped",
      email,
      ownerId: authUser.id,
      authUserExisted: true,
      createdAuthUser: false,
      mirrorAlreadyValid: false,
      syntheticPublicUserIds,
    };
  }

  if (!options.apply) {
    return {
      status: "would_create",
      email,
      ownerId: null,
      authUserExisted: false,
      createdAuthUser: false,
      mirrorAlreadyValid: false,
      syntheticPublicUserIds,
    };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    return unresolved(
      "create_failed",
      email,
      syntheticPublicUserIds,
      error?.message ?? "Supabase Auth createUser 未返回 user",
    );
  }
  const created = authIdentity(data.user);
  addAuthIdentity(authMap, created);
  return {
    status: "mapped",
    email,
    ownerId: created.id,
    authUserExisted: false,
    createdAuthUser: true,
    mirrorAlreadyValid: false,
    syntheticPublicUserIds,
  };
}

function unresolved(
  status: Exclude<ResolveOwnerResult["status"], "mapped" | "would_create">,
  email: string | null,
  syntheticPublicUserIds: string[],
  reason: string,
): ResolveOwnerResult {
  return {
    status,
    email,
    ownerId: null,
    authUserExisted: false,
    createdAuthUser: false,
    mirrorAlreadyValid: false,
    syntheticPublicUserIds,
    reason,
  };
}

export async function ensurePublicUserMirror(
  sql: SqlClient,
  ownerId: string,
  email: string,
  syntheticPublicUserIds: string[] = [],
): Promise<void> {
  const [existing] = await sql<{ id: string }[]>`
    SELECT id::text
    FROM public.users
    WHERE id = ${ownerId}
    LIMIT 1
  `;
  if (existing) {
    for (const syntheticId of syntheticPublicUserIds.filter((id) => id !== ownerId)) {
      await sql`
        UPDATE links
        SET owner_id = ${ownerId},
            updated_at = now()
        WHERE owner_id = ${syntheticId}
      `;
      await sql`
        UPDATE audit_logs
        SET actor_id = ${ownerId}
        WHERE actor_id = ${syntheticId}
      `;
      await sql`
        DELETE FROM public.users
        WHERE id = ${syntheticId}
          AND NOT EXISTS (SELECT 1 FROM links WHERE owner_id = ${syntheticId})
          AND NOT EXISTS (SELECT 1 FROM audit_logs WHERE actor_id = ${syntheticId})
      `;
    }
    await sql`
      UPDATE public.users
      SET email = ${email},
          role = COALESCE(role, 'user')
      WHERE id = ${ownerId}
    `;
    return;
  }

  const adoptId = syntheticPublicUserIds.length === 1 ? syntheticPublicUserIds[0] : null;
  if (adoptId) {
    await sql`
      WITH moved_user AS (
        UPDATE public.users
        SET id = ${ownerId},
            email = ${email},
            role = COALESCE(role, 'user')
        WHERE id = ${adoptId}
        RETURNING id
      ),
      moved_links AS (
        UPDATE links
        SET owner_id = ${ownerId},
            updated_at = now()
        WHERE owner_id = ${adoptId}
        RETURNING slug
      ),
      moved_audit AS (
        UPDATE audit_logs
        SET actor_id = ${ownerId}
        WHERE actor_id = ${adoptId}
        RETURNING id
      )
      SELECT
        (SELECT COUNT(*) FROM moved_user)::text AS moved_users,
        (SELECT COUNT(*) FROM moved_links)::text AS moved_links,
        (SELECT COUNT(*) FROM moved_audit)::text AS moved_audit
    `;
    return;
  }

  await sql`
    INSERT INTO public.users (id, email, role, created_at)
    VALUES (${ownerId}, ${email}, 'user', NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = COALESCE(public.users.role, 'user')
  `;
}

export type OwnershipSummary = {
  total: string;
  owned: string;
  unowned: string;
  unowned_with_legacy_email: string;
  unowned_with_fingerprint: string;
};

export async function loadOwnershipSummary(sql: SqlClient): Promise<OwnershipSummary> {
  const [summary] = await sql<OwnershipSummary[]>`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE owner_id IS NOT NULL)::text AS owned,
      COUNT(*) FILTER (WHERE owner_id IS NULL)::text AS unowned,
      COUNT(*) FILTER (
        WHERE owner_id IS NULL
          AND metadata->>'legacy_author_email' IS NOT NULL
      )::text AS unowned_with_legacy_email,
      COUNT(*) FILTER (
        WHERE owner_id IS NULL
          AND created_by_fingerprint IS NOT NULL
      )::text AS unowned_with_fingerprint
    FROM links
    WHERE deleted_at IS NULL
  `;
  return summary!;
}

export type PublicUserEmailSummary = {
  public_users_total: string;
  non_canonical_public_user_emails: string;
};

export async function loadPublicUserEmailSummary(
  sql: SqlClient,
): Promise<PublicUserEmailSummary> {
  const [summary] = await sql<PublicUserEmailSummary[]>`
    SELECT
      COUNT(*)::text AS public_users_total,
      COUNT(*) FILTER (WHERE lower(trim(email)) <> email)::text AS non_canonical_public_user_emails
    FROM public.users
  `;
  return summary!;
}

export async function backupIdentityAclRows(
  sql: SqlClient,
  ids: string[],
  label: string,
  backupDir = "var/identity-acl-backups",
): Promise<string | null> {
  if (!ids.length) return null;
  const dir = resolve(process.cwd(), backupDir);
  await mkdir(dir, { recursive: true });
  const safeLabel = label.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = resolve(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeLabel}.json`);
  const uuidIds = sql.array(ids, 2950);
  const [users, links, auditLogs] = await Promise.all([
    sql`SELECT * FROM public.users WHERE id = ANY(${uuidIds}) ORDER BY id`,
    sql`SELECT * FROM links WHERE owner_id = ANY(${uuidIds}) ORDER BY slug`,
    sql`SELECT * FROM audit_logs WHERE actor_id = ANY(${uuidIds}) ORDER BY timestamp, id`,
  ]);
  await writeFile(
    path,
    JSON.stringify(
      {
        created_at: new Date().toISOString(),
        ids,
        users: Array.from(users),
        links: Array.from(links),
        audit_logs: Array.from(auditLogs),
      },
      null,
      2,
    ),
  );
  return path;
}
