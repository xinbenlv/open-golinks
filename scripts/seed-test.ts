/**
 * 临时脚本：插入一条测试 link，用于本地验证 redirect。
 * 用完即删，不要纳入生产流程。
 */
import { db, schema } from "../src/db/db.ts";
import { sql } from "drizzle-orm";

await db
  .insert(schema.linksTable)
  .values({
    slug: "test",
    url: "https://example.com",
    isPublic: true,
    urlHistory: [],
  })
  .onConflictDoUpdate({
    target: schema.linksTable.slug,
    set: { url: "https://example.com", deletedAt: null, updatedAt: sql`now()` },
  });

console.log("[seed] inserted slug=test -> https://example.com");
process.exit(0);
