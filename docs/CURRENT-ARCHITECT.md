# Open GoLinks v2 - 当前系统架构

## System Overview

系统概览，展示核心组件和数据流向。

### ASCII 系统简图

```
┌─────────────────────────────────────────────────────────────┐
│                    Open GoLinks v2                          │
└─────────────────────────────────────────────────────────────┘

Frontend (Next.js + React)
│
├─ Pages (src/app/)
│  ├─ page.tsx - 主页
│  └─ api/ - API 路由
│
├─ Components (src/components/)
│  ├─ Atoms (9 components)
│  │  ├─ Button, Input, Label
│  │  ├─ Card, Badge, Alert
│  │  ├─ Icon, Avatar, Spinner
│  │
│  ├─ Molecules (Planning)
│  └─ Organisms (Planning)
│
├─ Design System (src/styles/)
│  ├─ variables.css - CSS 变量
│  └─ globals.css - 全局样式
│
└─ Tailwind CSS + PostCSS

        ↓↓↓

Backend (Next.js API Routes)
│
├─ src/app/api/v1/
│  ├─ links/ - 链接管理 API
│  ├─ audit/ - 审计日志 API
│  └─ health/ - 健康检查
│
└─ Authentication
   ├─ Supabase Auth
   └─ JWT Tokens

        ↓↓↓

Database
│
├─ PostgreSQL (Supabase)
├─ Drizzle ORM (src/db/)
└─ Schema & Types

        ↓↓↓

External Services
│
└─ Supabase (Auth + Database)
```

### Mermaid 详细系统图

```mermaid
graph TB
    subgraph "Frontend Layer"
        App["Next.js App<br/>(src/app/)<br/>SSR + Client Components"]
        Pages["Pages & Layouts<br/>(src/app/page.tsx<br/>src/app/layout.tsx)"]
        Components["Component Library<br/>(src/components/)"]

        subgraph "Components"
            Atoms["Atoms<br/>(9 components)<br/>Button, Input, Card..."]
            Molecules["Molecules<br/>(Planning)<br/>FormField, Modal..."]
            Organisms["Organisms<br/>(Planning)<br/>LinkForm, Header..."]
            Atoms --> Molecules
            Molecules --> Organisms
        end

        Design["Design System<br/>(src/styles/)<br/>CSS Variables<br/>Tailwind Config"]

        Pages --> Components
        Components --> Design
    end

    subgraph "Styling Layer"
        Tailwind["Tailwind CSS<br/>(tailwind.config.ts)<br/>CSS Utilities + Plugins"]
        PostCSS["PostCSS<br/>(postcss.config.js)<br/>Autoprefixer + Tailwind"]
        Variables["CSS Variables<br/>(src/styles/variables.css)<br/>Colors, Spacing, Typography"]

        Design --> Tailwind
        Tailwind --> PostCSS
        PostCSS --> Variables
    end

    subgraph "API Layer"
        Routes["API Routes<br/>(src/app/api/v1/)"]
        LinkAPI["Links API<br/>POST, GET, PUT, DELETE"]
        AuditAPI["Audit API<br/>GET /audit/:slug"]
        HealthAPI["Health API<br/>GET /health"]

        Routes --> LinkAPI
        Routes --> AuditAPI
        Routes --> HealthAPI
    end

    subgraph "Backend Services"
        Auth["Authentication<br/>Supabase Auth<br/>JWT, Sessions"]
        Validation["Validation<br/>(zod)"]
        Types["Type System<br/>(src/types/)"]
    end

    subgraph "Data Layer"
        ORM["Drizzle ORM<br/>(src/db/)"]
        Database["PostgreSQL<br/>(Supabase)"]
    end

    subgraph "External Services"
        Supabase["Supabase<br/>Auth, Database,<br/>Realtime"]
    end

    App --> Routes
    Routes --> Auth
    Routes --> Validation
    Routes --> Types
    Auth --> ORM
    Validation --> ORM
    ORM --> Database
    Database --> Supabase

    Frontend --> "Styling Layer"
```

## Architecture Details

### 1. Frontend Architecture

#### 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with fonts & styles
│   ├── page.tsx           # Home page
│   └── api/
│       └── v1/            # API routes
│
├── components/            # React components (Atomic Design)
│   ├── atoms/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Label.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Alert.tsx
│   │   ├── Icon.tsx
│   │   ├── Avatar.tsx
│   │   ├── Spinner.tsx
│   │   └── index.ts
│   ├── molecules/         # (Planning for Phase 3B)
│   ├── organisms/         # (Planning for Phase 3C)
│   └── index.ts
│
├── styles/                # Design system
│   ├── variables.css      # CSS custom properties
│   ├── globals.css        # Global styles
│   └── README.md
│
├── lib/                   # Utilities
│   └── cn.ts             # classname merger (clsx wrapper)
│
├── db/                    # Database
│   └── (Drizzle schema)
│
├── types/                 # TypeScript definitions
│   ├── api.ts
│   ├── database.ts
│   ├── auth.ts
│   └── index.ts
└── README.md
```

#### Design System (`src/styles/`)

完整的设计令牌系统 (`src/styles/variables.css:1-74`)：

**颜色系统**
- 语义颜色：primary (#2563eb), success (#16a34a), error (#dc2626), warning (#ea580c), info (#0284c7)
- 灰度色：gray-50 到 gray-900 (10 级)

**间距系统** (8px 基础单位)
- xs (0.25rem), sm (0.5rem), md (1rem), lg (1.5rem), xl (2rem), 2xl (3rem)

**排版系统**
- display: Geist (标题, 展示文本)
- body: Inter (正文)
- mono: JetBrains Mono (代码)

**动画系统**
- fast (150ms), normal (250ms), slow (350ms)
- 所有过渡使用 ease-out

**空间系统**
- 圆角：sm (4px), md (8px), lg (12px)
- 阴影：sm, md, lg, xl (4 级)
- Z-index：dropdown (100), sticky (200), fixed (300), modal (400), tooltip (500)

#### Atom Components (`src/components/atoms/`)

9 个基础可重用组件：

| 组件 | 文件 | 行数 | 功能 |
|------|------|------|------|
| Button | Button.tsx | 53 | 按钮 - 4 variants (primary, secondary, ghost, danger) + 3 sizes |
| Input | Input.tsx | 26 | 输入框 - error 和 loading 状态 |
| Label | Label.tsx | 23 | 标签 - required 标记支持 |
| Card | Card.tsx | 24 | 卡片容器 - interactive 支持 |
| Badge | Badge.tsx | 32 | 徽章 - 5 variants (primary, success, error, warning, gray) |
| Alert | Alert.tsx | 54 | 提示框 - 4 variants (success, error, warning, info) |
| Icon | Icon.tsx | 45 | 图标 - CheckIcon, XIcon, AlertIcon |
| Avatar | Avatar.tsx | 45 | 头像 - initials 或 image 模式 |
| Spinner | Spinner.tsx | 40 | 加载动画 - 3 sizes |

**特性**：
- 使用 class-variance-authority (CVA) 管理变体
- React.forwardRef 支持 DOM 引用
- 完整的 TypeScript 类型
- 所有组件都标记 'use client' directive
- 遵循 Web Accessibility (WCAG 2.1) 标准

### 2. Styling Configuration

#### Tailwind CSS (`tailwind.config.ts`)

所有 CSS 变量通过 Tailwind theme extension 集成：

```typescript
colors: { primary: 'var(--color-primary)', ... }
spacing: { xs: 'var(--space-xs)', ... }
borderRadius: { sm: 'var(--radius-sm)', ... }
transitionDuration: { fast: 'var(--transition-fast)', ... }
boxShadow: { sm: 'var(--shadow-sm)', ... }
zIndex: { dropdown: 'var(--z-dropdown)', ... }
```

这样可以：
- 在 CSS 和 Tailwind classes 中统一使用设计令牌
- 支持主题切换 (修改 CSS 变量)
- 类型安全的主题定制

#### PostCSS (`postcss.config.js`)

```javascript
plugins: {
  tailwindcss: {},
  autoprefixer: {},
}
```

自动添加浏览器前缀，确保 CSS 兼容性。

#### Global Styles (`src/styles/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@import './variables.css';
```

配置：
- HTML scroll-behavior: smooth
- Body font-family, background-color, color, line-height
- Focus-visible 状态管理
- 默认过渡 (transition-colors duration-normal)
- Selection 颜色

### 3. Font System

在 `src/app/layout.tsx` 中配置 Next.js Google Fonts：

```typescript
const geist = Geist({ variable: '--font-display' });
const inter = Inter({ variable: '--font-body' });

// 在 html 标签上应用
<html className={`${geist.variable} ${inter.variable}`}>
```

自动生成的 CSS 变量：
- `--font-display: Geist` (系统字体回退)
- `--font-body: Inter` (系统字体回退)

### 4. TypeScript Configuration

所有组件使用严格的 TypeScript 配置：

```typescript
interface ComponentProps extends React.ElementHTMLAttributes<HTMLElement> {
  // 自定义 props
  variant?: 'primary' | 'secondary' | ...;
  size?: 'sm' | 'md' | 'lg';
}

export const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ variant, size, ...props }, ref) => {
    // implementation
  }
);
```

### 5. Dependencies

**Production**:
- `clsx` (2.0.0) - className 工具
- `class-variance-authority` (0.7.0) - 组件变体管理
- 其他：Supabase, Drizzle ORM, Zod, etc.

**Development**:
- `tailwindcss` (3.4.0) - CSS 框架
- `postcss` (8.4.0) - CSS 处理
- `autoprefixer` (10.4.0) - 浏览器前缀

## Data Models

### Link Schema (Drizzle ORM, `src/db/`)

```typescript
links {
  id: string (primary key, nanoid)
  slug: string (unique)
  original_url: string
  created_by: uuid (FK to auth.users)
  created_at: timestamp
  expires_at: timestamp (nullable)
  is_active: boolean
  click_count: integer
}

audit {
  id: string
  link_id: string (FK to links)
  user_ip: string
  user_agent: string
  referrer: string
  clicked_at: timestamp
}
```

## API Design

### v1 API Routes (`src/app/api/v1/`)

#### Links API
- `POST /api/v1/links` - 创建短链
- `GET /api/v1/links` - 获取用户的链接列表
- `GET /api/v1/links/:slug` - 获取链接详情
- `PUT /api/v1/links/:slug` - 更新链接
- `DELETE /api/v1/links/:slug` - 删除链接
- `GET /api/v1/links/:slug/redirect` - 重定向

#### Audit API
- `GET /api/v1/audit/:slug` - 获取链接的点击记录

#### Health API
- `GET /api/v1/health` - 健康检查

## Development Workflow

### 1. Component Development

使用原子组件快速构建功能：

```typescript
'use client';

import { Button, Input, Label, Card, Alert } from '@/components';

export function MyFeature() {
  // 使用原子组件构建功能
}
```

### 2. Styling

三种方式可选：

**方式 1**: CSS 变量
```css
.custom { color: var(--color-primary); }
```

**方式 2**: Tailwind classes
```tsx
<div className="text-primary bg-gray-50 p-md" />
```

**方式 3**: CVA 组件变体
```typescript
const variants = cva('base', { variants: { ... } });
```

### 3. Type Safety

所有 props 都通过 TypeScript interfaces 定义：

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | ...;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}
```

## Phase 3 Roadmap

### Phase 3 Track A (完成)
- [x] CSS 变量系统
- [x] Tailwind 配置
- [x] 9 个原子组件
- [x] 设计系统文档

### Phase 3 Track B (Planning)
分子组件 (Molecules):
- FormField (Label + Input + Error)
- FormGroup (多个 FormFields)
- Modal (模态框)
- Dropdown (下拉菜单)
- Tabs (标签页)
- Toast (通知)

### Phase 3 Track C (Planning)
生物组件 (Organisms):
- LinkForm (创建/编辑链接)
- LinkCard (链接卡片)
- LinkTable (链接列表)
- Header (页面头部)
- Sidebar (侧边栏)
- LinkStatistics (链接统计)

## Performance Considerations

### 1. Code Splitting

使用 Next.js 自动代码分割：
- 页面级别代码分割
- 动态导入 (dynamic imports) 用于重型库

### 2. Image Optimization

使用 Next.js Image 组件：
```typescript
import Image from 'next/image';
```

### 3. Font Optimization

Next.js Google Fonts 自动优化：
- 字体预加载
- 字体显示优化
- 自动 CDN 分发

### 4. CSS Optimization

Tailwind CSS 生产版本自动移除未使用的 CSS。

## Testing Strategy (Phase 3 Track E) ✅

### Storybook 文档化

所有原子组件都有完整的 Storybook 故事 (`tests/stories/`)。

**故事文件** (`.stories.tsx:1-150+`)：
- `src/components/atoms/Button.stories.tsx` - 17 个故事 (变体、尺寸、状态、组合)
- `src/components/atoms/Input.stories.tsx` - 11 个故事 (类型、状态、交互)
- `src/components/atoms/Badge.stories.tsx` - 6 个故事 (所有色彩变体)
- `src/components/atoms/Card.stories.tsx` - 7 个故事 (交互式、布局、示例)

**启动 Storybook**：
```bash
npm run storybook        # 开发模式 (port 6006)
npm run storybook:build  # 生产构建
```

### Unit Tests (vitest) ✅

完整覆盖 >80%，共 117 个测试 (`tests/components/`)：

**测试文件**：
- `tests/components/atoms/Button.test.tsx` - 50+ 测试 (`tests/components/atoms/Button.test.tsx:1-450+`)
  - ✅ 变体渲染 (primary, secondary, ghost, danger)
  - ✅ 尺寸 (sm, md, lg)
  - ✅ 加载和禁用状态
  - ✅ 事件处理 (onClick, 键盘事件)
  - ✅ 可访问性 (ARIA, 焦点管理)
  - ✅ 快照测试 (6 个快照)

- `tests/components/atoms/Input.test.tsx` - 48+ 测试 (`tests/components/atoms/Input.test.tsx:1-400+`)
  - ✅ 输入类型 (text, email, password, number, url, search)
  - ✅ 错误状态和验证
  - ✅ 禁用和焦点管理
  - ✅ 事件处理 (onChange, onFocus, onBlur, onKeyDown)
  - ✅ 可访问性 (ARIA, 标签关联)
  - ✅ 快照测试 (4 个快照)

- `tests/components/molecules/InputField.test.tsx` - 24+ 测试 (`tests/components/molecules/InputField.test.tsx:1-300+`)
  - ✅ 标签和输入整合
  - ✅ 辅助文本和错误消息
  - ✅ React Hook Form 集成
  - ✅ 表单验证
  - ✅ 快照测试 (3 个快照)

### Test Infrastructure

**测试配置** (`tests/setup.ts:1-50+`)：
- 全局环境设置
- 每个测试前重置模拟
- 环境变量模拟
- matchMedia、IntersectionObserver、ResizeObserver 模拟

**测试工具** (`tests/utils/test-utils.tsx:1-250+`)：
- `FormWrapper` - React Hook Form 包装器
- `renderWithForm` - 自定义渲染函数
- `generateTestData` - 数据生成器 (用户、链接、表单数据)
- `a11yHelpers` - 可访问性检查工具
- `snapshotHelpers` - 快照规范化工具

### Test Commands

```bash
npm test                    # 运行所有测试
npm test -- --watch         # 监看模式
npm test -- --coverage      # 覆盖率报告 (目标 >80%)
npm test -- tests/components --run  # 只运行组件测试
npm run test:ui             # Vitest UI (交互式)
```

### Vitest Configuration

配置位于 `vitest.config.ts:1-35`：
- 环境：jsdom
- 全局测试函数
- 覆盖率配置：80% 阈值
- 排除 `.stories.tsx` 和 `.types.ts` 文件

### Integration Tests

- 多组件交互
- Form submissions
- API integration

### E2E Tests (Planning)

- 完整用户流程
- 跨浏览器测试

## Security Considerations

### 1. Authentication

Supabase Auth 处理：
- Session management
- JWT validation
- PKCE flow (OAuth)

### 2. Input Validation

使用 Zod 进行数据验证：

```typescript
const CreateLinkSchema = z.object({
  original_url: z.string().url(),
  slug: z.string().min(3).max(50).optional(),
});
```

### 3. CORS & CSP

通过 Next.js 中间件配置：
- 跨域策略
- 内容安全策略 (CSP)

## Accessibility (A11y)

所有组件遵循 WCAG 2.1 标准：

- 语义化 HTML (`<button>`, `<label>`, `<input>`)
- Focus 管理 (focus-visible)
- ARIA 属性 (role, aria-label, aria-describedby)
- 键盘导航支持
- 屏幕阅读器文本 (.sr-only)
- 颜色对比度满足 AA 级别

## Documentation

- `src/styles/README.md` - 设计系统文档
- `src/components/README.md` - 组件库文档
- `tailwind.config.ts` - Tailwind 配置注释
- `src/styles/variables.css` - CSS 变量注释
- 各组件文件中的 TypeScript JSDoc

## 相关文档

- [Phase 3 Track A 实现完成](../PHASE3-TRACK-A-IMPLEMENTATION.md)
- [设计系统文档](../src/styles/README.md)
- [组件库文档](../src/components/README.md)
- [v2 产品规格](./v2-SPEC-zh-2.1.md)
