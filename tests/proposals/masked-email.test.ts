/** 主人提示缺少可识别身份；服务端脱敏邮箱，保护完整域名、短地址与无效资料边界。 */
import { expect, test } from "bun:test";
import { maskEmail } from "../../src/lib/identity";
test("masking keeps only local endpoints and the full canonical domain", () => {
  expect(maskEmail("  AbcdefZ@Sub.ZGZG.IO ")).toBe("a**z@sub.zgzg.io");
  expect(maskEmail("az@example.test")).toBe("a**z@example.test");
  expect(maskEmail("a@example.test")).toBe("a**@example.test");
  expect(maskEmail("姓名@example.test")).toBe("姓**名@example.test");
  expect(maskEmail("a+private-label-z@example.test")).toBe("a**z@example.test");
  for (const email of [undefined, null, "", "@example.test", "a@@example.test", "not-an-email"]) expect(maskEmail(email)).toBeNull();
});
