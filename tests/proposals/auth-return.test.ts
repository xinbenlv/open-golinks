/** 登录曾固定回 Dashboard；安全 next 与跨 tab fallback 保留原链接并拒绝外站路径。 */
import { describe, expect, test } from "bun:test";
import { safeAuthReturn } from "../../src/web/lib/authReturn";
import { canClaimOwnership } from "../../src/lib/identity";
describe("claim identity and safe return", () => {
  test("only exact canonical zgzg.io email domain qualifies", () => {
    expect(canClaimOwnership("  Person@ZGZG.IO ")).toBe(true);
    for (const email of [null, "zgzg.io", "@zgzg.io", "a@zg.io", "a@sub.zgzg.io", "a@zgzg.io.evil.test", "a@evil.test"]) expect(canClaimOwnership(email)).toBe(false);
  });
  test("return target is a local link page", () => {
    expect(safeAuthReturn("/edit/unowned")).toBe("/edit/unowned");
    expect(safeAuthReturn("/claim/unowned")).toBe("/claim/unowned");
    for (const target of [undefined, "//evil.test", "/\\evil.test", "https://evil.test", "/edit/../evil", "/edit/%2f%2fevil", "/login", "/edit/slug?next=//evil.test"]) expect(safeAuthReturn(target)).toBe("/dashboard");
  });
});
