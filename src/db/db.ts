import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

// Supabase Postgres 连接
// 使用 connection pooler (port 6543) 兼容 Drizzle + serverless/容器环境
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL 未设置");
}

// max=10: 单容器够用; prepare=false: Supabase pooler 不支持 prepared statements
const client = postgres(connectionString, { max: 10, prepare: false });

export const db = drizzle(client, { schema });
export { schema };
