# 从 Heroku MongoDB 迁移到 Supabase PostgreSQL

**完成日期**: 2026-02-10
**类型**: 数据迁移指南
**受众**: 开发人员 / DevOps

## 概述

此文档说明如何从旧的 Heroku MongoDB 实例迁移数据到新的 Supabase PostgreSQL 数据库。

### 关键信息

- ✅ **自动化脚本**: `npm run migrate:legacy`
- ⚠️ **破坏性操作**: 会覆盖现有的 links 和 users 表
- 🧪 **测试模式**: `npm run migrate:legacy:dry` - 干运行模式
- 📊 **支持的数据**: Users 和 Links（Audit logs 不包括）

## 前置条件

### 环境准备

1. **确保 `.env` 包含两个数据库连接字符串**:
   ```bash
   DATABASE_URL=postgresql://...  # 新的 Supabase PostgreSQL
   LEGACY_MONGO_DB_URL=mongodb+srv://...  # 旧的 Heroku MongoDB
   ```

2. **安装依赖**:
   ```bash
   npm install
   ```
   脚本需要以下新包：
   - `mongodb` - MongoDB 驱动
   - `uuid` - UUID 生成
   - `tsx` - TypeScript 执行器

### 数据库访问

- MongoDB 连接字符串必须有访问权限
- PostgreSQL 连接字符串必须有写入权限
- 建议先在开发环境测试

## 迁移步骤

### 步骤 1: 测试迁移（干运行）

首先，在干运行模式下测试，**不修改任何数据**：

```bash
npm run migrate:legacy:dry
```

**输出示例**:
```
==================================================
MongoDB 到 PostgreSQL 数据迁移
==================================================
📋 连接到 MongoDB...
✅ MongoDB 连接成功

📚 开始迁移用户...
找到用户集合: "users"
读取 42 个用户
✅ 迁移了 42/42 个用户

🔗 开始迁移链接...
找到链接集合: "links"
读取 1,234 个链接
✅ 迁移了 1,234/1,234 个链接

==================================================
迁移统计:
  👥 用户:  42/42 已迁移
  🔗 链接:  1,234/1,234 已迁移
==================================================
✅ DRY-RUN 完成！使用 npm run migrate:legacy 执行实际迁移
```

✅ **验证**:
- 检查迁移的数据量是否符合预期
- 检查是否有错误或警告
- 如果看起来正确，继续步骤 2

### 步骤 2: 备份生产数据库

在运行实际迁移前，**备份 Supabase PostgreSQL**：

1. 进入 [Supabase Dashboard](https://app.supabase.com)
2. 选择项目
3. 左侧菜单 → Database → Backups
4. 创建手动备份

或者使用 SQL 导出：
```bash
# 导出当前状态
pg_dump $DATABASE_URL > backup-before-migration-2026-02-10.sql
```

### 步骤 3: 执行迁移

运行实际迁移：

```bash
npm run migrate:legacy
```

⚠️ **警告**:
- 脚本将删除 `links` 和 `users` 表中的所有现有数据
- 这是**不可逆的**（除非您有备份）
- 在生产环境前，先在开发环境测试

**成功输出**:
```
✅ 迁移完成！
```

### 步骤 4: 验证迁移

迁移后，验证数据完整性：

#### 检查用户数

```sql
SELECT COUNT(*) as user_count FROM users;
-- 应该显示 42 行
```

#### 检查链接数

```sql
SELECT COUNT(*) as link_count FROM links;
-- 应该显示 1,234 行
```

#### 抽样检查数据

```sql
-- 检查用户数据
SELECT id, email, role, created_at FROM users LIMIT 5;

-- 检查链接数据
SELECT slug, url, owner_id, created_at, visits FROM links LIMIT 5;

-- 检查所有者关系
SELECT l.slug, l.url, u.email
FROM links l
LEFT JOIN users u ON l.owner_id = u.id
LIMIT 5;
```

#### 检查数据完整性

```sql
-- 检查是否有所有者 ID 不匹配的链接
SELECT COUNT(*) FROM links
WHERE owner_id IS NOT NULL
AND owner_id NOT IN (SELECT id FROM users);

-- 应该返回 0（没有孤立链接）
```

## 迁移详情

### 映射规则

#### Users 表

| MongoDB 字段 | PostgreSQL 字段 | 说明 |
|---|---|---|
| `_id` 或 `id` | `id` | 转换为 UUID（如果不是 UUID） |
| `email` | `email` | 字符串，必需 |
| `role` | `role` | 默认值: "user" |
| `createdAt` 或 `created_at` | `created_at` | 时间戳 |

#### Links 表

| MongoDB 字段 | PostgreSQL 字段 | 说明 |
|---|---|---|
| `slug` | `slug` | 小写，主键 |
| `url` | `url` | 验证为有效 URL |
| `owner`/`ownerId`/`owner_id` | `owner_id` | 使用用户映射 |
| `createdAt`/`created_at` | `created_at` | 时间戳 |
| `updatedAt`/`updated_at` | `updated_at` | 时间戳 |
| `visits`/`visit_count` | `visits` | 整数，默认 0 |
| `fingerprint` | `created_by_fingerprint` | 可选 |
| `isPublic`/`is_public` | `is_public` | 布尔值，默认 true |
| `metadata` | `metadata` | JSONB，可选 |

### 不迁移的内容

以下**不会被迁移**（需要手动处理或重新生成）：

- 📝 **Audit Logs** - 审计日志需要单独迁移
- 📊 **Daily Visits** - 日访问统计会在新的事件中重新生成
- 🔍 **Analytics Data** - Google Analytics 数据独立管理

## 故障排查

### 常见问题

#### 1. MongoDB 连接失败

```
❌ 错误: MongoNetworkError: ...
```

**解决方案**:
- 检查 `LEGACY_MONGO_DB_URL` 是否正确
- 确保 IP 地址在 MongoDB 白名单中
- 检查网络连接

#### 2. UUID 转换错误

```
❌ 错误迁移用户: UUID validation failed
```

**解决方案**:
- 脚本会自动为非 UUID ID 生成新 UUID
- 检查 MongoDB 中的 `_id` 字段格式

#### 3. 链接所有者不匹配

```
⚠️  警告: 无法找到所有者: xxx
```

**解决方案**:
- 一些链接的所有者 ID 在用户列表中不存在
- 这些链接会被设置为 `owner_id = NULL`（匿名）
- 这是正常的，如果有匿名链接的话

#### 4. 约束违反

```
❌ 错误迁移链接: violates unique constraint
```

**解决方案**:
- 某个 slug 已存在于目标数据库
- 运行 `TRUNCATE links;` 清空链接表
- 或者检查是否需要合并数据

## 迁移后操作

### 1. 更新应用配置

确保应用使用新的数据库：
```bash
# .env 应该包含
DATABASE_URL=postgresql://... # Supabase

# LEGACY_MONGO_DB_URL 现在是可选的
# 如果迁移完成，可以从 .env 中移除
```

### 2. 运行应用测试

```bash
npm run test
npm run build
npm run dev
```

### 3. 验证功能

- ✅ 用户登录
- ✅ 创建新链接
- ✅ 访问现有链接
- ✅ 编辑链接
- ✅ 查看链接统计

### 4. 监控生产环境

如果在生产环境迁移：
- 监控数据库错误
- 检查应用日志
- 监控链接点击
- 验证用户能够正常操作

## 回滚计划

如果迁移失败或出现问题：

### 选项 1: 恢复备份

```bash
# 如果您有之前的备份
pg_restore -d $DATABASE_URL < backup-before-migration-2026-02-10.sql
```

### 选项 2: 重新迁移

```bash
# 清空表
TRUNCATE links CASCADE;
TRUNCATE users CASCADE;

# 重新运行迁移
npm run migrate:legacy
```

## 脚本参考

### 可用命令

```bash
# 干运行（推荐首先运行）
npm run migrate:legacy:dry

# 实际迁移
npm run migrate:legacy

# 详细日志版本
npm run migrate:legacy:verbose

# 自定义选项
tsx scripts/migrate-from-legacy.ts [--dry-run] [--verbose]
```

## 相关文件

- [`scripts/migrate-from-legacy.ts`](../scripts/migrate-from-legacy.ts) - 迁移脚本源代码
- [`scripts/README.md`](../scripts/README.md) - 脚本详细文档
- [`src/db/schema.ts`](../src/db/schema.ts) - PostgreSQL Schema 定义
- [`.env`](./.env) - 环境变量配置

## 联系方式

如果在迁移过程中遇到问题：
1. 检查脚本日志中的错误信息
2. 查看 [`scripts/README.md`](../scripts/README.md) 中的故障排查部分
3. 备份数据库后重试迁移
4. 如果问题持续，考虑手动检查数据

---

**最后更新**: 2026-02-10
**作者**: AI Agent
**版本**: 1.0
