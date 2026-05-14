# F5. 匿名链接认领 (Claim)

**Date**: 2026-05-13
**Duration**: 3 天
**Priority**: P0
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

匿名用户创建链接 → 注册登录后能"认领"为自己的. master 关键差异化功能. **dump 后老链接 owner_id 多数为 null, 本 feature 是切流后保留用户数据所有权的关键**.

> ⚠️ 若 W0 跑 owner_id SQL 显示 unowned 占比 > 50%, **F5 优先级升回 F2 之后**, 用户登录后立即能看到可认领项.

## Deliverables

新文件:
- `src/lib/fingerprint.ts` — 浏览器 + 服务端共用; 主算法 SHA-256(canvas + UA + tz + screen), fallback SHA-256(UA + tz + screen + 随机持久 token)
- `src/web/pages/Claim.tsx` — 单链接认领页 (兼容 master `claim.vue`)
- `src/web/components/ClaimBanner.tsx` — Dashboard 顶部 banner, 列可认领项
- `tests/e2e/F5-claim.test.ts`
- `tests/browser/F5.spec.ts`

修改:
- `src/routes/api/links.ts`:
  - `POST /` 写 `created_by_fingerprint` (前端通过 header `X-Fingerprint` 传)
  - 新 `POST /:slug/claim` (requireAuth)
  - 新 `GET /claimable?fingerprint=<hex>` (requireAuth)
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

// 校验: row.created_by_fingerprint === fingerprint AND row.owner_id IS NULL
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
// 仅返回 owner_id IS NULL AND created_by_fingerprint = $1 AND deleted_at IS NULL
```

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

test('不同浏览器 (fp 不同) 用同账号登录 → banner 不出现', ...);
test('同浏览器 (fp 同) 用 B 账号登录 + 已被认领的链接 → claim 返回 409', ...);
test('fingerprint 不匹配 (篡改请求) → 403', ...);
test('canvas 不可用浏览器 (mock window.HTMLCanvasElement) → fallback fingerprint 工作', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 1. type-check + 本地启动
- [ ] 2. `bun test tests/e2e/F5-claim.test.ts` 绿
- [ ] 3. commit + push, 前缀 `[F5]`
- [ ] 4. Railway env: 无新增
- [ ] 5. deploy SUCCESS
- [ ] 6. 浏览器验证生产: 匿名身份建一个新 slug → 注册一个测试账号登录 → banner 显示 → 点 Claim → /dashboard 列表含该 slug; build SHA 匹配
- [ ] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| canvas fingerprint 隐私模式失败 | fallback 算法已设计 |
| 用户清 localStorage 后丢失 fingerprint → 永远无法认领 | UI 提示 "建链后请尽快登录认领"; 长期方案: 邮箱关联 |
| 恶意用户暴力猜 fingerprint | fingerprint = 64 hex = 256 bits, 暴力空间不现实 |
| dump 数据老链接 `created_by_fingerprint` 是空 | 这些链接走不了 claim — 决定: 在 SQL 里把所有 owner_id IS NULL AND created_by_fingerprint IS NULL 的链接标 `metadata.legacy_unowned = true`, 提供"我是 master 时代 owner" 的人工认领流程 (P1) |
