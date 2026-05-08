/**
 * Supabase Auth JWT 验证 middleware (ES256 + JWKS).
 *
 * 设计：
 * - `requireAuth`: 缺失或无效 token → 401
 * - `optionalAuth`: 有 token 就验，没 token 也放行 (匿名创建场景)
 *
 * Supabase JWT 关键 claims:
 *   sub   = 用户 UUID (auth.users.id)
 *   email = 邮箱
 *   role  = 'authenticated' | 'service_role' | 'anon'
 *   iss   = https://<ref>.supabase.co/auth/v1
 *   aud   = 'authenticated'
 */
import type { Context, MiddlewareHandler } from "hono";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const JWKS_URL = process.env.SUPABASE_JWKS_URL;
const ISSUER = process.env.SUPABASE_JWT_ISSUER;
if (!JWKS_URL || !ISSUER) {
  throw new Error("SUPABASE_JWKS_URL / SUPABASE_JWT_ISSUER 未设置");
}

// jose 内部缓存 JWKS (默认 10 分钟)，无需我们再包一层
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export type AuthUser = {
  id: string;
  email: string | null;
  role: string;
  raw: JWTPayload;
};

export type AuthEnv = {
  Variables: {
    user?: AuthUser;
  };
};

function readBearer(c: Context): string | null {
  const h = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ? m[1].trim() : null;
}

async function verify(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience: "authenticated",
  });
  if (!payload.sub) throw new Error("JWT 缺少 sub");
  return {
    id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    role: typeof payload.role === "string" ? payload.role : "authenticated",
    raw: payload,
  };
}

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const token = readBearer(c);
  if (!token) return c.json({ error: "UNAUTHORIZED" }, 401);
  try {
    c.set("user", await verify(token));
  } catch {
    return c.json({ error: "INVALID_TOKEN" }, 401);
  }
  await next();
};

export const optionalAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const token = readBearer(c);
  if (token) {
    try {
      c.set("user", await verify(token));
    } catch {
      // 无效 token 在 optional 路径上视为未登录，不报错
    }
  }
  await next();
};
