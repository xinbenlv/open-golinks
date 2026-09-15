/** 已拥有链接缺少主人头像；邮箱 seed 修复；保护公开隐私与认领/保存/转移一致性。 */
import { beforeAll, describe, expect, test } from "bun:test";
import type { setup } from "./harness";
export function registerOwnerAvatarTests(getHarness: () => Awaited<ReturnType<typeof setup>>) {
  let h: Awaited<ReturnType<typeof setup>>;
  describe("email-derived owner avatar", () => {
    beforeAll(() => { h = getHarness(); });
    test("public owner is stable across links and viewers without exposing email", async () => {
      const slug = await h.seed();
      const other = await h.seed();
      const link = (await (await h.request(slug)).json()).link;
      expect(link.owner).toEqual({ avatarSeed: expect.stringMatching(/^[a-f0-9]{16}$/) });
      expect(JSON.stringify(link)).not.toContain(h.emails.owner);
      expect((await (await h.request(other, { role: "member" })).json()).link.owner).toEqual(link.owner);
      await h.sql`update users set email='OWNER@EXAMPLE.TEST' where id=${h.ids.owner}`;
      expect((await (await h.request(slug)).json()).link.owner).toEqual(link.owner);
      await h.sql`update users set email='owner@example.test' where id=${h.ids.owner}`;
      await h.sql`update links set owner_id=${h.ids.member} where slug=${other}`;
      expect((await (await h.request(other)).json()).link.owner).not.toEqual(link.owner);
    });
    test("claim, save and transfer return the current owner's avatar", async () => {
      const slug = await h.seed();
      await h.sql`update links set owner_id=null where slug=${slug}`;
      expect((await (await h.request(slug)).json()).link.owner).toBeNull();
      const claimed = await h.request(slug + "/claim", { role: "claimant", method: "POST" });
      expect(claimed.status).toBe(200);
      const link = (await claimed.json()).link;
      expect(link.owner.avatarSeed).toMatch(/^[a-f0-9]{16}$/);
      const saved = await h.request(slug, { role: "claimant", method: "PATCH", body: { baseRevision: link.revision, url: "https://example.test/avatar-save" } });
      expect(saved.status).toBe(200);
      expect((await saved.json()).link.owner).toEqual(link.owner);
      const transferred = await h.request(slug + "/transfer", { role: "claimant", method: "POST", body: { toEmail: h.emails.member } });
      expect(transferred.status).toBe(200);
      const next = (await transferred.json()).link;
      expect(next.ownerId).toBe(h.ids.member);
      expect(next.owner).not.toEqual(link.owner);
      expect((await (await h.request(slug)).json()).link.owner).toEqual(next.owner);
      await h.sql`update links set deleted_at=now() where slug=${slug}`;
      expect((await h.request(slug)).status).toBe(404);
    });
  });
}
