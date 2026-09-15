/** 仅允许专用 loopback 数据库；签名密钥只驻留测试进程内存。 */
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
export async function setup() {
  const url = new URL(
    process.env.PROPOSAL_TEST_DATABASE_URL ?? "http://invalid",
  );
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/ogl_proposals_test"
  )
    throw new Error(
      "A dedicated local ogl_proposals_test database is required",
    );
  process.env.DATABASE_URL = url.href;
  process.env.IP_HASH_SALT = "isolated-test-salt";
  process.env.PROPOSAL_TRUST_PROXY = "railway";
  process.env.PUBLIC_BASE_URL = "http://localhost";
  const keys = await generateKeyPair("ES256");
  const jwk = await exportJWK(keys.publicKey);
  const jwks = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      Response.json({
        keys: [{ ...jwk, kid: "test", alg: "ES256", use: "sig" }],
      }),
  });
  const issuer = `http://127.0.0.1:${jwks.port}`;
  process.env.SUPABASE_JWKS_URL = issuer;
  process.env.SUPABASE_JWT_ISSUER = issuer;
  const migrationClient = postgres(url.href, { max: 1 });
  await migrate(drizzle(migrationClient), {
    migrationsFolder: "./src/db/migrations",
  });
  await migrationClient.end();
  const sql = postgres(url.href, { max: 5 });
  await sql`truncate link_proposals, audit_logs, daily_visits, links, users cascade`;
  const { proposalsRoute } = await import("../../src/routes/api/proposals");
  const { linksRoute } = await import("../../src/routes/api/links");
  const app = new Hono()
    .route("/api/v1/links", proposalsRoute)
    .route("/api/v1/links", linksRoute);
  const ids = {
    owner: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    member: crypto.randomUUID(),
    outsider: crypto.randomUUID(),
  };
  const tokens: Record<string, string> = {};
  for (const [name, id] of Object.entries(ids)) {
    await sql`insert into users(id,email,role) values(${id},${name + "@example.test"},${name === "admin" ? "admin" : "user"})`;
    tokens[name] = await new SignJWT({
      email: name + "@example.test",
      role: name === "outsider" ? "admin" : "authenticated",
    })
      .setProtectedHeader({ alg: "ES256", kid: "test" })
      .setSubject(id)
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(keys.privateKey);
  }
  let sequence = 0;
  async function seed() {
    const slug = `proposal-${++sequence}-${Date.now()}`;
    await sql`insert into links(slug,url,owner_id,metadata) values(${slug},'https://example.test/handbook',${ids.owner},${sql.json({ description: "Team handbook", tags: ["team"], show_warning: true })})`;
    return slug;
  }
  async function request(
    path: string,
    options: {
      role?: string;
      method?: string;
      body?: unknown;
      cookie?: string;
      ip?: string;
      headers?: Record<string, string>;
    } = {},
  ) {
    const headers = new Headers({
      "content-type": "application/json",
      "x-real-ip": options.ip ?? "192.0.2.1",
      ...options.headers,
    });
    if (options.role)
      headers.set(
        "authorization",
        `Bearer ${tokens[options.role] ?? options.role}`,
      );
    if (options.cookie) headers.set("cookie", options.cookie);
    return app.request(`http://localhost/api/v1/links/${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }
  async function submit(
    slug: string,
    options: Parameters<typeof request>[1] = {},
  ) {
    const [link] = await sql`select * from links where slug=${slug}`;
    return request(`${slug}/proposals`, {
      ...options,
      method: "POST",
      body: options.body ?? {
        baseRevision: link!.revision,
        before: { url: link!.url, description: link!.metadata.description },
        after: {
          url: "https://example.test/handbook-2026",
          description: "Team handbook, 2026 edition",
        },
        note: "Update the handbook",
      },
    });
  }
  return {
    app,
    sql,
    ids,
    tokens,
    seed,
    request,
    submit,
    close: async () => {
      jwks.stop(true);
      await sql.end();
    },
  };
}
