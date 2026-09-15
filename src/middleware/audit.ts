/** 写入操作审计；可沿用调用方事务，避免外键检查等待自己持有的锁。 */
import { createHash } from "node:crypto";
import type { Context } from "hono";
import { db, schema } from "../db/db.ts";
import type { AuthEnv } from "./auth.ts";

const IP_HASH_SALT = process.env.IP_HASH_SALT;
if (!IP_HASH_SALT) {
  throw new Error("IP_HASH_SALT 未设置");
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "CLAIM" | "TRANSFER";

type JsonObject = Record<string, unknown>;

function requestIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    c.req.header("cf-connecting-ip") ||
    forwarded ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}:${IP_HASH_SALT}`).digest("hex");
}

export async function writeAudit(
  c: Context<AuthEnv>,
  action: AuditAction,
  slug: string,
  diff?: JsonObject,
  metadata: JsonObject = {},
  actorFingerprint?: string | null,
  executor: Pick<typeof db, "insert"> = db,
) {
  const user = c.get("user");
  const userAgent = c.req.header("user-agent") ?? null;
  await executor.insert(schema.auditLogsTable).values({
    linkSlug: slug,
    actorId: user?.id ?? null,
    actorFingerprint: actorFingerprint ?? null,
    actorIpHash: hashIp(requestIp(c)),
    action,
    diff: diff ?? null,
    metadata: {
      ...metadata,
      ...(user ? {} : { user_agent: userAgent }),
    },
  });
}
