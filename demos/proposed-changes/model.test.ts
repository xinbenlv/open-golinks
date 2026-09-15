import { expect, test } from "bun:test";
import { decide, seed } from "./model";
test("either reviewer can apply while preserving proposer attribution", () => {
  for (const role of ["owner", "admin"] as const) {
    const initial = seed();
    const result = decide(
      initial,
      1,
      role,
      "approved",
      "2026-09-09T18:00:00Z",
      "",
    );
    expect(result.active.url).toBe("https://example.com/team/handbook-2026");
    expect(initial.active.url).toBe("https://example.com/team/handbook");
    expect(result.proposals[0]).toMatchObject({
      status: "approved",
      proposer: "Anonymous visitor",
      decided: "2026-09-09T18:00:00Z",
    });
    expect(result.proposals[0]?.actor).toContain(role);
  }
});
test("rejection does not apply changes and retains outcome", () => {
  const initial = seed();
  const result = decide(
    initial,
    1,
    "admin",
    "rejected",
    "2026-09-09T18:00:00Z",
    "Outdated",
  );
  expect(result.active).toEqual(initial.active);
  expect(result.proposals[0]).toMatchObject({
    status: "rejected",
    reason: "Outdated",
  });
});
test("stale, repeated and unauthorized approvals are blocked", () => {
  const initial = seed();
  expect(decide(initial, 2, "owner", "approved", "", "")).toBe(initial);
  expect(decide(initial, 1, "anonymous", "approved", "", "")).toBe(initial);
  expect(decide(initial, 1, "member", "approved", "", "")).toBe(initial);
  const approved = decide(initial, 1, "owner", "approved", "", "");
  expect(decide(approved, 1, "admin", "approved", "", "")).toBe(approved);
});
test("unrelated current fields survive approval", () => {
  const initial = seed();
  initial.active.tags = "updated, tags";
  expect(decide(initial, 1, "owner", "approved", "", "").active.tags).toBe(
    "updated, tags",
  );
});
