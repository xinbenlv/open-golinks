# Open GoLinks v2 规范审查意见

**审查人:** Claude Opus 4.6
**文档版本:** v2.1.0
**审查日期:** 2026-02-09

## 总体评价

规范结构清晰、决策稳健，核心架构（Next.js 15 + Supabase + Drizzle）完全适配需求。完成以下改进后，规范将准备进入实施阶段。

---

## 必须修复的问题（5 项）

### 1. Race Condition 防护

**问题:** 未处理并发创建和 claim 的冲突。

**场景 A - 并发 slug 创建:**
- 两个匿名用户同时提交相同 slug 的 `POST /api/v1/links` 请求。
- 应用层必须捕获 duplicate key 冲突，返回 409 Conflict。
- 若用户未指定 slug，系统应自动生成，规避冲突。

**场景 B - 并发 claim:**
- 两个已认证用户同时尝试 claim 同一个匿名链接。
- claim flow 必须使用单个原子操作：`UPDATE links SET owner_id = $1 WHERE slug = $2 AND owner_id IS NULL RETURNING *`
- 禁止先读后写。Drizzle 实现时应利用事务或 `UPDATE ... RETURNING` 保证原子性。

### 2. Slug 验证规则和保留字黑名单

**问题:** 缺少 slug 字符集、大小写敏感性、保留字定义。

**规则定义:**
- **最短长度:** 3 字符
- **最大长度:** 50 字符
- **允许字符:** 仅小写字母（a-z）和连字符（-）
- **大小写规范化:** 输入时全部转换为小写
- **保留字黑名单:** `api`, `admin`, `dashboard`, `login`, `edit`, `warn`, `history`, `stats`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `.well-known`（Spec Writer 完整扩展列表）

**实施指导:**
- 在 API 层和数据库层均实现验证。
- 推荐 regex：首尾必为字母或者数字，中间可含连字符。例如：`^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$`
- 在 Spec 中添加"Slug 验证规则"专章。

### 4. DELETE Endpoint 和软删除策略

**问题:** API 缺少 DELETE 操作，audit log CASCADE 外键会丢失历史。

**解决方案:**
- **谁可删除:** 链接所有者和管理员
- **方式:** 软删除（soft delete）。在 `links` 表中添加 `deleted_at` 时间戳。
- **审计日志:** `audit_logs.link_slug` 外键从 CASCADE 改为 SET NULL，删除链接时保留审计历史。
- **API 设计:** 添加 `DELETE /api/v1/links/{slug}` endpoint。

### 5. 数据迁移策略

**问题:** 缺少从 v1（MongoDB + Express）迁移到 v2 的计划。

**迁移方式 - 暂停法:**
1. 冻结 v1 新请求，通知用户短暂维护。
2. 从 MongoDB 提取所有链接、用户、访问记录。
3. 转换数据格式适配 Postgres schema（特别是 `url_history` → `audit_logs`）。
4. 迁移用户账户至 Supabase Auth。
5. v1 分析历史存档至 S3，或由 Google Analytics 继续跟踪。
6. 启动 v2，验证所有链接可正常访问。

**Spec 更新:** 在实施计划中添加"数据迁移"章节（高层计划即可）。

---

## 高优先级改进（3 项）

### 1. 访问计数的原子操作

**问题:** `daily_visits` 聚合可能存在竞态条件。

**方案:**
- 使用原子 UPSERT：`INSERT INTO daily_visits (link_slug, date, count) VALUES ($1, $2, 1) ON CONFLICT (link_slug, date) DO UPDATE SET count = count + 1 RETURNING *`
- 或直接依赖 Google Analytics 的 Real-time API，移除 background job 和 `daily_visits` 表。

### 2. 错误响应规范化

**问题:** API 各处错误响应格式不一致。

**统一 Schema:**
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

- HTTP 状态码：遵循标准（400, 409, 401, 403, 500）
- `error.code`：机器可读，便于客户端程序化处理
- `error.details`：可选，包含验证失败信息

**Spec 中应列出所有可能的 error.code 值。**

### 3. URL 验证规则

**问题:** 规范提到"无效 URL 格式"但未定义标准。

**规则定义:**
- **协议:** 仅允许 `https://`（禁止 `http://`）
- **禁止:** `javascript:` 和 `data:` URL
- **本地地址:** 禁止 `localhost` 和私有 IP（`192.168.x.x`, `10.x.x.x`）
- **最大长度:** 2048 字符
- **验证:** 通过标准 URL parser（JavaScript `URL` constructor）

---

## 建议的新功能（5 项）

### 1. 公共链接搜索

**要求:**
- 在 `links` schema 中添加 `isPublic` boolean 字段。
- 默认值：`true`（新链接默认公开）。
- **UI:** 链接创建表单中提供 checkbox（默认勾选）。
- **API:** `GET /api/v1/links?search=...&public=true` 返回公开链接。
- 已认证用户可访问自己的所有链接；匿名用户仅访问 `isPublic=true` 的链接。

### 2. 批量操作 API

**Endpoints:**
- `POST /api/v1/links/batch` - 批量创建（JSON 数组）
- `DELETE /api/v1/links/batch` - 批量软删除（slug 数组）
- `GET /api/v1/links/export?format=csv|json&filter=...` - 导出过滤链接

**限制:** 单次操作限制 100-1000 条记录。

### 3. 链接转移（所有权转移）

**Endpoint:** `POST /api/v1/links/{slug}/transfer`

**请求参数:** `{ new_owner_id: string }`

**权限规则:**
- 链接所有者可转移其链接
- 管理员可将任何链接转移给任何用户
- 匿名链接的 claim 流程不变

**Audit Log:** 记录 `TRANSFER` action，包含 `from_owner_id`, `to_owner_id`, `timestamp`。

### 4. Health Check Endpoint

**Endpoint:** `GET /api/v1/health`

**响应:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-06T12:34:56Z",
  "version": "2.0.0"
}
```

- 无认证要求，对所有请求开放
- 执行轻量级数据库 ping（`SELECT 1`），确保连接池正常
- 用途：容器编排、监控工具、负载均衡器

### 5. QR Code 参数优化

**参数更新:**
- **Size 范围:** 100 到 1200 像素
- **格式:** SVG（矢量格式，无损缩放，CDN 友好）
- **库建议:** `qrcode.react` 或 `qr-code-styling`
- **Caching:** CDN 缓存 24 小时
- **Endpoint:** `GET /api/v1/links/{slug}/qrcode?size=200&format=svg`

---

## 实施前检查清单

以下项目必须在 Spec 提交给实施团队前完成：

- [ ] **Slug 验证规则:** 添加专章，明确最大长度、字符范围、完整保留字黑名单
- [ ] **Race Condition 防护:** 在"数据模型"和"API 设计"章节添加原子操作 SQL 示例
- [ ] **DELETE Endpoint:** 添加 `DELETE /api/v1/links/{slug}` 定义，更新 links 表添加 `deleted_at`
- [ ] **数据迁移章节:** 添加"v1 到 v2 迁移计划"高层阐述
- [ ] **公开搜索功能:** 更新 links schema 添加 `isPublic` boolean，UI 添加 checkbox
- [ ] **批量操作 API:** 添加三个新 endpoints 定义
- [ ] **链接转移 API:** 添加 `POST /api/v1/links/{slug}/transfer` 定义
- [ ] **Health Check Endpoint:** 添加 `GET /api/v1/health` 定义
- [ ] **错误响应规范:** 统一所有 API 错误格式，列出完整 error code 枚举
- [ ] **URL 验证规则:** 定义有效 URL 标准（https、无 javascript、无本地地址、长度限制）
- [ ] **QR Code 参数:** 更新为 100-1200 size 范围，指定 SVG 格式
- [ ] **访问计数策略:** 明确选择 Google Analytics 依赖或自维护 `daily_visits` 表
- [ ] **CSP 配置规范:** 补充 Turnstile、GA 和本地资源的具体 CSP header 配置

---

## 总结

v2 规范的核心架构决策是稳健的。通过完成上述 5 个必须修复问题、3 个高优先级改进、5 个建议新功能的实施，规范将为高质量的实施奠定坚实基础。

**关键行动:**
1. Spec Writer 基于检查清单对原规范进行结构化更新
2. 为实施团队生成清晰的"Spec 2.2.0"版本
3. 可选：生成 OpenAPI/Swagger 定义供集成参考

**时间预期:** 按规范分阶段计划，Phase 1 预计 6-8 周内完成。

---

**审查完成日期:** 2026-02-09
**规范状态:** 待 Spec Writer 更新，随后进入实施阶段
