// 版本信息. 来源:
// - 构建期: scripts/prerender.ts 在 import entry-ssr.tsx 之前向 globalThis 注入
// - 客户端: index.html 里一段 inline script 在 main.tsx 之前向 window 注入
// dev 模式 / 任何源头都没注入的兜底为 "dev".

export type Version = { sha: string; buildTime: string };

declare global {
  // eslint-disable-next-line no-var
  var __OGL_VERSION__: Version | undefined;
}

export function getVersion(): Version {
  const v =
    typeof globalThis !== "undefined" ? globalThis.__OGL_VERSION__ : undefined;
  return v ?? { sha: "dev", buildTime: "" };
}
