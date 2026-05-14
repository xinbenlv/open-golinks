# 计划目录

本目录存放 v2-hono 的工作计划. 规范见 [`.claude/rules/planning.md`](../../.claude/rules/planning.md).

## 入口

> ⚠️ **agent 实施时只看"主计划 + 对应 sub-plan 一份"**, 不混读多个 sub-plan, 避免上下文干扰. 主计划是导航 + 共享规范, sub-plan 是详细设计.

📋 **[主计划: 2026-05-13-feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)** — 总入口, 含 [Per-Feature SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done) / [Prerequisites](./2026-05-13-feature-parity-master-plan.md#prerequisites--开放问题-agent-端到端执行前必须就位) / 栈选型 / 切流策略

## Feature Sub-Plans

### 🔴 P0 (切流前)

- [x] [F1. 用户认证 + 登录 UI](./2026-05-13-F1-auth-and-login.md) — 3 天
- [x] [F2. 链接 CRUD + audit + ratelimit](./2026-05-13-F2-link-crud-audit-ratelimit.md) — 3 天
- [x] [F3. 个人链接列表 Dashboard](./2026-05-13-F3-user-dashboard.md) — 3 天
- [x] [F4. 基础 Stats + GA4 上报](./2026-05-13-F4-basic-stats-ga4.md) — 2.5 天
- [x] [F5. 匿名链接认领 (Claim)](./2026-05-13-F5-anonymous-claim.md) — 3 天

### 🟡 P1 (切流后 1 月内)

- [x] [F6. /warn/:slug 警告页](./2026-05-13-F6-warn-page.md) — 1.5 天
- [x] [F7. QR 码生成 / 下载](./2026-05-13-F7-qr-codes.md) — 3 天 + W0 spike
- [x] [F8. 详细 Analytics 页](./2026-05-13-F8-detailed-analytics.md) — 3 天
- [ ] [F9. 审计日志查看](./2026-05-13-F9-audit-log-view.md) — 1.5 天
- [ ] [F10. URL 历史展示](./2026-05-13-F10-url-history-display.md) — 0.5 天

### 🟢 P2 (长尾, 视用户反馈)

- [ ] [F11. 所有权转移 (Transfer)](./2026-05-13-F11-ownership-transfer.md) — 1.5 天
- [ ] [F12. 公开链接发现 (Browse)](./2026-05-13-F12-public-link-browse.md) — TBD (W4 末决策)
- [ ] [F13. Chrome Extension 兼容性](./2026-05-13-F13-chrome-extension-compat.md) — 2 天 含 spike
- [ ] [F14. 链接 metadata (tags, description)](./2026-05-13-F14-link-metadata.md) — 2 天

> 完成一个 feature 后, 在上面对应行的 `[ ]` 改成 `[x]` (按 [SOP 步骤 7](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done)).

## 已归档

- ✅ [`archived/2026-05-08-landing-page-phase-1.md`](./archived/2026-05-08-landing-page-phase-1.md) — Landing 页 SSG 实装 (phase 1)
- ✅ [`archived/2026-05-07-v2-hono-rewrite-phase-1.md`](./archived/2026-05-07-v2-hono-rewrite-phase-1.md) — v2-hono 重写主计划 (阶段 1 骨架完成, 阶段 2/3/4 被 feature-parity 总计划取代)
