/** 本地浏览器测试：真实 API/DB + 本地 JWT；测试登录入口只存在于此脚本。 */
import { Hono } from "hono";
import { staticCompression } from "../../src/middleware/static-compression";
import { setup } from "./harness";
import { safeAuthReturn } from "../../src/web/lib/authReturn";
const h = await setup();
const { qrRoute } = await import("../../src/routes/qr");
h.app.route("/qr", qrRoute);
await h.sql`insert into links(slug,url,owner_id,metadata) values('handbook','https://example.test/handbook',${h.ids.owner},${h.sql.json({ description: "Team handbook", tags: ["team"], show_warning: true })})`;
await h.sql`insert into links(slug,url,owner_id,metadata) values('unowned','https://example.test/handbook',null,${h.sql.json({ description: "Team handbook", tags: ["team"], show_warning: true })})`;
await h.submit("handbook", {
  ip: "192.0.2.100",
  headers: {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15",
    "accept-language": "en-US",
  },
});
for (const slug of ["avatar-empty", "avatar-unowned", "claim-race", "this-is-a-long-short-link-slug-for-mobile-layout"]) {
  await h.sql`insert into links(slug,url,owner_id) values(${slug},'https://example.test/handbook',null)`;
}
const port = Number(process.env.PROPOSAL_BROWSER_PORT ?? 3197);
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${port}`;
async function handle(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  if (path.startsWith("/__test/session/") || path.startsWith("/__test/login/")) {
    const role = path.split("/").at(-1)!;
    const returnTo = safeAuthReturn(new URL(req.url).searchParams.get("next") ?? "/edit/handbook");
    if (role === "anonymous") return new Response("<script>localStorage.removeItem('sb-127-auth-token'); location.replace('/edit/handbook');</script>", { headers: { "Content-Type": "text/html" } });
    if (!(role in h.ids)) return new Response("Unknown role", { status: 404 });
    const session = {
      access_token: h.tokens[role], refresh_token: "local-test-only",
      expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, token_type: "bearer",
      user: { id: h.ids[role as keyof typeof h.ids], email: h.emails[role], aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    };
    if (path.startsWith("/__test/session/")) return Response.json(session, { headers: { "Cache-Control": "no-store" } });
    return new Response(
      `<script>localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))}); location.replace(${JSON.stringify(returnTo)});</script>`,
      { headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } },
    );
  }
  if (path === "/api/v1/stats/query")
    return Response.json({ rows: [], totalEvents: 0, source: "ga4" });
  if (path === "/robots.txt") return new Response("", { status: 404 });
  if (path.startsWith("/api/") || path.startsWith("/qr/")) return h.app.fetch(req);
  const file = Bun.file(`dist/web${path}`);
  if (!path.includes("..") && (await file.exists()) && path !== "/")
    return new Response(file, { headers: { "Content-Type": file.type } });
  return new Response(Bun.file("dist/web/index.html"), {
    headers: { "Content-Type": "text/html" },
  });
}
const web = new Hono()
  .use("*", staticCompression)
  .all("*", (c) => handle(c.req.raw));
const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch: (req, server) => {
    // 模拟受信任反向代理，使用真实 loopback socket 地址而不是客户端自报头。
    const headers = new Headers(req.headers);
    headers.set("x-real-ip", server.requestIP(req)?.address ?? "Unknown");
    const forwarded = new Request(req, { headers });
    return new URL(req.url).pathname.startsWith("/api/") ? handle(forwarded) : web.fetch(forwarded);
  },
});
console.log(
  `Local proposal test app: http://127.0.0.1:${server.port}/edit/handbook`,
);
process.on("SIGINT", async () => {
  server.stop(true);
  await h.close();
  process.exit();
});
