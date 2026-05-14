# F5. 匿名链接认领 (Claim)

**Date**: 2026-05-13
**Duration**: 3 天
**Priority**: P0
**Status**: ✅ Done
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

匿名用户创建链接 → 注册登录后能"认领"为自己的. master 关键差异化功能. **dump 后老链接 owner_id 多数为 null 时, 不能只靠 fingerprint; 本 feature 同时负责 legacy email ownership reconciliation, 是切流前保留用户数据所有权的关键**.

> ⚠️ 若 W0/W2 跑 owner_id + legacy author email 覆盖率显示仍有无法映射链接, **F5 legacy claim/manual review 是切流阻塞项**. Fingerprint claim 只覆盖 v2-hono 新匿名创建的链接.

## Deliverables

新文件:
- `src/lib/fingerprint.ts` — 浏览器 + 服务端共用; 主算法 SHA-256(canvas + UA + tz + screen), fallback SHA-256(UA + tz + screen + 随机持久 token)
- `src/web/pages/Claim.tsx` — 单链接认领页 (兼容 master `pages/link.vue` 里的 "Claim to update" 体验)
- `src/web/components/ClaimBanner.tsx` — Dashboard 顶部 banner, 列可认领项
- `scripts/reconcile-legacy-owners.ts` 或同等 runbook — 按 legacy author email 统计/回填 owner_id, 产出无法自动处理的 review list
- `tests/e2e/F5-claim.test.ts`
- `tests/browser/F5.spec.ts`

修改:
- `src/routes/api/links.ts`:
  - `POST /` 写 `created_by_fingerprint` (前端通过 header `X-Fingerprint` 传)
  - 新 `POST /:slug/claim` (requireAuth)
  - 新 `GET /claimable?fingerprint=<hex>` (requireAuth)
- `src/routes/redirect.ts` + `tests/e2e/reserved-slug-fallthrough.test.ts`: 把 `claim` 加入 RESERVED, 防止 `/claim/:slug` 被当成短链 slug
- 匿名建链时 `web/pages/Create.tsx` (或 Landing 的创建表单) 把 slug + fingerprint 入 localStorage `golinks:created`
- 登录后 `Dashboard.tsx` 顶部读 localStorage + 调 `/claimable` 显示 banner

## 依赖与现状

- F1 (auth) + F2 (audit) 完成
- DB: `links.created_by_fingerprint` (varchar(64)) 已就绪
- env: 无新增

## API 设计

### `POST /api/v1/links/:slug/claim` (requireAuth)

```jsonc
// req
{ "fingerprint": "<64-hex>" }

// 新匿名链接校验: row.created_by_fingerprint === fingerprint AND row.owner_id IS NULL
// Legacy 链接校验: row.owner_id IS NULL AND metadata.legacy_author_email lower == current user email lower
// 写: owner_id = userId, audit CLAIM (diff.from=null, diff.to=userId)

// 200 { link: { ..., ownerId: "<uuid>" } }
// 403 fingerprint 不匹配
// 409 owner_id 已设置
// 404 slug 不存在
```

### `GET /api/v1/links/claimable?fingerprint=<hex>` (requireAuth)

```jsonc
// 200
{ "links": [{ "slug": "...", "createdAt": "..." }, ...] }
// 返回两类:
// 1. owner_id IS NULL AND created_by_fingerprint = $1 AND deleted_at IS NULL
// 2. owner_id IS NULL AND metadata.legacy_author_email lower == current user email lower AND deleted_at IS NULL
```

### Legacy owner reconciliation (P0)

W2 必须跑一次 owner/email 覆盖率:

```sql
SELECT
  COUNT(*) FILTER (WHERE owner_id IS NULL) AS unowned,
  COUNT(*) FILTER (WHERE owner_id IS NULL AND metadata->>'legacy_author_email' IS NOT NULL) AS unowned_with_email,
  COUNT(*) FILTER (WHERE owner_id IS NULL AND created_by_fingerprint IS NOT NULL) AS unowned_with_fingerprint,
  COUNT(*) AS total
FROM links;
```

处理策略:
- 若 `metadata.legacy_author_email` 能匹配 `public.users.email`, backfill `owner_id`
- 若当前用户 email 等于 `metadata.legacy_author_email`, `/claimable` 直接列出可认领
- 若既无 email 也无 fingerprint, 导出 review list, 由人工确认后写 owner; 该 list 未闭环前不切 DNS
- 不把 legacy email 明文返回给非 owner; UI 只显示 slug/url/createdAt

2026-05-13 dry-run 结果 (`bun scripts/reconcile-legacy-owners.ts`):
- `total=5804`
- `unowned=4959`
- `unowned_with_email=0`
- `unowned_with_fingerprint=0`

结论: 目前 dump 数据没有可自动回填的 legacy email / fingerprint. F5 代码路径已支持新匿名链接和将来带 `legacy_author_email` 的数据; 现有 4959 条未归属 legacy 链接仍需 manual review/批量归属策略, 未闭环前不切 DNS.

## Fingerprint 算法 (`src/lib/fingerprint.ts`)

```ts
// 浏览器端
export async function computeFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    // ... draw text + 几何形状 → toDataURL → SHA-256
    const canvasHash = await sha256(canvas.toDataURL());
    return await sha256([canvasHash, navigator.userAgent, Intl.DateTimeFormat().resolvedOptions().timeZone, `${screen.width}x${screen.height}`].join('|'));
  } catch {
    // canvas 不可用 (隐私模式)
    let token = localStorage.getItem('golinks:fp-fallback-token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('golinks:fp-fallback-token', token);
    }
    return await sha256([navigator.userAgent, Intl.DateTimeFormat().resolvedOptions().timeZone, `${screen.width}x${screen.height}`, token].join('|'));
  }
}
```

服务端不计算 fingerprint, 仅校验客户端送来的值长度 + 格式 (64 hex chars).

## UI 草图

```
[Dashboard 顶部 ClaimBanner]
+----------------------------------------+
| 🔗 You have 3 unclaimed links          |
| /foo, /bar, /baz                       |
| [Claim all]   [Review one by one]      |
+----------------------------------------+

[Claim.tsx 单链接页 /claim/:slug]
+----------------------------------------+
| Claim ownership of /foo                |
| Originally created: 2024-01-15         |
| Destination: https://...               |
|                                        |
| [Claim this link]   [Not mine]         |
+----------------------------------------+
```

## e2e 测试

```ts
test('匿名建链 → 登录 → banner 出现 → 点 claim → 链接进列表', async () => {
  // 1. 匿名 POST /links { slug:'aa', url } with X-Fingerprint: fp1
  // 2. localStorage 存 { slug: 'aa', fp: fp1 }
  // 3. 用户 A 登录
  // 4. GET /api/v1/links/claimable?fingerprint=fp1 → [{slug:'aa'}]
  // 5. POST /links/aa/claim {fingerprint: fp1} → 200, owner_id 写入
  // 6. /dashboard 列表含 aa, audit_logs 含 CLAIM
});

test('legacy_author_email 匹配当前用户 → 登录后可认领历史链接', ...);
test('legacy_author_email 不匹配 → 不出现在 claimable, claim 返回 403', ...);
test('不同浏览器 (fp 不同) 用同账号登录 → banner 不出现', ...);
test('同浏览器 (fp 同) 用 B 账号登录 + 已被认领的链接 → claim 返回 409', ...);
test('fingerprint 不匹配 (篡改请求) → 403', ...);
test('canvas 不可用浏览器 (mock window.HTMLCanvasElement) → fallback fingerprint 工作', ...);
test('直接访问 /claim/foo 不会被 redirectRoute 当成 slug', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [x] 1. type-check + build + 本地 production server healthcheck
- [x] 2. `bun test tests/e2e/F5-claim.test.ts` 绿
- [x] 3. commit + push, 前缀 `[F5]`
- [x] 4. Railway env: 无新增
- [x] 5. deploy SUCCESS
- [x] 6. 浏览器验证生产: 匿名身份建一个新 slug → 注册一个测试账号登录 → banner 显示 → 点 Claim → /dashboard 列表含该 slug; build SHA 匹配
- [x] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| canvas fingerprint 隐私模式失败 | fallback 算法已设计 |
| 用户清 localStorage 后丢失 fingerprint → 永远无法认领 | UI 提示 "建链后请尽快登录认领"; 长期方案: 邮箱关联 |
| 恶意用户暴力猜 fingerprint | fingerprint = 64 hex = 256 bits, 暴力空间不现实 |
| dump 数据老链接 `created_by_fingerprint` 是空 | 不靠 fingerprint; 先 legacy author email backfill/match claim, 剩余人工 review. 这是 P0 切流条件, 不是 P1 |
