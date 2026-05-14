import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_KEY_PATH = "/tmp/open-golinks-gcp-key.json";

function decodeCredentials(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  return Buffer.from(trimmed, "base64").toString("utf8");
}

export function loadGcpCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) return null;

  const decoded = decodeCredentials(raw);
  JSON.parse(decoded);
  mkdirSync(dirname(DEFAULT_KEY_PATH), { recursive: true });
  writeFileSync(DEFAULT_KEY_PATH, decoded, { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = DEFAULT_KEY_PATH;
  return DEFAULT_KEY_PATH;
}
