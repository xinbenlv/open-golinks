# Open GoLinks v2 - 规范审查

**审查人:** 高级系统架构师 (Claude Opus 4.6)
**审查规范版本:** 2.1.0 (2026-02-06)
**审查日期:** 2026-02-06
**结论:** 有条件批准,需要必要修订

---

## 执行摘要

v2 规范是一份结构良好的文档,清晰地阐述了从 MongoDB + Express 技术栈迁移到现代 Next.js 15 + Supabase + Drizzle 架构的计划。"匿名创建"理念得以保留,同时通过 Turnstile 和 Cloudflare WAF 解决了合理的安全性问题。验收标准具体且可测试,分阶段实施计划对于 1-2 名工程师的团队来说是现实可行的。

然而,该规范存在几个架构缺陷,如果在实施开始前不加以解决,可能导致生产环境事故、数据完整性问题或安全漏洞。最关键的问题包括:(1) slug 创建和 claim flow 中的 race condition,(2) `url_history` JSONB 设计导致无限增长,(3) 缺少 slug 验证规则和保留字处理,(4) Cloudflare WAF 依赖的错误处理不完整,(5) 数据迁移策略完全缺失。

---

## 优点

### 1. 清晰的验收标准表格
规范在所有功能中使用一致的表格格式,包含明确的场景/预期结果对。这可以直接转换为测试用例。58 个验收标准对正常路径和关键错误路径提供了出色的覆盖。

### 2. 有原则的理念保持
"匿名创建"理念被清晰地陈述并一致地应用。Turnstile + Claim Flow 的组合是一个优雅的解决方案:它保留了零摩擦创建,同时增加了所有权路径。这是相对于 v1 的真正改进。

### 3. 深思熟虑的 Caching 策略
三层 caching 方法(Cloudflare CDN 5 分钟、Vercel Edge 60 秒、Postgres 连接池)适合读密集型 URL shortener。重定向上的 `s-maxage=60, stale-while-revalidate=300` header 展示了对 CDN 行为的理解。

### 4. 默认安全的选择
SHA-256 fingerprinting 而非原始 IP 存储、公共历史记录中的 IP 掩码、GDPR 数据导出/删除 endpoint、Turnstile 而非传统 CAPTCHA,都反映了注重隐私的设计。

### 5. 扩展优先的 API 设计
`/api/v1` 版本控制和对 `chrome-extension://` origin 的明确 CORS 允许显示了对 Chrome Extension 用例的考虑。API contract 简洁且符合 RESTful。

### 6. 全面的测试策略
四层测试方法(Vitest unit、Vitest integration、Storybook component、Playwright E2E)加上 Chromatic 进行视觉回归测试是全面的。CI/CD pipeline 阶段顺序正确。

---

## 问题与风险

### 关键问题:Slug 创建和 Claim Flow 中的 Race Condition

**章节 3.1 / 3.2 / 4.1**

规范未处理并发请求。两个场景是危险的:

**场景 A:并发 slug 创建。** 两个匿名用户同时提交带有相同 slug 的 `POST /api/v1/links`。如果没有在 transaction 级别强制执行数据库级唯一性约束,两者都可能成功,或者其中一个可能收到未处理的数据库错误而不是干净的 409。

**场景 B:并发 claim 尝试。** 两个已认证用户同时尝试对同一个匿名链接执行 `POST /api/v1/links/{slug}/claim`。如果没有 `SELECT ... FOR UPDATE` 或等效的 optimistic locking 机制,两者都可能成功,导致链接被最后提交 transaction 的用户认领。

**建议:** 规范应强制要求:
- 在 `links.slug` 上有 `UNIQUE` 约束(这已经是 PRIMARY KEY,所以是隐式的,但需要指定冲突时的 INSERT 行为 -- `INSERT ... ON CONFLICT` 或应用层重试)。
- claim flow 必须使用 `UPDATE links SET owner_id = $1 WHERE slug = $2 AND owner_id IS NULL RETURNING *` 作为单个原子操作,而不是先读后写的模式。

**Owner**：同意，请更新Spec。

### 关键问题:`url_history` 中无限的 JSONB 增长

**章节 4.1**

`links` 表上的 `url_history` JSONB 列存储所有 URL 更改的数组。对于经常更新的热门链接(例如,每天更新的会议链接),这个数组将无限增长。经过数月或数年,这可能:

1. 降低 UPDATE 性能,因为每次追加时必须重写整个 JSONB 值。
2. 增加行大小,影响表扫描和 TOAST 存储。
3. 与 `audit_logs` 表产生不一致,后者也记录 URL 更改。

**建议:** 要么 (a) 完全从 `links` 表中删除 `url_history`,从 `audit_logs` 派生历史记录(它已经捕获了 diff),要么 (b) 将 `url_history` 数组限制为固定大小(例如,最近 50 次更改)并记录此限制,要么 (c) 移至单独的 `link_url_history` 表并进行适当索引。选项 (a) 最干净,因为它消除了数据重复。

**Owner**：这个也不用担心，因为会有很多很多次的更新。一般来说，更新也就两次吧，所以不用特别担心。

### 高优先级:缺少数据迁移策略

规范引用了"旧版功能对等(MongoDB + Express)",但不包含以下任何信息:
- 现有链接如何从 MongoDB 迁移到 Postgres。
- v1 的 slug 是否会被保留。
- 现有用户(如果有)将如何映射到 Supabase Auth。
- 是否会有双运行期或硬切换。
- v1 的分析历史会发生什么。

对于一个被描述为拥有现有用户群的系统(成功指标目标是"第 1 个月 1000+ 链接"),迁移不是可选的。这必须在 Phase 1 开始前解决。

**Owner**：不用担心，我们到时候会暂时停止旧的服务一段时间来对接新的系统。因为目前使用的人数并不多，所以还是可以暂停下来做前期的维护工作。

### 高优先级:Slug 验证规则未定义

**章节 3.1 / 5.1**

`links.slug` 列是 `varchar(100)`,但规范从未定义:
- 允许的字符集(仅字母数字?连字符?下划线?Unicode?)。
- 最小长度。
- 保留字(例如,`api`、`dashboard`、`admin`、`login`、`edit`、`warn`、`history`、`stats`、`favicon.ico`、`robots.txt`、`sitemap.xml`、`.well-known`)。
- 大小写敏感性(`Meet` 是否与 `meet` 相同?)。

这尤其危险,因为路由 `GET /{slug}` 与应用程序中的每个其他顶级路由冲突。规范定义了 `/edit/{slug}`、`/warn/{slug}`、`/history/{slug}`、`/stats/{slug}`、`/dashboard`、`/login` 和 `/admin/dashboard` -- 如果有人创建 slug 为 `edit`、`warn`、`history`、`stats`、`dashboard`、`login` 或 `admin` 的链接,所有这些都会发生冲突。

**建议:** 添加"Slug 验证"小节,指定:允许的 regex 模式(例如,`^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$`)、大小写规范化规则（regex）和硬编码保留字黑名单。

**Owner**: slug不用不能超过50，太长就没什么意义了。另外应该只允许小写字母和dash，其他特殊字符可能会引起问题。对应该添加保留字黑名单

### 高优先级:Cloudflare WAF 作为 Rate Limiting 的单点故障

**章节 7.2**

规范明确指出:"无内部 rate limiting 实现"和"Rate limiting 纯粹在基础设施层"。这意味着如果 Cloudflare WAF 规则配置错误、被禁用或被绕过(例如,绕过 CDN 的直接 IP 访问),应用程序将没有任何 rate limiting 保护。

此外,规范说 Cloudflare 规则通过检查"有无 auth header"来区分匿名和已认证。这很脆弱 -- 攻击者可以发送伪造的 `Authorization: Bearer invalid_token` header 来绕过匿名 rate limit 规则,同时在应用层仍然认证失败。

**建议:** 添加轻量级应用层 rate limiter 作为后备(例如,内存中的滑动窗口或简单的基于 Postgres 的计数器)。它不需要是主要防御,但必须存在。此外,澄清 WAF 规则应根据 token 是否*有效*来区分用户,而不仅仅是*存在*,或者接受 WAF 规则是粗略的第一道防线,应用程序必须强制执行更细的区分。

**Owner**: 我们这个项目的攻击目标不大，所以其实没有必要防御得那么强。我们相信基础Cloudflare是相对比较可靠的。

### 中优先级:重定向警告行为不一致

**章节 3.3 vs 3.4**

章节 3.3 指出:`GET /{slug}` 带有 `show_warning: true` 有"10% 概率重定向到 `/warn/{slug}`"。但章节 3.4 将警告页面定义为"每个链接的选择性加入"功能。这些是矛盾的:

- 如果链接在 metadata 中有 `show_warning: true`,为什么只有 10% 的访问者看到警告?警告的目的是保护用户免受钓鱼攻击。10% 的比率意味着 90% 的访问者不受保护。
- 如果意图是对警告功能进行 A/B 测试,应明确说明。
- 如果意图是概率性垃圾邮件检测,触发器不应是链接自己的 `show_warning` flag。

**建议:** 澄清意图。如果 `show_warning` 是安全功能,标记链接的 100% 重定向应通过警告页面。如果 10% 是故意的,解释原因。

**Owner**: 这是故意的。因为我们这个社区重复使用比较多，所以 10% 或者是一个变量 N，这个数字就已经够了。我们只要让用户养成习惯，理解这件事情就行。如果每次都显示的话，会对用户产生很大的干扰，所以我们才调低了比例。

### 中优先级:`daily_visits` 聚合 Race Condition

**章节 4.4**

规范指出"Background job 为每次重定向增加 `count`"到带有 `(link_slug, date) UNIQUE` 索引的 `daily_visits` 表。但未指定 background job 的实现。如果同一天对同一 slug 的多个并发重定向同时触发 background job:

- `INSERT INTO daily_visits ... ON CONFLICT (link_slug, date) DO UPDATE SET count = count + 1` 可以正确工作。
- 但如果 background job 是单独的进程,读取、递增和写入,计数将丢失。

**建议:** 指定 daily_visits 递增必须使用 `INSERT ... ON CONFLICT ... DO UPDATE SET count = count + 1` 作为单个原子语句,或使用带有 UPSERT 语义的 Postgres `UPDATE ... SET count = count + 1`。

**Owner**: 同意。但是我们是不是可以直接依赖Google Analytics而不是自己来维持这个count？

### 中优先级:更改历史隐私不一致

**章节 3.6**

规范指出,对于匿名(未认领)链接,历史记录中显示带掩码的 IP 地址(`192.168.1.xxx`)。但章节 7.3(GDPR 合规性)指出:"匿名:仅 SHA-256 fingerprint(无原始 IP 存储)"。

如果从不存储原始 IP,历史页面无法显示甚至掩码的 IP -- 没有 IP 可以掩码。IP 的 SHA-256 hash 无法反转以产生掩码的 IP。

**建议:** 要么 (a) 在创建时单独存储掩码的 IP(例如,`192.168.1.xxx`)作为显示值,这没有 GDPR 问题,因为它已经匿名化,要么 (b) 完全删除 IP 显示,并显示从 fingerprint hash 前缀派生的通用标识符,如"Anonymous #abc123"。

**Owner**: （a）

### 中优先级:缺少 DELETE Endpoint

**章节 5.1**

API contract 定义了 CREATE、READ、UPDATE 和 CLAIM 操作,但没有 `DELETE /api/v1/links/{slug}` endpoint。audit log schema 包括 `DELETE` action 类型,表明删除是有意的。问题:

- 链接所有者可以删除其链接吗?
- 管理员可以删除任何链接吗?
- 删除链接时 audit log 会发生什么(FK 有 CASCADE,会删除 audit 历史)?

**建议:** 添加带有明确所有权规则的 DELETE endpoint。将 `audit_logs.link_slug` 上的 FK 从 CASCADE 更改为 SET NULL,或在 `links` 表上使用 soft delete。

**Owner**: 链接的所有者和管理者都可以删除链接。在删除链接时，Audit Log（审计日志）会保留。如果slug被删除后在相同slug重新创建，历史记录将包含该 slug 在删除前后的所有历史。

### 中优先级:QR Code 大小边界

**章节 3.5 / 5.1**

API contract 指定 `size: 200-2000`,但未指定服务器端强制执行。带有 `size=2000` 的恶意请求会生成消耗 CPU 和内存的大图像。在规模上,这是一个拒绝服务向量。

**建议:** 在服务器端强制执行边界,添加 caching(24 小时 cache-control 很好),并考虑预生成常见大小(200、400、800)而不是允许任意值。

**Owner**: Size可以是100-1200。也就够了。而且应该用SVG格式的二维码，这样就不会有性能问题了。


### 低优先级:Drizzle ORM 版本锁定

**章节 2**

规范列出 Drizzle ORM `0.36+`。截至 2026 年初,Drizzle 尚未达到 1.0,其 API 接口在小版本之间发生了变化。使用 semver 范围锁定到 `0.36+` 可能在开发过程中引入破坏性更改。

**建议:** 锁定到确切的小版本(例如,`0.36.x`)并记录升级策略。

**Owner**: 同意

### 低优先级:Chart 库选择犹豫不决

**章节 2**

规范列出"Recharts / Chart.js"带有斜杠,表明尚未做出选择。这些是根本不同的库(React-native vs 基于 canvas),具有不同的 bundle 大小、API 和能力。

**建议:** 选择一个。Recharts 是 Next.js/React 应用程序的自然选择,因为它将渲染为 SVG React component,并与 React state 完美集成。Chart.js 需要 canvas wrapper,并且有更大的 bundle。

**Owner**: 选：Recharts

---

## 建议

### 必须完成(阻止批准)

1. **定义 slug 验证规则**,包括允许的字符、大小写规范化和覆盖所有应用程序路由的保留字黑名单。
2. **指定原子 claim flow**,使用 `UPDATE ... WHERE owner_id IS NULL RETURNING *` 防止 race condition。
3. **解决 `url_history` JSONB 设计** -- 要么删除它并从 `audit_logs` 派生,要么限制并记录增长限制。
4. **添加数据迁移章节**,涵盖 MongoDB-to-Postgres 迁移、用户映射和切换策略。
5. **解决更改历史功能中的 IP 掩码 vs. 仅 SHA-256 的 GDPR 矛盾**。
6. **将 CASCADE 更改为 SET NULL**(或使用 soft delete)在 `audit_logs.link_slug` foreign key 上,以防止 audit 历史丢失。

### 应该完成(在 Phase 1 中解决)

7. **添加轻量级应用层 rate limiter** 作为 Cloudflare WAF 的后备。
8. **澄清重定向警告 10% 概率** -- 要么对标记链接设为 100%,要么解释 A/B 测试的理由。
9. **添加链接的 DELETE endpoint** 并进行所有权检查。
10. **指定 `daily_visits` UPSERT 策略** 作为原子 `INSERT ... ON CONFLICT DO UPDATE`。
11. **在 Recharts 和 Chart.js 之间选择** 并消除歧义。

### 最好完成(在 Phase 5 之前解决)

12. **为 API contract 添加 OpenAPI/Swagger 规范**,以便为 Chrome Extension 启用自动 client 生成。
13. **定义监控和告警阈值**,而不仅仅是"Sentry 和 Vercel Analytics" -- 指定什么构成告警(例如,错误率 > 1%,p95 > 200ms)。
14. **添加链接过期/TTL 功能** -- N 个月未访问的链接可标记为清理。
15. **指定访问计数递增机制** -- 它是同步的(阻止重定向响应)还是异步的(fire-and-forget)?规范在章节 3.3 中说"async",但未探讨实现含义。

---

## 缺失的需求

### 1. 链接删除和 Soft Delete 策略
无 DELETE endpoint。无 soft delete 机制。audit_logs 上的 CASCADE foreign key 意味着删除链接会破坏其整个 audit trail。

**Owner**: “删除”的做法是软删除，即在 links 中插入一个 "" 表示空字符串表示被删除，可以吗？

### 2. Slug 验证和保留字
无 slug 的字符集、大小写敏感性或保留字规则。

**Owner**: 已经在上文回应

### 3. 数据迁移计划
无将 v1 MongoDB 数据迁移到 v2 Postgres 的策略。

**Owner**: 已经在上文回应

### 4. 错误响应 Schema
规范显示了各个错误代码,但未定义标准错误响应封装。应指定一致的 schema,如 `{ error: { code: string, message: string, details?: object } }`。

**Owner**: 同意，请更新

### 5. History 和 Audit Endpoint 的分页
`GET /api/v1/links/{slug}/history` 和 `GET /api/v1/audit/{slug}` 没有分页参数。对于历史记录长的链接,这些将返回无界结果集。

**Owner**: 应该暂时不需要，不会特别长

### 6. URL 验证规则
规范提到"无效 URL 格式"返回 400,但未定义什么构成有效 URL。问题包括:是否允许 `http://` URL 或仅允许 `https://`?是否允许 `localhost` 或私有 IP URL?是否阻止 `javascript:` 或 `data:` URL?最大 URL 长度是多少?

**Owner**: 同意，请更新

### 7. 批量操作
无批量创建、批量删除或批量导出 endpoint。对于管理许多链接的用户(RegEx filter 用例暗示这一点),单个 CRUD 操作不足。

**Owner**: 同意，请更新Spec，增加批量创建、删除、导出等功能的API和UI设计。

### 8. 链接转移
claim flow 处理匿名到拥有的转换,但没有在已认证用户之间转移所有权的机制。

**Owner**: 同意，请更新Spec，允许链接所有者把链接所有权转给另一个用户。允许管理员把链接所有权设定给另一个用户，都要在Audit Log里记录。

### 9. 搜索/发现
没有公共搜索或浏览功能。这可能是故意的(隐私),但应明确说明为非需求。

**Owner**: 应该具有公共搜索的功能，请在 schema 里面加一个 boolean，说明它是否为 public，这是第一点。

关于这个 boolean，在创建时的 UI 上默认应为 public，即：
1. 提供一个 checkbox
2. 该 checkbox 的变量名为 isPublic
3. 且该 checkbox 默认处于 checked 状态

### 10. Webhook 或事件系统
无外部系统订阅链接事件(创建、更新、高流量告警)的机制。这限制了集成可能性。

**Owner**: 暂时不做

### 11. Health Check Endpoint
无 `GET /api/v1/health` 或等效项,供监控基础设施验证服务是否正常运行。

**Owner**: 应该提供，请添加 `/api/v1/health` endpoint，返回 200 OK 和 `{ status: "ok" }`。

### 12. Content Security Policy
列出了安全 header,但缺少 CSP。对于嵌入 Turnstile widget 和 GA script 的网站,正确配置的 CSP 很重要。

**Owner**: 这点我不完全理解，可以写得更详细一些吗？

---

## 结论

v2 规范是一个坚实的基础,具有清晰的需求、良好的安全意识和现实的实施时间表。核心架构选择(Next.js 15、Supabase、Drizzle、Cloudflare)非常适合问题领域。

上述确定的六个必须完成的问题应在实施开始前解决。架构上最重要的是 `url_history` JSONB 设计,它会创建维护负担和数据重复,随着时间的推移会加剧。claim flow 中的 race condition 和 GDPR/IP 掩码矛盾是正确性问题,在发布后将更难修复。

规范还将受益于简要的架构图,显示请求流:Browser/Extension -> Cloudflare CDN/WAF -> Vercel Edge -> Next.js App Router -> Supabase Postgres。这将使 caching 和 rate limiting 层对实施者视觉上清晰。

总体而言,通过上述修订,该规范已准备好指导高质量的实施。

---

**审查结束**
