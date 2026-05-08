# Railway 部署失败: Node.js 18 EOL

## 问题描述

2026-05-07 `railway up` 部署失败, build 阶段错误:

```
error: Node.js 18.x has reached End-Of-Life and has been removed
[ERRO] [stage-0  4/15] RUN nix-env -if .nixpacks/nixpkgs-...nix && nix-collect-garbage -d
Build Failed: ... exit code: 1
```

## 错误原因

Nixpacks 自动 detect 到 `package.json` 里有 `react` / `react-dom` 等 Node 生态依赖, 默认尝试装 Node.js. Nixpacks 锁的旧 nixpkgs revision (`31fb21469e34b6b5c7be77b9a35bae43d0c598e9`) 指向 Node 18; 但 nixpkgs 上游已把 Node 18 (EOL) 从仓库移除, 导致安装失败.

我们的项目运行时只用 Bun (server `bun src/server.ts`, build `bun run build:web`, package manager `bun install`), 完全不需要 Node.

## 解决方案

在仓库根加 `nixpacks.toml`, 显式指定只装 `bun`, 不让 Nixpacks 自动加 Node:

```toml
[phases.setup]
nixPkgs = ["bun"]

[phases.install]
cmds = ["bun install --frozen-lockfile"]

[phases.build]
cmds = ["bun run build:web"]

[start]
cmd = "bun src/server.ts"
```

## 相关代码

- `nixpacks.toml`
- `railway.json` (builder = NIXPACKS, healthcheck = /api/v1/health)
- `package.json` 的 scripts (build:web / start)

## 注意

如果以后某个 build/runtime 步骤确实需要 Node (例如某些工具链 binary), 在 `nixPkgs` 数组里加 `"nodejs_22"` (或当前 LTS), 不要回退到 nodejs_18.
