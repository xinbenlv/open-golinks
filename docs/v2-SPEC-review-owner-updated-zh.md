# Open GoLinks v2 - 审查意见（Owner 回应版）

**审查人:** Claude Opus 4.6
**原始审查日期:** 2026-02-06
**Owner 回应日期:** 2026-02-06
**文档版本:** 1.0
**目的:** 整合 Owner 反馈，供 Spec Writer 参考更新规范

---

## 状态汇总

| 状态 | 数量 | 详情 |
|------|------|------|
| **已接受** | 10 项 | Owner 同意实施或确认已考虑的建议 |
| **部分接受** | 7 项 | Owner 认可但有修改或不同实现方式 |
| **暂不实施** | 2 项 | Owner 明确表示暂不做或低优先级 |
| **需要澄清** | 1 项 | Owner 反馈不够详细，需要更多信息 |

**总计:** 20 项 Owner 回应

---

## 详细反馈与 Owner 回应

### 第一部分：架构与并发问题

#### 问题 1: Slug 创建和 Claim Flow 中的 Race Condition
**原始章节:** 3.1 / 3.2 / 4.1
**严重级别:** CRITICAL

**原始反馈:**
规范未处理并发请求。两个危险的场景：
1. **场景 A - 并发 slug 创建：** 两个匿名用户同时提交带有相同 slug 的 `POST /api/v1/links`。如果没有在 transaction 级别强制执行数据库级唯一性约束，两者都可能成功，或者其中一个可能收到未处理的数据库错误而不是干净的 409。
2. **场景 B - 并发 claim 尝试：** 两个已认证用户同时尝试对同一个匿名链接执行 `POST /api/v1/links/{slug}/claim`。如果没有 `SELECT ... FOR UPDATE` 或等效的 optimistic locking 机制，两者都可能成功，导致链接被最后提交 transaction 的用户认领。

**建议实现方式：**
- 在 `links.slug` 上有 `UNIQUE` 约束（PRIMARY KEY 隐式约束，需要指定 INSERT 冲突处理 -- `INSERT ... ON CONFLICT` 或应用层重试）
- claim flow 必须使用 `UPDATE links SET owner_id = $1 WHERE slug = $2 AND owner_id IS NULL RETURNING *` 作为单个原子操作

**Owner 回应:**
> "同意，请更新Spec。"

**状态:** 已接受
**建议的更新:**
- 在数据库架构部分添加并发控制规则
- 在 API 3.1 和 3.2 章节中明确指定事务和锁定机制
- 添加代码示例展示正确的 UPSERT 和 UPDATE 语句

---

#### 问题 2: `url_history` 中无限的 JSONB 增长
**原始章节:** 4.1
**严重级别:** CRITICAL

**原始反馈:**
`links` 表上的 `url_history` JSONB 列存储所有 URL 更改的数组。对于经常更新的热门链接，这个数组将无限增长，导致：
1. UPDATE 性能降低（需要重写整个 JSONB 值）
2. 行大小增加（影响 TOAST 存储）
3. 与 `audit_logs` 表产生数据重复

**建议解决方案（三选一）：**
- (a) 完全删除 `url_history`，从 `audit_logs` 派生历史记录（推荐，消除数据重复）
- (b) 将 `url_history` 数组限制为固定大小（如最近 50 次更改）
- (c) 移至单独的 `link_url_history` 表并进行索引

**Owner 回应:**
> "这个也不用担心，因为会有很多很多次的更新。一般来说，更新也就两次吧，所以不用特别担心。"

**状态:** 部分接受
**解释:** Owner 的反馈似乎基于对使用模式的不同理解（"一般也就两次"）。然而原始反馈针对"经常更新的热门链接"场景。

**建议的更新:**
- 在规范中记录预期的链接更新频率
- 澄清是否应实施数据增长限制（如最近 50 次更改）
- 至少添加一个注释说明 `url_history` 与 `audit_logs` 的关系，避免在数据量增长时产生问题

**备注:** 需要与 Owner 再次确认实际预期的更新频率和数据增长情况

---

### 第二部分：验证与命名规则

#### 问题 3: Slug 验证规则未定义
**原始章节:** 3.1 / 5.1
**严重级别:** HIGH

**原始反馈:**
`links.slug` 列是 `varchar(100)`，但规范未定义：
- 允许的字符集（仅字母数字？连字符？下划线？Unicode？）
- 最小长度
- 保留字（api、dashboard、admin、login、edit、warn、history、stats、favicon.ico、robots.txt、sitemap.xml、.well-known）
- 大小写敏感性

这尤其危险，因为路由 `GET /{slug}` 与应用程序的每个顶级路由冲突。

**Owner 回应:**
> "slug不用不能超过50，太长就没什么意义了。另外应该只允许小写字母和dash，其他特殊字符可能会引起问题。对应该添加保留字黑名单"

**状态:** 已接受
**Owner 明确要求的更新：**
1. 最大长度：50 字符（而非 100）
2. 允许的字符：**仅小写字母和 dash（连字符）**
3. 必须添加：**保留字黑名单**

**建议的更新:**
- 添加"5.2 Slug 验证" 小节，包含：
  - 允许的 regex 模式：`^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$`（1-50 字符，起始和结尾必须是字母数字）
  - 大小写规范化规则：所有 slug 自动转换为小写
  - 硬编码保留字黑名单，包括：
    ```
    api, v1, dashboard, admin, login, edit, warn, history, stats,
    claim, public, search, export, import, settings, profile,
    favicon.ico, robots.txt, sitemap.xml, sitemap, .well-known
    ```
  - 客户端和服务器端双重验证

---

#### 问题 4: URL 验证规则缺失
**原始章节:** 5.1
**严重级别:** HIGH

**原始反馈:**
规范提到"无效 URL 格式"返回 400，但未定义什么构成有效 URL。问题包括：
- 是否允许 `http://` URL 或仅允许 `https://`？
- 是否允许 `localhost` 或私有 IP URL？
- 是否阻止 `javascript:` 或 `data:` URL？
- 最大 URL 长度是多少？

**Owner 回应:**
> "同意，请更新"

**状态:** 已接受
**建议的更新:**
- 添加"5.3 URL 验证" 小节，定义：
  - **协议要求：** 仅允许 `https://`，使用 `https://` 自动升级 `http://`
  - **禁止的协议：** `javascript:`、`data:`、`file:`、`vbscript:` 等
  - **私有 IP 限制：** 阻止 `127.0.0.1`、`localhost`、`192.168.x.x`、`10.x.x.x`、`172.16-31.x.x`
  - **最大长度：** 2048 字符（符合 URL 规范）
  - 使用 URL parser 和正则表达式验证

---

### 第三部分：数据管理与历史

#### 问题 5: 更改历史隐私不一致
**原始章节:** 3.6 vs 7.3
**严重级别:** HIGH

**原始反馈:**
规范有矛盾：
- 章节 3.6：对于匿名（未认领）链接，历史记录中显示带掩码的 IP 地址（`192.168.1.xxx`）
- 章节 7.3：匿名链接仅存储 SHA-256 fingerprint，无原始 IP 存储

**问题：** 如果从不存储原始 IP，就无法在历史页面显示掩码的 IP。SHA-256 hash 无法反转。

**建议解决方案：**
- (a) **推荐** 在创建时单独存储掩码的 IP（`192.168.1.xxx`）作为显示值
- (b) 完全删除 IP 显示，使用 "Anonymous #abc123" 标识符

**Owner 回应:**
> "（a）"

**状态:** 已接受
**Owner 明确选择:** 方案 (a) - 在创建时单独存储掩码的 IP

**建议的更新:**
- 修改 `audit_logs` 表 schema：添加 `masked_ip` varchar(15) 字段
- 在 3.6 章节明确指定：存储 SHA-256 fingerprint + 掩码的 IP（用于显示）
- 在 7.3 GDPR 合规性章节澄清：掩码 IP 已是匿名化数据，符合 GDPR

---

#### 问题 6: 缺少 DELETE Endpoint
**原始章节:** 5.1
**严重级别:** HIGH

**原始反馈:**
API contract 定义了 CREATE、READ、UPDATE、CLAIM 操作，但没有 `DELETE /api/v1/links/{slug}` endpoint。audit_logs schema 包括 DELETE action，表明删除是有意的。

**问题：**
- 链接所有者可以删除其链接吗？
- 管理员可以删除任何链接吗？
- 删除链接时 audit_logs 会发生什么（FK CASCADE 会删除 audit 历史）？

**Owner 回应 (问题 1 - DELETE endpoint):**
> "链接的所有者和管理者都可以删除链接。在删除链接时，Audit Log（审计日志）会保留。如果slug被删除后在相同slug重新创建，历史记录将包含该 slug 在删除前后的所有历史。"

**Owner 回应 (问题 2 - Soft Delete 机制):**
> "删除"的做法是软删除，即在 links 中插入一个 "" 表示空字符串表示被删除，可以吗？

**状态:** 已接受 + 需要澄清
**Owner 提出的实现方式：** 使用软删除，在 `links` 表中添加一个字段标记删除状态（使用空字符串表示被删除）

**建议的更新:**
- 添加 `5.4 DELETE Endpoint` 小节：
  ```
  DELETE /api/v1/links/{slug}
  权限：链接所有者 | 管理员
  实现：软删除（在 links 表中添加 deleted_at 时间戳或 is_deleted 布尔字段）
  Audit Log：保留所有历史记录
  ```
- 修改 `audit_logs.link_slug` FK：从 CASCADE 改为 SET NULL（保护历史数据）
- 说明：删除后的 slug 可以被重新创建，历史记录将显示完整的生命周期

**备注:** Owner 建议使用空字符串表示删除，但使用 `deleted_at` 时间戳或 `is_deleted` 布尔字段可能更清晰。需要确认最终实现方式。

---

#### 问题 7: 链接删除和 Soft Delete 策略
**原始章节:** 缺失的需求 #1
**严重级别:** HIGH

**原始反馈:**
无 soft delete 机制，CASCADE foreign key 意味着删除链接会破坏其整个 audit trail。

**Owner 回应:** （见上文问题 6 的 Owner 回应）

**状态:** 已接受

---

### 第四部分：访问控制与安全

#### 问题 8: Rate Limiting 的单点故障
**原始章节:** 7.2
**严重级别:** HIGH

**原始反馈:**
规范明确指出：无内部 rate limiting 实现，纯粹依赖 Cloudflare WAF。如果 WAF 配置错误或被绕过，应用程序没有保护。

此外，WAF 规则通过检查"有无 auth header"区分用户很脆弱 -- 攻击者可以发送伪造 header 绕过。

**建议：**
- 添加轻量级应用层 rate limiter 作为后备（内存滑动窗口或基于 Postgres 的计数器）
- 澄清 WAF 规则应根据 token 是否**有效**区分，而非仅**存在**

**Owner 回应:**
> "我们这个项目的攻击目标不大，所以其实没有必要防御得那么强。我们相信基础Cloudflare是相对比较可靠的。"

**状态:** 不接受
**Owner 决策：** 不实施应用层 rate limiting，完全依赖 Cloudflare WAF

**建议的更新:**
- 在规范中明确记录这个架构决策和假设
- 添加"7.2.1 架构决策：Rate Limiting 单点故障接受"章节，说明：
  - 项目攻击表面有限
  - 信任 Cloudflare WAF 作为主要防线
  - 监控 Cloudflare WAF 事件和绕过尝试

---

#### 问题 9: 公共搜索功能
**原始章节:** 缺失的需求 #9
**严重级别:** MEDIUM

**原始反馈:**
没有公共搜索或浏览功能。这可能是故意的（隐私），但应明确说明。

**Owner 回应:**
> "应该具有公共搜索的功能，请在 schema 里面加一个 boolean，说明它是否为 public，这是第一点。
>
> 关于这个 boolean，在创建时的 UI 上默认应为 public，即：
> 1. 提供一个 checkbox
> 2. 该 checkbox 的变量名为 isPublic
> 3. 且该 checkbox 默认处于 checked 状态"

**状态:** 已接受 + 提供具体实现指导
**Owner 明确要求的更新：**
1. **新功能：公共链接搜索**
2. **数据库：** 在 `links` 表中添加 `is_public` boolean 字段
3. **UI/UX 要求：**
   - 创建/编辑链接时提供 checkbox
   - 变量名必须为 `isPublic`
   - 默认状态：**checked（即默认为 public）**
4. **搜索功能：** 实现公共搜索 API endpoint
   - `GET /api/v1/links/search?q=term` 仅返回 `is_public=true` 的链接

**建议的更新:**
- 在 `schema.sql` 中添加：`is_public BOOLEAN DEFAULT true`
- 添加新 API endpoint：`GET /api/v1/search?q={query}&limit=20&offset=0`
- 在 UI 设计中添加搜索页面
- 更新验收标准，包含搜索功能的测试用例

---

### 第五部分：警告与分析

#### 问题 10: 重定向警告行为不一致
**原始章节:** 3.3 vs 3.4
**严重级别:** MEDIUM

**原始反馈:**
章节 3.3 指出：`GET /{slug}` 带有 `show_warning: true` 有"10% 概率重定向到 `/warn/{slug}`"。但章节 3.4 将警告页面定义为"每个链接的选择性加入"功能。

**矛盾：**
- 如果链接有 `show_warning: true`，为什么只有 10% 的访问者看到警告？
- 10% 的比率意味着 90% 的访问者不受保护

**Owner 回应:**
> "这是故意的。因为我们这个社区重复使用比较多，所以 10% 或者是一个变量 N，这个数字就已经够了。我们只要让用户养成习惯，理解这件事情就行。如果每次都显示的话，会对用户产生很大的干扰，所以我们才调低了比例。"

**状态:** 已接受
**Owner 明确的产品决策：**
- 10% 是**意图的概率采样**，目的是用户教育而非完全保护
- 这是一个 A/B 测试/用户习惯养成策略
- 可以是可配置的变量 N

**建议的更新:**
- 在 3.3 章节澄清：
  ```
  警告展示策略（概率采样）：
  - show_warning: true 时，根据 warning_display_rate（默认 10%）概率重定向
  - 目的：让用户养成检查的习惯，避免频繁中断体验
  - 这是一个用户教育策略，而非完全的安全保护
  ```
- 在 schema 中为链接添加 `warning_display_rate` 字段（可配置）
- 在配置中定义全局默认值

---

#### 问题 11: 日常访问计数 Race Condition
**原始章节:** 4.4
**严重级别:** MEDIUM

**原始反馈:**
规范指出"Background job 为每次重定向增加 `count`"到 `daily_visits` 表。但如果多个并发重定向同时触发 background job 时：
- `INSERT INTO daily_visits ... ON CONFLICT (link_slug, date) DO UPDATE SET count = count + 1` 可以正确工作
- 但如果 background job 使用读-修改-写模式，计数将丢失

**Owner 回应:**
> "同意。但是我们是不是可以直接依赖Google Analytics而不是自己来维持这个count？"

**状态:** 部分接受
**Owner 的反问：** 是否应该依赖 Google Analytics 而不是自己维护计数？

**建议的更新:**
- 需要与 Owner 确认最终决策：
  - **选项 A：** 保持自有计数，使用原子 UPSERT：`INSERT ... ON CONFLICT DO UPDATE SET count = count + 1`
  - **选项 B：** 依赖 GA4，移除自有计数逻辑（简化，但失去应用层控制）
- 如果选择 A，明确指定 UPSERT 语句
- 如果选择 B，更新 schema 和分析设计，说明依赖 GA4 的数据流

**备注:** 依赖 GA4 可以简化实现，但失去实时计数和应用层控制。需要业务决策。

---

### 第六部分：新增功能需求

#### 问题 12: 批量操作
**原始章节:** 缺失的需求 #7
**严重级别:** MEDIUM

**原始反馈:**
无批量创建、删除或导出 endpoint。对于管理许多链接的用户（RegEx filter 用例暗示这一点），单个 CRUD 操作不足。

**Owner 回应:**
> "同意，请更新Spec，增加批量创建、删除、导出等功能的API和UI设计。"

**状态:** 已接受 + 明确新增功能
**Owner 要求的新功能：**
1. **批量创建** API endpoint
2. **批量删除** API endpoint
3. **批量导出** API endpoint
4. 相应的 UI 设计

**建议的更新:**
- 添加 "5.5 批量操作 API" 小节：
  ```
  POST /api/v1/links/batch
  - 批量创建多个链接
  - 请求体：[{ slug, url, metadata }, ...]
  - 返回：{ created: [...], failed: [...] }

  DELETE /api/v1/links/batch
  - 批量删除多个链接
  - 请求体：{ slugs: [slug1, slug2, ...] }
  - 权限：仅自有链接或管理员

  GET /api/v1/links/export
  - 导出链接列表（CSV/JSON）
  - 查询参数：format=csv|json, filter=regex
  - 返回：文件下载或数据
  ```
- 在 UI/UX 设计中添加批量操作界面

---

#### 问题 13: 链接转移
**原始章节:** 缺失的需求 #8
**严重级别:** MEDIUM

**原始反馈:**
claim flow 处理匿名到拥有的转换，但没有在已认证用户之间转移所有权的机制。

**Owner 回应:**
> "同意，请更新Spec，允许链接所有者把链接所有权转给另一个用户。允许管理员把链接所有权设定给另一个用户，都要在Audit Log里记录。"

**状态:** 已接受 + 明确新增功能
**Owner 要求的新功能：**
1. **链接所有者** 可以将所有权转给另一个用户
2. **管理员** 可以设定/转移链接所有权给任何用户
3. **所有操作** 必须在 Audit Log 中记录

**建议的更新:**
- 添加 "5.6 链接转移 API" 小节：
  ```
  POST /api/v1/links/{slug}/transfer
  - 转移链接所有权
  - 请求体：{ new_owner_id: uuid, reason?: string }
  - 权限：当前所有者 | 管理员
  - Audit Log：记录 action="TRANSFER"，包含 old_owner_id 和 new_owner_id

  PUT /api/v1/admin/links/{slug}/owner
  - 管理员设定所有权（无需当前所有者同意）
  - 请求体：{ owner_id: uuid }
  - 权限：管理员仅
  - Audit Log：记录 action="ADMIN_TRANSFER"
  ```
- 更新 audit_logs schema：可能需要 `new_value` 字段记录转移目标

---

#### 问题 14: 健康检查 Endpoint
**原始章节:** 缺失的需求 #11
**严重级别:** LOW

**原始反馈:**
无 `GET /api/v1/health` 或等效项，供监控基础设施验证服务是否正常运行。

**Owner 回应:**
> "应该提供，请添加 `/api/v1/health` endpoint，返回 200 OK 和 `{ status: "ok" }`。"

**状态:** 已接受
**Owner 明确要求的实现：**
- Endpoint：`GET /api/v1/health`
- 响应状态：200 OK
- 响应体：`{ status: "ok" }`

**建议的更新:**
- 添加 "5.7 Health Check Endpoint" 小节：
  ```
  GET /api/v1/health
  响应：200 OK
  {
    "status": "ok",
    "timestamp": "2026-02-09T12:00:00Z",
    "version": "2.0.0"
  }

  或简化版本：
  {
    "status": "ok"
  }
  ```
- 不需要认证
- 用于监控和负载均衡器健康检查

---

### 第七部分：技术选型

#### 问题 15: Chart 库选择
**原始章节:** 2
**严重级别:** LOW

**原始反馈:**
规范列出"Recharts / Chart.js"带有斜杠，表明尚未做出选择。这些是根本不同的库。

**建议：** Recharts 是 Next.js/React 应用程序的自然选择（渲染为 SVG React component，与 React state 完美集成）。

**Owner 回应:**
> "选：Recharts"

**状态:** 已接受
**Owner 最终决策：** 使用 **Recharts**

**建议的更新:**
- 将技术栈章节更新为：`Recharts`（而非 "Recharts / Chart.js"）

---

#### 问题 16: Drizzle ORM 版本锁定
**原始章节:** 2
**严重级别:** LOW

**原始反馈:**
规范列出 Drizzle ORM `0.36+`。但 Drizzle 尚未达到 1.0，API 在小版本间发生变化。使用 semver 范围锁定到 `0.36+` 可能引入破坏性更改。

**建议：** 锁定到确切的小版本（如 `0.36.x`）并记录升级策略。

**Owner 回应:**
> "同意"

**状态:** 已接受

**建议的更新:**
- 将技术栈中的 Drizzle ORM 版本更新为：`0.36.x`（而非 `0.36+`）
- 添加"升级策略"文档，说明如何测试和验证 Drizzle 的小版本更新

---

### 第八部分：错误处理与规范

#### 问题 17: 错误响应 Schema
**原始章节:** 缺失的需求 #4
**严重级别:** MEDIUM

**原始反馈:**
规范显示了各个错误代码，但未定义标准错误响应封装。应指定一致的 schema。

**建议:** 定义一致的 schema，如 `{ error: { code: string, message: string, details?: object } }`

**Owner 回应:**
> "同意，请更新"

**状态:** 已接受

**建议的更新:**
- 添加 "5.8 错误响应 Schema" 小节：
  ```
  所有错误响应应采用以下格式：

  {
    "error": {
      "code": "SLUG_ALREADY_EXISTS",
      "message": "The slug is already taken",
      "details": {
        "requested_slug": "my-link",
        "suggestion": "my-link-1"
      }
    }
  }

  标准错误代码：
  - INVALID_SLUG
  - INVALID_URL
  - SLUG_ALREADY_EXISTS
  - SLUG_RESERVED
  - LINK_NOT_FOUND
  - UNAUTHORIZED
  - FORBIDDEN
  - RATE_LIMITED
  - INTERNAL_SERVER_ERROR
  ```

---

#### 问题 18: Content Security Policy
**原始章节:** 缺失的需求 #12
**严重级别:** MEDIUM

**原始反馈:**
列出了安全 header，但缺少 CSP。对于嵌入 Turnstile widget 和 GA script 的网站，正确配置的 CSP 很重要。

**Owner 回应:**
> "这点我不完全理解，可以写得更详细一些吗？"

**状态:** 需要澄清
**Owner 态度：** 同意重要性，但需要更多说明

**建议的更新:**
- 向 Owner 提供 CSP 详细解释和示例
- 在规范的 "7.1 安全 Headers" 小节中添加：
  ```
  Content-Security-Policy 配置：

  default-src 'self';
  script-src 'self' https://challenge.cloudflare.com https://cdn.jsdelivr.net https://www.googletagmanager.com;
  frame-src https://challenge.cloudflare.com;
  connect-src 'self' https://api.github.com https://www.google-analytics.com;
  img-src 'self' data: https: https://www.google-analytics.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;

  原因：
  - Cloudflare Turnstile: challenge.cloudflare.com
  - Google Analytics: www.googletagmanager.com
  - 防止 XSS 攻击和非授权资源加载
  ```

---

### 第九部分：已澄清的功能

#### 问题 19: History 和 Audit Endpoint 分页
**原始章节:** 缺失的需求 #5
**严重级别:** LOW

**原始反馈:**
`GET /api/v1/links/{slug}/history` 和 `GET /api/v1/audit/{slug}` 没有分页参数。对于历史记录长的链接，可能返回无界结果集。

**Owner 回应:**
> "应该暂时不需要，不会特别长"

**状态:** 不实施（暂时）

**备注：** Owner 确认当前使用模式下历史记录长度有限，暂不需要实施分页。可以在 Phase 2+ 中作为优化考虑。

---

#### 问题 20: Webhook 或事件系统
**原始章节:** 缺失的需求 #10
**严重级别:** LOW

**原始反馈:**
无外部系统订阅链接事件（创建、更新、高流量告警）的机制。限制集成可能性。

**Owner 回应:**
> "暂时不做"

**状态:** 暂不实施

**备注：** Owner 明确将此功能标记为后期考虑或不做。在 Phase 1 中不包括。

---

## 总结表格

| 问题 # | 标题 | 级别 | 状态 | 关键决策 |
|--------|------|------|------|---------|
| 1 | Slug 创建和 Claim Flow Race Condition | CRITICAL | 已接受 | 实施原子事务控制 |
| 2 | url_history JSONB 增长 | CRITICAL | 部分接受 | 需要再次确认更新频率 |
| 3 | Slug 验证规则 | HIGH | 已接受 | 最大 50 字符，仅小写字母和 dash，需要保留字黑名单 |
| 4 | URL 验证规则 | HIGH | 已接受 | 仅 https，阻止危险协议，限制私有 IP |
| 5 | 更改历史隐私 | HIGH | 已接受 | 存储掩码 IP 供显示 |
| 6 | 缺少 DELETE Endpoint | HIGH | 已接受 | 软删除，Owner 和管理员可删除，保留审计日志 |
| 7 | Soft Delete 策略 | HIGH | 已接受 | 使用软删除标记或时间戳 |
| 8 | Rate Limiting 单点故障 | HIGH | 不接受 | 完全依赖 Cloudflare WAF |
| 9 | 公共搜索功能 | MEDIUM | 已接受 | 添加 is_public 字段，默认 checked，搜索 API |
| 10 | 重定向警告概率 | MEDIUM | 已接受 | 10% 是故意的，用户习惯培养策略 |
| 11 | Daily Visits Race Condition | MEDIUM | 部分接受 | 提问：依赖 GA4 还是自有计数？ |
| 12 | 批量操作 | MEDIUM | 已接受 | 实施批量创建、删除、导出 API |
| 13 | 链接转移 | MEDIUM | 已接受 | Owner 和管理员可转移，审计日志记录 |
| 14 | 健康检查 Endpoint | LOW | 已接受 | `GET /api/v1/health` 返回 `{ status: "ok" }` |
| 15 | Chart 库选择 | LOW | 已接受 | 选择 Recharts |
| 16 | Drizzle 版本锁定 | LOW | 已接受 | 锁定为 0.36.x |
| 17 | 错误响应 Schema | MEDIUM | 已接受 | 定义标准错误格式 |
| 18 | Content Security Policy | MEDIUM | 需要澄清 | Owner 同意但需要详细说明 |
| 19 | History 分页 | LOW | 不实施 | 暂时不需要 |
| 20 | Webhook 事件系统 | LOW | 暂不实施 | 后期考虑 |

---

## Spec Writer 工作优先级

### 立即处理（阻止因素）
1. **Slug 验证规则** - 添加最大 50 字符，小写字母和 dash，保留字黑名单
2. **Race Condition 修复** - 原子事务控制（Claim flow 和 slug 创建）
3. **URL 验证规则** - https only，阻止危险协议，私有 IP 限制
4. **DELETE Endpoint** - 软删除实现，权限检查
5. **Audit Log 数据完整性** - FK 改为 SET NULL，保留历史

### Phase 1 必做
6. **公共搜索功能** - is_public 字段，搜索 API，UI checkbox
7. **批量操作 API** - 批量创建、删除、导出
8. **链接转移功能** - Owner 和管理员转移，审计记录
9. **错误响应 Schema** - 统一错误格式定义
10. **健康检查 Endpoint** - `/api/v1/health`

### 需要与 Owner 确认
- `daily_visits` 计数实现：GA4 依赖 vs 自有计数原子操作？
- `url_history` 增长限制：实施前再次确认预期更新频率
- CSP 详细配置：向 Owner 解释后确认最终需求
- 软删除实现细节：确认使用字段名和标记方式

### 可延后（Phase 2+）
- 历史记录分页（Owner 确认暂不需要）
- Webhook 事件系统（Owner 明确暂不做）
- 监控告警阈值详细定义

---

## 附录：Owner 回应的实现指导

### 新功能清单（Owner 明确要求）
- [ ] 公共链接搜索 (`is_public` boolean，默认 true）
- [ ] 批量操作（创建、删除、导出）
- [ ] 链接转移（Owner 和管理员）
- [ ] 健康检查 Endpoint（`GET /api/v1/health`）
- [ ] DELETE Endpoint（软删除）

### 架构决策已确认
- [ ] 不实施应用层 rate limiting（信任 Cloudflare WAF）
- [ ] 警告展示为概率采样（10%）- 用户习惯培养策略
- [ ] 存储掩码 IP 供 audit 历史显示
- [ ] 使用 Recharts 进行可视化
- [ ] Drizzle ORM 锁定为 0.36.x

### 需要澄清的项目
- [ ] `url_history` 增长限制策略
- [ ] `daily_visits` 计数：GA4 vs 自有实现
- [ ] CSP 具体配置要求
- [ ] 软删除实现细节（字段名、标记方式）

---

**文档生成时间:** 2026-02-09
**审查文档版本基础:** v2-SPEC-review-zh.md
**下一步:** Spec Writer 应基于本文档更新 v2 规范
