/** 可信身份的邮箱规范化、认领域判断与公开 DTO 脱敏。 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

export function canClaimOwnership(email: unknown): boolean {
  return normalizeEmail(email)?.split("@")[1] === "zgzg.io";
}

/** 公开邮箱提示只保留本地部分首尾字符，域名完整保留；固定星号不暴露长度。 */
export function maskEmail(value: unknown): string | null {
  const email = normalizeEmail(value);
  if (!email) return null;
  const [local, domain] = email.split("@");
  const characters = Array.from(local!);
  return `${characters[0]}**${characters.length > 1 ? characters.at(-1) : ""}@${domain}`;
}

export function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

export function sanitizeLinkMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = { ...(value as Record<string, unknown>) };
  delete metadata.legacy_author_email;
  return metadata;
}

export function sanitizeLinkRecord<T extends { metadata: unknown }>(row: T): T {
  return {
    ...row,
    metadata: sanitizeLinkMetadata(row.metadata),
  };
}
