import { sql } from "drizzle-orm";
import { db } from "../src/db/db.ts";

const apply = process.argv.includes("--apply");

async function main() {
  const [coverage] = await db.execute<{
    unowned: string;
    unowned_with_email: string;
    unowned_with_fingerprint: string;
    total: string;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE owner_id IS NULL)::text AS unowned,
      COUNT(*) FILTER (
        WHERE owner_id IS NULL
          AND metadata->>'legacy_author_email' IS NOT NULL
      )::text AS unowned_with_email,
      COUNT(*) FILTER (
        WHERE owner_id IS NULL
          AND created_by_fingerprint IS NOT NULL
      )::text AS unowned_with_fingerprint,
      COUNT(*)::text AS total
    FROM links
  `);

  console.log("[legacy-owner-reconcile] coverage", coverage);

  if (apply) {
    const result = await db.execute(sql`
      UPDATE links
      SET owner_id = users.id,
          updated_at = now()
      FROM users
      WHERE links.owner_id IS NULL
        AND links.metadata->>'legacy_author_email' IS NOT NULL
        AND lower(links.metadata->>'legacy_author_email') = lower(users.email)
    `);
    console.log("[legacy-owner-reconcile] backfill applied", result.count ?? 0);
  } else {
    const rows = await db.execute<{
      slug: string;
      url: string;
      legacy_author_email: string | null;
      created_by_fingerprint: string | null;
    }>(sql`
      SELECT
        slug,
        url,
        metadata->>'legacy_author_email' AS legacy_author_email,
        created_by_fingerprint
      FROM links
      WHERE owner_id IS NULL
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 100
    `);
    console.log("[legacy-owner-reconcile] dry-run review sample", Array.from(rows));
    console.log("[legacy-owner-reconcile] pass --apply to backfill matching emails");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[legacy-owner-reconcile] failed", err);
    process.exit(1);
  });
