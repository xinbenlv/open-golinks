/** 无主链接缺少域账号认领入口；后端域授权 + CAS 修复，锁定拒绝抢占与事务原子性。 */
import { beforeAll, describe, expect, test } from "bun:test";
import type { setup } from "./harness";
export function registerClaimTests(getHarness: () => Awaited<ReturnType<typeof setup>>) {
let h: Awaited<ReturnType<typeof setup>>;
describe("unowned link claim", () => {
  beforeAll(() => { h = getHarness(); });
  async function unowned() {
    const slug = await h.seed();
    await h.sql`update links set owner_id=null where slug=${slug}`;
    return slug;
  }
  function claim(slug: string, role?: string, body?: unknown) {
    return h.request(slug + "/claim", { method: "POST", role, body });
  }
  test("signed @zgzg.io identity claims without fingerprint and can immediately save", async () => {
    const slug = await unowned();
    const result = await claim(slug, "claimant");
    expect(result.status).toBe(200);
    const { link } = await result.json();
    expect(link.ownerId).toBe(h.ids.claimant);
    const saved = await h.request(slug, { method: "PATCH", role: "claimant", body: { baseRevision: link.revision, url: "https://example.test/new" } });
    expect(saved.status).toBe(200);
    const audit = await h.sql`select actor_id,metadata from audit_logs where link_slug=${slug} and action='CLAIM'`;
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actor_id).toBe(h.ids.claimant);
    expect(audit[0]!.metadata.claim_method).toBe("domain");
  });
  test("anonymous, invalid token, non-domain, lookalike, DB admin and spoofed metadata cannot claim", async () => {
    const slug = await unowned();
    expect((await claim(slug)).status).toBe(401);
    expect((await claim(slug, "bad-token")).status).toBe(401);
    for (const role of ["member", "lookalike", "admin", "outsider", "anonymousAuth"]) {
      const res = await claim(slug, role, { email: "spoofed@zgzg.io", ownerId: h.ids.claimant });
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe("CLAIM_DOMAIN_REQUIRED");
    }
    expect((await h.request(slug).then(r => r.json())).link.ownerId).toBeNull();
  });
  test("fingerprint and legacy email discover links but never bypass the domain requirement", async () => {
    const slug = await unowned();
    const fingerprint = "a".repeat(64);
    await h.sql`update links set created_by_fingerprint=${fingerprint}, metadata=${h.sql.json({legacy_author_email:"member@example.test"})} where slug=${slug}`;
    expect((await claim(slug, "member", { fingerprint })).status).toBe(403);
    expect((await h.request("claimable?fingerprint=" + fingerprint, { role: "member" }).then(r => r.json())).links).toEqual([]);
    expect((await h.request("claimable?fingerprint=" + fingerprint, { role: "claimant" }).then(r => r.json())).links.some((l: {slug:string}) => l.slug === slug)).toBe(true);
    expect((await claim(slug, "claimant", { fingerprint })).status).toBe(200);
    expect((await h.request(slug).then(r => r.json())).link.metadata.legacy_author_email).toBeUndefined();
  });
  test("already-owned and deleted links stay protected", async () => {
    const owned = await h.seed();
    expect((await claim(owned, "claimant")).status).toBe(409);
    expect((await h.request(owned).then(r => r.json())).link.ownerId).toBe(h.ids.owner);
    const deleted = await unowned();
    await h.sql`update links set deleted_at=now() where slug=${deleted}`;
    expect((await claim(deleted, "claimant")).status).toBe(404);
    expect((await claim("missing-claim", "claimant")).status).toBe(404);
  });
  test("concurrent claimants produce one owner, one clear conflict and one audit", async () => {
    const slug = await unowned();
    const results = await Promise.all([claim(slug, "claimant"), claim(slug, "competitor")]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const loser = results.find(r => r.status === 409)!;
    expect((await loser.json()).error).toBe("ALREADY_OWNED");
    const winner = await results.find(r => r.status === 200)!.json();
    expect((await h.request(slug).then(r => r.json())).link.ownerId).toBe(winner.link.ownerId);
    expect(await h.sql`select * from audit_logs where link_slug=${slug} and action='CLAIM'`).toHaveLength(1);
  });
  test("failed audit rolls back ownership", async () => {
    const slug = await unowned();
    await h.sql`alter table audit_logs add constraint test_reject_claim check (action <> 'CLAIM') not valid`;
    try {
      expect((await claim(slug, "claimant")).status).toBe(500);
      expect((await h.request(slug).then(r => r.json())).link.ownerId).toBeNull();
    } finally { await h.sql`alter table audit_logs drop constraint test_reject_claim`; }
  });
});

}
