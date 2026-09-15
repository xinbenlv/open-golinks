/** 本地浏览器测试：真实 API/DB + 本地 JWT；测试登录入口只存在于此脚本。 */
import { Hono } from "hono";
import { staticCompression } from "../../src/middleware/static-compression";
import { setup } from "./harness";
const h = await setup();
const { auditRoute } = await import("../../src/routes/api/audit");
h.app.route("/api/v1/audit", auditRoute);
await h.sql`insert into links(slug,url,owner_id,metadata) values('handbook','https://example.test/handbook',${h.ids.owner},${h.sql.json({ description: "Team handbook", tags: ["team"], show_warning: true })})`;
await h.submit("handbook", {
  ip: "192.0.2.100",
  headers: {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15",
    "accept-language": "en-US",
  },
});
const port = 3197;
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${port}`;
async function handle(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  if (path.startsWith("/__test/login/")) {
    const role = path.split("/").at(-1)!;
    if (!(role in h.ids)) return new Response("Unknown role", { status: 404 });
    const session = {
      access_token: h.tokens[role],
      refresh_token: "local-test-only",
      expires_in: 7200,
      expires_at: Math.floor(Date.now() / 1000) + 7200,
      token_type: "bearer",
      user: {
        id: h.ids[role as keyof typeof h.ids],
        email: role + "@example.test",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    };
    return new Response(
      `<script>localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))}); location.replace('/edit/handbook');</script>`,
      { headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } },
    );
  }
  if (path === "/api/v1/stats/query")
    return Response.json({ rows: [], totalEvents: 0, source: "ga4" });
  if (path === "/robots.txt") return new Response("", { status: 404 });
  if (path.startsWith("/api/")) return h.app.fetch(req);
  const file = Bun.file(`dist/web${path}`);
  if (!path.includes("..") && (await file.exists()) && path !== "/")
    return new Response(file);
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
  fetch: (req) =>
    new URL(req.url).pathname.startsWith("/api/")
      ? handle(req)
      : web.fetch(req),
});
console.log(
  `Local proposal test app: http://127.0.0.1:${server.port}/edit/handbook`,
);
process.on("SIGINT", async () => {
  server.stop(true);
  await h.close();
  process.exit();
});
