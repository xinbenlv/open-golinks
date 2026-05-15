import { describe, expect, it } from "bun:test";
import {
  buildAuthIdentityMap,
  resolveOwnerByEmail,
  type PublicUserRow,
} from "../../scripts/lib/identity-acl.ts";
import { normalizeEmail, sanitizeLinkRecord } from "../../src/lib/identity.ts";

const fakeSupabase = {} as Parameters<typeof resolveOwnerByEmail>[3];

function publicUser(id: string, email: string): PublicUserRow {
  return {
    id,
    email,
    role: "user",
    created_at: new Date("2026-05-14T00:00:00Z"),
  };
}

describe("identity ACL helpers", () => {
  it("normalizes canonical emails and strips internal legacy metadata", () => {
    expect(normalizeEmail("  Owner@Example.COM ")).toBe("owner@example.com");
    expect(normalizeEmail("anonymous")).toBeNull();

    const link = sanitizeLinkRecord({
      slug: "abc",
      metadata: {
        legacy_author_email: "owner@example.com",
        tags: ["work"],
      },
    });
    expect(link.metadata).toEqual({ tags: ["work"] });
  });

  it("resolves legacy email to existing Supabase Auth user without synthetic ids", async () => {
    const authMap = buildAuthIdentityMap([
      { id: "auth-owner", email: "owner@example.com" },
    ]);
    const resolved = await resolveOwnerByEmail(
      "OWNER@example.com",
      [publicUser("synthetic-owner", "owner@example.com")],
      authMap,
      fakeSupabase,
      { apply: false },
    );

    expect(resolved).toMatchObject({
      status: "mapped",
      email: "owner@example.com",
      ownerId: "auth-owner",
      authUserExisted: true,
      createdAuthUser: false,
      syntheticPublicUserIds: ["synthetic-owner"],
    });
  });

  it("reports dry-run creation without inventing an owner UUID", async () => {
    const resolved = await resolveOwnerByEmail(
      "new@example.com",
      [],
      buildAuthIdentityMap([]),
      fakeSupabase,
      { apply: false },
    );

    expect(resolved).toMatchObject({
      status: "would_create",
      email: "new@example.com",
      ownerId: null,
    });
  });

  it("does not auto-merge duplicate canonical public user emails", async () => {
    const resolved = await resolveOwnerByEmail(
      "owner@example.com",
      [
        publicUser("first", "owner@example.com"),
        publicUser("second", " OWNER@example.com "),
      ],
      buildAuthIdentityMap([]),
      fakeSupabase,
      { apply: false },
    );

    expect(resolved).toMatchObject({
      status: "public_email_conflict",
      ownerId: null,
    });
  });
});
