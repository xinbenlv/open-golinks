import { describe, expect, beforeAll, it } from "bun:test";
import type { Hono as HonoType } from "hono";

let app: HonoType;

const SPA_SENTINEL = "SPA_FALLBACK";

beforeAll(async () => {
  process.env.DATABASE_URL ??= "postgres://stub:stub@127.0.0.1:5432/stub";
  process.env.SUPABASE_JWKS_URL ??=
    "https://example.supabase.co/auth/v1/.well-known/jwks.json";
  process.env.SUPABASE_JWT_ISSUER ??=
    "https://example.supabase.co/auth/v1";

  const { Hono } = await import("hono");
  const { meRoute } = await import("../../src/routes/api/me.ts");
  const { authRoute } = await import("../../src/routes/auth.ts");
  const { redirectRoute } = await import("../../src/routes/redirect.ts");

  app = new Hono();
  app.route("/api/v1/me", meRoute);
  app.route("/auth", authRoute);
  app.route("/", redirectRoute);
  app.get("*", (c) => c.text(SPA_SENTINEL, 200));
});

describe("F1 auth + login routing", () => {
  it("GET /api/v1/me without bearer token returns 401", async () => {
    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("GET /api/v1/me with invalid bearer token returns 401", async () => {
    const res = await app.request("/api/v1/me", {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "INVALID_TOKEN" });
  });

  it("GET /login falls through to SPA fallback, not /edit/login", async () => {
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SPA_SENTINEL);
  });

  it("GET /auth/callback falls through to SPA fallback", async () => {
    const res = await app.request("/auth/callback?code=test");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SPA_SENTINEL);
  });

  it("GET /auth/confirm rejects invalid token-hash links", async () => {
    const res = await app.request("/auth/confirm");
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid auth confirmation link");
  });
});
