import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import {
  backupIdentityAclRows,
  createSupabaseAdminClientFromEnv,
  ensurePublicUserMirror,
  loadAuthIdentityMap,
  loadOwnershipSummary,
  loadPublicUserEmailSummary,
  loadPublicUsers,
  resolveOwnerByEmail,
  type PublicUserRow,
  type ResolveOwnerResult,
} from "./lib/identity-acl.ts";
import { normalizeEmail } from "../src/lib/identity.ts";

const envPath = resolve(process.cwd(), ".env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env 不存在时使用 shell 环境变量。
}

const apply = process.argv.includes("--apply");
const verbose = process.argv.includes("--verbose");
const backupDirArg = process.argv.find((arg) => arg.startsWith("--backup-dir="));
const backupDir = backupDirArg?.split("=", 2)[1] ?? "var/identity-acl-backups";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[identity-acl-repair] DATABASE_URL 未设置");
  process.exit(1);
}

type ReferenceCounts = {
  link_count: string;
  audit_count: string;
};

type RepairAction = {
  syntheticUser: PublicUserRow;
  email: string | null;
  resolution: ResolveOwnerResult;
  linkCount: number;
  auditCount: number;
};

function log(message: string, data?: unknown) {
  if (data === undefined) {
    console.log(message);
  } else {
    console.log(message, data);
  }
}

async function referenceCounts(
  sql: postgres.Sql | postgres.TransactionSql,
  userId: string,
): Promise<ReferenceCounts> {
  const [counts] = await sql<ReferenceCounts[]>`
    SELECT
      (SELECT COUNT(*) FROM links WHERE owner_id = ${userId})::text AS link_count,
      (SELECT COUNT(*) FROM audit_logs WHERE actor_id = ${userId})::text AS audit_count
  `;
  return counts!;
}

function isRemappable(action: RepairAction) {
  return action.resolution.status === "mapped";
}

function needsNullOwner(action: RepairAction) {
  return action.resolution.status !== "mapped" && action.resolution.status !== "would_create";
}

async function printCoverage(sql: postgres.Sql, label: string) {
  const ownership = await loadOwnershipSummary(sql);
  const publicUsers = await loadPublicUserEmailSummary(sql);
  log(`[identity-acl-repair] ${label} owner coverage`, ownership);
  log(`[identity-acl-repair] ${label} public.users email consistency`, publicUsers);
}

async function main() {
  const sql = postgres(dbUrl!, { max: 1, prepare: false });
  try {
    const supabase = createSupabaseAdminClientFromEnv();
    await printCoverage(sql, "before");

    const authMap = await loadAuthIdentityMap(supabase);
    const publicUsers = await loadPublicUsers(sql);
    const syntheticUsers = publicUsers.filter((user) => !authMap.ids.has(user.id));
    log("[identity-acl-repair] auth alignment", {
      auth_source: authMap.source,
      auth_users_total: authMap.total,
      public_users_total: publicUsers.length,
      synthetic_public_users: syntheticUsers.length,
    });

    const actions: RepairAction[] = [];
    for (const user of syntheticUsers) {
      const email = normalizeEmail(user.email);
      const resolution = await resolveOwnerByEmail(
        user.email,
        publicUsers,
        authMap,
        supabase,
        { apply },
      );
      const counts = await referenceCounts(sql, user.id);
      actions.push({
        syntheticUser: user,
        email,
        resolution,
        linkCount: Number(counts.link_count),
        auditCount: Number(counts.audit_count),
      });
    }

    const summary = {
      total_synthetic_users: actions.length,
      affected_links: actions.reduce((sum, action) => sum + action.linkCount, 0),
      affected_audit_logs: actions.reduce((sum, action) => sum + action.auditCount, 0),
      remap_to_auth_user: actions.filter(isRemappable).length,
      would_create_auth_user: actions.filter((action) => action.resolution.status === "would_create").length,
      null_owner_or_conflict: actions.filter(needsNullOwner).length,
    };
    log("[identity-acl-repair] repair summary", summary);

    const reviewRows = actions
      .filter((action) => action.linkCount > 0 || action.auditCount > 0 || action.resolution.status !== "mapped")
      .slice(0, 100)
      .map((action) => ({
        synthetic_id: action.syntheticUser.id,
        email: action.email,
        status: action.resolution.status,
        target_owner_id: action.resolution.status === "mapped" ? action.resolution.ownerId : null,
        link_count: action.linkCount,
        audit_count: action.auditCount,
        reason: "reason" in action.resolution ? action.resolution.reason : null,
      }));
    log("[identity-acl-repair] review sample", reviewRows);

    if (!apply) {
      log("[identity-acl-repair] dry-run only; pass --apply to write changes");
      return;
    }

    const backupIds = Array.from(new Set([
      ...actions.map((action) => action.syntheticUser.id),
      ...actions.flatMap((action) => (
        action.resolution.status === "mapped" ? [action.resolution.ownerId] : []
      )),
    ]));
    const backupPath = await backupIdentityAclRows(sql, backupIds, "synthetic-owner-repair", backupDir);
    log("[identity-acl-repair] backup written", backupPath);

    await sql.begin(async (tx) => {
      for (const action of actions) {
        const syntheticId = action.syntheticUser.id;
        if (action.resolution.status === "mapped") {
          await tx`
            UPDATE links
            SET metadata = COALESCE(metadata, '{}'::jsonb)
              || jsonb_build_object('legacy_author_email', ${action.resolution.email})
            WHERE owner_id = ${syntheticId}
          `;
          await ensurePublicUserMirror(
            tx,
            action.resolution.ownerId,
            action.resolution.email,
            [syntheticId],
          );
          continue;
        }

        if (action.email) {
          await tx`
            UPDATE links
            SET owner_id = NULL,
                updated_at = now(),
                metadata = COALESCE(metadata, '{}'::jsonb)
                  || jsonb_build_object('legacy_author_email', ${action.email})
            WHERE owner_id = ${syntheticId}
          `;
        } else {
          await tx`
            UPDATE links
            SET owner_id = NULL,
                updated_at = now()
            WHERE owner_id = ${syntheticId}
          `;
        }
        await tx`
          UPDATE audit_logs
          SET actor_id = NULL
          WHERE actor_id = ${syntheticId}
        `;
        await tx`
          DELETE FROM public.users
          WHERE id = ${syntheticId}
            AND NOT EXISTS (SELECT 1 FROM links WHERE owner_id = ${syntheticId})
            AND NOT EXISTS (SELECT 1 FROM audit_logs WHERE actor_id = ${syntheticId})
        `;
      }
    });

    await printCoverage(sql, "after");
    log("[identity-acl-repair] apply complete");
    if (verbose) {
      log("[identity-acl-repair] actions", actions);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error("[identity-acl-repair] failed", err);
  process.exit(1);
});
