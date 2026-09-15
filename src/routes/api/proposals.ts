/** 提议路由边界：限制 body、检查 Origin、校验 bearer，并隔离数据库错误详情。 */
import { Hono, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { requireAuth, type AuthEnv } from "../../middleware/auth";
import { listProposals, inspectProposal } from "../../lib/proposals/read";
import { submitProposal } from "../../lib/proposals/submit";
import { reviewProposal } from "../../lib/proposals/review";
export const proposalsRoute = new Hono<AuthEnv>();
const route = "/:slug/proposals";
const guard: MiddlewareHandler<AuthEnv> = async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  c.header("Vary", "Authorization, Cookie");
  if (c.req.method === "POST") {
    if (!c.req.header("content-type")?.startsWith("application/json"))
      return c.json({ error: "JSON_REQUIRED" }, 415);
    const origin = c.req.header("origin");
    const expected = process.env.PUBLIC_BASE_URL
      ? new URL(process.env.PUBLIC_BASE_URL).origin
      : new URL(c.req.url).origin;
    if (origin && origin !== expected)
      return c.json({ error: "ORIGIN_FORBIDDEN" }, 403);
  }
  if (c.req.header("authorization")) return requireAuth(c, next);
  await next();
};
for (const path of [route, `${route}/*`]) {
  proposalsRoute.use(path, bodyLimit({ maxSize: 16384 }), guard);
}
proposalsRoute.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.warn("[proposals] request failed");
  return c.json({ error: "INTERNAL_ERROR" }, 500);
});

proposalsRoute.get(route, listProposals);
proposalsRoute.post(route, submitProposal);
proposalsRoute.post(`${route}/:id/review`, requireAuth, reviewProposal);
proposalsRoute.get(`${route}/:id/metadata`, requireAuth, inspectProposal);
