# Identity 和 ACL 迁移计划

**Date**: 2026-05-14
**Duration**: 1-2 天实现；如果剩余 owner 需要人工 review，再另算
**Priority**: P0
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

这份计划只解决一件事：`v2-hono` 里“谁拥有一个 link，以及后端怎么判断这个人能不能改它”。

最终决定：

- 新版唯一可信 owner id 是 Supabase Auth 的 `auth.users.id`。
- `links.owner_id` 存这个 Supabase Auth UUID。
- `public.users.id` 只是 app 里的 mirror，必须等于 `auth.users.id`。
- migration 不能自己 `uuidv4()` 生成 owner id。
- 旧版 author email 只作为迁移线索，存在 `links.metadata.legacy_author_email`。
- `metadata.legacy_author_email` 是后端内部字段，不能从公开 API / DTO 返回。
- 有可信 legacy email 时，必须优先找到或静默创建 Supabase Auth user 并 remap 到 `auth.users.id`。
- 只有 email 缺失、无效、冲突或人工判定不可信时，才保持 `owner_id = null`。
- 所有 email 写入 `public.users.email` 前必须 `trim().toLowerCase()`。
- anonymous link 用 `links.owner_id IS NULL` 表示。
- Claim Link 是 P0，必须支持。

这份计划暂时不讨论 Google OAuth。以后如果加 Google OAuth，也应该通过 Supabase Auth 接入，继续使用同一个 `auth.users.id`。

## 旧版是怎么做的

旧 Mongo 里的 link 大概是这样：

```ts
{
  linkname: string, // slug
  dest: string,     // url
  author: string    // email 或 "anonymous"
}
```

旧版 ownership 的核心是 `author`：

- `author` 可能是用户 email。
- `author` 也可能是 `"anonymous"`。
- 这个 `author` 不是稳定的 auth user id。
- Mongo `_id` 是 link document id，不是 owner id。
- 旧 Auth0/session 不能直接当作新版 `links.owner_id`。

之前 migration 最大的问题是：根据 legacy email 创建了 `public.users`，但这些 user id 是 migration 自己生成的 UUID，不是 Supabase Auth 的 `auth.users.id`。这样登录后的 JWT `sub` 对不上 `links.owner_id`，ACL 就会坏。

## 新版用什么 id

新版只用 Supabase Auth UUID 做 owner id。

| 数据 | 含义 | 谁生成 | 谁验证 |
|---|---|---|---|
| `auth.users.id` | 真实用户 id | Supabase Auth | Supabase Auth |
| JWT `sub` | 当前请求用户 id | Supabase Auth | Hono 后端用 Supabase JWKS 验 JWT |
| JWT `email` | 当前登录 email | Supabase Auth | Hono 后端验完 JWT 后读取 |
| `public.users.id` | app 表里的 user mirror | app 从 Supabase Auth 复制 | 只作为 FK target |
| `links.owner_id` | link owner | app 从 verified JWT `sub` 或 migration 的 Admin API 结果写入 | app 的 ACL 代码检查 |

核心规则：

```ts
links.owner_id === verifiedJwt.sub
```

所有 owner-only 操作都只看这个规则：

- Dashboard 只列自己的 links
- edit
- delete
- transfer
- owner-only audit

后端不能信任 request body 里的 user id 或 email。email 只能在 JWT 已验证之后，用来做 legacy claim。

email 规则：

- `public.users.email` 使用 canonical email：`trim().toLowerCase()`。
- `ensureUserRow`、migration、transfer recipient lookup、Claim Link 都必须使用同一套 normalize 规则。
- `public.users` 应增加 `lower(email)` 唯一索引，防止 `Foo@example.com` 和 `foo@example.com` 写成两个人。
- `public.users` 可以作为 mirror/cache 和 email 辅助索引，但不能作为 identity source of truth。

## anonymous 怎么表示

新版 anonymous 不是一个 user。

规则：

- anonymous link: `links.owner_id IS NULL`
- 不创建 `"anonymous"` user
- 不把 `"anonymous"` 写进 `metadata.legacy_author_email`
- 新版匿名创建可以保存 `created_by_fingerprint`，以后登录后用 Claim Link 认领

## migration 怎么映射旧版到新版

### 1. 读取 legacy author

每条 Mongo link：

- 如果 `author` 缺失、为空、或等于 `"anonymous"`：
  - `owner_id = null`
  - 不写 `metadata.legacy_author_email`
- 如果 `author` 是有效 email：
  - lowercase + trim
  - 写 `metadata.legacy_author_email = email`
  - 用这个 email 找到或创建 Supabase Auth user

### 2. 创建或找到 Supabase Auth user

对每个唯一 legacy email：

1. 用 Supabase Admin API 和 `SUPABASE_SECRET_KEY`。
2. 先 normalize：`email = trim().toLowerCase()`。
3. 先读 `public.users` 的同 email mirror，但必须验证它的 `id` 是否真实存在于 Supabase Auth。
4. 如果 `public.users.id` 已存在于 Supabase Auth，复用这个 `auth.users.id`。
5. 如果 `public.users.id` 不存在于 Supabase Auth，说明这是旧 migration 生成的 synthetic mirror，不能继续当 owner。
6. 再从 Supabase Auth 查找同 email user。
   - Supabase JS Admin API 没有直接的 `getUserByEmail`；实现时可以用分页 `listUsers({ perPage: 1000 })` 构建 `lower(email) -> auth.users.id` map，或用受控 SQL 读取 `auth.users`。
   - 不能只靠 `public.users` 判断用户真实存在。
7. 如果 Supabase Auth 没有这个 email，就用 Admin API 静默创建 user：

```ts
await supabase.auth.admin.createUser({
  email: normalizedEmail,
  email_confirm: true,
});
```

8. 用 Supabase 返回的 `auth.users.id` 作为唯一 owner UUID。
9. 再 upsert `public.users`：

```sql
id = auth.users.id
email = normalized email
role = 'user'
```

要求：

- migration 必须 idempotent。
- 同一个 email 反复跑，必须得到同一个 `auth.users.id`。
- migration 不能用 `uuidv4()` 创建 owner id。
- `public.users` 不能成为 identity source of truth，只能 mirror Supabase Auth。
- migration 创建的 Supabase Auth user 必须直接标记为 email confirmed。
- migration 创建用户必须对用户无感：不发送邀请、确认、通知邮件。
- migration 必须输出 synthetic mirror 修复计划：哪些 `public.users.id` 不在 Supabase Auth 中、会 remap 到哪个 `auth.users.id`。
- 对同一个 canonical email 出现多个 `public.users` / Auth user 的情况，必须进入 conflict report，不能自动拍脑袋合并。

### 3. 写 links.owner_id

每条 link：

- 如果 legacy email 成功映射到 Supabase Auth user：
  - `links.owner_id = auth.users.id`
  - 保留 `metadata.legacy_author_email`
- 如果 legacy email 有效但 Supabase Auth 中不存在：
  - 静默创建 Supabase Auth user
  - `links.owner_id = auth.users.id`
  - 保留 `metadata.legacy_author_email`
- 如果 email 缺失、无效、冲突、或人工判定不可信：
  - `links.owner_id = null`
  - 如果有可用 claim 线索，保留 `metadata.legacy_author_email`
- 如果没有可用 email：
  - 保持 anonymous，即 `links.owner_id = null`
  - 不进入 owner dashboard
  - 不做人工 CSV 批量归属
- 如果 Postgres 已经有同 slug：
  - 默认不覆盖已有非空 `owner_id`
  - 只有当已有 `owner_id` 是 synthetic mirror，且能通过同 email 找到或创建真实 Auth user 时，才自动 remap
  - 除非人工 override 文件明确要求覆盖
  - 可以 merge `metadata.legacy_author_email`

## 现有数据修复策略

这次计划不仅修未来 migration，也要修当前库里已经存在的 synthetic owner。

### 1. 找出 synthetic mirror users

先构建 Supabase Auth user map：

- 推荐：用 Supabase Admin API 分页 `listUsers`，构建 `authIdSet` 和 `lower(email) -> auth.users.id`。
- 可选：如果当前 DB 连接权限允许，也可以直接读 `auth.users`，但实现必须在 dry-run 中说明使用的是哪种方式。

然后扫描：

```sql
SELECT id, lower(email) AS email
FROM public.users;
```

dry-run 报告必须包含：

- `public.users` 总数
- `public.users.id` 存在于 Supabase Auth 的数量
- `public.users.id` 不存在于 Supabase Auth 的数量
- synthetic user 影响的 link 数
- synthetic user 里 email 可 remap / 需要创建 Auth user / 冲突 / 无效 email 的数量

### 2. 修复 synthetic owner links

对每个 synthetic `public.users`：

- 如果 email 有效，且 Supabase Auth 已有同 canonical email：
  - 把 `links.owner_id` 从 synthetic id remap 到现有 `auth.users.id`
  - upsert `public.users(id = auth.users.id, email = canonicalEmail)`
  - 删除或停用 synthetic `public.users` 前，必须确认没有 FK 继续引用它
- 如果 email 有效，但 Supabase Auth 没有同 email：
  - 静默创建 Supabase Auth user，`email_confirm: true`
  - 用新 `auth.users.id` remap `links.owner_id`
  - upsert `public.users(id = auth.users.id, email = canonicalEmail)`
- 如果 email 无效、缺失、或 canonical email 冲突：
  - 不创建 Auth user
  - 把相关 `links.owner_id` 设为 `null`
  - 如果有可信 email 文本，保留 `metadata.legacy_author_email`
  - 进入 review report；切流前必须接受这些 unowned 的处理策略

### 3. apply 安全要求

- apply 前备份所有将修改的 `links` 和 `public.users` 行，至少输出可复原的 JSON/CSV 文件路径。
- owner remap 必须放在 transaction 中。
- 默认只填补或 remap synthetic owner；不能覆盖已经指向真实 `auth.users.id` 的非空 owner。
- 删除 synthetic `public.users` 前必须确认 `links.owner_id` 和 `audit_logs.actor_id` 都不再引用它；否则保留这行但不得再作为 owner source。

## migration 前后必须报告什么

每次 dry-run 和 apply 后都要报告：

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE owner_id IS NOT NULL) AS owned,
  COUNT(*) FILTER (WHERE owner_id IS NULL) AS unowned,
  COUNT(*) FILTER (
    WHERE owner_id IS NULL
      AND metadata->>'legacy_author_email' IS NOT NULL
  ) AS unowned_with_legacy_email,
  COUNT(*) FILTER (
    WHERE owner_id IS NULL
      AND created_by_fingerprint IS NOT NULL
  ) AS unowned_with_fingerprint
FROM links
WHERE deleted_at IS NULL;
```

还要报告 identity 一致性：

```sql
SELECT
  COUNT(*) AS public_users_total,
  COUNT(*) FILTER (WHERE lower(email) <> email) AS non_canonical_public_user_emails
FROM public.users;
```

Supabase Auth 对齐情况必须由 Admin API map 或受控 `auth.users` 查询另行输出：

- `public.users.id` 不存在于 Supabase Auth 的数量
- `links.owner_id` 不存在于 Supabase Auth 的数量
- `audit_logs.actor_id` 不存在于 Supabase Auth 的数量
- canonical email 冲突数量

切流前必须明确接受剩余 `unowned` 的处理策略。否则不能切 DNS。

## 新版怎么创建 link 并 attach ownership

### 登录用户创建

`POST /api/v1/links` 带有效 Bearer token：

1. 后端验证 JWT。
2. 后端读取 `sub` 和 `email`。
3. 后端确保 `public.users.id = sub` 存在。
4. 新 link 写 `owner_id = sub`。
5. audit 里 `actor_id = sub`。

前端不传 owner id。owner id 永远由后端从 JWT 得到。

### 匿名用户创建

`POST /api/v1/links` 没有有效 token：

1. 新 link 写 `owner_id = null`。
2. 如果有 `X-Fingerprint`，保存到 `created_by_fingerprint`。
3. audit 里 `actor_id = null`。
4. 用户以后登录后，通过 Claim Link attach ownership。

## Claim Link

必须支持 Claim Link，因为不是所有旧 link 都能在 migration 时安全归属。

### 谁可以 claim

只能 claim 这种 link：

- `owner_id IS NULL`
- `deleted_at IS NULL`
- 并且满足下面任意一种证明：
  - `metadata.legacy_author_email` lower 后等于 JWT email lower 后
  - `created_by_fingerprint` 等于请求里提交的 fingerprint

### claim 怎么写

claim 必须是原子更新：

```sql
UPDATE links
SET owner_id = $jwt_sub,
    updated_at = now()
WHERE slug = $slug
  AND owner_id IS NULL
  AND deleted_at IS NULL
  AND (
    created_by_fingerprint = $fingerprint
    OR lower(metadata->>'legacy_author_email') = $jwt_email_lower
  )
RETURNING *;
```

如果没有 row 返回，说明已经被别人 claim、已删除、或不允许 claim。API 不能放宽规则重试。

### claim audit

claim 成功后写 audit：

- `action = 'CLAIM'`
- `actor_id = JWT.sub`
- `diff.before.ownerId = null`
- `diff.after.ownerId = JWT.sub`
- `metadata.claim_method = 'legacy_email' | 'fingerprint'`

### API 返回脱敏

`metadata.legacy_author_email` 只用于 migration 和后端 Claim Link 判断，不能作为 API 响应字段返回。

要求：

- `GET /api/v1/links/:slug` 是公开接口，必须从返回 DTO 中移除 `metadata.legacy_author_email`。
- Dashboard / edit / claimable 等前端 API 也不需要这个字段；前端 ACL 不能依赖 legacy email。
- Claim Link 是否允许，由后端读取 DB 并比较 verified JWT email，前端只调用 claim API。
- 如果未来 owner-only 调试页面需要显示 legacy email，必须新建明确的 admin/internal endpoint，不能复用公开 DTO。

## Supabase 还是 Clerk

这里选择 Supabase Auth，不切 Clerk。

原因：

- 现在 schema 已经是 UUID `links.owner_id`。
- Supabase Auth 的 `auth.users.id` 正好是 UUID。
- 当前 Hono middleware 已经按 Supabase JWT / JWKS 验证。
- 前端登录也已经用 Supabase session。
- Clerk 的 user id 通常是 string，如果切 Clerk，要改 owner id 类型，或新增一层 identity mapping。
- Clerk 不会自动解决 `public.users` mirror 和 ACL 重写问题。

以后如果产品需要组织、邀请、复杂账号管理 UI，可以重新评估 Clerk。当前 migration 不适合切。

## Deliverables

需要改的代码：

- 改 `scripts/migrate-from-legacy.ts`：owner id 只能来自 Supabase Auth Admin API。
- 删除 migration 里的 owner `uuidv4()` 生成逻辑。
- legacy email 写进 `links.metadata.legacy_author_email`。
- `"anonymous"` 只写成 `owner_id = null`。
- `public.users` 只 mirror Supabase Auth users。
- 增加 existing data repair path：修复已经存在的 synthetic `public.users` / `links.owner_id`。
- 给 `public.users` 增加 canonical email 写入规则和 `lower(email)` 唯一约束。
- 保持并收紧 Claim Link 的 `owner_id IS NULL` + proof predicate 原子更新规则。
- 所有 link API 响应用 DTO 脱敏 `metadata.legacy_author_email`。
- 补 migration / claim / ACL 测试。

需要改的文档：

- 更新 `scripts/README.md`，说明新的 owner mapping 规则。
- 更新 cutover runbook，说明剩余 unowned legacy links 和 synthetic owner 修复结果未被接受前不能切 DNS。

## Implementation Steps

1. 给 migration / repair scripts 加 Supabase Admin helper。
2. 写 idempotent 的 `email -> auth.users.id` resolver：先读 mirror，再验证 Auth，再找/建 Auth user。
3. 加 existing data repair dry-run，扫描 synthetic `public.users` 和 synthetic `links.owner_id`。
4. 改 legacy migration，让它用 resolver 写 owner。
5. 加 DTO sanitize，公开和普通前端 API 不返回 `metadata.legacy_author_email`。
6. 加 `public.users.email` canonical 写入和 `lower(email)` 唯一约束。
7. dry-run 输出：
   - 会创建哪些 auth users
   - 哪些 auth users 已存在
   - 哪些 links 会变 owned
   - 哪些 links 仍然 unowned
   - 哪些 synthetic owner 会 remap
   - 哪些 email conflict 需要人工处理
8. apply 模式写 users、links、metadata。
9. 补测试：
   - migration 不生成 synthetic owner UUID
   - legacy `"anonymous"` 变 `owner_id = null`
   - legacy email 映射到 Supabase Auth UUID
   - synthetic owner 会按 email remap 到真实 Auth user
   - 有效 email 不存在 Auth user 时会静默创建 confirmed Auth user
   - 无效/冲突 email 保持 `owner_id = null`
   - 默认不覆盖已有 Postgres owner
   - matching legacy email 可以 claim
   - non-matching email 不能 claim
   - 并发 claim 只能一个成功
   - 公开 link API 不返回 `metadata.legacy_author_email`

## Timeline

- Day 1: migration/repair owner resolver + synthetic owner dry-run coverage report。
- Day 2: apply path + DTO 脱敏 + tests + docs。
- Extra: 如果还有很多无 email 的 legacy links，需要人工 review。

## Success Criteria

- 所有非空 `links.owner_id` 都来自 Supabase Auth user id。
- 所有 `public.users.id` 都是 Supabase Auth user id，或不再被 owner/audit FK 引用。
- `public.users.email` 都是 canonical email，且 `lower(email)` 唯一。
- migration 不再用 `uuidv4()` 生成 owner id。
- legacy anonymous links 都是 `owner_id = null`。
- legacy email links 要么映射/创建到真实 Supabase Auth UUID，要么因 email 缺失/无效/冲突保持 unowned/claimable。
- Dashboard、edit、delete、transfer、audit 都用 verified JWT `sub` 做 ACL。
- Claim Link 只允许从 `owner_id IS NULL` attach ownership。
- Claim Link 的 proof 条件在同一个原子 `UPDATE` 里检查。
- 公开 API 和普通前端 API 不返回 `metadata.legacy_author_email`。
- 切流前能清楚看到还有多少 unowned legacy links。

## 已确认决策

- migration 创建的 Supabase Auth users：直接标记 email confirmed。
- migration 创建用户：完全静默，不发送任何通知邮件；对用户应该无感。
- 有可信 legacy email 但 Supabase Auth user 不存在：静默创建 confirmed Auth user，并 remap `links.owner_id`。
- 没有可用 email、email 无效、或 email 冲突的 legacy links：保持 anonymous，即 `owner_id = null`；不做人工 CSV 批量归属。
- `metadata.legacy_author_email` 只作为后端内部迁移/claim 线索，不对公开 API / 普通前端 API 返回。
