# Open GoLinks v2 - 技术规范

**版本:** 2.0.0
**日期:** 2026-02-06
**状态:** 草稿
**架构师:** 高级系统架构师
**模型:** Claude Opus 4.6

---

## 执行摘要

Open GoLinks v2 现代化了 URL 缩短服务,同时保留了"匿名创建"的理念。本规范定义了使用 2026 年稳定技术构建安全、可扩展系统的需求、验收标准和测试用例。

**核心原则:** 零摩擦链接创建与渐进式安全(Turnstile + Rate Limiting + Claim Flow)。

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

---

## 2. 技术栈

| 层级 | 技术 | 版本 |
|-------|-----------|---------|
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

## 3. 功能需求

### 3.1 匿名链接创建

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
| POST `/api/v1/links` 1 小时内 51 次(已认证) | 第 51 次请求返回 429 |
| 匿名链接创建记录 `created_by_fingerprint` | 审计日志包含 SHA-256 hash,非原始 IP |
| 匿名链接创建时 URL 格式无效 | 400 Bad Request,带验证错误 |

### 3.2 冲突解决与 Claim Flow

**需求:** 当 slug 已存在时进行显式冲突处理。

**规则:**
- 匿名链接(owner_id = null)可以被已认证用户认领
- 拥有所有权的链接未经许可不能被覆盖
- 为冲突场景返回清晰的错误码

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| POST `/api/v1/links` 针对已存在的 slug(匿名 → 匿名) | 409 Conflict,带 `SLUG_CONFLICT` 错误 |
| POST `/api/v1/links/{slug}/claim` 针对匿名链接(已认证用户) | 200 OK,设置 `owner_id = user.id`,记录 CLAIM 操作 |
| POST `/api/v1/links/{slug}/claim` 针对已拥有的链接 | 403 Forbidden,带 `ALREADY_OWNED` 错误 |
| PUT `/api/v1/links/{slug}` 由所有者操作 | 200 OK,更新 URL,记录 UPDATE 操作及差异 |
| PUT `/api/v1/links/{slug}` 由非所有者操作 | 403 Forbidden,带 `OWNERSHIP_REQUIRED` 错误 |
| POST `/api/v1/links/{slug}/claim` 针对不存在的 slug | 404 Not Found |
| Claim 更新 `url_history` JSONB 数组 | 旧 URL 附加到 `url_history`,带时间戳 |

### 3.3 链接解析与缓存

**需求:** 快速、全球分布的重定向解析,带边缘缓存。

**缓存策略:**
- Cloudflare CDN: 5 分钟(静态资源、QR codes)
- Vercel Edge: 60 秒(链接解析)
- Database: Postgres,带连接池

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/{slug}` 针对存在的链接 | 302 重定向到目标 URL |
| GET `/{slug}` 针对不存在的 slug | 302 重定向到 `/edit/{slug}`(自动创建 UX) |
| GET `/{slug}` 增加访问计数 | 数据库 `visits` 字段增加 1(异步) |
| GET `/{slug}` 当 `show_warning: true` | 10% 概率重定向到 `/warn/{slug}` |
| GET `/api/v1/resolve?slug={slug}` | 200 JSON 响应,包含 `{slug, url, metadata}` |
| GET `/{slug}` p95 延迟 | 全球 < 100ms |
| 重定向的 Cache-Control header | `s-maxage=60, stale-while-revalidate=300` |

### 3.4 重定向警告页面

**需求:** 可选的钓鱼保护,在外部重定向前倒计时。

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/warn/{slug}` 显示倒计时 | 5 秒倒计时器可见 |
| 警告页面显示目标 URL | 目标 URL 在 `<code>` 块中显示 |
| "立即前往"按钮绕过倒计时 | 立即重定向到目标 |
| "取消"按钮返回主页 | 重定向到 `/` |
| 倒计时达到 0 | 自动重定向到目标 URL |

### 3.5 QR Code 生成

**需求:** 为 go-links 生成 QR codes,带自定义选项。

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/api/v1/qr/{slug}` | 返回 PNG QR code(默认 400x400px) |
| GET `/api/v1/qr/{slug}?size=200` | 返回 200x200px PNG |
| GET `/api/v1/qr/{slug}?format=svg` | 返回 SVG QR code |
| GET `/api/v1/qr/{non-existent}` | 404 Not Found |
| QR code 扫描到正确 URL | 移动扫描器重定向到 `/{slug}` |
| Cache-Control header | `max-age=86400`(24 小时) |

### 3.6 更改历史(公开)

**需求:** 任何用户(无需登录)都可以查看链接的更改历史。

**历史可见性规则:**
- **匿名链接(未认领):** 在历史中显示 IP 地址
- **已认领链接:** 在历史中隐藏 IP 地址和所有权详情
- 显示所有 URL 更改及时间戳
- 显示创建时间戳和所有更新时间戳

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| GET `/history/{slug}` 针对匿名链接 | 返回历史,显示 IP 地址(最后 3 个八位组掩码:`192.168.1.xxx`) |
| GET `/history/{slug}` 针对已认领链接 | 返回历史,不显示 IP 地址,显示"注册用户" |
| 历史显示创建时间戳 | 第一条记录显示 `created_at`,操作为"Created" |
| 历史显示所有 URL 更改 | 每次更新显示旧 URL → 新 URL,带时间戳 |
| GET `/api/v1/links/{slug}/history`(API) | 返回历史记录的 JSON 数组 |
| 匿名链接后来被认领 | 认领前的历史显示 IP,认领后的历史隐藏 IP |
| 历史按时间戳排序 | 最近的更改首先显示(DESC 顺序) |

**历史记录格式:**
```json
{
  "action": "CREATE | UPDATE | CLAIM",
  "timestamp": "2026-02-06T12:00:00Z",
  "old_url": null,
  "new_url": "https://example.com",
  "actor": {
    "type": "anonymous | user",
    "display": "192.168.1.xxx" | "user@example.com" | "Registered User"
  }
}
```

### 3.7 Analytics 与 Dashboard

**需求:** 使用 Google Analytics 跟踪链接使用情况,并提供带 RegEx 过滤的内部 dashboard。

**Dashboard 功能:**
1. **Google Analytics 集成:** 跟踪重定向/创建事件
2. **用户 Dashboard:** 查看和编辑个人链接及统计数据
3. **RegEx 过滤器:** 按 slug 模式过滤链接以进行活动分析
4. **Analytics 详情页:** 单个链接分析,带时间序列图表
5. **聚合 Analytics:** 过滤链接的组合分析
6. **管理员 Dashboard:** 系统范围统计

**用例 - RegEx 过滤:**
> 非营利组织举办多个活动,使用命名约定:
> - `event-2024-fundraiser`, `event-2024-conference`, `event-2025-workshop`
> - 过滤器: `^event-2024-.*` 查看所有 2024 年活动
> - 查看: 单个 + 累计分析,带时间线图表

**验收标准:**

| 场景 | 预期结果 |
|----------|-----------------|
| 重定向触发 GA 事件 | Google Analytics 接收 `event: redirect, slug: {slug}` |
| GET `/dashboard`(已认证) | 显示用户的链接表,包含 slug、URL、访问次数、编辑按钮 |
| Dashboard 显示总访问次数 | 用户拥有的所有链接的访问次数总和 |
| Dashboard 显示每个链接的访问次数 | 每个链接显示单独的访问计数 |
| 在 dashboard 上点击"编辑"按钮 | 导航到 `/edit/{slug}`,表单预填充 |
| 在 dashboard 上点击链接 slug | 导航到 `/stats/{slug}`(分析详情页) |
| GET `/api/v1/stats/me`(API) | 返回 `{total_links, total_visits, links: [{slug, url, visits}]}` |
| GET `/api/v1/stats/me?filter=^event-.*` | 仅返回匹配 RegEx 模式的链接 |
| Dashboard RegEx 过滤器输入 | 文本输入接受 RegEx,提交时过滤表格 |
| 无效的 RegEx 模式 | 显示错误消息"Invalid regular expression" |
| 过滤链接显示聚合统计 | 过滤结果的总访问次数和总链接数 |
| GET `/stats/{slug}`(详情页) | 显示单个链接分析:每日访问图表(30 天)、总访问次数、创建日期 |
| Analytics 图表显示时间线 | 折线图,X 轴:日期,Y 轴:访问次数 |
| GET `/api/v1/stats/links/{slug}`(API) | 返回 `{slug, total_visits, daily_visits: [{date, count}]}` |
| 过滤链接聚合图表 | 所有过滤链接的组合时间线图表 |
| GET `/admin/dashboard`(仅管理员) | 显示系统范围统计(总用户数、链接数、访问次数) |
| GET `/api/v1/stats/global`(管理员) | 返回 `{total_users, total_links, total_visits, top_links}` |
| 未认证用户访问 dashboard | 重定向到 `/login` |

**Dashboard UI 组件:**

```typescript
// User Dashboard Table
interface DashboardLink {
  slug: string;
  url: string;
  visits: number;
  created_at: string;
  actions: {
    edit: () => void;      // Navigate to /edit/{slug}
    analytics: () => void; // Navigate to /stats/{slug}
  };
}

// RegEx Filter
interface FilterState {
  pattern: string;        // User input RegEx
  isValid: boolean;       // Pattern validation
  matchCount: number;     // Number of matching links
}

// Analytics Chart Data
interface AnalyticsData {
  slug: string;
  total_visits: number;
  daily_visits: Array<{
    date: string;          // ISO format: "2026-02-06"
    count: number;
  }>;
}
```

**Google Analytics 事件:**
```javascript
// On redirect
gtag('event', 'link_redirect', {
  'slug': 'meet',
  'destination_domain': 'zoom.us'
});

// On link creation
gtag('event', 'link_create', {
  'slug': 'meet',
  'user_type': 'anonymous' | 'authenticated'
});
```

---

## 4. 数据库 Schema

**表:** `links`, `audit_logs`, `users`, `daily_visits`

### 4.1 Links 表

| 字段 | 类型 | 约束 | 用途 |
|-------|------|-------------|---------|
| `slug` | varchar(100) | PRIMARY KEY | 唯一标识符 |
| `url` | text | NOT NULL | 目标 URL |
| `owner_id` | uuid | FK → users.id, nullable | 所有者(null = 匿名) |
| `created_at` | timestamp | NOT NULL, default now() | 创建时间 |
| `updated_at` | timestamp | NOT NULL, default now() | 最后更新时间 |
| `visits` | integer | NOT NULL, default 0 | 访问计数器 |
| `created_by_fingerprint` | varchar(64) | nullable | SHA-256 hash,用于匿名跟踪 |
| `url_history` | jsonb | default [] | `{url, changed_at, changed_by}` 数组 |
| `metadata` | jsonb | nullable | `{title?, description?, tags[], show_warning?}` |

**索引:** `owner_id`, `created_at`, `created_by_fingerprint`

### 4.2 Audit Logs 表

| 字段 | 类型 | 用途 |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY |
| `link_slug` | varchar(100) | FK → links.slug (CASCADE) |
| `actor_id` | uuid | FK → users.id (nullable) |
| `actor_fingerprint` | varchar(64) | SHA-256 hash(匿名) |
| `actor_ip_hash` | varchar(64) | SHA-256(IP + salt) |
| `action` | varchar(50) | CREATE, UPDATE, DELETE, CLAIM, VISIT |
| `diff` | jsonb | `{before?, after?, changes[]}` |
| `metadata` | jsonb | `{user_agent?, referer?, turnstile_validated?}` |
| `timestamp` | timestamp | NOT NULL, default now() |

**索引:** `link_slug`, `actor_id`, `timestamp`, `actor_fingerprint`

### 4.3 Users 表

| 字段 | 类型 | 用途 |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY(匹配 Supabase auth.users.id) |
| `email` | varchar(255) | NOT NULL, unique |
| `role` | varchar(20) | `user` 或 `admin` |
| `created_at` | timestamp | NOT NULL |

### 4.4 Daily Visits 表(Analytics)

| 字段 | 类型 | 用途 |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY |
| `link_slug` | varchar(100) | FK → links.slug (CASCADE) |
| `date` | date | 访问日期(UTC,仅日期) |
| `count` | integer | 该日期的访问次数 |

**索引:** `(link_slug, date)` UNIQUE - 防止每个链接的重复日期条目

**聚合:**
- 每日访问计数预先聚合以提高性能
- 后台任务为每次重定向增加 `count`
- 查询速度快(无需 COUNT audit_logs)

**注意:** Rate limiting 由 Cloudflare WAF 处理,因此不需要 `rate_limits` 表。

---

## 5. API 契约(Extension-First 设计)

所有 endpoint 使用 `/api/v1` 前缀进行版本控制。兼容 Chrome Extension MV3。

### 5.1 核心 Endpoints

#### POST `/api/v1/links` - 创建/更新链接

**请求:**
```json
{
  "slug": "meet",
  "url": "https://zoom.us/j/123",
  "turnstile_token": "<token>", // Required if unauthenticated
  "metadata": { "title": "Meeting", "tags": ["work"] }
}
```

**响应:**
- `201` Created: `{slug, url, owner_id, created_at, claim_url?}`
- `400` Bad Request: 无效的 URL 或 slug 格式
- `403` Forbidden: 缺失/无效的 Turnstile token
- `409` Conflict: Slug 已存在(包含 `suggestion` 字段)
- `429` Too Many Requests: 超过速率限制(包含 `retry_after`)

#### GET `/api/v1/resolve?slug={slug}` - 解析链接

**响应:**
- `200` OK: `{slug, url, metadata: {title, visits}}`
- `404` Not Found: `{error: "SLUG_NOT_FOUND", slug}`
- `429` Too Many Requests

#### POST `/api/v1/links/{slug}/claim` - 认领匿名链接

**认证:** 必需(Bearer token)

**响应:**
- `200` OK: `{slug, previous_owner_id, new_owner_id, claimed_at}`
- `403` Forbidden: `ALREADY_OWNED` 或 `OWNERSHIP_REQUIRED`
- `404` Not Found

#### GET `/api/v1/links?owner=me&limit=50&offset=0` - 列出用户链接

**认证:** 必需

**响应:** `{links: [], total, limit, offset}`

#### GET `/api/v1/audit/{slug}` - 审计日志检索

**认证:** 必需(所有者或管理员)

**响应:** `{slug, logs: [{id, action, actor_id, timestamp, diff}]}`

#### GET `/api/v1/qr/{slug}?size=400&format=png` - QR Code

**Query 参数:**
- `size`: 200-2000(默认: 400)
- `format`: png | svg(默认: png)

**响应:**
- `200` OK: 二进制图像(PNG/SVG)
- `404` Not Found

#### GET `/api/v1/links/{slug}/history` - 更改历史

**认证:** 可选(公开 endpoint)

**响应:**
```json
{
  "slug": "meet",
  "history": [
    {
      "action": "UPDATE",
      "timestamp": "2026-02-06T14:00:00Z",
      "old_url": "https://zoom.us/j/123",
      "new_url": "https://zoom.us/j/456",
      "actor": {
        "type": "user",
        "display": "Registered User"
      }
    },
    {
      "action": "CLAIM",
      "timestamp": "2026-02-06T13:00:00Z",
      "actor": {
        "type": "user",
        "display": "user@example.com"
      }
    },
    {
      "action": "CREATE",
      "timestamp": "2026-02-06T12:00:00Z",
      "new_url": "https://zoom.us/j/123",
      "actor": {
        "type": "anonymous",
        "display": "192.168.1.xxx"
      }
    }
  ]
}
```

**IP 掩码规则:**
- 未认领链接: 显示掩码 IP(`192.168.1.xxx`)
- 已认领链接: 隐藏 IP,显示"注册用户"或 email(如果用户查看自己的链接)

#### GET `/api/v1/stats/me?filter={regex}` - 用户统计

**认证:** 必需

**Query 参数:**
- `filter`: 可选的 RegEx 模式(例如,`^event-.*`)

**响应:**
```json
{
  "total_links": 5,
  "total_visits": 142,
  "filter_applied": "^event-.*",
  "links": [
    {
      "slug": "meet",
      "url": "https://zoom.us/j/123",
      "visits": 42,
      "created_at": "2026-02-06T12:00:00Z"
    }
  ]
}
```

**错误:**
- `400` Bad Request: 无效的 RegEx 模式

#### GET `/api/v1/stats/links/{slug}` - 链接分析详情

**认证:** 必需(所有者或管理员)

**响应:**
```json
{
  "slug": "meet",
  "url": "https://zoom.us/j/123",
  "total_visits": 142,
  "created_at": "2026-02-06T12:00:00Z",
  "daily_visits": [
    {"date": "2026-02-06", "count": 15},
    {"date": "2026-02-05", "count": 23},
    {"date": "2026-02-04", "count": 18}
  ]
}
```

**响应:**
- `200` OK: Analytics 数据
- `403` Forbidden: 非所有者或管理员
- `404` Not Found: 链接不存在

#### GET `/api/v1/stats/global` - 全局统计

**认证:** 必需(仅管理员)

**响应:**
```json
{
  "total_users": 50,
  "total_links": 200,
  "total_visits": 5000,
  "top_links": [
    {"slug": "meet", "visits": 500},
    {"slug": "docs", "visits": 350}
  ]
}
```

### 5.2 安全 Headers

**CORS:** 允许 `chrome-extension://` origins
**Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS`


---

## 6. 测试策略

### 6.1 测试技术栈

| 类型 | Framework | 用途 |
|------|-----------|---------|
| **单元测试** | Vitest | 独立函数、工具、验证逻辑 |
| **集成测试** | Vitest + Drizzle | API endpoints、数据库事务、认证流程 |
| **组件测试** | Storybook | UI 组件隔离、视觉测试、交互测试 |
| **E2E 测试** | Playwright | 完整用户旅程、浏览器交互、extension |

### 6.2 单元测试(Vitest)

**验证策略:**

使用快速、确定性的测试测试隔离的函数和工具:

- **URL 验证:** 通过单元测试验证无效 URL 被拒绝,有效 URL 通过
- **Turnstile 验证:** 使用模拟 API 响应隔离测试 token 验证逻辑
- **Slug 清理:** 验证特殊字符、空格和无效模式得到正确处理
- **指纹哈希:** 确认 SHA-256 hash 生成产生一致的 64 字符十六进制字符串
- **IP 掩码:** 测试 IP 地址被掩码以仅显示前几个八位组(例如,`192.168.1.xxx`)
- **缓存 Header 生成:** 验证为不同资源类型生成正确的 cache-control headers

### 6.3 集成测试(Vitest)

**验证策略:**

针对隔离测试数据库使用真实数据库事务测试 API endpoints:

**链接创建与 Turnstile 保护:**
- 验证没有 Turnstile token 的 POST 返回 403,带 `TURNSTILE_REQUIRED` 错误
- 验证有效 Turnstile 的 POST 创建匿名链接(owner_id = null)
- 验证匿名创建将 SHA-256 指纹写入 audit_logs 表

**Claim Flow:**
- 验证已认证用户可以认领匿名链接并更新 owner_id
- 验证尝试认领已拥有的链接返回 403,带 `ALREADY_OWNED` 错误

**更改历史 API:**
- 验证匿名链接的历史 endpoint 返回掩码 IP 地址
- 验证已认领链接的历史 endpoint 隐藏 IP 地址
- 验证历史条目按时间戳排序(最新优先)

**Dashboard 统计 API:**
- 验证 `/api/v1/stats/me` 返回正确的 total_links、total_visits 和 links 数组
- 验证 RegEx 过滤器参数正确过滤链接(例如,`^event-2024-.*` 仅匹配匹配的 slugs)
- 验证无效的 RegEx 模式返回 400,带验证错误消息

**链接分析 API:**
- 验证 `/api/v1/stats/links/{slug}` 从数据库返回正确的 daily_visits 数组
- 验证非所有者访问返回 403 Forbidden
- 验证不存在的链接返回 404 Not Found

### 6.4 组件测试(Storybook)

**验证策略:**

隔离 UI 组件并独立于后端逻辑测试视觉状态:

**Dashboard 链接表组件:**
- 测试默认状态,显示多个链接,包含 slug、URL、访问次数、编辑按钮
- 测试无链接的空状态
- 测试过滤状态,仅显示匹配的链接和应用的 RegEx 模式

**RegEx 过滤器输入组件:**
- 测试有效模式状态(显示匹配计数)
- 测试无效模式状态(显示错误消息)
- 测试模式提交和清除功能

**Analytics 时间序列图表组件:**
- 测试单链接图表,30 天数据可视化
- 测试聚合图表,组合多个过滤链接
- 测试空状态和加载状态

**链接创建表单组件:**
- 测试带 Turnstile widget 集成的表单
- 测试验证错误状态
- 测试已认证与匿名用户状态

**更改历史时间线组件:**
- 测试不同操作类型的历史条目(CREATE、UPDATE、CLAIM)
- 测试匿名与已认领链接的 IP 掩码显示
- 测试时间戳格式化和排序

**视觉回归测试:**
- 使用 Chromatic 进行自动截图比较
- 测试所有状态:默认、加载、错误、空
- 测试响应式布局:移动、平板、桌面断点

### 6.5 E2E 测试(Playwright)

**验证策略:**

在真实浏览器环境中测试完整的用户旅程,所有系统集成:

**匿名链接创建流程:**
- 验证匿名用户可以填写表单、完成 Turnstile 挑战并成功创建链接

**已认证链接创建与认领:**
- 验证用户可以登录、导航到匿名链接、点击认领按钮并看到成功消息

**链接重定向解析:**
- 验证浏览器在访问 go-link slug 时导航到正确的目标 URL
- 验证重定向后数据库中的访问计数增加

**重定向警告页面:**
- 验证警告页面显示 5 秒倒计时并自动重定向到目标

**更改历史页面(公开访问):**
- 验证公开历史页面为匿名链接显示掩码 IP 地址(例如,`192.168.1.xxx`)
- 验证已认领链接历史隐藏 IP 地址并显示"注册用户"标签

**用户 Dashboard:**
- 验证已认证用户看到完整的 dashboard,包含总统计和链接表
- 验证表显示每个链接的 slug、URL、访问次数和编辑按钮
- 验证点击编辑按钮导航到预填充表单的编辑页面
- 验证 RegEx 过滤器输入过滤表仅显示匹配的链接
- 验证无效的 RegEx 模式显示错误消息
- 验证点击链接 slug 导航到分析详情页面,图表可见
- 验证过滤链接显示聚合图表,组合所有匹配链接的统计数据

**Google Analytics 集成:**
- 验证重定向触发 GA 事件,带正确的 slug 和目标参数

**自动创建 UX:**
- 验证访问不存在的 slug 重定向到创建表单页面

**QR Code 生成:**
- 验证 QR code endpoint 返回有效图像,移动扫描器正确解析

**Chrome Extension 集成:**
- 验证 extension 可以通过 API 创建和解析链接
- 验证 omnibox 集成正常工作

### 6.6 测试环境设置

**要求:**
- 隔离的测试数据库(独立的 Supabase 测试项目)
- 模拟 Turnstile API 以进行 token 验证
- 预配置的测试用户,带已知凭据
- links 和 daily_visits 表的种子数据脚本

**CI/CD Pipeline 阶段:**
1. Lint & Type Check(ESLint + TypeScript)
2. 单元测试(Vitest)
3. 集成测试(Vitest,带测试数据库)
4. 组件测试(Storybook build + Chromatic 视觉回归)
5. E2E 测试(Playwright,无头模式)
6. 覆盖率报告(强制最低 80% 阈值)

**本地开发:**
- Storybook 在本地端口运行以进行组件开发
- Chromatic 集成以进行自动视觉回归测试

---

## 7. 安全与合规

### 7.1 Bot Protection

**Turnstile:** Cloudflare CAPTCHA 替代方案(注重隐私)
- 匿名链接创建必需
- 已认证用户可选
- 通过 Cloudflare API 进行服务器端验证

### 7.2 Rate Limiting

**策略:** 委托给 Cloudflare WAF(Web Application Firewall)

**配置:**
- Cloudflare Rate Limiting 规则处理所有速率限制
- 无内部速率限制实现
- Cloudflare 在请求到达 Next.js 应用之前阻止请求

**推荐的 Cloudflare 规则:**

| 用户类型 | 限制 | 窗口 | Cloudflare 规则 |
|-----------|-------|--------|-----------------|
| 匿名创建 | 5 个请求 | 1 小时 | Path: `/api/v1/links`, Method: POST, No auth header |
| 已认证创建 | 50 个请求 | 1 小时 | Path: `/api/v1/links`, Method: POST, Has auth header |
| 解析 | 100 个请求 | 1 分钟 | Path: `/*`(除 `/api/*`) |

**优势:**
- ✅ 速率限制跟踪无数据库开销
- ✅ 边缘级保护(在 CDN 处阻止)
- ✅ 消除对 `rate_limits` 表的需求
- ✅ Cloudflare dashboard 提供分析

**内部验证:**
- 应用程序仍验证 Turnstile tokens
- 应用程序仍检查所有权/权限
- Rate limiting 纯粹是基础设施级别

### 7.3 GDPR 合规

**数据最小化:**
- 匿名: 仅 SHA-256 指纹(无原始 IP 存储)
- 已认证: Email、user_id(通过 OAuth 同意)

**用户权利:**
- **访问:** `GET /api/v1/users/me/data`(导出所有数据)
- **删除:** `DELETE /api/v1/users/me`(设置 `owner_id = NULL`,保留审计日志)

### 7.4 安全 Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000`
- CORS: 允许 `chrome-extension://` origins

---

## 8. 实施阶段

### 阶段 1: 基础(第 1-2 周)
- Next.js 15 + TypeScript 设置
- Supabase + Drizzle schema 迁移
- Supabase Auth 集成
- **测试:** 验证逻辑的单元测试(Vitest)

### 阶段 2: 核心 API(第 3-4 周)
- API endpoints: `POST /api/v1/links`, `GET /api/v1/resolve`, `POST /api/v1/links/{slug}/claim`
- API endpoints: `GET /api/v1/links/{slug}/history`, `GET /api/v1/stats/me`, `GET /api/v1/stats/global`
- Turnstile 验证 middleware
- 带 IP 掩码的审计日志
- **测试:** 所有 endpoints 的集成测试(Vitest)

### 阶段 3: Web UI(第 5-6 周)
- 带 Turnstile 的链接创建表单
- 自动创建 UX(`/{slug}` → `/edit/{slug}`)
- 重定向警告页面
- 更改历史页面(`/history/{slug}`)
- 带 RegEx 过滤器的用户 dashboard
- 编辑按钮和分析详情页
- 时间序列图表(Recharts/Chart.js)
- QR code endpoint
- Google Analytics 集成
- **测试:** 组件的 Storybook stories,用户流程的 E2E 测试(Playwright)

### 阶段 4: Extension(第 7-8 周)
- Chrome Extension MV3
- Omnibox 集成
- **测试:** Extension E2E 测试(Playwright)

### 阶段 5: 生产(第 9-10 周)
- 负载测试 + 优化
- 安全审计
- 监控(Sentry, Vercel Analytics)
- **测试:** 完整回归套件

---

## 9. 成功指标

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

## 10. 结论

**核心创新:**
1. **Turnstile 保护的匿名创建**(解决垃圾信息)
2. **Claim Flow**(解决遗留所有权问题)
3. **公开更改历史**(通过 IP 掩码实现透明度与隐私)
4. **增强的 Analytics Dashboard**(RegEx 过滤用于活动分析,时间序列图表)
5. **Google Analytics 集成**(跟踪重定向和创建事件)
6. **Cloudflare Rate Limiting**(边缘级保护,无内部开销)
7. **全面测试**(Vitest + Playwright + Storybook)

**Dashboard 功能(以用户为中心):**
- 查看所有拥有的链接,带编辑按钮
- RegEx 过滤器用于批量分析(例如,`^event-2024-.*` 用于活动跟踪)
- 单链接分析详情页,带 30 天时间线图表
- 过滤链接的聚合分析
- 时间序列可视化(Recharts/Chart.js)

**测试优先开发:**
- **58 个明确的验收标准**涵盖所有功能
- 合并前需要单元、集成、组件(Storybook)和 E2E 测试
- CI/CD pipeline 强制执行 80% 覆盖率
- 使用 Chromatic 进行视觉回归测试

**关键依赖:**
- **外部:** Cloudflare(WAF + Turnstile)、Google Analytics GA4、Chromatic(视觉测试)
- **内部:** Next.js 15、Supabase(Postgres + Auth)、Drizzle ORM、Recharts/Chart.js
- **测试:** Vitest(单元/集成)、Storybook(组件)、Playwright(E2E)

**下一步:**
1. 批准规范
2. 配置 Cloudflare rate limiting 规则
3. 设置测试环境(Supabase 测试项目、Turnstile 测试密钥、GA4 属性、Chromatic 项目)
4. 设置 Storybook,带初始组件 stories
5. 使用 TDD 方法开始阶段 1

---

**文档版本:** 2.1.0
**最后更新:** 2026-02-06
**状态:** 待批准
