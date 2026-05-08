# Manual Test Guide: Link Permission Controls

> 本文档提供手动测试所有权限控制功能的详细步骤。
> 这些测试验证了安全漏洞修复（匿名链接无法被任何人修改）。

**Status**: ✅ Implementation Complete
**Date**: 2026-02-10

## Quick Start

1. **启动开发服务器**
   ```bash
   npm run dev
   # 访问 http://localhost:3000
   ```

2. **在 Supabase 创建测试用户**
   - 访问 Supabase Dashboard → Authentication
   - 创建两个测试用户：
     - `test-user-a@example.com` / password: `TestPassword123!`
     - `test-user-b@example.com` / password: `TestPassword123!`

## Test Scenarios

### Scenario 1: 匿名链接保护 (Anonymous Link Protection)

**目标**: 验证匿名链接不能被任何人修改（除非先声明所有权）

#### Test 1.1: ❌ 匿名用户无法修改匿名链接

```bash
# Step 1: 创建匿名链接（未登录）
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-anon-1",
    "url": "https://example.com",
    "turnstileToken": "mock-token"
  }'

# 预期响应: 201
# 响应体应包含: "ownerId": null

# Step 2: 尝试修改链接（仍未登录）
curl -X PUT http://localhost:3000/api/v1/links/test-anon-1 \
  -H "Content-Type: application/json" \
  -d '{"url": "https://malicious.com"}'

# ❌ 预期: 403 Forbidden
# 预期错误码: ANONYMOUS_LINK_MODIFICATION_FORBIDDEN
```

**验证点**:
- [ ] 返回状态码 403
- [ ] 错误码为 `ANONYMOUS_LINK_MODIFICATION_FORBIDDEN`
- [ ] 链接 URL 未被改变（仍为 `https://example.com`）

#### Test 1.2: ❌ 已登录用户无法修改未认领的匿名链接

```bash
# Step 1: 创建匿名链接（未登录）
# 使用 Test 1.1 的链接

# Step 2: 登录测试用户 A
# - 访问 http://localhost:3000/auth/login
# - 使用 test-user-a@example.com / password
# - 记录 JWT token（从 browser console: localStorage.getItem('sb-...'))

# Step 3: 尝试修改链接（已登录但未声明所有权）
curl -X PUT http://localhost:3000/api/v1/links/test-anon-1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{"url": "https://hijacked.com"}'

# ❌ 预期: 403 Forbidden
# 预期错误码: ANONYMOUS_LINK_MODIFICATION_FORBIDDEN
```

**验证点**:
- [ ] 返回状态码 403
- [ ] 链接 URL 未被改变

#### Test 1.3: ✅ 声明所有权后可以修改链接

```bash
# Step 1: 创建匿名链接（使用 Test 1.1 的链接）

# Step 2: 声明所有权
curl -X POST http://localhost:3000/api/v1/links/test-anon-1/claim \
  -H "Authorization: Bearer $JWT_TOKEN_A"

# ✅ 预期: 200 OK
# 响应体应包含: "ownerId": "<user_id_a>"

# Step 3: 修改链接
curl -X PUT http://localhost:3000/api/v1/links/test-anon-1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{"url": "https://updated.com"}'

# ✅ 预期: 200 OK
# 响应体应包含: "url": "https://updated.com"
```

**验证点**:
- [ ] 声明所有权成功（返回 200，ownerId 被设置）
- [ ] 修改链接成功（返回 200，URL 被更新）

#### Test 1.4: ✅ 用户界面提示声明所有权

```
# UI 测试流程:
# 1. 未登录状态，创建匿名链接
# 2. 登录用户 A
# 3. 访问 /edit/test-anon-1
# 4. 应该看到警告提示: "这是一个匿名链接，要修改此链接，请先声明所有权"
# 5. 点击"声明所有权"按钮
# 6. 提示应该消失，表单应该可用
```

**验证点**:
- [ ] 登录后访问编辑页面显示 claim 提示
- [ ] Claim 按钮可点击
- [ ] 点击后提示消失，表单变为可编辑

---

### Scenario 2: 只有所有者可以修改 (Owner-Only Modification)

**目标**: 验证非所有者无法修改他人的链接

#### Test 2.1: ❌ 用户B无法修改用户A的链接

```bash
# Step 1: 用户A创建链接（已登录）
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{
    "slug": "test-owned-by-a",
    "url": "https://user-a.com"
  }'

# ✅ 预期: 201 Created
# 响应体应包含: "ownerId": "<user_a_id>"

# Step 2: 用户B尝试修改
curl -X PUT http://localhost:3000/api/v1/links/test-owned-by-a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_B" \
  -d '{"url": "https://hijacked-by-b.com"}'

# ❌ 预期: 403 Forbidden
# 预期错误码: FORBIDDEN
```

**验证点**:
- [ ] 返回状态码 403
- [ ] 错误码为 `FORBIDDEN`
- [ ] 链接 URL 未被改变

#### Test 2.2: ❌ 用户B无法删除用户A的链接

```bash
# 使用 Test 2.1 的链接
curl -X DELETE http://localhost:3000/api/v1/links/test-owned-by-a \
  -H "Authorization: Bearer $JWT_TOKEN_B"

# ❌ 预期: 403 Forbidden
# 预期错误码: FORBIDDEN
```

**验证点**:
- [ ] 返回状态码 403
- [ ] 链接仍然存在（未被删除）

#### Test 2.3: ✅ 用户A可以修改自己的链接

```bash
# 使用 Test 2.1 的链接
curl -X PUT http://localhost:3000/api/v1/links/test-owned-by-a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{"url": "https://updated-by-a.com"}'

# ✅ 预期: 200 OK
# 响应体应包含: "url": "https://updated-by-a.com"
```

**验证点**:
- [ ] 返回状态码 200
- [ ] URL 被更新

---

### Scenario 3: 已删除链接的重用保护 (Deleted Slug Reuse Protection)

**目标**: 验证已删除的 slug 只能由原所有者重用

#### Test 3.1: ❌ 其他用户无法重用已删除的 slug

```bash
# Step 1: 用户A创建链接
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{
    "slug": "test-deleted-1",
    "url": "https://user-a.com"
  }'

# Step 2: 用户A删除链接
curl -X DELETE http://localhost:3000/api/v1/links/test-deleted-1 \
  -H "Authorization: Bearer $JWT_TOKEN_A"

# ✅ 预期: 200 OK

# Step 3: 用户B尝试创建同样的 slug
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_B" \
  -d '{
    "slug": "test-deleted-1",
    "url": "https://user-b-hijack.com"
  }'

# ❌ 预期: 403 Forbidden
# 预期错误码: DELETED_SLUG_FORBIDDEN
```

**验证点**:
- [ ] 删除成功（返回 200）
- [ ] 用户B创建失败（返回 403，错误码 DELETED_SLUG_FORBIDDEN）

#### Test 3.2: ✅ 原所有者可以重新激活已删除的 slug

```bash
# 使用 Test 3.1 的链接
# Step 3: 用户A尝试重新创建同样的 slug
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{
    "slug": "test-deleted-1",
    "url": "https://user-a-new.com"
  }'

# ✅ 预期: 200 OK
# 响应体应包含: "message": "Link reactivated successfully"
# 响应体应包含: "url": "https://user-a-new.com"
```

**验证点**:
- [ ] 返回状态码 200（不是 201 Created）
- [ ] 响应消息包含 "reactivated"
- [ ] URL 被更新为新的值

#### Test 3.3: ❌ 匿名用户无法重用已删除的 slug

```bash
# 使用 Test 3.1 的链接（用户A已删除）

# 尝试匿名创建
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-deleted-1",
    "url": "https://hijacked.com",
    "turnstileToken": "mock-token"
  }'

# ❌ 预期: 403 Forbidden
# 预期错误码: DELETED_SLUG_FORBIDDEN
```

**验证点**:
- [ ] 返回状态码 403
- [ ] 错误码为 DELETED_SLUG_FORBIDDEN

#### Test 3.4: ✅ 原所有者可以多次重用 slug

```bash
# Step 1: 创建 → 删除 → 重新激活
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{
    "slug": "test-reuse-cycle",
    "url": "https://v1.com"
  }'

curl -X DELETE http://localhost:3000/api/v1/links/test-reuse-cycle \
  -H "Authorization: Bearer $JWT_TOKEN_A"

curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{
    "slug": "test-reuse-cycle",
    "url": "https://v2.com"
  }'

# ✅ 预期: 200 OK (reactivated)

# Step 2: 再次删除 → 重新激活
curl -X DELETE http://localhost:3000/api/v1/links/test-reuse-cycle \
  -H "Authorization: Bearer $JWT_TOKEN_A"

curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{
    "slug": "test-reuse-cycle",
    "url": "https://v3.com"
  }'

# ✅ 预期: 200 OK (reactivated)
```

**验证点**:
- [ ] 第一次重新激活成功
- [ ] 第二次重新激活也成功
- [ ] 最终 URL 为 "https://v3.com"

---

### Scenario 4: 编辑页面权限检查 (Edit Page Permission Checks)

**目标**: 验证编辑页面的访问控制和重定向

#### Test 4.1: ✅ 链接存在时，未登录用户被重定向到登录页面

```
# UI 测试:
# 1. 使用匿名用户创建链接 "test-redirect"
# 2. 未登录状态，访问 http://localhost:3000/edit/test-redirect
# 3. 应该自动重定向到 http://localhost:3000/auth/login?returnTo=/edit/test-redirect
```

**验证点**:
- [ ] 自动重定向到登录页面
- [ ] returnTo 参数正确
- [ ] 登录后返回 /edit/test-redirect

#### Test 4.2: ❌ 非所有者被拒绝访问编辑页面

```
# UI 测试:
# 1. 用户A创建链接 "test-owned"
# 2. 用户A登出，用户B登入
# 3. 访问 http://localhost:3000/edit/test-owned
# 4. 应该显示错误信息: "你没有权限编辑这个链接"
```

**验证点**:
- [ ] 显示错误消息
- [ ] 不允许编辑表单

#### Test 4.3: ✅ 所有者可以访问编辑页面

```
# UI 测试:
# 1. 用户A创建链接 "test-owned-a"
# 2. 用户A已登入
# 3. 访问 http://localhost:3000/edit/test-owned-a
# 4. 应该显示编辑表单
```

**验证点**:
- [ ] 显示编辑表单
- [ ] 表单包含正确的 URL 和元数据

#### Test 4.4: ✅ 匿名链接显示 Claim 提示

```
# UI 测试:
# 1. 创建匿名链接 "test-anon-claim"
# 2. 用户A登入
# 3. 访问 http://localhost:3000/edit/test-anon-claim
# 4. 应该显示黄色警告: "这是一个匿名链接"
# 5. 应该显示"声明所有权"按钮
```

**验证点**:
- [ ] 显示 claim 提示
- [ ] 显示"声明所有权"按钮
- [ ] 点击按钮后提示消失

---

### Scenario 5: API 验证错误优先级 (Validation Error Priority)

**目标**: 验证权限检查先于其他验证

#### Test 5.1: 权限检查先于 URL 验证

```bash
# 创建匿名链接
curl -X POST http://localhost:3000/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-error-priority",
    "url": "https://example.com",
    "turnstileToken": "mock-token"
  }'

# 尝试修改为无效 URL（但应该因为权限问题失败，而不是 URL 验证）
curl -X PUT http://localhost:3000/api/v1/links/test-error-priority \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN_A" \
  -d '{"url": "invalid-url"}'

# ❌ 预期: 403 Forbidden
# 预期错误码: ANONYMOUS_LINK_MODIFICATION_FORBIDDEN
# （而不是 400 Bad Request 的 URL_INVALID 错误）
```

**验证点**:
- [ ] 返回 403（权限错误）而不是 400（验证错误）

---

## Test Report Template

在完成所有测试后，请记录结果：

```markdown
# Test Results - Link Permission Controls

**Date**: 2026-02-10
**Tester**: [Your Name]
**Environment**: Local (http://localhost:3000)

## Scenario 1: Anonymous Link Protection
- [ ] Test 1.1: Anonymous cannot modify
- [ ] Test 1.2: Authenticated user cannot modify without claim
- [ ] Test 1.3: Can modify after claim
- [ ] Test 1.4: UI shows claim prompt
**Status**: ✅ PASS / ❌ FAIL

## Scenario 2: Owner-Only Modification
- [ ] Test 2.1: Non-owner cannot modify
- [ ] Test 2.2: Non-owner cannot delete
- [ ] Test 2.3: Owner can modify
**Status**: ✅ PASS / ❌ FAIL

## Scenario 3: Deleted Slug Reuse Protection
- [ ] Test 3.1: Other users blocked
- [ ] Test 3.2: Original owner can reactivate
- [ ] Test 3.3: Anonymous users blocked
- [ ] Test 3.4: Owner can reuse multiple times
**Status**: ✅ PASS / ❌ FAIL

## Scenario 4: Edit Page Permission Checks
- [ ] Test 4.1: Unauthenticated redirected to login
- [ ] Test 4.2: Non-owner gets error
- [ ] Test 4.3: Owner can edit
- [ ] Test 4.4: Anonymous link shows claim prompt
**Status**: ✅ PASS / ❌ FAIL

## Scenario 5: API Validation Priority
- [ ] Test 5.1: Permission checked before URL validation
**Status**: ✅ PASS / ❌ FAIL

## Summary
- **Total Tests**: 18
- **Passed**: XX
- **Failed**: XX
- **Overall Status**: ✅ PASS / ❌ FAIL

## Issues Found
[List any issues or unexpected behaviors]

## Notes
[Any additional observations]
```

---

## Integration Test Files

完整的自动化测试套件已创建：

- **文件**: `/tests/integration/links.permissions.test.ts`
- **测试数**: 18 个 test cases
- **覆盖范围**:
  - 匿名链接保护（5 个 tests）
  - 所有者权限（5 个 tests）
  - 已删除 slug 重用（4 个 tests）
  - 边界情况和状态转换（3 个 tests）
  - 审计日志（1 个 test）

要运行这些测试，需要：
1. 启动开发服务器：`npm run dev`
2. 在另一个终端运行：`npm test -- tests/integration/links.permissions.test.ts`

---

## Security Checklist

完成以下安全检查：

- [ ] ✅ 匿名链接无法被任何人修改（除非先 claim）
- [ ] ✅ 链接修改需要验证所有权
- [ ] ✅ 链接删除需要验证所有权
- [ ] ✅ 已删除 slug 受到保护，只能由原所有者重用
- [ ] ✅ API 层进行权限检查（不仅仅是 UI 层）
- [ ] ✅ 权限检查在其他验证之前进行
- [ ] ✅ 所有操作都被审计日志记录

---

## Known Limitations

1. **Turnstile 验证**：测试使用 mock token（`mock-token`），生产环境需要真实验证
2. **认证状态**：手动测试需要真实的 JWT token，推荐使用浏览器开发者工具获取

---

## Next Steps

- 完成所有手动测试并记录结果
- 在生产环境前进行完整的 E2E 测试
- 验证审计日志正确记录所有操作
- 考虑添加自动化 UI 测试（使用 Playwright 或 Cypress）
