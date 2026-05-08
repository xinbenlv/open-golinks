/**
 * 应用 drizzle-kit 生成的 SQL 迁移到 DATABASE_URL 指向的库。
 * 使用 drizzle-orm 内置 migrator，自动维护 __drizzle_migrations 表。
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 未设置");
  process.exit(1);
}

// max=1 + prepare=false: 兼容 Supabase pooler，迁移期单连接即可
const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./src/db/migrations" });
await client.end();
console.log("[migrate] 完成");
