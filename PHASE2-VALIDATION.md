# Phase 2 验证清单

Phase 2 Core API Development 完成度验证指南。

## 🚀 快速验证（5 分钟）

```bash
# 1. 类型检查
npm run type-check

# 2. 运行所有单元测试
npm test

# 3. 运行集成测试
npm test tests/integration

# 4. 生成覆盖率报告
npm run test:coverage

# 5. Lint 检查
npm run lint

# 6. 构建
npm run build
```

**预期结果：**
- ✅ 0 TypeScript 错误
- ✅ 256+ 测试通过（120 unit + 136 integration）
- ✅ 测试覆盖率 ≥ 80%
- ✅ 0 lint 错误
- ✅ 构建成功

---

## ✅ 文件完成度检查清单

### Track A: LinkService + Core Routes (6 files)
```bash
ls -la src/lib/services/link.service.ts
ls -la src/lib/db/atomic-operations.ts
ls -la src/app/api/v1/links/route.ts
ls -la src/app/api/v1/\[...\]slug\]/route.ts
ls -la src/app/api/v1/links/\[slug\]/route.ts
ls -la tests/unit/services/link.service.test.ts
```

**检查清单：**
- [ ] LinkService.create() 有 Turnstile 验证
- [ ] LinkService.claim() 原子操作（WHERE owner_id IS NULL）
- [ ] LinkService.update() 更新 URL history
- [ ] LinkService.delete() 软删除
- [ ] atomicCreateLink() 处理 UNIQUE 约束冲突
- [ ] atomicClaimLink() 处理并发声明
- [ ] GET /{slug} 返回 302 重定向
- [ ] POST /api/v1/links 返回 201 Created
- [ ] GET /api/v1/links 支持分页和过滤
- [ ] 40+ 单元测试通过

### Track B: AuditService + Analytics (6 files)
```bash
ls -la src/lib/services/audit.service.ts
ls -la src/lib/services/analytics.service.ts
ls -la src/app/api/v1/audit/\[slug\]/route.ts
ls -la src/app/api/v1/stats/me/route.ts
ls -la src/app/api/v1/stats/links/\[slug\]/route.ts
ls -la tests/unit/services/audit.service.test.ts
```

**检查清单：**
- [ ] AuditService.logCreate() 记录 CREATE 操作
- [ ] AuditService.logUpdate() 包含 before/after diff
- [ ] AuditService.logClaim() 记录所有权转移
- [ ] AnalyticsService 支持 regex 过滤
- [ ] Daily visits 使用原子 UPSERT（ON CONFLICT）
- [ ] GET /api/v1/audit/{slug} 返回分页日志
- [ ] GET /api/v1/stats/me 支持正则表达式过滤
- [ ] GET /api/v1/stats/links/{slug} 返回 30 天数据
- [ ] 30+ 单元测试通过
- [ ] Audit diff 正确追踪字段变化

### Track C: Turnstile + IP Masking (6 files)
```bash
ls -la src/lib/services/turnstile.service.ts
ls -la src/lib/services/ip-masking.service.ts
ls -la src/lib/middleware/turnstile-guard.ts
ls -la src/app/api/v1/links/\[slug\]/claim/route.ts
ls -la src/app/api/v1/links/\[slug\]/transfer/route.ts
ls -la tests/unit/services/turnstile.test.ts
```

**检查清单：**
- [ ] TurnstileService.verify() 调用 Cloudflare
- [ ] Token 过期检查（最长 2 分钟）
- [ ] 10 秒超时保护
- [ ] IPMaskingService 掩盖 IPv4（最后八位为 *）
- [ ] IPMaskingService 掩盖 IPv6（保留前 3 组）
- [ ] IP 哈希存储（SHA-256 + salt）
- [ ] 角色权限检查（仅所有者/admin 可见原始 IP）
- [ ] POST /api/v1/links/{slug}/claim 原子操作
- [ ] POST /api/v1/links/{slug}/transfer 转移所有权
- [ ] 48+ 单元测试通过

### Track D: Integration Tests (12 files, 136+ cases)
```bash
ls -la tests/integration/
ls -la tests/integration/setup.ts
ls -la tests/integration/links.*.test.ts
```

**检查清单：**
- [ ] 15 个创建测试（包括 Turnstile 验证）
- [ ] 8 个声明测试（包括并发竞争）
- [ ] 11 个更新测试（包括 URL history）
- [ ] 11 个删除测试
- [ ] 13 个解析测试（包括原子访问计数）
- [ ] 11 个转移测试
- [ ] 10 个批量操作测试
- [ ] 13 个审计日志测试
- [ ] 13 个统计测试（包括正则过滤）
- [ ] 12 个二维码测试
- [ ] 19 个错误处理测试
- [ ] 全部 136+ 集成测试通过

---

## 📊 功能验证

### 1. 原子操作验证

```bash
# 创建同一 slug 的并发请求 → 仅 1 个成功 (201)，其他 409 冲突
npm test -- links.create.test.ts

# 并发声明同一 anonymous slug → 仅 1 个成功 (200)，其他 409
npm test -- links.claim.test.ts

# 10 个并发访问同一 slug → visit count += 10（原子 UPSERT）
npm test -- links.resolve.test.ts
```

**预期结果：** ✅ 所有原子操作通过

### 2. Turnstile 验证

```bash
# Anonymous user 需要 Turnstile token
npm test -- "Anonymous user without Turnstile"

# 无效 token → 403 TURNSTILE_INVALID
npm test -- "invalid Turnstile token"

# 已认证用户跳过 Turnstile
npm test -- "Authenticated user skips Turnstile"
```

**预期结果：** ✅ Turnstile 流程正确

### 3. IP 掩盖验证

```bash
# 查看审计日志中的 IP 掩盖
npm test -- "history shows masked IP"

# 检查 IP 哈希存储（不可逆）
npm test -- "audit log contains hashed IP"

# 验证角色权限（仅所有者/admin）
npm test -- "owner can see actor display"
```

**预期结果：** ✅ GDPR 合规

### 4. 差异追踪验证

```bash
# 检查 UPDATE 操作的 before/after diff
npm test -- "url history tracked"

# 检查字段变化记录
npm test -- "audit diff includes changes"

# 检查 CLAIM 操作的所有权转移
npm test -- "claim audit log created"
```

**预期结果：** ✅ 差异完整追踪

### 5. 正则表达式过滤验证

```bash
# 用户统计中的正则过滤
npm test -- "user stats with regex filter"

# 无效正则 → 400 INVALID_REGEX
npm test -- "invalid regex in filter"
```

**预期结果：** ✅ 正则过滤工作正常

---

## 🔍 详细验证脚本

### 完整测试套件

```bash
#!/bin/bash
set -e

echo "🧪 Phase 2 完整验证开始..."

echo "1️⃣ 类型检查..."
npm run type-check

echo "2️⃣ ESLint..."
npm run lint

echo "3️⃣ 单元测试..."
npm test tests/unit/services
npm test tests/unit/db

echo "4️⃣ 集成测试..."
npm test tests/integration

echo "5️⃣ 覆盖率报告..."
npm run test:coverage

echo "6️⃣ 构建..."
npm run build

echo "✅ Phase 2 验证完成！"
echo ""
echo "总结："
echo "  ✅ 类型安全"
echo "  ✅ 代码规范"
echo "  ✅ 256+ 测试通过"
echo "  ✅ 覆盖率 ≥ 80%"
echo "  ✅ 生产构建成功"
```

保存为 `validate-phase2.sh`：
```bash
chmod +x validate-phase2.sh
./validate-phase2.sh
```

---

## 📋 API 端点验证

### 本地测试（开发服务器）

```bash
# 启动开发服务器
npm run dev &

# 等待启动
sleep 2

# 1. 健康检查
curl http://localhost:3000/api/v1/health

# 2. 创建链接（无 Turnstile，会失败）
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{"slug":"test","url":"https://example.com"}'
# 预期：403 TURNSTILE_REQUIRED

# 3. 创建链接（有 Turnstile mock）
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{"slug":"test","url":"https://example.com","turnstileToken":"mock-token"}'
# 预期：201 Created

# 4. 解析链接（重定向）
curl -L http://localhost:3000/test
# 预期：302 Location: https://example.com

# 5. 列出链接
curl "http://localhost:3000/api/v1/links?owner=me" \
  -H "Authorization: Bearer YOUR_JWT"
# 预期：200 OK with items array
```

---

## 🔐 安全性检查

### Turnstile 验证
- [ ] 所有 anonymous POST 需要 turnstileToken
- [ ] 已认证用户可以跳过 Turnstile
- [ ] Token 过期检查（> 2 分钟）
- [ ] 网络超时（> 10s）返回 503

### IP 安全（GDPR）
- [ ] 原始 IP 永远不存储在审计日志中
- [ ] 审计日志存储 SHA-256(IP + salt)
- [ ] 公共历史中的 IP 掩盖（192.168.1.*）
- [ ] 仅所有者和 admin 可见原始 IP

### 所有权验证
- [ ] UPDATE 需要所有权
- [ ] DELETE 需要所有权
- [ ] TRANSFER 需要所有权（anonymous 不可转移）
- [ ] Admin 可以覆盖所有权检查

---

## 📈 性能检查

### 原子操作性能

```bash
# 运行并发压力测试
npm test -- "concurrent claims"
npm test -- "concurrent visits"

# 预期：所有操作在 500ms 内完成
```

### 查询性能

```bash
# 大型数据集分页
npm test -- "pagination works"

# 正则表达式过滤
npm test -- "regex filter performance"

# 预期：< 1000ms 响应时间
```

---

## 🚀 部署前检查清单

### 代码质量
- [ ] TypeScript strict 模式无错误
- [ ] ESLint 通过
- [ ] 所有测试通过（256+）
- [ ] 测试覆盖率 ≥ 80%
- [ ] 没有未使用的变量
- [ ] 没有 console.log（除 error/warn）

### 功能完整性
- [ ] 所有 18+ API 端点实现
- [ ] Turnstile 集成
- [ ] 审计日志系统
- [ ] IP 掩盖（GDPR）
- [ ] 原子操作
- [ ] 正则过滤

### 安全性
- [ ] SQL 注入防护（使用参数化查询）
- [ ] XSS 防护（不信任用户输入）
- [ ] CSRF 防护（Next.js 内置）
- [ ] 认证检查（所有保护路由）
- [ ] 所有权验证（CRUD 操作）

### 数据库
- [ ] Schema 迁移已应用
- [ ] 索引已创建
- [ ] 约束条件已验证
- [ ] 外键关系正确

### 监控准备
- [ ] Error tracking 配置（Sentry）
- [ ] 日志聚合（ELK/Datadog）
- [ ] 性能监控（Vercel Analytics）
- [ ] Alert 规则配置

---

## 🎯 验证结果

当以下全部通过时，Phase 2 完成：

```
✅ 所有 30 个文件已创建
✅ TypeScript 类型检查：0 错误
✅ ESLint：0 错误
✅ 单元测试：120+ 通过
✅ 集成测试：136+ 通过
✅ 覆盖率：≥ 80%
✅ 构建：成功
✅ 原子操作：正确
✅ Turnstile：集成完成
✅ IP 掩盖：GDPR 合规
✅ 审计日志：完整追踪
✅ 正则过滤：工作正常
```

---

## 后续步骤

Phase 2 验证通过后，可以开始 Phase 3：

1. ✅ 前端 UI（React 组件）
2. ✅ 链接创建表单
3. ✅ 用户仪表板
4. ✅ 分析可视化
5. ✅ 组件测试（Storybook）

---

**预计验证时间：10-15 分钟**

如有测试失败，查看详细日志：
```bash
npm test -- --reporter=verbose
npm run test:ui  # 交互式调试
```
