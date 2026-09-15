/** 真实 PostgreSQL + JWT 的权限、并发、原子性及提议生命周期回归。 */
import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { registerClaimTests } from "./claim-cases";
import { registerOwnerAvatarTests } from "./owner-avatar-cases";
import { setup } from "./harness";
let h: Awaited<ReturnType<typeof setup>>;
describe.skipIf(!process.env.PROPOSAL_TEST_DATABASE_URL)(
  "proposal integration",
  () => {
    beforeAll(async () => {
      h = await setup();
    }, 20000);
    afterAll(async () => {
      await h?.close();
    });
    registerClaimTests(() => h);
    registerOwnerAvatarTests(() => h);
    test("confirmation identity matches saved anonymous IP and browser", async () => {
      const slug = await h.seed();
      const options = { ip: "198.51.100.8", headers: { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140.0.0.0 Safari/537.36" } };
      const response = await h.request(slug + "/proposals/identity", options);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const { identity } = await response.json();
      expect(identity.ip).toBe(options.ip);
      expect(identity.browser).toBe("Chrome");
      expect(identity.os).toBe("macOS");
      const { proposal } = await (await h.submit(slug, options)).json();
      const details = await (await h.request(slug + "/proposals/" + proposal.id + "/metadata", { role: "owner" })).json();
      expect(details.metadata.ip).toBe(identity.ip);
      expect(details.metadata.ua).toBe(identity.ua);
      const signed = await (await h.request(slug + "/proposals/identity", { role: "member" })).json();
      expect(signed.identity).toEqual({ accountId: h.ids.member, email: "member@example.test" });
    });
    test("publish can be proposed on and off, only approval changes visibility", async () => {
      const slug = await h.seed();
      for (const isPublic of [true, false]) {
        const link = (await (await h.request(slug)).json()).link;
        const before = { url: link.url, description: link.metadata.description, tags: link.metadata.tags, isPublic: link.isPublic };
        const response = await h.submit(slug, { role: "member", body: { baseRevision: link.revision, before, after: { ...before, isPublic } } });
        expect(response.status).toBe(201);
        const { proposal } = await response.json();
        expect((await (await h.request(slug)).json()).link.isPublic).toBe(!isPublic);
        expect((await h.request(slug + "/proposals/" + proposal.id + "/review", { role: "owner", method: "POST", body: { decision: "approve" } })).status).toBe(200);
        const saved = (await (await h.request(slug)).json()).link;
        expect(saved.isPublic).toBe(isPublic);
        expect(saved.metadata.tags).toEqual(["team"]);
      }
    });
    test("tag-only proposals add and remove tags without altering other metadata", async () => {
      const slug = await h.seed();
      const res = await h.submit(slug, { body: { baseRevision: 0,
        before: { url: "https://example.test/handbook", description: "Team handbook", tags: ["team"] },
        after: { url: "https://example.test/handbook", description: "Team handbook", tags: ["docs", "new"] } } });
      expect(res.status).toBe(201);
      const { proposal } = await res.json();
      const review = await h.request(slug + "/proposals/" + proposal.id + "/review", { role: "admin", method: "POST", body: { decision: "approve" } });
      expect(review.status).toBe(200);
      const link = (await (await h.request(slug)).json()).link;
      expect(link.metadata.tags).toEqual(["docs", "new"]);
      expect(link.metadata.show_warning).toBe(true);
      expect(link.urlHistory).toEqual([]);
      const ownerList = await (await h.request(slug + "/proposals?status=history", { role: "owner" })).json();
      expect(ownerList.proposals[0].anonymousDetails.ip).toBe("192.0.2.1");
      const historyResponse = await h.app.request("http://localhost/api/v1/audit/" + slug, { headers: { authorization: "Bearer " + h.tokens.admin } });
      expect(historyResponse.status).toBe(200);
      const history = await historyResponse.json();
      const approval = history.logs.find((log: { action: string }) => log.action === "APPROVE_PROPOSAL");
      expect(approval.actorEmail).toBe("admin@example.test");
      expect(approval.proposer).toBe("Anonymous visitor");
      expect(approval.anonymousDetails.ip).toBe("192.0.2.1");
      expect((await h.app.request("http://localhost/api/v1/audit/" + slug, { headers: { authorization: "Bearer " + h.tokens.member } })).status).toBe(403);
      const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
      const anonList = await (await h.request(slug + "/proposals?status=history", { cookie })).json();
      expect(anonList.proposals[0].anonymousDetails).toBeUndefined();
    });
    test("signed-in proposal details use account identity instead of browser metadata", async () => {
      const slug = await h.seed();
      const res = await h.submit(slug, { role: "member" });
      expect(res.status).toBe(201);
      const { proposal } = await res.json();
      const details = await (await h.request(slug + "/proposals/" + proposal.id + "/metadata", { role: "owner" })).json();
      expect(details.metadata).toEqual({ accountId: h.ids.member, email: "member@example.test" });
      const [stored] = await h.sql`select request_metadata, ip_hash from link_proposals where id=${proposal.id}`;
      expect(stored!.request_metadata.ip).toBeUndefined();
      expect(stored!.request_metadata.ua).toBeUndefined();
      expect(stored!.ip_hash).toHaveLength(64);
    });
    test("direct save permits database admin and owner, rejects visitors and forged admin claims", async () => {
      const slug = await h.seed();
      for (const role of [undefined, "member", "outsider"]) {
        const res = await h.request(slug, { role, method: "PATCH", body: { url: "https://example.test/blocked" } });
        expect(res.status).toBe(role ? 403 : 401);
      }
      const initial = (await (await h.request(slug)).json()).link;
      const saved = await h.request(slug, { role: "admin", method: "PATCH", body: { url: "https://example.test/admin-save", baseRevision: initial.revision } });
      expect(saved.status).toBe(200);
      expect((await saved.json()).link.url).toBe("https://example.test/admin-save");
      expect((await h.request(slug, { role: "owner", method: "PATCH", body: { url: "https://example.test/stale", baseRevision: initial.revision } })).status).toBe(409);
      await h.sql`update users set role='user' where id=${h.ids.admin}`;
      expect((await h.request(slug, { role: "admin", method: "PATCH", body: { url: "https://example.test/revoked" } })).status).toBe(403);
      await h.sql`update users set role='admin' where id=${h.ids.admin}`;
    });
    test("anonymous submission stays pending; cookie owns status, metadata stays private; owner approves atomically", async () => {
      const slug = await h.seed();
      const res = await h.submit(slug);
      expect(res.status).toBe(201);
      const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
      expect(res.headers.get("set-cookie")).toContain("HttpOnly");
      const { proposal } = await res.json();
      expect(proposal.status).toBe("pending");
      expect(proposal.requestMetadata).toBeUndefined();
      const [initial] = await h.sql`select * from links where slug=${slug}`;
      expect(initial!.url).toBe("https://example.test/handbook");
      const mine = await (
        await h.request(`${slug}/proposals`, { cookie })
      ).json();
      expect(mine.proposals).toHaveLength(1);
      expect(
        (await (await h.request(`${slug}/proposals`)).json()).proposals,
      ).toHaveLength(0);
      expect(
        (
          await h.request(`${slug}/proposals/${proposal.id}/metadata`, {
            cookie,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await h.request(`${slug}/proposals/${proposal.id}/metadata`, {
            role: "member",
          })
        ).status,
      ).toBe(403);
      const details = await (
        await h.request(`${slug}/proposals/${proposal.id}/metadata`, {
          role: "owner",
        })
      ).json();
      expect(details.metadata.ip).toBe("192.0.2.1");
      expect(details.metadata.location).toBeNull();
      const approval = await h.request(
        `${slug}/proposals/${proposal.id}/review`,
        { role: "owner", method: "POST", body: { decision: "approve" } },
      );
      expect(approval.status).toBe(200);
      const [link] = await h.sql`select * from links where slug=${slug}`;
      expect(link!.url).toBe(proposal.after.url);
      expect(link!.metadata.tags).toEqual(["team"]);
      expect(link!.metadata.show_warning).toBe(true);
      expect(link!.url_history).toHaveLength(1);
      expect(link!.url_history[0].changedBy).toBe(h.ids.owner);
      const logs =
        await h.sql`select action, actor_id from audit_logs where link_slug=${slug} order by timestamp`;
      expect(logs.map((l) => l.action)).toEqual([
        "PROPOSE",
        "APPROVE_PROPOSAL",
      ]);
      expect(logs[1]!.actor_id).toBe(h.ids.owner);
      const history = await (
        await h.request(`${slug}/proposals?status=history`, { cookie })
      ).json();
      expect(history.proposals[0].status).toBe("approved");
    });
    test("database admin can review; JWT admin claim cannot; signed member sees only own", async () => {
      const slug = await h.seed();
      const p = (
        await (await h.submit(slug, { role: "member", ip: "192.0.2.2" })).json()
      ).proposal;
      expect(
        (
          await (
            await h.request(`${slug}/proposals`, { role: "member" })
          ).json()
        ).proposals,
      ).toHaveLength(1);
      expect(
        (
          await (
            await h.request(`${slug}/proposals`, { role: "outsider" })
          ).json()
        ).proposals,
      ).toHaveLength(0);
      expect(
        (
          await h.request(`${slug}/proposals/${p.id}/review`, {
            role: "outsider",
            method: "POST",
            body: { decision: "approve" },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await h.request(`${slug}/proposals/${p.id}/review`, {
            role: "admin",
            method: "POST",
            body: { decision: "approve" },
          })
        ).status,
      ).toBe(200);
      const [log] =
        await h.sql`select actor_id, metadata from audit_logs where link_slug=${slug} and action='APPROVE_PROPOSAL'`;
      expect(log!.actor_id).toBe(h.ids.admin);
      expect(log!.metadata.proposerId).toBe(h.ids.member);
    });
    test("concurrent approval yields one winner and one audit/history entry", async () => {
      const slug = await h.seed();
      const p = (await (await h.submit(slug, { ip: "192.0.2.3" })).json())
        .proposal;
      const results = await Promise.all(
        ["owner", "admin"].map((role) =>
          h.request(`${slug}/proposals/${p.id}/review`, {
            role,
            method: "POST",
            body: { decision: "approve" },
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const [link] =
        await h.sql`select url_history from links where slug=${slug}`;
      expect(link!.url_history).toHaveLength(1);
      const logs =
        await h.sql`select id from audit_logs where link_slug=${slug} and action='APPROVE_PROPOSAL'`;
      expect(logs).toHaveLength(1);
    });
    test("stale revision, including ABA edits, cannot approve; rejection leaves current link alone", async () => {
      const slug = await h.seed();
      const p = (await (await h.submit(slug, { ip: "192.0.2.4" })).json())
        .proposal;
      await h.sql`update links set url='https://example.test/temporary' where slug=${slug}`;
      await h.sql`update links set url='https://example.test/handbook' where slug=${slug}`;
      expect(
        (await (await h.request(`${slug}/proposals`, { role: "owner" })).json())
          .proposals[0].stale,
      ).toBe(true);
      expect(
        (
          await h.request(`${slug}/proposals/${p.id}/review`, {
            role: "owner",
            method: "POST",
            body: { decision: "approve" },
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await h.request(`${slug}/proposals/${p.id}/review`, {
            role: "owner",
            method: "POST",
            body: { decision: "reject", reason: "Outdated" },
          })
        ).status,
      ).toBe(200);
      const [link] =
        await h.sql`select url,url_history from links where slug=${slug}`;
      expect(link!.url).toBe("https://example.test/handbook");
      expect(link!.url_history).toEqual([]);
    });
    test("transfer and delete/recreate invalidate pending proposals and revoke old reviewer access", async () => {
      const slug = await h.seed();
      const p = (await (await h.submit(slug, { ip: "192.0.2.5" })).json())
        .proposal;
      await h.sql`update links set owner_id=${h.ids.member} where slug=${slug}`;
      expect(
        (
          await h.request(`${slug}/proposals/${p.id}/metadata`, {
            role: "owner",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await h.request(`${slug}/proposals/${p.id}/review`, {
            role: "member",
            method: "POST",
            body: { decision: "approve" },
          })
        ).status,
      ).toBe(409);
      await h.sql`update links set deleted_at=now() where slug=${slug}`;
      expect(
        (await h.request(`${slug}/proposals`, { role: "admin" })).status,
      ).toBe(404);
      await h.sql`update links set deleted_at=null where slug=${slug}`;
      expect(
        (
          await h.request(`${slug}/proposals/${p.id}/review`, {
            role: "admin",
            method: "POST",
            body: { decision: "approve" },
          })
        ).status,
      ).toBe(409);
    });
    test("visits do not cause conflicts; old owner form cannot overwrite approval", async () => {
      const slug = await h.seed();
      const p = (await (await h.submit(slug, { ip: "192.0.2.6" })).json())
        .proposal;
      await h.sql`update links set visits=visits+1 where slug=${slug}`;
      expect(
        (
          await h.request(`${slug}/proposals/${p.id}/review`, {
            role: "owner",
            method: "POST",
            body: { decision: "approve" },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await h.request(slug, {
            role: "owner",
            method: "PATCH",
            body: { url: "https://example.test/old-form", baseRevision: 0 },
          })
        ).status,
      ).toBe(409);
    });
    test("failed audit insert rolls back approval, URL and history", async () => {
      const slug = await h.seed();
      const p = (await (await h.submit(slug, { ip: "192.0.2.7" })).json())
        .proposal;
      await h.sql`alter table audit_logs add constraint test_reject_approval check (action <> 'APPROVE_PROPOSAL') not valid`;
      try {
        const res = await h.request(`${slug}/proposals/${p.id}/review`, {
          role: "owner",
          method: "POST",
          body: { decision: "approve" },
        });
        expect(res.status).toBe(500);
        const [link] =
          await h.sql`select url,url_history from links where slug=${slug}`;
        expect(link!.url).toBe(p.before.url);
        expect(link!.url_history).toEqual([]);
        const [stored] =
          await h.sql`select status from link_proposals where id=${p.id}`;
        expect(stored!.status).toBe("pending");
      } finally {
        await h.sql`alter table audit_logs drop constraint test_reject_approval`;
      }
    });
    test("rate limit survives rotating user agent and concurrent submission", async () => {
      const slug = await h.seed();
      const results = await Promise.all(
        Array.from({ length: 7 }, (_, n) =>
          h.submit(slug, {
            ip: "192.0.2.8",
            headers: { "user-agent": `agent-${n}` },
          }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(5);
      expect(results.filter((r) => r.status === 429)).toHaveLength(2);
    });
    test("invalid auth, origin, payload and URL are rejected", async () => {
      const slug = await h.seed();
      expect((await h.submit(slug, { role: "bad-token" })).status).toBe(401);
      expect(
        (
          await h.submit(slug, {
            headers: { origin: "https://untrusted.test" },
          })
        ).status,
      ).toBe(403);
      expect(
        (await h.submit(slug, { body: { padding: "x".repeat(20000) } })).status,
      ).toBe(413);
      expect(
        (
          await h.submit(slug, {
            body: {
              baseRevision: 0,
              before: {
                url: "https://example.test/handbook",
                description: "Team handbook",
              },
              after: { url: "javascript:alert(1)", description: "" },
            },
          })
        ).status,
      ).toBe(400);
    });
    test("metadata expires and cleanup preserves proposal history", async () => {
      const slug = await h.seed();
      const p = (await (await h.submit(slug, { ip: "192.0.2.9" })).json())
        .proposal;
      await h.sql`update link_proposals set submitted_at=now()-interval '31 days' where id=${p.id}`;
      expect(
        (
          await (
            await h.request(`${slug}/proposals/${p.id}/metadata`, {
              role: "owner",
            })
          ).json()
        ).metadata,
      ).toBeNull();
      const { purgeProposalMetadata } =
        await import("../../src/lib/proposals/retention");
      await purgeProposalMetadata();
      const [row] =
        await h.sql`select status, request_metadata from link_proposals where id=${p.id}`;
      expect(row!.request_metadata).toBeNull();
      expect(row!.status).toBe("pending");
    });
    test("pagination does not lose proposals with the same timestamp", async () => {
      const slug = await h.seed();
      const time = new Date("2026-09-01T12:00:00.123Z");
      for (let n = 0; n < 45; n++)
        await h.sql`insert into link_proposals(link_slug,base_revision,proposer,before,after,ip_hash,submitted_at) values(${slug},0,'Anonymous visitor','{"url":"https://example.test/old","description":""}','{"url":"https://example.test/new","description":""}','test',${time})`;
      let cursor: string | null = null;
      const ids: string[] = [];
      do {
        const response = await h.request(
          `${slug}/proposals${cursor ? "?cursor=" + cursor : ""}`,
          { role: "owner" },
        );
        expect(response.headers.get("cache-control")).toContain("no-store");
        const page = await response.json();
        ids.push(...page.proposals.map((p: { id: string }) => p.id));
        cursor = page.nextCursor;
      } while (cursor);
      expect(ids).toHaveLength(45);
      expect(new Set(ids).size).toBe(45);
    });
    test("untrusted forwarded IP and browser role bypass are rejected", async () => {
      const slug = await h.seed();
      process.env.PROPOSAL_TRUST_PROXY = "";
      try {
        const res = await h.submit(slug, {
          headers: {
            "x-forwarded-for": "8.8.8.8",
            "cf-connecting-ip": "8.8.8.8",
          },
        });
        const p = (await res.json()).proposal;
        const details = await (
          await h.request(`${slug}/proposals/${p.id}/metadata`, {
            role: "owner",
          })
        ).json();
        expect(details.metadata.ip).toBe("Unknown");
      } finally {
        process.env.PROPOSAL_TRUST_PROXY = "railway";
      }
      const [table] =
        await h.sql`select relrowsecurity from pg_class where relname='link_proposals'`;
      expect(table!.relrowsecurity).toBe(true);
    });
  test('owner save racing approval has one winner; unchanged URL is not added to history', async () => {
    const slug = await h.seed();
    const p=(await (await h.submit(slug,{ip:'192.0.2.44'})).json()).proposal;
    const responses=await Promise.all([
      h.request(slug,{role:'owner',method:'PATCH',body:{baseRevision:0,url:'https://example.test/handbook',metadata:{description:'Owner draft'}}}),
      h.request(slug+'/proposals/'+p.id+'/review',{role:'admin',method:'POST',body:{decision:'approve'}}),
    ]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
    const [link]=await h.sql`select url,url_history from links where slug=${slug}`;
    expect(link!.url_history.length).toBe(link!.url===p.before.url?0:1);
  });
  test('description-only approval preserves URL history', async () => {
    const slug=await h.seed();
    const p=(await (await h.submit(slug,{ip:'192.0.2.45',body:{baseRevision:0,before:{url:'https://example.test/handbook',description:'Team handbook'},after:{url:'https://example.test/handbook',description:'Updated description'}}})).json()).proposal;
    expect((await h.request(slug+'/proposals/'+p.id+'/review',{role:'owner',method:'POST',body:{decision:'approve'}})).status).toBe(200);
    const [link]=await h.sql`select url_history,metadata from links where slug=${slug}`;
    expect(link!.url_history).toEqual([]);expect(link!.metadata.description).toBe('Updated description');
  });

  },
);
