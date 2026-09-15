/** 只使用部署显式信任的入口 IP；客户端 UA/语言属于自报信息。 */
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { Context } from "hono";
import type { SubmissionMetadata } from "./types";

export function privateHash(value: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("IP_HASH_SALT 未设置");
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function submissionMetadata(c: Context): SubmissionMetadata {
  // Railway 必须是唯一公网入口并覆盖 X-Real-IP；默认不信任任何代理头。
  const candidate =
    process.env.PROPOSAL_TRUST_PROXY === "railway"
      ? c.req.header("x-real-ip")
      : "";
  const ip = candidate && isIP(candidate) ? candidate : "Unknown";
  const ua = (c.req.header("user-agent") ?? "").slice(0, 1024);
  const locale = (
    c.req.header("accept-language")?.split(",")[0]?.split(";")[0] ?? "Unknown"
  ).slice(0, 80);
  // 保守分类；未匹配的 UA 保持 Unknown，原文仅在私有详情提供。
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Version\/.+Safari\//.test(ua)
          ? "Safari"
          : "Unknown";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows NT/.test(ua)
        ? "Windows"
        : /Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown";
  const device = /iPad|Tablet/.test(ua)
    ? "Tablet"
    : /Mobile|iPhone/.test(ua)
      ? "Mobile"
      : os !== "Unknown"
        ? "Desktop"
        : "Unknown";
  return { ip, ua, locale, browser, os, device, location: null };
}
