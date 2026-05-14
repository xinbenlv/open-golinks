// 版本信息. 来源:
// - 构建期: scripts/prerender.ts 在 import entry-ssr.tsx 之前向 globalThis 注入
// - 客户端: index.html 里一段 inline script 在 main.tsx 之前向 window 注入
// dev 模式 / 任何源头都没注入的兜底为 dev 占位.

export type Version = {
  version: string;
  sha: string;
  builtAt: string; // ISO-8601 带时区偏移; 显示时可降级到 YYYY-MM-DD HH:mm
  branch?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __OGL_VERSION__: Version | undefined;
}

const DEV_FALLBACK: Version = {
  version: "0.0.0-dev",
  sha: "dev",
  builtAt: "",
};

export function getVersion(): Version {
  const v =
    typeof globalThis !== "undefined" ? globalThis.__OGL_VERSION__ : undefined;
  if (!v) return DEV_FALLBACK;
  // 兼容旧字段 { sha, buildTime } (历史预渲染产物可能仍在 CDN 上)
  const legacy = v as unknown as { buildTime?: string };
  return {
    version: v.version ?? DEV_FALLBACK.version,
    sha: v.sha ?? DEV_FALLBACK.sha,
    builtAt: v.builtAt ?? legacy.buildTime ?? "",
    branch: v.branch,
  };
}

// 紧凑展示: 取 ISO 的日期+时分部分, 避免完整 ISO 在 footer 中过长.
export function formatBuiltAtShort(builtAt: string): string {
  if (!builtAt) return "";
  // 2026-05-13T08:30:42-07:00 -> 2026-05-13 08:30
  const m = builtAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;
  return builtAt;
}

export function formatVersionLine(v: Version = getVersion()): string {
  const time = formatBuiltAtShort(v.builtAt);
  const tail = [v.sha, time].filter(Boolean).join(" · ");
  return tail ? `v${v.version} · ${tail}` : `v${v.version}`;
}
