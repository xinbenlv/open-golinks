/**
 * GET /api/v1/me — 返回当前 JWT 解出的用户信息。
 * 用途：客户端验证登录态、调试 auth middleware。
 */
import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../../middleware/auth.ts";

export const meRoute = new Hono<AuthEnv>();

meRoute.get("/", requireAuth, (c) => {
  const user = c.get("user")!;
  return c.json({ id: user.id, email: user.email, role: user.role });
});
