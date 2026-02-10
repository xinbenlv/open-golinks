# 实现链接编辑权限控制和登录页面

**Date**: 2026-02-10
**Duration**: 预估 3-4 小时
**Priority**: P0（安全漏洞修复）
**Status**: 📋 Planning

## Context（背景）

当前系统存在安全漏洞：匿名创建的链接（`ownerId = null`）可以被任何未登录用户修改和删除。这是因为权限检查 `current.ownerId !== userId` 在两者都为 `null` 时会通过检查。

**用户需求**：
1. ✅ 第一次创建链接可以未登录（已支持）
2. ❌ 创建后要修改/删除必须登录（当前有漏洞）
3. ❌ 删除后重新创建同样的 slug 也需要登录（当前未检查）

**用户选择的方案**：
- 使用 Supabase Auth UI 组件库创建登录页面
- 已删除的 slug 只有原所有者可以重用（最严格）
- 匿名链接必须通过 `/api/v1/links/[slug]/claim` 声明所有权后才能编辑

## Overview（概览）

实现完整的链接编辑权限控制系统，包括：
1. 创建登录页面（使用 `@supabase/auth-ui-react`）
2. 修改编辑页面增加认证检查和重定向
3. 强化 API 权限检查，修复匿名链接漏洞
4. 实现软删除 slug 的重用权限检查
5. 添加新的错误代码和用户友好的提示

## Deliverables（交付物）

1. **登录页面** - `/src/app/auth/login/page.tsx`
2. **修改后的编辑页面** - `/src/app/edit/[slug]/page.tsx`
3. **更新的 API 路由** - `/src/app/api/v1/links/[slug]/route.ts` 和 `/src/app/api/v1/links/route.ts`
4. **更新的服务层** - `/src/lib/services/link.service.ts`
5. **新增错误代码** - `/src/lib/constants/errors.ts`
6. **测试用例** - 验证权限检查的集成测试

## Implementation Steps（实现步骤）

### Step 1: 安装依赖

安装 Supabase Auth UI 组件库：

```bash
npm install @supabase/auth-ui-react @supabase/auth-ui-shared
```

### Step 2: 创建登录页面

**文件**: `/src/app/auth/login/page.tsx`

**功能**：
- 使用 `@supabase/auth-ui-react` 的 `<Auth>` 组件
- 支持邮箱/密码登录
- 支持 `returnTo` 查询参数（登录后返回原页面）
- 检查用户是否已登录，如果已登录则自动重定向

**支持的认证方式**：
- ✅ 邮箱/密码登录
- ✅ Magic Link（无密码邮箱登录）- Supabase 原生支持
- ✅ Google OAuth - Supabase 原生支持（需要在 Dashboard 配置）

**实现要点**：
```typescript
'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { getSupabaseBrowserClient } from '@/lib/auth/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';

  // 检查认证状态
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(returnTo);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [returnTo, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">登录到 Open GoLinks</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}  // 启用 Google OAuth
          view="magic_link"        // 默认显示 Magic Link 视图
          showLinks={true}         // 显示"使用密码登录"链接
          redirectTo={`${window.location.origin}${returnTo}`}
          magicLink={true}         // 启用 Magic Link
        />

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>支持的登录方式：</p>
          <ul className="mt-2 space-y-1">
            <li>📧 Magic Link（无密码登录）</li>
            <li>🔑 邮箱 + 密码</li>
            <li>🌐 Google 账号</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

**Supabase Dashboard 配置**（Google OAuth）：
1. 访问 Supabase Dashboard → Authentication → Providers
2. 启用 Google Provider
3. 添加 Google OAuth Client ID 和 Client Secret
   - 在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 2.0 凭据
   - 添加授权的重定向 URI：`https://[project-id].supabase.co/auth/v1/callback`
4. 保存配置

**Magic Link 配置**：
- Magic Link 默认启用，无需额外配置
- 用户输入邮箱后，Supabase 会发送包含登录链接的邮件
- 点击链接即可完成登录（无需密码）

### Step 3: 修改编辑页面增加认证检查

**文件**: `/src/app/edit/[slug]/page.tsx`

**修改逻辑**：
1. 获取链接信息后，检查链接是否已存在
2. 如果链接已存在，获取当前用户
3. 如果未登录，重定向到登录页面（带 `returnTo` 参数）
4. 如果已登录但不是所有者（且链接有所有者），显示错误提示

**关键代码修改**（第22-40行区域）：

```typescript
useEffect(() => {
  (async () => {
    const { slug: slugValue } = await params;
    setSlug(slugValue);

    try {
      // 1. 尝试获取现有链接
      const response = await fetch(`/api/v1/links/${slugValue}`);
      if (response.ok) {
        const data = await response.json();
        const link = data.data;

        // 2. 如果链接存在，检查认证状态
        const { data: { user } } = await supabase.auth.getUser();

        // 3. 如果未登录，重定向到登录页面
        if (!user) {
          window.location.href = `/auth/login?returnTo=/edit/${slugValue}`;
          return;
        }

        // 4. 如果链接有所有者且不是当前用户，显示权限错误
        if (link.ownerId && link.ownerId !== user.id) {
          setError('你没有权限编辑这个链接');
          setIsLoading(false);
          return;
        }

        // 5. 如果链接是匿名的，提示需要先声明所有权
        if (!link.ownerId) {
          setShowClaimPrompt(true);
        }

        setExistingLink(link);
      }
    } catch {
      // 链接不存在，继续显示创建表单
    } finally {
      setIsLoading(false);
    }
  })();
}, [params]);
```

**新增状态**：
```typescript
const [error, setError] = useState<string | null>(null);
const [showClaimPrompt, setShowClaimPrompt] = useState(false);
```

**新增 UI**：显示声明所有权的提示和按钮。

### Step 4: 强化 API 权限检查

#### 4.1 修改 PUT /api/v1/links/[slug]

**文件**: `/src/app/api/v1/links/[slug]/route.ts` (第59-108行)

**修改重点**：
```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const { slug } = await params;
    const body = await request.json();

    // 获取现有链接
    const oldLink = await linkService.get(slug);
    if (!oldLink) {
      return NextResponse.json(
        errorResponse(ErrorCode.LINK_NOT_FOUND, 'Link not found'),
        { status: 404 }
      );
    }

    // 🔒 新增：严格权限检查
    // 1. 如果链接是匿名的，必须先声明所有权
    if (!oldLink.ownerId) {
      return NextResponse.json(
        errorResponse(
          ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN,
          'This anonymous link must be claimed before editing. Use POST /api/v1/links/{slug}/claim to claim ownership.'
        ),
        { status: 403 }
      );
    }

    // 2. 必须是所有者或管理员
    if (oldLink.ownerId !== user?.id && user?.role !== 'admin') {
      return NextResponse.json(
        errorResponse(ErrorCode.FORBIDDEN, 'You do not have permission to edit this link'),
        { status: 403 }
      );
    }

    // 执行更新
    const updated = await linkService.update(
      slug,
      user?.id || null,
      body,
      user?.role === 'admin'
    );

    // 审计日志
    await auditService.logUpdate(
      slug,
      oldLink,
      updated,
      user?.id || null,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return NextResponse.json(
      successResponse({
        slug: updated.slug,
        url: updated.url,
        updatedAt: updated.updatedAt.toISOString(),
        urlHistory: updated.urlHistory,
      })
    );
  } catch (error: any) {
    const statusCode = getHttpStatusCode(error.code) || 500;
    return NextResponse.json(
      errorResponse(error.code, error.message),
      { status: statusCode }
    );
  }
}
```

#### 4.2 修改 DELETE /api/v1/links/[slug]

**文件**: `/src/app/api/v1/links/[slug]/route.ts` (第113-147行)

**修改逻辑**（与 PUT 类似）：
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const { slug } = await params;

    // 获取现有链接
    const link = await linkService.get(slug);
    if (!link) {
      return NextResponse.json(
        errorResponse(ErrorCode.LINK_NOT_FOUND, 'Link not found'),
        { status: 404 }
      );
    }

    // 🔒 新增：严格权限检查
    // 1. 如果链接是匿名的，必须先声明所有权
    if (!link.ownerId) {
      return NextResponse.json(
        errorResponse(
          ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN,
          'This anonymous link must be claimed before deletion. Use POST /api/v1/links/{slug}/claim to claim ownership.'
        ),
        { status: 403 }
      );
    }

    // 2. 必须是所有者或管理员
    if (link.ownerId !== user?.id && user?.role !== 'admin') {
      return NextResponse.json(
        errorResponse(ErrorCode.FORBIDDEN, 'You do not have permission to delete this link'),
        { status: 403 }
      );
    }

    // 执行删除
    const deleted = await linkService.delete(
      slug,
      user?.id || null,
      user?.role === 'admin'
    );

    // 审计日志
    await auditService.logDelete(
      slug,
      user?.id || null,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return NextResponse.json(
      successResponse({
        slug: deleted.slug,
        deletedAt: deleted.deletedAt?.toISOString(),
      })
    );
  } catch (error: any) {
    const statusCode = getHttpStatusCode(error.code) || 500;
    return NextResponse.json(
      errorResponse(error.code, error.message),
      { status: statusCode }
    );
  }
}
```

#### 4.3 修改 POST /api/v1/links - 检查已删除的 slug

**文件**: `/src/app/api/v1/links/route.ts`

**修改逻辑**：
```typescript
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const { slug, url, metadata, turnstile_token } = body;

    // 🔒 新增：检查 slug 是否已存在（包括软删除）
    if (slug) {
      const existingLink = await linkService.get(slug);

      // 如果 slug 已存在
      if (existingLink) {
        // 如果是软删除状态
        if (existingLink.deletedAt) {
          // 检查是否是原所有者
          if (existingLink.ownerId !== user?.id) {
            return NextResponse.json(
              errorResponse(
                ErrorCode.DELETED_SLUG_FORBIDDEN,
                `The slug "${slug}" was previously used and deleted. Only the original owner can reuse it.`
              ),
              { status: 403 }
            );
          }

          // 如果是原所有者，重新激活链接
          const reactivated = await linkService.reactivate(slug, url, metadata);

          return NextResponse.json(
            successResponse({
              slug: reactivated.slug,
              url: reactivated.url,
              createdAt: reactivated.createdAt.toISOString(),
              message: 'Link reactivated successfully',
            }),
            { status: 200 }
          );
        } else {
          // 如果 slug 存在且未删除，返回冲突错误
          return NextResponse.json(
            errorResponse(ErrorCode.SLUG_ALREADY_EXISTS, `Slug "${slug}" is already in use`),
            { status: 409 }
          );
        }
      }
    }

    // 原有的创建逻辑...
    // 验证 Turnstile（如果是匿名用户）
    if (!user) {
      const isValid = await turnstileService.verify(
        turnstile_token,
        request.headers.get('x-forwarded-for') || 'unknown'
      );
      if (!isValid) {
        return NextResponse.json(
          errorResponse(ErrorCode.TURNSTILE_VALIDATION_FAILED, 'Invalid captcha'),
          { status: 400 }
        );
      }
    }

    // 创建链接
    const created = await linkService.create(
      slug,
      url,
      user?.id || null,
      metadata,
      !user
    );

    return NextResponse.json(
      successResponse({
        slug: created.slug,
        url: created.url,
        createdAt: created.createdAt.toISOString(),
      }),
      { status: 201 }
    );
  } catch (error: any) {
    const statusCode = getHttpStatusCode(error.code) || 500;
    return NextResponse.json(
      errorResponse(error.code, error.message),
      { status: statusCode }
    );
  }
}
```

### Step 5: 更新 linkService

**文件**: `/src/lib/services/link.service.ts`

#### 5.1 修改 update() 方法（第136-183行）

**目标**：移除匿名用户修改的漏洞。

**修改前**：
```typescript
if (current.ownerId !== userId && !admin) {
  throw createError(ErrorCode.FORBIDDEN);
}
```

**修改后**：
```typescript
// 严格检查所有权
// 1. 匿名链接不允许通过 update 修改
if (!current.ownerId) {
  throw createError(
    ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN,
    403,
    { message: 'Anonymous links must be claimed before editing' }
  );
}

// 2. 必须是所有者或管理员
if (current.ownerId !== userId && !admin) {
  throw createError(ErrorCode.FORBIDDEN, 403);
}
```

#### 5.2 修改 delete() 方法（第188-205行）

**目标**：与 update() 相同的权限检查。

```typescript
async delete(slug: string, userId: string | null, admin: boolean = false): Promise<Link> {
  const current = await this.get(slug);
  if (!current) {
    throw createError(ErrorCode.LINK_NOT_FOUND);
  }

  // 严格检查所有权
  // 1. 匿名链接不允许通过 delete 删除
  if (!current.ownerId) {
    throw createError(
      ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN,
      403,
      { message: 'Anonymous links must be claimed before deletion' }
    );
  }

  // 2. 必须是所有者或管理员
  if (current.ownerId !== userId && !admin) {
    throw createError(ErrorCode.FORBIDDEN, 403);
  }

  // 软删除
  const result = await db
    .update(linksTable)
    .set({ deletedAt: new Date() })
    .where(eq(linksTable.slug, slug))
    .returning();

  return result[0];
}
```

#### 5.3 新增 reactivate() 方法

**目标**：重新激活已删除的链接。

```typescript
/**
 * REACTIVATE: Reactivate a soft-deleted link (owner only)
 */
async reactivate(
  slug: string,
  newUrl: string,
  newMetadata?: any
): Promise<Link> {
  const current = await this.get(slug);

  if (!current) {
    throw createError(ErrorCode.LINK_NOT_FOUND);
  }

  if (!current.deletedAt) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      400,
      { message: 'Link is not deleted' }
    );
  }

  // 验证新 URL
  const urlValidation = validateURL(newUrl);
  if (!urlValidation.valid) {
    throw createError(urlValidation.error!);
  }

  // 重新激活并更新 URL
  const result = await db
    .update(linksTable)
    .set({
      url: newUrl,
      metadata: newMetadata,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(linksTable.slug, slug))
    .returning();

  return result[0];
}
```

### Step 6: 添加新错误代码

**文件**: `/src/lib/constants/errors.ts`

**新增**：
```typescript
export enum ErrorCode {
  // ... 现有错误代码 ...

  ANONYMOUS_LINK_MODIFICATION_FORBIDDEN = 'ANONYMOUS_LINK_MODIFICATION_FORBIDDEN',  // HTTP 403
  DELETED_SLUG_FORBIDDEN = 'DELETED_SLUG_FORBIDDEN',                                // HTTP 403
}

export function getHttpStatusCode(errorCode?: ErrorCode): number | undefined {
  const statusMap: Record<ErrorCode, number> = {
    // ... 现有映射 ...

    [ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN]: 403,
    [ErrorCode.DELETED_SLUG_FORBIDDEN]: 403,
  };

  return errorCode ? statusMap[errorCode] : undefined;
}
```

### Step 7: 更新 LinkCreationForm 显示 Claim 提示

**文件**: `/src/components/organisms/LinkCreationForm.tsx`

**新增 Props**：
```typescript
interface LinkCreationFormProps {
  // ... 现有 props ...
  showClaimPrompt?: boolean;
  onClaim?: () => void;
}
```

**新增 UI**（在表单上方）：
```typescript
{showClaimPrompt && (
  <Alert variant="warning" className="mb-4">
    <p className="font-semibold">这是一个匿名链接</p>
    <p className="text-sm mt-1">
      要修改此链接，请先声明所有权。
    </p>
    <Button
      variant="primary"
      size="sm"
      className="mt-2"
      onClick={async () => {
        try {
          const response = await fetch(`/api/v1/links/${existingLink!.slug}/claim`, {
            method: 'POST',
          });
          if (response.ok) {
            alert('所有权声明成功！');
            onClaim?.();
          } else {
            const data = await response.json();
            alert(`声明失败：${data.error?.message}`);
          }
        } catch (error) {
          alert('声明失败，请重试');
        }
      }}
    >
      声明所有权
    </Button>
  </Alert>
)}
```

### Step 8: 测试

#### 8.1 单元测试

创建 `/tests/integration/links.edit-permissions.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';

describe('Link Edit Permissions', () => {
  it('should prevent anonymous users from editing anonymous links', async () => {
    // 1. 创建匿名链接
    const created = await POST('/api/v1/links', { slug: 'test', url: 'https://example.com' });
    expect(created.status).toBe(201);

    // 2. 尝试匿名修改
    const updated = await PUT('/api/v1/links/test', { url: 'https://newurl.com' });
    expect(updated.status).toBe(403);
    expect(updated.error.code).toBe('ANONYMOUS_LINK_MODIFICATION_FORBIDDEN');
  });

  it('should allow editing after claiming ownership', async () => {
    // 1. 创建匿名链接
    const created = await POST('/api/v1/links', { slug: 'test', url: 'https://example.com' });

    // 2. 登录并声明所有权
    const user = await login('user@example.com');
    const claimed = await POST('/api/v1/links/test/claim', {}, user.token);
    expect(claimed.status).toBe(200);

    // 3. 修改链接
    const updated = await PUT('/api/v1/links/test', { url: 'https://newurl.com' }, user.token);
    expect(updated.status).toBe(200);
  });

  it('should prevent reusing deleted slug by non-owner', async () => {
    // 1. 用户A创建并删除链接
    const userA = await login('a@example.com');
    await POST('/api/v1/links', { slug: 'test', url: 'https://example.com' }, userA.token);
    await DELETE('/api/v1/links/test', userA.token);

    // 2. 用户B尝试重用 slug
    const userB = await login('b@example.com');
    const created = await POST('/api/v1/links', { slug: 'test', url: 'https://other.com' }, userB.token);
    expect(created.status).toBe(403);
    expect(created.error.code).toBe('DELETED_SLUG_FORBIDDEN');
  });

  it('should allow reusing deleted slug by original owner', async () => {
    // 1. 用户A创建并删除链接
    const userA = await login('a@example.com');
    await POST('/api/v1/links', { slug: 'test', url: 'https://example.com' }, userA.token);
    await DELETE('/api/v1/links/test', userA.token);

    // 2. 用户A重用 slug
    const created = await POST('/api/v1/links', { slug: 'test', url: 'https://newurl.com' }, userA.token);
    expect(created.status).toBe(200);
    expect(created.data.message).toContain('reactivated');
  });
});
```

#### 8.2 手动测试流程

1. **测试匿名链接编辑保护**：
   ```bash
   # 1. 未登录创建链接
   curl -X POST http://localhost:3000/api/v1/links -d '{"slug":"test","url":"https://example.com"}'

   # 2. 未登录尝试修改（应返回 403）
   curl -X PUT http://localhost:3000/api/v1/links/test -d '{"url":"https://newurl.com"}'

   # 3. 登录并声明所有权
   curl -X POST http://localhost:3000/api/v1/links/test/claim -H "Authorization: Bearer $TOKEN"

   # 4. 登录后修改（应成功）
   curl -X PUT http://localhost:3000/api/v1/links/test -d '{"url":"https://newurl.com"}' -H "Authorization: Bearer $TOKEN"
   ```

2. **测试已删除 slug 重用保护**：
   ```bash
   # 1. 用户A创建链接
   curl -X POST http://localhost:3000/api/v1/links -d '{"slug":"test","url":"https://example.com"}' -H "Authorization: Bearer $TOKEN_A"

   # 2. 用户A删除链接
   curl -X DELETE http://localhost:3000/api/v1/links/test -H "Authorization: Bearer $TOKEN_A"

   # 3. 用户B尝试重用 slug（应返回 403）
   curl -X POST http://localhost:3000/api/v1/links -d '{"slug":"test","url":"https://other.com"}' -H "Authorization: Bearer $TOKEN_B"

   # 4. 用户A重用 slug（应成功并返回 "reactivated"）
   curl -X POST http://localhost:3000/api/v1/links -d '{"slug":"test","url":"https://newurl.com"}' -H "Authorization: Bearer $TOKEN_A"
   ```

3. **测试登录页面和重定向**：
   - 访问 `/edit/test`（假设链接存在）
   - 应自动重定向到 `/auth/login?returnTo=/edit/test`
   - 登录后应返回 `/edit/test`

## Timeline（时间线）

- **Step 1**: 安装依赖（5 分钟）
- **Step 2**: 创建登录页面（30 分钟）
- **Step 3**: 修改编辑页面（45 分钟）
- **Step 4**: 强化 API 权限检查（1 小时）
- **Step 5**: 更新 linkService（45 分钟）
- **Step 6**: 添加错误代码（15 分钟）
- **Step 7**: 更新 LinkCreationForm（30 分钟）
- **Step 8**: 编写和运行测试（1 小时）

**总计**: 约 4.5 小时

## Success Criteria（成功标准）

✅ **功能验证**：
1. 登录页面正常工作，支持邮箱/密码登录
2. 未登录用户无法修改/删除现有链接
3. 匿名链接必须声明所有权后才能编辑
4. 已删除的 slug 只能由原所有者重用
5. 所有 API 端点返回正确的错误代码和消息

✅ **安全验证**：
1. 匿名链接漏洞已修复
2. 所有权限检查正确执行
3. 审计日志正确记录所有操作

✅ **用户体验**：
1. 错误消息清晰友好
2. 登录重定向流程顺畅
3. Claim 提示和按钮易于使用

✅ **测试覆盖**：
1. 所有单元测试通过
2. 集成测试覆盖所有权限场景
3. 手动测试流程验证通过

## Critical Files（关键文件）

### 新增文件
- `/src/app/auth/login/page.tsx` - 登录页面

### 修改文件
- `/src/app/edit/[slug]/page.tsx` - 编辑页面（增加认证检查）
- `/src/app/api/v1/links/route.ts` - 创建 API（检查已删除 slug）
- `/src/app/api/v1/links/[slug]/route.ts` - 更新/删除 API（强化权限检查）
- `/src/lib/services/link.service.ts` - 服务层（修复权限漏洞，新增 reactivate 方法）
- `/src/lib/constants/errors.ts` - 错误代码（新增两个错误代码）
- `/src/components/organisms/LinkCreationForm.tsx` - 表单组件（显示 Claim 提示）

### 测试文件
- `/tests/integration/links.edit-permissions.test.ts` - 权限测试（新增）

## Existing Functions to Reuse（复用现有函数）

- `getCurrentUser()` - `/src/lib/auth/server.ts:26-34` - 获取当前用户
- `linkService.get()` - `/src/lib/services/link.service.ts:85-90` - 获取链接
- `linkService.claim()` - `/src/lib/services/link.service.ts:210-235` - 声明所有权
- `createError()` - `/src/lib/api/errors.ts` - 创建错误对象
- `getSupabaseBrowserClient()` - `/src/lib/auth/client.ts:7-12` - 获取浏览器端 Supabase 客户端

## Architecture Decisions（架构决策）

1. **使用 Supabase Auth UI 而非自建表单**：
   - 优势：快速集成，包含完整的认证流程（登录、注册、密码重置）
   - 劣势：样式定制受限
   - 决策：用户选择了此方案，可快速上线

2. **在 API 层进行权限检查而非仅在 UI 层**：
   - 优势：更安全，防止直接 API 调用绕过权限
   - 实现：在 API 路由和 linkService 两层都进行检查

3. **软删除而非物理删除**：
   - 优势：保留审计记录，支持撤销删除
   - 实现：通过 `deletedAt` 字段标记，检查 slug 重用时验证所有权

4. **使用 claim 功能而非 session/cookie tracking**：
   - 优势：更清晰的所有权模型，支持跨设备
   - 实现：匿名链接必须先 claim 才能修改

## Notes（注意事项）

1. **Supabase Auth 配置**：
   - 确保 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已配置
   - 在 Supabase Dashboard 中启用以下认证方式：
     - ✅ Email/Password（默认启用）
     - ✅ Magic Link（默认启用）
     - ✅ Google OAuth（需要配置 Client ID 和 Secret）
   - 配置邮件模板（可选，用于 Magic Link）

2. **cookie 处理**：
   - 当前 `getSupabaseServerClient()` 的 cookies 实现是占位符
   - 需要修复为使用 Next.js 的 `cookies()` 函数
   - **优先级**：中（登录功能可能需要此修复）

3. **审计日志**：
   - 所有操作（创建、更新、删除、声明、重新激活）都应记录
   - 确保 `auditService` 正确记录用户 ID 和 IP

4. **错误消息国际化**：
   - 当前所有错误消息都是硬编码的中文
   - 未来考虑使用 i18n 库支持多语言

5. **测试环境**：
   - 需要 Supabase 测试项目
   - 需要配置测试用户账号

## Verification（验证步骤）

### 端到端验证流程

1. **场景1：匿名创建后尝试编辑**
   - [ ] 未登录访问 `/create`
   - [ ] 创建链接 `go/test`
   - [ ] 访问 `/edit/test`
   - [ ] 应重定向到 `/auth/login?returnTo=/edit/test`
   - [ ] 登录后返回 `/edit/test`
   - [ ] 看到"需要声明所有权"的提示
   - [ ] 点击"声明所有权"按钮
   - [ ] 声明成功后可以编辑链接

2. **场景2：删除后重新创建**
   - [ ] 用户A登录并创建链接 `go/test`
   - [ ] 用户A删除链接
   - [ ] 用户A尝试重新创建 `go/test` → 应成功（显示 "reactivated"）
   - [ ] 用户B登录并尝试创建 `go/test` → 应失败（403 错误）

3. **场景3：尝试修改他人链接**
   - [ ] 用户A创建链接 `go/test`
   - [ ] 用户B登录并访问 `/edit/test`
   - [ ] 应显示"你没有权限编辑这个链接"错误

### API 测试验证

运行测试：
```bash
npm test -- tests/integration/links.edit-permissions.test.ts
```

所有测试应通过。
