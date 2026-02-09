# Open GoLinks v2 - 规范审查意见

**审查人:** 高级系统架构师 (Claude Opus 4.6)
**规范版本:** 2.1.0
**审查日期:** 2026-02-09
**结论:** 基于本文档所列改进，规范已准备进入实施阶段

---

## 执行摘要

v2 规范是一份结构良好的文档，清晰地阐述了从 MongoDB + Express 技术栈迁移到现代 Next.js 15 + Supabase + Drizzle 架构的计划。"匿名创建"理念得以保留，同时通过 Turnstile 和 Cloudflare WAF 解决了合理的安全性问题。验收标准具体且可测试，分阶段实施计划对于 1-2 名工程师的团队来说是现实可行的。

经过深入的架构审查，规范的核心决策是稳健的。本文档总结了需要修复的关键问题、高优先级改进、建议的新功能，以及实施指导。完成这些调整后，规范将为高质量的实施提供明确的指导。

---

## 规范的优点

1. **清晰的验收标准表格** - 58 个验收标准覆盖正常和错误路径，可直接转化为测试用例。
2. **有原则的理念保持** - "匿名创建"保留，Turnstile + Claim Flow 是优雅的解决方案：保留零摩擦创建，同时增加了所有权路径。
3. **深思熟虑的缓存策略** - 三层缓存（CDN 5 分钟、Edge 60 秒、连接池）适合读密集型 URL shortener。
4. **隐私优先的设计** - SHA-256 指纹、IP 掩码、GDPR 数据导出/删除、Turnstile 而非传统 CAPTCHA。
5. **扩展优先的 API 设计** - `/api/v1` 版本控制、Chrome Extension 的 CORS 支持、RESTful contract。
6. **全面的测试策略** - Vitest + Storybook + Playwright + Chromatic 的四层测试方法。

---

## 必须修复的问题（5 项）

### 1. Slug 创建和 Claim Flow 中的 Race Condition

**问题:** 规范未处理并发请求导致的冲突。

**具体场景:**
- **场景 A - 并发 slug 创建:** 两个匿名用户同时提交相同 slug 的 `POST /api/v1/links` 请求。
- **场景 B - 并发 claim 尝试:** 两个已认证用户同时尝试 claim 同一个匿名链接。

**建议方案:**

对于场景 A（并发创建）：
- `links.slug` 列已为 PRIMARY KEY，隐式拥有 UNIQUE 约束。
- 应用层必须捕获并处理 duplicate key 冲突，向用户返回 409 Conflict（而非未处理的数据库错误）。
- 若用户未指定 slug，系统应自动生成，完全规避冲突。

对于场景 B（并发 claim）：
- claim flow 必须使用单个原子操作：`UPDATE links SET owner_id = $1 WHERE slug = $2 AND owner_id IS NULL RETURNING *`
- 禁止先读后写的模式。Drizzle ORM 实现时应利用数据库事务或 `UPDATE ... RETURNING` 保证原子性。

### 2. Slug 验证规则和保留字黑名单

**问题:** 规范未定义 slug 的字符集、大小写敏感性和保留字。

**建议方案:**

- **最短长度:** 3 字符
- **最大长度:** 50 字符
- **允许字符:** 小写字母（a-z）和连字符（-）仅此而已。其他特殊字符、大写字母、下划线、数字等均不允许。
- **大小写规范化:** 输入时全部转换为小写。
- **保留字黑名单:** 必须包含以下系统路由（完整列表由 Spec Writer 扩展）：
  - 系统路由：`api`, `admin`, `dashboard`, `login`, `edit`, `warn`, `history`, `stats`
  - 特殊文件：`favicon.ico`, `robots.txt`, `sitemap.xml`, `.well-known`

**实施指导:**
- 在 API 层和数据库层均实现验证。
- 建议的 regex 模式：`^[a-z][a-z-]{0,48}[a-z]$`（首尾必为字母，中间可含连字符）
- 在 Spec 中添加"Slug 验证规则"专章，详细列出完整的保留字。

### 3. IP 地址存储与显示（GDPR 合规）

**问题:** 规范存在自相矛盾：历史页面声称显示掩码 IP，但 GDPR 章节声称仅存储 SHA-256 fingerprint。

**建议方案:** 在创建时单独存储掩码 IP 作为显示值

具体实施：
- 每次访问 redirect 时，计算原始 IP 地址的掩码版本（如 `192.168.1.xxx`）。
- 在 `visit_logs` 或 `audit_logs` 中存储掩码后的 IP。
- 同时存储 IP 的 SHA-256 fingerprint，供内部去重和安全分析使用。
- 掩码 IP 不涉及 GDPR 问题，因为已经完全匿名化，无法反推原始 IP。
- 历史页面直接显示掩码 IP，无隐私顾虑。

### 4. DELETE Endpoint 和软删除策略

**问题:** API contract 缺少 DELETE 操作，且 audit log 的 CASCADE 外键会导致删除链接时丢失历史。

**建议方案:**

- **谁可删除:** 链接所有者和管理员都可删除链接。
- **删除方式:** 软删除（soft delete）。具体做法：在 `links` 表中添加 `deleted_at` 时间戳字段。
- **审计日志:** 删除链接时，`audit_logs` 表保留所有历史记录。`audit_logs.link_slug` 外键从 CASCADE 改为 SET NULL，确保删除链接时不破坏审计历史。
- **重新创建:** 若 slug 被删除后再用相同 slug 重新创建，历史记录将包含该 slug 在删除前后的所有操作。
- **API 设计:** 应添加 `DELETE /api/v1/links/{slug}` endpoint，权限检查后执行软删除。

### 5. 数据迁移策略

**问题:** 规范缺少从 v1（MongoDB + Express）迁移到 v2 的详细计划。

**建议方案:** 暂停法

- **迁移方式:** 在迁移期间，临时关闭 v1 服务，进行数据库迁移和系统对接。
- **可行性:** 当前 v1 用户数量不多，短暂停机可以接受。
- **具体步骤:**
  1. 冻结 v1 新请求，通知用户短暂维护。
  2. 从 MongoDB dump 中提取所有链接、用户、访问记录。
  3. 转换数据格式适配 Postgres schema（特别是 `url_history` → `audit_logs`）。
  4. 迁移用户账户至 Supabase Auth（保留原始用户 ID 或创建映射表）。
  5. v1 分析历史可存档至 S3/历史表，或由 Google Analytics 继续跟踪新数据。
  6. 启动 v2，验证所有链接可正常访问。
  7. 设置 v1 → v2 重定向或分阶段关闭 v1。

**Spec 更新:** 应在实施计划中添加"数据迁移"章节，高层计划即可（无需逐行代码）。

---

## 高优先级改进（3 项）

### 1. 访问计数的原子操作

**问题:** `daily_visits` 聚合可能存在竞态条件。

**建议方案:**
- 访问计数递增必须使用原子操作：`INSERT INTO daily_visits (link_slug, date, count) VALUES ($1, $2, 1) ON CONFLICT (link_slug, date) DO UPDATE SET count = count + 1 RETURNING *`
- 或考虑直接依赖 Google Analytics 的 Real-time API 进行访问统计，移除 background job 和 `daily_visits` 表，简化架构。

### 2. 错误响应规范化

**问题:** API 各处错误响应格式不一致。

**建议方案:** 统一所有 API 错误响应为以下 schema：

```json
{
  "error": {
    "code": "SLUG_CONFLICT|INVALID_URL|UNAUTHORIZED|...",
    "message": "Human-readable error message",
    "details": {
      "field": "slug",
      "value": "edit",
      "constraint": "reserved_slug"
    }
  }
}
```

- **HTTP 状态码:** 遵循标准（400 Bad Request, 409 Conflict, 401 Unauthorized, 403 Forbidden, 500 Internal Server Error 等）。
- **error.code:** 机器可读的错误标识符，便于客户端程序化处理。
- **error.message:** 人类可读的解释。
- **error.details:** 可选，包含验证失败的字段、违反的约束等附加信息。
- **Spec 中应列出所有可能的 error.code 值及其含义。**

### 3. URL 验证规则

**问题:** 规范提到"无效 URL 格式"返回 400，但未定义有效 URL 的标准。

**建议方案:** 定义以下规则：
- **协议:** 仅允许 `https://`（不允许 `http://`）
- **特殊 URL 类型:** 禁止 `javascript:` 和 `data:` URL
- **本地地址:** 禁止 `localhost` 和私有 IP URL（例如 `192.168.x.x`, `10.x.x.x`）
- **最大长度:** 建议 2048 字符（HTTP 标准 URL 长度限制）
- **有效格式:** 通过标准 URL parser 验证（例如 JavaScript `URL` constructor）

---

## 建议的新功能（5 项）

### 1. 公共链接搜索

**建议:** 添加公开搜索功能

**具体要求:**
- 在 `links` schema 中添加 `isPublic` boolean 字段，标示链接是否可被公开搜索。
- 默认值：`true`（即新链接默认为公开）。
- **UI 设计:** 在链接创建表单中提供 checkbox：
  - 变量名：`isPublic`
  - 标签：可为"Make public" 或"Allow public search"
  - 默认状态：**checked（勾选）**
  - 用户可取消勾选，将链接设为私有，不出现在公开搜索结果中。
- **API 支持:**
  - `GET /api/v1/links?search=...&public=true` 返回公开链接。
  - 已认证用户可访问自己的所有链接（无论 public 状态）。
  - 匿名用户仅可访问 `isPublic=true` 的链接。

### 2. 批量操作 API

**建议:** 增加批量操作功能

**实施指导:**
- **批量创建:** `POST /api/v1/links/batch`，接收 JSON 数组，一次创建多个链接。支持混合的有/无 slug 请求。
- **批量删除:** `DELETE /api/v1/links/batch`，接收 slug 数组，批量软删除。权限检查同单个 DELETE。
- **批量导出:** `GET /api/v1/links/export?format=csv|json&filter=...`，导出过滤后的链接列表。支持 CSV 和 JSON 格式。
- **限制:** 单次批量操作建议限制在 100-1000 条记录，防止过大请求。

### 3. 链接转移（所有权转移）

**建议:** 允许链接所有权在用户之间转移

**实施指导:**
- **新 API endpoint:** `POST /api/v1/links/{slug}/transfer`
- **请求参数:** `{ new_owner_id: string }`
- **权限规则:**
  - 链接所有者可转移其链接。
  - 管理员可将任何链接转移给任何用户。
  - 匿名链接（无所有者）的 claim 流程不变。
- **Audit Log:** 记录 `TRANSFER` action，包含 `from_owner_id`, `to_owner_id`, `timestamp`。
- **验证:** 确保目标 user_id 存在且有效。

### 4. Health Check Endpoint

**建议:** 提供服务健康检查接口

**实施指导:**
- **Endpoint:** `GET /api/v1/health`
- **响应:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-02-06T12:34:56Z",
    "version": "2.0.0"
  }
  ```
- **用途:** 容器编排（Docker、Kubernetes）、监控工具（Sentry、Vercel）和负载均衡器的健康检查。
- **无认证要求:** 该 endpoint 应对所有请求开放（不需要 auth header）。
- **性能:** 应执行轻量级数据库 ping（如 `SELECT 1`），确保连接池正常。

### 5. QR Code 参数优化

**建议:** 优化 QR Code 生成参数

**实施方案:**
- **Size 参数范围:** `100` 到 `1200` 像素（而非原规范的 `200-2000`）。
- **格式:** 生成 SVG 格式 QR Code，而非 PNG/JPEG。
  - SVG 优势：矢量格式，无损缩放，文件小，CDN 友好，Web 原生。
  - 库建议：`qrcode.react` 或 `qr-code-styling`。
- **Caching:** 在 CDN（Cloudflare）上缓存 24 小时，减少服务器负载。
- **API endpoint:** `GET /api/v1/links/{slug}/qrcode?size=200&format=svg`

---

## 已确认的架构决策（不需改动）

以下决策经过仔细评估，保持不变：

### 1. Cloudflare WAF 作为唯一 Rate Limiting 防线

**决策:** 应用层不实现额外的 rate limiting 逻辑

**原因:** 该项目的攻击目标相对较小，基础 Cloudflare WAF 防护足够可靠。

**实施方案:**
- 完全依赖 Cloudflare WAF 规则进行请求限制。
- Cloudflare 规则应监控 IP、User-Agent、请求频率等，区分匿名和认证用户。

**注意:** 若将来遭遇流量攻击，可在此基础上添加应用层防护，但当前不是必要项。

### 2. 重定向警告 10% 采样策略

**决策:** 保留 10% 概率采样

**原因:** 这是有意的用户习惯培养策略。社区中重复使用比较多，10% 比例或可配置的变量 N 已经足够。100% 显示会对用户产生很大的干扰。

**实施方案:**
- 链接可配置 `show_warning: true` 标记，表示启用警告页面。
- 当用户访问标记链接时，系统**概率性**（10% 或可配置比例 N）重定向到 `/warn/{slug}`。
- **代码实现:** 在 redirect 逻辑中，生成 `0-99` 的随机数，若 `< 10` 则重定向到警告页面。
- **可配置性:** 建议在 admin panel 中提供参数调整（当前默认 10%）。

### 3. Recharts 作为图表库

**决策:** 选择 Recharts

**确认:**
- Recharts 作为前端图表库的唯一选择，不再考虑 Chart.js。
- Recharts 基于 React，SVG 渲染，与 Next.js 15 应用集成良好。
- 支持响应式设计、内置主题、丰富的图表类型（折线、柱状、饼图等）。

### 4. Drizzle ORM 版本锁定

**决策:** 锁定到具体小版本

**确认:**
- 不使用 `0.36+` 的 semver 范围。
- 锁定到具体小版本（如 `0.36.4`），防止小版本更新导致 API 破坏。
- 升级 Drizzle 时应进行完整的集成测试和 staging 验证。

### 5. Google Analytics 作为访问计数首选

**决策:** 可选择依赖 Google Analytics

**方案:**
- 应用层可选择依赖 Google Analytics 的 Real-time API 进行访问统计，而非自维护 `daily_visits` 表。
- 若选择此方案，移除 background job 和 `daily_visits` 表，简化架构。
- 若仍需自维护，确保使用原子操作 `INSERT ... ON CONFLICT ... DO UPDATE SET count = count + 1`。
- **Spec 中应明确说明选择的方案。**

---

## 实施指导

### 1. 数据库原子操作

**Race Condition 防护的核心：**

所有涉及"读-判断-写"的操作必须转化为单个原子 SQL 语句或数据库事务。

**示例：**

```sql
-- Claim 流程（原子操作）
UPDATE links
SET owner_id = $1, claimed_at = NOW()
WHERE slug = $2 AND owner_id IS NULL
RETURNING *;

-- 访问计数（原子 UPSERT）
INSERT INTO daily_visits (link_slug, date, count)
VALUES ($1, $2, 1)
ON CONFLICT (link_slug, date)
DO UPDATE SET count = count + 1
RETURNING *;
```

**Drizzle 实现建议：**
- 使用 `db.transaction()` 包装 Drizzle 查询。
- 对于 `ON CONFLICT DO UPDATE` 场景，确认 Drizzle 提供的 DSL 支持此语法（通常需要 raw SQL 或 `sql<>` 标签）。
- 所有涉及修改的操作应添加 unit/integration 测试，验证并发场景下的正确性。

### 2. Slug 验证的三层防护

```
[UI 层]
  ↓ 前端 regex 实时验证 ^[a-z][a-z-]{0,48}[a-z]$
  ↓
[API 层]
  ↓ POST /api/v1/links 接收时再次验证
  ↓ 检查保留字黑名单（内存数组或 Postgres 表）
  ↓
[数据库层]
  ↓ UNIQUE 约束 + CHECK 约束（可选）
  ↓ 捕获冲突，返回 409
```

### 3. 软删除与审计追踪

**字段添加：**
```sql
ALTER TABLE links ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE audit_logs
  DROP CONSTRAINT audit_logs_link_slug_fkey,
  ADD CONSTRAINT audit_logs_link_slug_fkey
    FOREIGN KEY (link_slug)
    REFERENCES links(slug)
    ON DELETE SET NULL;
```

**查询时过滤：**
```sql
SELECT * FROM links WHERE slug = $1 AND deleted_at IS NULL;
```

**恢复选项（可选）：**
若需要还原已删除链接，可在 Admin API 中提供 `POST /api/v1/admin/links/{slug}/restore` endpoint，更新 `deleted_at` 为 NULL。

### 4. GDPR 合规与 IP 掩码

**实施流程：**

```
用户访问 GET /{slug}
  ↓ 获取 IP = 192.168.1.42
  ↓ 计算掩码 = 192.168.1.xxx
  ↓ 计算 SHA256(IP) = a1b2c3d4...
  ↓ 存储：visit_logs { ip_masked, ip_fingerprint, ... }
  ↓ 历史页面显示：访客 from 192.168.1.xxx at 2026-02-06 12:34
```

**隐私保证：**
- 掩码 IP 无法反推原始 IP，符合 GDPR 匿名化要求。
- 指纹用于内部去重分析，不向用户暴露。

---

## 需要进一步澄清的项目

### Content Security Policy (CSP) 配置

**现状:** CSP 安全策略规则需要更详细的规范。

**建议方向：**

CSP 是一个 HTTP header，指定浏览器允许加载哪些资源（脚本、样式、图像等）。对于 Open GoLinks v2，关键的 CSP 需求：

- **Turnstile widget:** 需要允许加载 Cloudflare 脚本和样式。
  ```
  script-src 'self' https://challenges.cloudflare.com;
  style-src 'self' https://challenges.cloudflare.com;
  ```
- **Google Analytics:** 需要允许 GA 脚本和信标。
  ```
  script-src 'self' https://www.googletagmanager.com;
  connect-src 'self' https://*.google-analytics.com;
  ```
- **Recharts（本地）:** 通常仅需 `'self'`。

**后续步骤:** 需要对 CSP 配置进行具体决策，并在 Spec 的"安全 Headers"章节补充。

---

## 完整的实施前检查清单

以下项目必须在 Spec 提交给实施团队前完成：

- [ ] **Slug 验证规则:** 添加"Slug 验证"专章，明确：最大 50 字符、小写字母+连字符、完整保留字黑名单。
- [ ] **Race Condition 防护:** 在"数据模型"和"API 设计"章节，分别添加 claim flow 和 daily_visits 的原子操作 SQL 示例。
- [ ] **IP 掩码存储:** 更新 `visit_logs` / `audit_logs` schema，添加 `ip_masked` 和 `ip_fingerprint` 字段。
- [ ] **DELETE Endpoint 和软删除:** 添加 `DELETE /api/v1/links/{slug}` endpoint 定义，更新 links 表 schema 添加 `deleted_at`。
- [ ] **数据迁移章节:** 添加"v1 到 v2 迁移计划"高层阐述（无需逐行代码）。
- [ ] **公开搜索功能:** 更新 links schema 添加 `isPublic` boolean，UI 设计添加 checkbox（默认 checked）。
- [ ] **批量操作 API:** 添加 `POST /api/v1/links/batch`, `DELETE /api/v1/links/batch`, `GET /api/v1/links/export` endpoint 定义。
- [ ] **链接转移 API:** 添加 `POST /api/v1/links/{slug}/transfer` endpoint，audit log 支持 TRANSFER action。
- [ ] **Health Check Endpoint:** 添加 `GET /api/v1/health` endpoint 定义。
- [ ] **标准错误响应 Schema:** 统一所有 API 错误响应格式，列出完整的 error code 枚举。
- [ ] **URL 验证规则:** 定义有效 URL 的标准（https only、无 javascript: 协议、无本地地址、最大长度）。
- [ ] **QR Code 参数更新:** 更新为 100-1200 size 范围，指定 SVG 格式。
- [ ] **访问计数策略:** 明确说明选择 Google Analytics 依赖或自维护 `daily_visits` 表。
- [ ] **CSP 配置规范:** 为 Turnstile、GA 和本地资源补充具体的 CSP header 配置。

---

## 总体结论

v2 规范经过深入审查，核心架构决策是稳健的。通过本文档所列的 5 个必须修复问题、3 个高优先级改进、5 个建议新功能的实施，规范将为高质量的实施奠定坚实基础。

**关键成就：**
- 架构选择（Next.js 15、Supabase、Drizzle、Cloudflare）完全适配问题领域。
- 对技术决策态度明确：接纳核心安全和并发防护，拒绝过度防御，聚焦实际需求。
- 明确了 5 个关键缺陷的处理方案，以及 5 个新增功能需求。

**实施前的行动项：**
1. Spec Writer 基于本文档的检查清单，对原规范进行结构化更新。
2. 为实施团队生成一份清晰的"Spec 2.2.0"版本，包含所有调整。
3. 可选：生成 OpenAPI/Swagger 定义，供 Chrome Extension 和第三方集成参考。

**时间预期：**
- 按照规范中的分阶段计划，Phase 1（核心功能）预计 6-8 周内完成。
- 使用本文档作为实施指导，可避免返工和架构债务。

**最终状态：** 规范已准备进入实施阶段，完成检查清单中的所有项目即可启动开发。

---

**文档编制日期:** 2026-02-09
**审查版本:** 2.1.0
**规范状态:** 待 Spec Writer 更新，随后进入实施阶段

