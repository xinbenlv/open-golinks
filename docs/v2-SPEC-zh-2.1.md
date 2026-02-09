# Open GoLinks v2 - 技术规范 2.1

**版本:** 2.1.0
**日期:** 2026-02-09
**状态:** 准备实施
**架构师:** 高级系统架构师
**模型:** Claude Opus 4.6

---

## 执行摘要

Open GoLinks v2 现代化了 URL 缩短服务,同时保留了"匿名创建"的理念。本规范定义了使用 2026 年稳定技术构建安全、可扩展系统的需求、验收标准和测试用例。**核心原则:** 零摩擦链接创建与渐进式安全(Turnstile + Rate Limiting + Claim Flow)。

---

## 1. 背景与遗留系统分析

### 1.1 核心理念

**匿名创建:** 无需认证的零摩擦链接创建。
- **保留:** 即时可用性,无入门门槛
- **解决:** 垃圾信息、所有权冲突、合规性问题

### 1.2 遗留功能对等(MongoDB + Express)

| 功能 | V2 策略 | 验收标准 |
|---------|-------------|---------------------|
| **匿名创建** | ✅ 保留并使用 Turnstile | 无认证的 POST 在有效 Turnstile token 时成功 |
| **Claim Flow** | ✅ 新增 | 已认证用户可以认领匿名链接(解决遗留痛点) |
| **冲突解决** | ✅ 新增 | 已认领的 slug 返回 409,认领成功返回 200 |
| **URL 历史** | ✅ 保留 | 所有 URL 更改记录在 `audit_logs` + `url_history` JSONB 中 |
| **更改历史(公开)** | ✅ 新增 | 公开的 `/history/{slug}` 页面,带有 IP 掩码规则 |
| **Rate Limiting** | ✅ Cloudflare WAF | 在边缘处理,无内部实现 |
| **Bot Protection** | ✅ Turnstile | 没有有效 Turnstile token 的匿名 POST 失败 |
| **边缘缓存** | ✅ 升级 | 全球重定向延迟 p95 < 100ms |
| **重定向警告** | ✅ 保留 | 每个链接可选,重定向前 5 秒倒计时 |
| **QR Code** | ✅ 保留 | GET `/api/v1/qr/{slug}` 返回 PNG/SVG |
| **自动创建 UX** | ✅ 保留 | 缺失的 slug 重定向到 `/edit/{slug}` |
| **Google Analytics** | ✅ 保留 | 跟踪重定向和创建事件 |
| **Dashboard** | ✅ 增强 | 用户统计、RegEx 过滤器、编辑按钮、分析图表 |
| **软删除** | ✅ 新增 | 链接所有者和管理员可删除链接,保留审计日志 |
| **公共搜索** | ✅ 新增 | 支持按公开/私有状态搜索链接 |
| **批量操作** | ✅ 新增 | 批量创建、删除、导出链接 |
| **链接转移** | ✅ 新增 | 所有者可转移链接所有权 |

---

## 2. 技术栈

| 层级 | 技术 | 版本 |
|-------|-----------|---------:|
| Framework | Next.js | 15.x (App Router) |
| Database | Supabase (Postgres) | 2.x |
| ORM | Drizzle ORM | 0.36+ |
| Auth | Supabase Auth | `@supabase/ssr` |
| Bot Protection | Cloudflare Turnstile | Latest |
| Rate Limiting | Cloudflare WAF | Latest |
| Analytics | Google Analytics | GA4 |
| Charts | Recharts / Chart.js | Latest |
| Testing | Vitest + Playwright + Storybook | Latest |
| Language | TypeScript | 5.x (strict) |

---

## 3. Slug 验证规则与保留字黑名单

### 3.1 Slug 格式规范

**验证标准:**

| 属性 | 规则 | 示例 |
|------|------|------|
| **最短长度** | 3 字符 | ✅ `abc` |
| **最大长度** | 50 字符 | ✅ `my-super-long-slug` |
| **允许字符** | 小写字母(a-z)、数字(0-9)、连字符(-) | ✅ `event-2024-fundraiser` |
| **首尾字符** | 必须是字母或数字,不能是连字符 | ❌ `-invalid`, ✅ `valid-slug` |
| **大小写规范化** | 输入时全部转换为小写 | 输入 `My-Slug` → 存储 `my-slug` |
| **连续连字符** | 不允许 `--` | ❌ `my--slug` |

**正则表达式验证:**
```regex
^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$
```

### 3.2 保留字黑名单

以下 slug 被系统保留,不允许用户创建:

```
# 系统路由
api, admin, dashboard, login, logout, register, profile, settings, edit, warn, history, stats, share, export, import, claim, transfer, delete, health

# Web 标准文件
favicon.ico, robots.txt, sitemap.xml, ads.txt, app.webmanifest, manifest.json

# 安全相关
.well-known, security.txt, _redirects, _headers

# 框架相关
next, vercel, __next, .env, .git, public, private, static, assets, uploads, media
```

---

## 4. URL 验证规则

### 4.1 有效 URL 标准

| 属性 | 规则 | 示例 |
|------|------|------|
| **协议** | 仅允许 `https://`、`ftp://` | ❌ `http://example.com`, ✅ `https://example.com` |
| **禁止协议** | 禁止 `javascript:`、`data:`、`file:` | ❌ `javascript:alert('xss')` |
| **本地地址** | 禁止 `localhost` 和私有 IP | ❌ `http://192.168.1.1` |
| **最大长度** | 2048 字符 | 符合 RFC 7231 |

**禁止的私有 IP 范围:**
- `127.0.0.0/8` (localhost)
- `192.168.0.0/16`、`10.0.0.0/8`、`172.16.0.0/12`、`169.254.0.0/16`

---

## 5. 功能需求

### 5.1 匿名链接创建

**需求:** 未认证用户可以在 bot protection 保护下创建链接。

**授权层级:**
- **匿名用户:** 需要 Turnstile,速率限制 5次/小时(基于 IP)
- **已认证用户:** Turnstile 可选,速率限制 50次/小时(基于用户)
- **管理员:** 无需 Turnstile,提升权限

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| POST `/api/v1/links` 无认证,无 Turnstile token | 403 Forbidden,错误码 `TURNSTILE_REQUIRED` |
| POST `/api/v1/links` 无认证,有效 Turnstile token | 201 Created,`owner_id = null` |
| POST `/api/v1/links` 无认证,无效 Turnstile token | 403 Forbidden,错误码 `TURNSTILE_INVALID` |
| POST `/api/v1/links` 1 小时内 6 次(匿名) | 第 6 次请求返回 429,带 `retry_after` 字段 |
| POST `/api/v1/links` 有效 JWT(已认证) | 201 Created,`owner_id = <user_uuid>` |
| 自动生成 slug(未指定) | 系统生成唯一的 slug,避免冲突 |

### 5.2 冲突解决与 Claim Flow

**并发安全:** 使用原子 SQL 防止并发冲突。Claim 操作: `UPDATE links SET owner_id = $1 WHERE slug = $2 AND owner_id IS NULL RETURNING *`

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| POST `/api/v1/links` 针对已存在的 slug(匿名 → 匿名) | 409 Conflict,带 `SLUG_CONFLICT` 错误 |
| POST `/api/v1/links/{slug}/claim` 针对匿名链接(已认证用户) | 200 OK,设置 `owner_id = user.id`,记录 CLAIM 操作 |
| 两个用户并发 claim 同一链接 | 仅一个成功(200),另一个返回 409 Conflict |

### 5.3 链接删除与软删除

**规则:**
- **软删除:** 在 `links` 表添加 `deleted_at` 时间戳
- **谁可删除:** 链接所有者和管理员
- **查询影响:** 列表查询默认排除已删除链接

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| DELETE `/api/v1/links/{slug}` 由所有者操作 | 200 OK,设置 `deleted_at` 时间戳,记录 DELETE 操作 |
| DELETE `/api/v1/links/{slug}` 由非所有者操作 | 403 Forbidden,带 `OWNERSHIP_REQUIRED` 错误 |
| GET `/api/v1/links?owner=me` 不返回已删除链接 | 查询不包含 `deleted_at IS NOT NULL` 的链接 |

### 5.4 链接所有权转移

**授权规则:**
- 链接所有者可转移其链接给任何已注册用户
- 管理员可将任何链接转移给任何用户
- 匿名链接不支持转移(应先 claim)

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| POST `/api/v1/links/{slug}/transfer` 由所有者操作 | 200 OK,转移所有权,记录 TRANSFER 操作 |
| POST `/api/v1/links/{slug}/transfer` 针对匿名链接 | 403 Forbidden,带 `ANONYMOUS_CANNOT_TRANSFER` 错误 |

### 5.5 链接解析与缓存

**缓存策略:**
- Cloudflare CDN: 5 分钟(静态资源、QR codes)
- Vercel Edge: 60 秒(链接解析)

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/{slug}` 针对存在的链接 | 302 重定向到目标 URL |
| GET `/{slug}` p95 延迟 | 全球 < 100ms |
| 重定向的 Cache-Control header | `s-maxage=60, stale-while-revalidate=300` |

### 5.6 重定向警告页面

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/warn/{slug}` 显示倒计时 | 5 秒倒计时器可见 |
| 警告页面显示目标 URL | 目标 URL 在 `<code>` 块中显示 |

### 5.7 QR Code 生成

**参数范围:**
- **Size:** 100 到 1200 像素(默认: 400)
- **Format:** PNG(默认) 或 SVG(推荐矢量格式)

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/api/v1/qr/{slug}?size=200&format=svg` | 返回 SVG QR code |
| Cache-Control header | `max-age=86400`(24 小时) |

### 5.8 更改历史(公开)

**历史可见性规则:**
- **匿名链接(未认领):** 显示掩码 IP 地址(`192.168.1.xxx`)
- **已认领链接:** 隐藏 IP 地址,显示"注册用户"

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/history/{slug}` 针对匿名链接 | 返回历史,显示掩码 IP |
| GET `/history/{slug}` 针对已认领链接 | 返回历史,不显示 IP 地址 |

### 5.9 公共链接搜索

**数据模型:** 在 `links` 表添加 `isPublic` boolean 字段(默认: true)

**规则:**
- 已认证用户可访问自己的所有链接
- 匿名用户仅访问 `isPublic=true` 的链接

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/api/v1/links?search=meet&public=true` | 返回公开链接匹配结果 |
| GET `/{slug}` 针对私有链接(未认证) | 返回 404 Not Found |

### 5.10 Analytics 与 Dashboard

**Dashboard 功能:**
1. Google Analytics 集成
2. 用户 Dashboard(查看和编辑链接)
3. RegEx 过滤器(按 slug 模式过滤)
4. Analytics 详情页(单个链接分析,30 天时间线)
5. 聚合 Analytics(过滤链接的组合分析)
6. 管理员 Dashboard(系统范围统计)

**访问计数策略:** 使用原子 UPSERT 防止竞态条件:
```sql
INSERT INTO daily_visits (link_slug, date, count)
VALUES ($1, DATE($2), 1)
ON CONFLICT (link_slug, date)
DO UPDATE SET count = count + 1
```

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/dashboard`(已认证) | 显示用户的链接表,包含 slug、URL、访问次数、编辑、删除按钮 |
| Dashboard RegEx 过滤器 | 文本输入接受 RegEx,提交时过滤表格 |
| GET `/api/v1/stats/me?filter=^event-.*` | 仅返回匹配 RegEx 模式的链接 |
| GET `/stats/{slug}`(详情页) | 显示单个链接分析:每日访问图表(30 天)、总访问次数 |

### 5.11 Batch 操作 API

**Endpoints:**

| Endpoint | 方法 | 用途 | 限制 |
|----------|------|------|------|
| `/api/v1/links/batch` | POST | 批量创建链接 | 单次最多 100 条 |
| `/api/v1/links/batch` | DELETE | 批量软删除链接 | 单次最多 100 条 |
| `/api/v1/links/export` | GET | 导出过滤链接 | 格式:csv 或 json |

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| POST `/api/v1/links/batch` 创建超过 100 条 | 返回 400,错误码 `BATCH_SIZE_EXCEEDED` |
| GET `/api/v1/links/export?format=csv` | 返回 CSV 文件 |
| GET `/api/v1/links/export?format=json&filter=^event-.*` | 返回过滤的 JSON 数组 |

### 5.12 Health Check Endpoint

**Endpoint:** `GET /api/v1/health`

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/api/v1/health` | 返回 200 OK 和版本号 |
| 无认证要求 | 任何请求都可访问 |
| 数据库连接失败 | 返回 503 Service Unavailable |

---

## 6. 数据库 Schema

**表:** `links`, `audit_logs`, `users`, `daily_visits`

### 6.1 Links 表

| 字段 | 类型 | 约束 | 用途 |
|-------|------|-------------|---------|
| `slug` | varchar(50) | PRIMARY KEY | 唯一标识符 |
| `url` | text | NOT NULL | 目标 URL |
| `owner_id` | uuid | FK → users.id, nullable | 所有者(null = 匿名) |
| `created_at` | timestamp | NOT NULL, default now() | 创建时间 |
| `updated_at` | timestamp | NOT NULL, default now() | 最后更新时间 |
| `deleted_at` | timestamp | nullable | 软删除时间戳 |
| `visits` | integer | NOT NULL, default 0 | 访问计数器 |
| `created_by_fingerprint` | varchar(64) | nullable | SHA-256 hash,用于匿名跟踪 |
| `isPublic` | boolean | NOT NULL, default true | 公开/私有状态 |
| `url_history` | jsonb | default [] | `{url, changed_at, changed_by}` 数组 |
| `metadata` | jsonb | nullable | `{title?, description?, tags[], show_warning?}` |

**索引:**
- `PRIMARY KEY (slug)`
- `INDEX (owner_id)`, `INDEX (created_at)`, `INDEX (deleted_at)`, `INDEX (isPublic)`

**CHECK 约束:**
```sql
CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$')
```

### 6.2 Audit Logs 表

| 字段 | 类型 | 用途 |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY |
| `link_slug` | varchar(50) | FK → links.slug (SET NULL, not CASCADE) |
| `actor_id` | uuid | FK → users.id (nullable) |
| `actor_fingerprint` | varchar(64) | SHA-256 hash(匿名) |
| `actor_ip_hash` | varchar(64) | SHA-256(IP + salt) |
| `action` | varchar(50) | CREATE, UPDATE, DELETE, CLAIM, VISIT, TRANSFER |
| `diff` | jsonb | `{before?, after?, changes[]}` |
| `metadata` | jsonb | `{user_agent?, turnstile_validated?, from_owner_id?, to_owner_id?}` |
| `timestamp` | timestamp | NOT NULL, default now() |

### 6.3 Users 表

| 字段 | 类型 | 用途 |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY(匹配 Supabase auth.users.id) |
| `email` | varchar(255) | NOT NULL, unique |
| `role` | varchar(20) | `user` 或 `admin` |
| `created_at` | timestamp | NOT NULL |

### 6.4 Daily Visits 表(Analytics)

| 字段 | 类型 | 用途 |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY |
| `link_slug` | varchar(50) | FK → links.slug (CASCADE) |
| `date` | date | 访问日期(UTC) |
| `count` | integer | 该日期的访问次数 |

**索引:** `UNIQUE (link_slug, date)`

---

## 7. API 契约(Extension-First 设计)

所有 endpoint 使用 `/api/v1` 前缀。

### 7.1 错误响应规范化

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "slug",
      "constraint": "reserved_slug"
    }
  }
}
```

**错误码枚举:**

| 错误码 | HTTP 状态 | 场景 |
|--------|----------|------|
| `TURNSTILE_REQUIRED` | 403 | 匿名用户未提供 Turnstile token |
| `TURNSTILE_INVALID` | 403 | Turnstile token 验证失败 |
| `SLUG_CONFLICT` | 409 | Slug 已存在 |
| `SLUG_RESERVED` | 400 | Slug 在保留字黑名单中 |
| `URL_INVALID` | 400 | URL 验证失败 |
| `ALREADY_OWNED` | 403 | 尝试 claim 已拥有的链接 |
| `OWNERSHIP_REQUIRED` | 403 | 操作需要链接所有权 |
| `INVALID_REGEX` | 400 | RegEx 模式无效 |
| `BATCH_SIZE_EXCEEDED` | 400 | 批量操作超过限制 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超过速率限制 |

### 7.2 核心 Endpoints

#### POST `/api/v1/links` - 创建/更新链接

**请求:**
```json
{
  "slug": "meet",
  "url": "https://zoom.us/j/123",
  "turnstile_token": "<token>",
  "isPublic": true,
  "metadata": { "title": "Meeting", "tags": ["work"] }
}
```

**响应:** `201 Created` 或错误

#### GET `/api/v1/resolve?slug={slug}` - 解析链接

**响应:** `200 OK` 或 `404 Not Found`

#### POST `/api/v1/links/{slug}/claim` - 认领匿名链接

**认证:** 必需

**响应:** `200 OK` 或错误

#### PUT `/api/v1/links/{slug}` - 更新链接

**认证:** 必需(必须为所有者或管理员)

**响应:** `200 OK` 或错误

#### DELETE `/api/v1/links/{slug}` - 删除链接(软删除)

**认证:** 必需(必须为所有者或管理员)

**响应:** `200 OK` 或错误

#### POST `/api/v1/links/{slug}/transfer` - 转移链接所有权

**认证:** 必需

**请求:**
```json
{
  "new_owner_id": "user-uuid"
}
```

**响应:** `200 OK` 或错误

#### GET `/api/v1/links?owner=me&limit=50&offset=0` - 列出用户链接

**认证:** 必需

**查询参数:** `owner`, `search`, `public`, `limit`, `offset`

**响应:** `{links: [], total, limit, offset}`

#### POST `/api/v1/links/batch` - 批量创建链接

**认证:** 必需

**限制:** 单次最多 100 条

**响应:** `201 Created` 或 `400 Bad Request`

#### DELETE `/api/v1/links/batch` - 批量删除链接

**认证:** 必需

**限制:** 单次最多 100 条

**响应:** `200 OK`

#### GET `/api/v1/links/export?format=csv|json&filter=...` - 导出链接

**认证:** 必需

**查询参数:** `format`, `filter`

**响应:** CSV 文件或 JSON 数组

#### GET `/api/v1/audit/{slug}` - 审计日志检索

**认证:** 必需(所有者或管理员)

**查询参数:** `action`, `limit`

**响应:** `{slug, logs: [...]}`

#### GET `/api/v1/qr/{slug}?size=400&format=png` - QR Code

**查询参数:** `size` (100-1200), `format` (png|svg)

**响应:** 二进制图像

#### GET `/api/v1/links/{slug}/history` - 更改历史

**认证:** 可选(公开)

**响应:** `{slug, history: [...]}`

#### GET `/api/v1/stats/me?filter={regex}` - 用户统计

**认证:** 必需

**查询参数:** `filter`

**响应:** `{total_links, total_visits, links: [...]}`

#### GET `/api/v1/stats/links/{slug}` - 链接分析详情

**认证:** 必需(所有者或管理员)

**响应:** `{slug, total_visits, daily_visits: [...]}`

#### GET `/api/v1/stats/global` - 全局统计

**认证:** 必需(仅管理员)

**响应:** `{total_users, total_links, total_visits, top_links: [...]}`

#### GET `/api/v1/health` - 健康检查

**认证:** 不需要

**响应:** `{status, version, timestamp}`

### 7.3 安全 Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000`
- CORS: 允许 `chrome-extension://` origins

---

## 8. Race Condition 防护

### 8.1 并发 Slug 创建

**解决方案:**
1. 数据库层: PRIMARY KEY 约束防止重复
2. 应用层: 捕获 duplicate key 错误,返回 409 Conflict
3. 建议: 不指定 slug 时,系统自动生成唯一值

### 8.2 并发 Claim

**解决方案:** 使用原子 UPDATE 操作。

```sql
UPDATE links
SET owner_id = $1
WHERE slug = $2 AND owner_id IS NULL
RETURNING *;
```

仅一个 claim 操作成功,失败的返回 409 Conflict。

### 8.3 并发访问计数

**解决方案:** 使用原子 UPSERT。

```sql
INSERT INTO daily_visits (link_slug, date, count)
VALUES ($1, CURRENT_DATE, 1)
ON CONFLICT (link_slug, date)
DO UPDATE SET count = count + 1
RETURNING *;
```

---

## 9. 数据迁移策略(v1 → v2)

### 9.1 迁移流程

**Phase 1: 准备(第 1-2 周)**
1. 配置 Supabase Postgres 项目
2. 创建 Drizzle schema 和表结构
3. 设置测试环境,生成迁移脚本
4. 备份 MongoDB 完整数据

**Phase 2: 执行(维护窗口 2-4 小时)**
1. 冻结 v1 新请求
2. 从 MongoDB 提取所有链接、用户、访问记录
3. 数据格式转换:
   - MongoDB `_id` → Postgres `owner_id` (uuid)
   - MongoDB `url_changes` → `audit_logs` + `url_history`
   - MongoDB `visits` → Postgres `visits` + `daily_visits` 汇总
   - 匿名链接: 生成 `created_by_fingerprint`
4. 验证数据完整性
5. 启动 v2,验证所有链接可正常访问
6. 保留 v1 实例 24 小时(紧急回滚)

**Phase 3: 后续(第 3-4 周)**
1. v1 分析历史存档至 S3
2. Google Analytics 继续跟踪
3. 监控 v2 性能和错误

### 9.2 验证清单

迁移完成后验证:

- [ ] 所有 links 已成功迁移(计数匹配)
- [ ] 所有 users 已成功迁移
- [ ] audit_logs 完整
- [ ] daily_visits 汇总正确
- [ ] 匿名链接的 created_by_fingerprint 已填充
- [ ] 已认领链接的 owner_id 正确映射
- [ ] soft delete 字段初始化为 null
- [ ] isPublic 默认设置为 true
- [ ] 随机抽样验证 20 个链接的重定向功能

---

## 10. 测试策略

### 10.1 测试技术栈

| 类型 | Framework | 用途 |
|------|-----------|---------|
| **单元测试** | Vitest | 独立函数、工具、验证逻辑 |
| **集成测试** | Vitest + Drizzle | API endpoints、数据库事务 |
| **组件测试** | Storybook | UI 组件隔离、视觉测试 |
| **E2E 测试** | Playwright | 完整用户旅程、浏览器交互 |

### 10.2 单元测试(Vitest)

- **URL 验证:** 无效 URL 被拒绝,有效 URL 通过
- **Slug 验证:** 格式规范、保留字检查、大小写规范化
- **Slug 冲突:** 并发冲突处理
- **指纹哈希:** SHA-256 hash 生成一致性
- **IP 掩码:** IP 地址被正确掩码
- **缓存 Header:** 为不同资源类型生成正确的 headers

### 10.3 集成测试(Vitest)

- **链接创建与 Turnstile 保护**
- **Claim Flow 与并发安全**
- **删除与软删除**
- **链接转移**
- **更改历史与 IP 掩码**
- **Dashboard 统计与 RegEx 过滤**
- **Batch 操作**
- **Health Check**

### 10.4 组件测试(Storybook)

- **Dashboard 链接表组件**
- **RegEx 过滤器输入组件**
- **Analytics 时间序列图表**
- **链接创建表单组件**
- **更改历史时间线组件**
- **视觉回归测试** (Chromatic)

### 10.5 E2E 测试(Playwright)

- **匿名链接创建流程**
- **已认证链接创建与认领**
- **链接重定向解析**
- **重定向警告页面**
- **更改历史页面(公开访问)**
- **用户 Dashboard**
- **Google Analytics 集成**
- **QR Code 生成**
- **Chrome Extension 集成**

### 10.6 CI/CD Pipeline

1. Lint & Type Check(ESLint + TypeScript)
2. 单元测试(Vitest)
3. 集成测试(Vitest,带测试数据库)
4. 组件测试(Storybook + Chromatic)
5. E2E 测试(Playwright,无头模式)
6. 覆盖率报告(强制最低 80% 阈值)

---

## 11. 安全与合规

### 11.1 Bot Protection

**Turnstile:** Cloudflare CAPTCHA 替代方案
- 匿名链接创建必需
- 已认证用户可选
- 服务器端验证

### 11.2 Rate Limiting

**策略:** Cloudflare WAF 处理所有速率限制

**推荐的 Cloudflare 规则:**

| 用户类型 | 限制 | 窗口 |
|---------|------|--------|
| 匿名创建 | 5 个请求 | 1 小时 |
| 已认证创建 | 50 个请求 | 1 小时 |
| 解析 | 100 个请求 | 1 分钟 |

### 11.3 GDPR 合规

**数据最小化:**
- 匿名: 仅 SHA-256 指纹
- 已认证: Email、user_id

**用户权利:**
- **访问:** `GET /api/v1/users/me/data`
- **删除:** `DELETE /api/v1/users/me`

### 11.4 安全 Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy: default-src 'self'; script-src 'self' https:; img-src 'self' data: https:; frame-src 'self' https://challenges.cloudflare.com`

---

## 12. 实施阶段

### 阶段 1: 基础(第 1-2 周)
- Next.js 15 + TypeScript 设置
- Supabase + Drizzle schema
- Supabase Auth 集成
- 单元测试(Vitest)

### 阶段 2: 核心 API(第 3-4 周)
- 所有 API endpoints
- Turnstile 验证
- 审计日志与 IP 掩码
- Race Condition 防护
- 集成测试(Vitest)

### 阶段 3: Web UI(第 5-6 周)
- 链接创建表单
- Dashboard 与 RegEx 过滤
- Analytics 图表与历史页面
- QR Code、Google Analytics
- 组件与 E2E 测试

### 阶段 4: Extension(第 7-8 周)
- Chrome Extension MV3
- Omnibox 集成
- Extension E2E 测试

### 阶段 5: 数据迁移(第 9 周)
- v1 → v2 数据迁移
- 数据验证与回滚计划

### 阶段 6: 生产(第 10-11 周)
- 负载测试与优化
- 安全审计
- 监控(Sentry, Vercel Analytics)
- 完整回归套件

---

## 13. 成功指标

### 技术 KPIs
- **可用性:** 99.9% 正常运行时间
- **延迟:** p95 < 100ms
- **测试覆盖率:** > 80%
- **滥用率:** < 1% 标记的链接

### 用户指标
- **采用率:** 1000+ 链接(第 1 个月)
- **留存率:** 50% 创建 2+ 链接
- **认领率:** 7 天内 > 30%

---

## 结论

**核心创新:**
1. Turnstile 保护的匿名创建
2. Claim Flow(解决遗留所有权问题)
3. 公开更改历史(IP 掩码实现透明度与隐私)
4. 增强的 Analytics Dashboard(RegEx 过滤、时间序列图表)
5. Google Analytics 集成
6. Cloudflare Rate Limiting(边缘级保护)
7. 软删除与所有权转移(灵活的链接管理)
8. 全面测试(Vitest + Playwright + Storybook)
9. Race Condition 防护(原子操作保证数据一致性)
10. 数据迁移计划(平稳过渡 v1 → v2)

**关键依赖:**
- **外部:** Cloudflare(WAF + Turnstile)、Google Analytics GA4、Chromatic
- **内部:** Next.js 15、Supabase(Postgres + Auth)、Drizzle ORM、Recharts/Chart.js
- **测试:** Vitest、Storybook、Playwright

---

**文档版本:** 2.1.0
**最后更新:** 2026-02-09
**状态:** 准备实施

**审查反馈整合清单:**
- ✅ Slug 验证规则与保留字黑名单
- ✅ URL 验证规则定义
- ✅ Race Condition 防护说明
- ✅ 删除 Endpoint 和软删除策略
- ✅ 链接转移功能
- ✅ 公共搜索功能(isPublic 字段)
- ✅ Batch 操作 API
- ✅ Health Check Endpoint
- ✅ QR Code 参数优化(100-1200px, SVG)
- ✅ 错误响应规范化
- ✅ 访问计数原子操作说明
- ✅ 数据迁移策略
- ✅ Race Condition 防护详细说明
