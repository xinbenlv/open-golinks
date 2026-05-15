const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
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
