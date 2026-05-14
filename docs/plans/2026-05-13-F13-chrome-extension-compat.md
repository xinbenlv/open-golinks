# F13. Chrome Extension 兼容性

**Date**: 2026-05-13
**Duration**: 2 天 (含 W0 spike 1 天)
**Priority**: P2 (但 W0 spike 是 P0 前置)
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

验证 master 时代的 Chrome Extension (omnibox `go <slug>` 类似 keyword search) 能否调用 v2-hono API. 决定是 (a) 加 shim 保持旧 API 兼容, (b) 发扩展新版本, 还是 (c) 弃用扩展.

## W0 Spike (必做)

1. 找到扩展源码 repo (在 [Prerequisites](./2026-05-13-feature-parity-master-plan.md#-外部账户项目就位-需人介入) 列表中标记为待定)
2. 读扩展 manifest + background.js, 列出它调用的 API endpoint:
   - 可能的旧 endpoint: `GET /api/v2/link/:slug`, `POST /api/v2/edit`, `GET /api/v2/my-links`, `GET /api/v2/available/:slug`
3. 跟 v2-hono 当前 API 对比, 列差异 (endpoint path / method / request body / response shape)
4. 决定方案: shim / 新版 / 弃用

## Deliverables (取决于方案)

### 方案 A: shim (推荐)

新文件:
- `src/routes/api/v2-compat.ts` — 把 `/api/v2/*` 路径转发到对应 `/api/v1/*` 的 shim
- `tests/e2e/F13-extension-compat.test.ts` (puppeteer 加载扩展)

修改:
- `src/server.ts` 注册 `/api/v2/*` 路由

### 方案 B: 发扩展新版本

修改:
- 扩展源码 (在另一个 repo) 把 API path 改成 `/api/v1/*` + 重新打包发布 Chrome Web Store

### 方案 C: 弃用

修改:
- 通知现有用户 (扩展 / dashboard banner)
- 一段时间后停掉

## 依赖与现状

- 至少 F1 + F2 完成 (有完整 API 才能对照)
- env: 无新增

## API 兼容性 (推测, W0 spike 确认)

| 旧 (master) | 新 (v2-hono) | shim 难度 |
|---|---|---|
| `GET /api/v2/link/:slug` | `GET /api/v1/links/:slug` | 简单, response shape 略改 |
| `POST /api/v2/edit { golink, dest, ... }` | `POST /api/v1/links` + `PATCH /api/v1/links/:slug` | 中, 需根据 slug 是否已存在路由到不同 endpoint |
| `GET /api/v2/my-links` (cookie auth) | `GET /api/v1/links?owner=me` (Bearer JWT) | 难, 扩展需先支持 Supabase JWT |
| `GET /api/v2/available/:slug` | 新增简单 endpoint `GET /api/v1/links/:slug/available` | 简单 |

## e2e 测试

```ts
test('Puppeteer 加载扩展, 在 omnibox 输入 "go foo" → 跳到目标 URL', ...);
test('扩展调 /api/v2/link/:slug (shim) → 返回兼容 schema', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 0. W0 spike 完成, 方案确定
- [ ] 1-7. 同 SOP

## 风险

| 风险 | 缓解 |
|---|---|
| 扩展用 cookie session, v2-hono 用 Bearer JWT — 不兼容 | shim 不能解决此问题; 必须发扩展新版 |
| 找不到扩展源码 | 弃用方案 |
| Chrome Web Store 审核慢 | 提前提交 (W0/W1 启动) |
