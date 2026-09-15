/** 通过主人的规范化邮箱生成私密 seed；公开响应不携带邮箱。 */
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/db";
import { normalizeEmail, sanitizeLinkRecord } from "./identity";

export async function linkWithOwner<T extends { ownerId: string | null; metadata: unknown }>(row: T, connection: Pick<typeof db, "select"> = db) {
  if (!row.ownerId) return { ...sanitizeLinkRecord(row), owner: null };
  const [user] = await connection.select({ email: schema.usersTable.email })
    .from(schema.usersTable).where(eq(schema.usersTable.id, row.ownerId)).limit(1);
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("IP_HASH_SALT 未设置");
  // 域分隔避免与 IP 指纹混用；缺少用户时仍以 owner ID 提供稳定占位。
  const identity = normalizeEmail(user?.email) ?? row.ownerId;
  const avatarSeed = createHmac("sha256", salt).update(`owner-avatar:v1:${identity}`).digest("hex").slice(0, 16);
  return { ...sanitizeLinkRecord(row), owner: { avatarSeed } };
}
