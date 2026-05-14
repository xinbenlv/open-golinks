// 构建信息四元组: version / sha / builtAt / branch.
// 优先级:
//   1. 环境变量 (CI/部署期注入: OGL_BUILD_VERSION / OGL_BUILD_SHA / OGL_BUILD_TIME / OGL_BUILD_BRANCH)
//   2. Vercel 自动注入 (VERCEL_GIT_COMMIT_SHA / VERCEL_GIT_COMMIT_REF)
//   3. 运行期回退: 读 package.json + git rev-parse + new Date() (仅 dev 模式可靠)
//
// 设计: 模块加载即求值一次, 缓存在 BUILD_INFO. 服务端各处直接 import 使用.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type BuildInfo = {
  version: string;
  sha: string; // git short SHA (6 字符)
  builtAt: string; // ISO-8601 带时区偏移, e.g. 2026-05-13T08:30:42-07:00
  branch?: string;
};

function readPkgVersion(): string {
  try {
    const pkgPath = resolve(import.meta.dir, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function readGitSha(): string {
  try {
    return execSync("git rev-parse --short=6 HEAD", { cwd: resolve(import.meta.dir, "..") })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

function readGitBranch(): string | undefined {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd: resolve(import.meta.dir, "..") })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

// 生成带本地时区偏移的 ISO-8601 (e.g. 2026-05-13T08:30:42-07:00).
// 避免 toISOString() 的尾 Z, 因为人类读者常会误读成本地时间.
function nowWithOffset(): string {
  const d = new Date();
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const offMin = -d.getTimezoneOffset(); // 东半球为正
  const sign = offMin >= 0 ? "+" : "-";
  const offH = pad(offMin / 60);
  const offM = pad(offMin % 60);
  const y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}-${M}-${D}T${h}:${m}:${s}${sign}${offH}:${offM}`;
}

function resolveSha(): string {
  const env =
    process.env.OGL_BUILD_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA;
  if (env) return env.slice(0, 6);
  return readGitSha();
}

function resolveBranch(): string | undefined {
  return (
    process.env.OGL_BUILD_BRANCH ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.RAILWAY_GIT_BRANCH ||
    process.env.GITHUB_REF_NAME ||
    readGitBranch()
  );
}

export const BUILD_INFO: BuildInfo = {
  version: process.env.OGL_BUILD_VERSION || readPkgVersion(),
  sha: resolveSha(),
  builtAt: process.env.OGL_BUILD_TIME || nowWithOffset(),
  branch: resolveBranch(),
};

// 单行紧凑展示, 用于 CLI/启动日志/header 等场景.
export function formatBuildLine(info: BuildInfo = BUILD_INFO): string {
  return `v${info.version} · ${info.sha} · ${info.builtAt}`;
}
