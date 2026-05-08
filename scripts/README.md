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
- 读取旧 MongoDB 数据库中的用户和链接
- 规范化 schema（MongoDB 字段 → PostgreSQL 字段）
- 将数据插入新的 PostgreSQL 数据库
- 支持干运行（dry-run）模式进行测试

### 使用方法

#### 1. **干运行（推荐首先运行）**
```bash
npm run migrate:legacy:dry
```
- 显示将迁移的数据量
- 显示数据映射规则
- **不修改任何数据库**
- 用于验证迁移前的准备

#### 2. **实际迁移**
```bash
npm run migrate:legacy
```
- **会覆盖现有数据库中的链接和用户**
- 读取 MongoDB 中的用户和链接
- 映射到 PostgreSQL schema
- 插入数据

#### 3. **详细日志**
```bash
npm run migrate:legacy:verbose
```
- 显示每条被迁移的记录
- 对调试有帮助

### 环境变量

脚本需要以下环境变量：

- `LEGACY_MONGO_DB_URL` - Heroku MongoDB 连接字符串
  - 格式: `mongodb+srv://user:password@cluster/database`
  - 存储在 `.env` 文件中

- `DATABASE_URL` - PostgreSQL 连接字符串
  - 自动从 `.env` 读取
  - 指向新的 Supabase 数据库

### 工作流程

1. **连接到 MongoDB**
   - 使用 `LEGACY_MONGO_DB_URL`
   - 自动检测用户集合（users, accounts, profiles, user）
   - 自动检测链接集合（links, urls, shortlinks, golinks, link）

2. **迁移用户**
   - 读取 MongoDB 用户
   - 规范化字段：
     - `_id` / `id` → UUID
     - `email` → email
     - `role` → role (默认 "user")
     - `createdAt` / `created_at` → createdAt
   - 删除现有用户（仅匹配 email）
   - 插入新用户

3. **迁移链接**
   - 读取 MongoDB 链接
   - 规范化字段：
     - `slug` → slug（小写）
     - `url` → url（验证为有效 URL）
     - `owner` / `ownerId` / `owner_id` → ownerId（使用用户映射）
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
MongoDB          → PostgreSQL
_id/id           → id (UUID)
email            → email
role             → role
createdAt        → createdAt
```

##### 链接
```
MongoDB          → PostgreSQL
slug             → slug (normalized)
url              → url (validated)
owner/ownerId    → ownerId (with user mapping)
createdAt        → createdAt
updatedAt        → updatedAt
visits           → visits
fingerprint      → createdByFingerprint
isPublic         → isPublic
metadata         → metadata
```

#### UUID 处理

- MongoDB 中的非 UUID ID 会自动转换为 UUID
- 使用 `uuid.v4()` 生成新 UUID
- 在 `userIdMap` 中追踪映射，以便链接可以引用正确的所有者

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
  ⚠️  错误:  X
==================================================
```

### 注意事项

⚠️ **重要**：
- 实际迁移会**覆盖现有数据**（users/links 表）
- 在执行之前始终运行 `--dry-run` 模式进行验证
- 备份生产数据库（Supabase 提供备份功能）
- 审计日志（audit_logs 表）**不会被迁移**（需要手动处理）

### 故障排查

#### 连接错误
```
❌ 错误: LEGACY_MONGO_DB_URL 环境变量未设置
```
- 确保 `.env` 文件包含 `LEGACY_MONGO_DB_URL`
- 检查连接字符串格式

#### 无法找到集合
```
⚠️  未找到用户集合，跳过用户迁移
```
- 脚本尝试多个可能的集合名称
- 如果仍然找不到，检查 MongoDB 中的实际集合名称
- 手动更新脚本中的 `userCollectionNames` / `linkCollectionNames`

#### 数据验证错误
- 查看错误消息了解哪些字段有问题
- 使用 `--verbose` 标志查看详细日志
- 检查源数据的数据类型和格式

### 相关文件

- [`.env`](../.env) - 环境变量配置
- [`src/db/schema.ts`](../src/db/schema.ts) - 目标 PostgreSQL schema
- [`docs/plans/2026-02-10-ga-backend-proxy.md`](../docs/plans/2026-02-10-ga-backend-proxy.md) - 迁移计划文档

### 维护

此脚本应在以下情况下更新：
- PostgreSQL schema 发生变化（添加/删除/重命名字段）
- MongoDB 源数据的字段名称发生变化
- 需要特殊的数据转换逻辑

---

**最后更新**: 2026-02-10
