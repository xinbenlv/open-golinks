# 迁移脚本

此目录包含数据迁移和维护脚本。

## run-migrations.ts

应用 `src/db/migrations/` 下 drizzle-kit 生成的 SQL 迁移到 `DATABASE_URL` 指向的库。

由 `bun run db:migrate` 调用。使用 drizzle-orm 内置 migrator，自动维护 `__drizzle_migrations` 表，幂等可重复执行。

## seed-test.ts

本地开发用：插入（或 upsert）一条 `slug=test` → `https://example.com` 的链接，用于手动验证 `/:slug` redirect 与 visits/daily_visits 累加。

```bash
bun scripts/seed-test.ts
curl -I http://localhost:3000/test   # 应返回 302 + Location
```

## migrate-from-legacy.ts

从 Heroku MongoDB 迁移数据到 PostgreSQL 的脚本。

### 背景

open-golinks v2 从 MongoDB（Heroku） 迁移到 PostgreSQL（Supabase）。此脚本用于：
- 读取旧 MongoDB `shortlinks` 中的链接
- 规范化 schema（MongoDB 字段 → PostgreSQL 字段）
- 用 Supabase Auth Admin API 把 legacy author email 映射为 `auth.users.id`
- 将数据 upsert 到 PostgreSQL 数据库
- 支持干运行（dry-run）模式进行测试
- 默认保留只存在于 PostgreSQL 的链接，不做删除

### 使用方法

#### 1. **干运行（推荐首先运行）**
```bash
bun run migrate:legacy:dry
```
- 显示将迁移的数据量
- 显示数据映射规则
- **不修改任何数据库**
- 用于验证迁移前的准备

#### 2. **非破坏性 upsert（默认实际迁移）**
```bash
bun run migrate:legacy
```
- 添加 MongoDB 中的新 slug
- 对 MongoDB 和 PostgreSQL 都存在的 slug 覆盖 URL，并补充 `metadata.legacy_author_email`
- 保留只存在于 PostgreSQL 的链接
- 保留既有 visits、url_history、created_by_fingerprint、deleted_at、is_public
- 仅当 legacy author 能解析到真实 Supabase Auth user 时写入 owner
- 默认不覆盖已有非空 `links.owner_id`

#### 3. **详细日志**
```bash
bun run migrate:legacy -- --verbose
```
- 显示每条被迁移的记录
- 对调试有帮助

#### 4. **破坏性全量替换（仅恢复/重建时使用）**
```bash
bun run migrate:legacy:replace
```
- **会清空 `daily_visits`、`audit_logs`、`links` 后重新导入**
- 不会清空 `users`
- 日常补 dump 不要使用这个命令

### 环境变量

脚本需要以下环境变量：

- `LEGACY_MONGO_DB_READONLY_URL` - Heroku MongoDB 只读连接字符串
  - 格式: `mongodb+srv://user:password@cluster/database`
  - 存储在 `.env` 文件中

- `DATABASE_URL` - PostgreSQL 连接字符串
  - 自动从 `.env` 读取
  - 指向新的 Supabase 数据库

- `SUPABASE_URL` 或 `VITE_SUPABASE_URL` - Supabase project URL

- `SUPABASE_SECRET_KEY` 或 `SUPABASE_SERVICE_ROLE_KEY` - Supabase service-role/Admin key，用于 `listUsers` 和静默 `createUser`

### 工作流程

1. **连接到 MongoDB**
   - 使用 `LEGACY_MONGO_DB_READONLY_URL`
   - 自动检测用户集合（users, accounts, profiles, user）
   - 自动检测链接集合（links, urls, shortlinks, golinks, link）

2. **解析 owner identity**
   - 从 MongoDB `shortlinks.author` 提取 email，统一 `trim().toLowerCase()`
   - `"anonymous"`、空值和无效 email 迁移为 `owner_id = null`
   - 用 Supabase Admin API 分页 `listUsers` 构建 `email -> auth.users.id`
   - 已有 `public.users` 只能作为 mirror，必须验证 id 存在于 Supabase Auth
   - Auth 中没有有效 legacy email 时，apply 模式静默创建 `email_confirm: true` 的 Auth user

3. **迁移链接**
   - 读取 MongoDB 链接
   - 规范化字段：
     - `slug` → slug（小写）
     - `url` → url（验证为有效 URL）
     - `author` email → `ownerId`（使用 Supabase Auth UUID）
     - `createdAt` / `created_at` → createdAt
     - `updatedAt` / `updated_at` → updatedAt
     - `visits` / `visit_count` → visits
     - `isPublic` / `is_public` → isPublic
     - `fingerprint` → createdByFingerprint
     - `metadata` → metadata
   - 删除现有链接
   - 插入新链接

### 架构细节

#### Schema 映射规则

##### 用户
```
Supabase Auth    → PostgreSQL public.users
auth.users.id    → id
canonical email  → email
role             → role='user'
```

##### 链接
```
MongoDB          → PostgreSQL
slug             → slug (normalized)
url              → url (validated)
author email     → ownerId (auth.users.id)
author email     → metadata.legacy_author_email
createdAt        → createdAt
updatedAt        → updatedAt
visits           → visits
fingerprint      → createdByFingerprint
isPublic         → isPublic
metadata         → metadata
```

#### UUID 处理

- `links.owner_id` 只能来自 Supabase Auth `auth.users.id`
- migration 不生成 owner UUID
- `public.users.id` 只是 mirror，必须等于对应的 `auth.users.id`
- existing synthetic `public.users` 由 `reconcile-legacy-owners.ts` dry-run/apply 修复

#### URL 验证

- 验证 URL 格式
- 如果 URL 不以 `http://` 或 `https://` 开头，自动添加 `https://`

#### 错误处理

- 脚本捕获迁移过程中的错误
- 无效数据（如缺少 slug）会被跳过
- 错误计数在摘要中显示
- 脚本以非零状态码退出如果出现致命错误

### 迁移统计

脚本完成后会显示：
```
==================================================
迁移统计:
  👥 用户:  X/Y 已迁移
  🔗 链接:  X/Y 已迁移
Owner coverage:
  total=..., owned=..., unowned=...
Identity consistency:
  public_users_total=..., non_canonical_public_user_emails=...
  ⚠️  错误:  X
==================================================
```

### 注意事项

⚠️ **重要**：
- 默认实际迁移是非破坏性的 upsert；不会删除 PostgreSQL-only 链接
- 只有 `--replace-all` / `bun run migrate:legacy:replace` 会清空链接相关表
- 在执行之前始终运行 `--dry-run` 模式进行验证
- 备份生产数据库（Supabase 提供备份功能）
- 审计日志（audit_logs 表）**不会被迁移**（需要手动处理）

### 故障排查

#### 连接错误
```
❌ 错误: LEGACY_MONGO_DB_READONLY_URL 环境变量未设置
```
- 确保 `.env` 文件包含 `LEGACY_MONGO_DB_READONLY_URL`
- 检查连接字符串格式

#### Mongo 集合名称不同

当前脚本读取固定集合 `shortlinks`。如果源库集合名称不同，需要先用 `scripts/inspect-mongo.ts` 确认实际集合，再改 `scripts/migrate-from-legacy.ts` 的读取位置。

#### 数据验证错误
- 查看错误消息了解哪些字段有问题
- 使用 `--verbose` 标志查看详细日志
- 检查源数据的数据类型和格式

### 相关文件

- [`.env`](../.env) - 环境变量配置
- [`src/db/schema.ts`](../src/db/schema.ts) - 目标 PostgreSQL schema
- [`docs/plans/2026-05-14-identity-acl-migration-plan.md`](../docs/plans/2026-05-14-identity-acl-migration-plan.md) - Identity / ACL 迁移计划

### 维护

此脚本应在以下情况下更新：
- PostgreSQL schema 发生变化（添加/删除/重命名字段）
- MongoDB 源数据的字段名称发生变化
- 需要特殊的数据转换逻辑

## reconcile-legacy-owners.ts

Identity/ACL repair 脚本。默认 dry-run 用 Supabase Admin API 对齐 `public.users` 与 `auth.users`，找出 synthetic mirror user、受影响链接和需要人工处理的 conflict:

```bash
bun scripts/reconcile-legacy-owners.ts
```

确认报告后可执行 apply。apply 前会在 `var/identity-acl-backups/` 写出会修改的 `users`、`links`、`audit_logs` JSON 备份，并在 transaction 中 remap 或置空 synthetic owner:

```bash
bun scripts/reconcile-legacy-owners.ts --apply
```

规则：

- synthetic `public.users.email` 有效且 Auth 已有同 email → remap `links.owner_id` / `audit_logs.actor_id` 到真实 Auth id。
- synthetic email 有效但 Auth 不存在 → 静默创建 confirmed Auth user，再 remap。
- email 无效、canonical email 冲突或 Auth email 冲突 → 不创建 Auth user，相关 `links.owner_id` 置为 `null`，可用 email 写入 `metadata.legacy_author_email` 供后续 claim。
- 删除 synthetic `public.users` 前会确认 `links.owner_id` 和 `audit_logs.actor_id` 都不再引用它。

可用 `--backup-dir=<path>` 覆盖备份目录，`--verbose` 输出完整 action 列表。

## lib/identity-acl.ts

迁移脚本共享 helper：

- `loadAuthIdentityMap` - 通过 Supabase Admin API 分页读取 Auth users。
- `resolveOwnerByEmail` - idempotent `email -> auth.users.id` resolver，处理 synthetic mirror、Auth create 和 conflict。
- `ensurePublicUserMirror` - 写入或修复 `public.users(id = auth.users.id)` mirror。
- `loadOwnershipSummary` / `loadPublicUserEmailSummary` - dry-run/apply 后的覆盖率报告。
- `backupIdentityAclRows` - apply 前 JSON 备份。

---

**最后更新**: 2026-05-14
