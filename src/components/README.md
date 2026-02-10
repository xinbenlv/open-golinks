# 组件库 (Components)

该目录包含 Open GoLinks v2 的可重用 React 组件库，遵循原子设计 (Atomic Design) 模式。

## 目录结构

```
components/
├── atoms/          # 原子组件 - 最小的可重用单位
├── molecules/      # 分子组件 - 原子组件的组合 (Phase 3 Track B)
├── organisms/      # 生物组件 - 分子组件的组合 (Phase 3 Track C)
├── README.md       # 本文件
└── index.ts        # 导出入口
```

## Atoms (原子组件)

最基础的可重用组件，不能再被分解。

### 已实现

| 组件 | 描述 | Props |
|------|------|-------|
| **Button** | 通用按钮 | `variant`, `size`, `isLoading`, `icon`, `disabled` |
| **Input** | 文本输入框 | `error`, `isLoading`, `placeholder`, `disabled` |
| **Label** | 表单标签 | `required`, `htmlFor` |
| **Card** | 卡片容器 | `interactive` |
| **Badge** | 标签/徽章 | `variant` (primary, success, error, warning, gray) |
| **Spinner** | 加载动画 | `size` (sm, md, lg) |
| **Icon** | 通用图标容器 | `size` (sm, md, lg), `CheckIcon`, `XIcon`, `AlertIcon` |
| **Avatar** | 头像 | `initials`, `size`, `src` |
| **Alert** | 提示框 | `variant`, `title`, `onClose` |

### Button 示例

```tsx
import { Button } from '@/components';

// 基础用法
<Button>Click me</Button>

// 带变体
<Button variant="primary" size="lg">Create Link</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="danger" disabled>Delete</Button>

// 加载状态
<Button isLoading>Saving...</Button>

// 带图标
<Button icon={<CheckIcon />}>Save</Button>
```

### Input 示例

```tsx
import { Input, Label, Button } from '@/components';

// 表单示例
<div>
  <Label htmlFor="slug" required>Short Code</Label>
  <Input
    id="slug"
    placeholder="e.g., my-link"
    error={errors.slug ? "Already taken" : undefined}
  />
</div>
```

### Card 示例

```tsx
import { Card, Badge } from '@/components';

<Card interactive>
  <Badge variant="success">Active</Badge>
  <h3 className="text-lg font-bold mt-2">Link Title</h3>
  <p className="text-gray-600">Description here</p>
</Card>
```

### Alert 示例

```tsx
import { Alert } from '@/components';

<Alert variant="success" title="Success!">
  Your link has been created.
</Alert>

<Alert variant="error" onClose={() => setError(null)}>
  Something went wrong. Please try again.
</Alert>
```

## 使用方式

### 从 atoms 导入

```typescript
// 方式 1: 从 atoms 导入
import { Button, Input, Label } from '@/components/atoms';

// 方式 2: 从主入口导入
import { Button, Input, Label } from '@/components';
```

### 组合使用

```tsx
'use client';

import { Button, Input, Label, Card, Alert } from '@/components';
import { useState } from 'react';

export function CreateLinkForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // API call
    } catch (err) {
      setError('Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-4">Create Short Link</h2>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="url" required>URL</Label>
          <Input id="url" type="url" placeholder="https://example.com" />
        </div>

        <div>
          <Label htmlFor="slug">Short Code (optional)</Label>
          <Input id="slug" placeholder="e.g., my-link" />
        </div>

        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          {loading ? 'Creating...' : 'Create Link'}
        </Button>
      </form>
    </Card>
  );
}
```

## 样式系统集成

所有原子组件都基于 `src/styles/variables.css` 中定义的设计令牌：

- 颜色：`--color-primary`, `--color-error` 等
- 间距：`--space-xs` 至 `--space-2xl`
- 排版：`--font-display`, `--font-body`
- 过渡：`--transition-fast`, `--transition-normal`

## 工具函数

### cn() - Class Name Utility

```typescript
import { cn } from '@/lib/cn';

// 组合多个 class names
const classes = cn(
  'base-class',
  condition && 'conditional-class',
  'another-class'
);
```

## Variants (变体)

许多组件使用 `class-variance-authority` 库定义变体，支持组合式的样式管理：

```tsx
// Button 支持的变体
variant: 'primary' | 'secondary' | 'ghost' | 'danger'
size: 'sm' | 'md' | 'lg'

// Badge 支持的变体
variant: 'primary' | 'success' | 'error' | 'warning' | 'gray'

// Alert 支持的变体
variant: 'success' | 'error' | 'warning' | 'info'
```

## 无障碍 (Accessibility)

所有组件都遵循无障碍最佳实践：

- 语义化 HTML (button, label, input)
- 焦点管理 (focus-visible)
- ARIA 属性 (role, aria-label)
- 键盘导航支持
- 屏幕阅读器文本 (.sr-only)

## Molecules (分子组件)

将原子组件组合成更复杂的单元。

### Phase 3 Track B (已实现)

| 组件 | 描述 | 用途 |
|------|------|------|
| **InputField** | Label + Input | 表单字段 |
| **TextAreaField** | Label + TextArea | 多行文本字段 |

### Phase 3 Track C (新增)

| 组件 | 描述 | 关键特性 |
|------|------|--------|
| **SearchInput** | 带防抖搜索 | 可配置防抖延迟（默认300ms）|
| **Pagination** | 分页导航 | 智能页码、省略号、前后页 |
| **FilterBar** | 综合过滤栏 | 搜索+正则过滤+视图切换 |
| **CopyButton** | 复制按钮 | 一键复制，自动复位反馈 |

### SearchInput 示例

```tsx
import { SearchInput } from '@/components/molecules';

<SearchInput
  onSearch={(query) => console.log(query)}
  placeholder="Search..."
  debounceMs={300}
/>
```

### Pagination 示例

```tsx
import { Pagination } from '@/components/molecules';

<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={(page) => setCurrentPage(page)}
  maxButtons={5}
/>
```

### FilterBar 示例

```tsx
import { FilterBar } from '@/components/molecules';

<FilterBar
  onSearch={setSearch}
  onFilter={setFilterRegex}
  onViewChange={setViewMode}
  currentView={viewMode}
/>
```

### CopyButton 示例

```tsx
import { CopyButton } from '@/components/molecules';

<CopyButton
  text="https://go.example.com/link"
  label="Copy"
  variant="secondary"
  size="sm"
/>
```

## Organisms (有机体组件)

### Phase 3 Track C (新增)

| 组件 | 描述 | 集成 |
|------|------|------|
| **LinksDashboardTable** | 链接仪表板 | 搜索、过滤、分页、多选、删除 |

### LinksDashboardTable 示例

```tsx
import { LinksDashboardTable } from '@/components/organisms';

<LinksDashboardTable
  initialLinks={links}
  baseUrl="https://go.example.com"
/>
```

**功能：**
- ✅ 搜索过滤 (slug + URL)
- ✅ 正则表达式过滤，带验证
- ✅ 分页 (20 条/页)
- ✅ 表格/网格视图切换
- ✅ 复选框多选和批量删除
- ✅ 复制链接到剪贴板
- ✅ 编辑/删除单个链接
- ✅ 完全响应式设计

## Hooks (自定义钩子)

### Phase 3 Track C (新增)

| Hook | 描述 | 用途 |
|------|------|------|
| **useDebounce** | 防抖值 | 延迟更新变量（搜索等） |
| **useCopyToClipboard** | 复制剪贴板 | 复制文本并提供反馈 |

### useDebounce 示例

```tsx
import { useDebounce } from '@/lib/hooks';

const [value, setValue] = useState('');
const debouncedValue = useDebounce(value, 300);

useEffect(() => {
  // 执行搜索，每300ms最多一次
  searchLinks(debouncedValue);
}, [debouncedValue]);
```

### useCopyToClipboard 示例

```tsx
import { useCopyToClipboard } from '@/lib/hooks';

const { copy, copied } = useCopyToClipboard();

<button onClick={() => copy('text-to-copy')}>
  {copied ? 'Copied!' : 'Copy'}
</button>
```

## 受保护路由 (Protected Routes)

### /dashboard - 用户仪表板

```
src/app/(protected)/dashboard/page.tsx
src/app/(protected)/layout.tsx
```

- 需要用户认证
- 显示用户的所有短链接
- 集成 LinksDashboardTable 组件
- 快速创建新链接按钮

## Testing & Storybook (Phase 3 Track E) ✅ 完成

### Storybook 文档

所有原子组件都有完整的 Storybook 故事文档。启动 Storybook：

```bash
npm run storybook
```

访问 `http://localhost:6006` 查看所有组件的交互式文档。

### 故事文件

| 组件 | 故事文件 | 覆盖范围 |
|------|--------|--------|
| **Button** | `src/components/atoms/Button.stories.tsx` | 所有变体、尺寸、状态、组合 |
| **Input** | `src/components/atoms/Input.stories.tsx` | 所有输入类型、状态、交互 |
| **Badge** | `src/components/atoms/Badge.stories.tsx` | 所有色彩变体 |
| **Card** | `src/components/atoms/Card.stories.tsx` | 交互式/非交互式卡片 |

### 组件测试

完整的测试覆盖 >80%：

```bash
npm test                    # 运行所有测试
npm test -- --watch         # 监看模式
npm test -- --coverage      # 生成覆盖率报告
npm run test:ui             # Vitest UI
```

### 测试文件

| 文件 | 测试数量 | 范围 |
|------|--------|------|
| `tests/components/atoms/Button.test.tsx` | 50+ | 变体、尺寸、事件、可访问性、快照 |
| `tests/components/atoms/Input.test.tsx` | 48+ | 类型、错误、禁用、焦点、事件 |
| `tests/components/molecules/InputField.test.tsx` | 24+ | 标签、验证、表单集成 |

### 测试工具

`tests/utils/test-utils.tsx` 提供：

- **FormWrapper**: React Hook Form 测试包装器
- **renderWithForm**: 自动提供表单上下文的渲染函数
- **generateTestData**: 测试数据生成器 (用户、链接、表单)
- **a11yHelpers**: 可访问性测试工具
- **snapshotHelpers**: 快照规范化工具

#### 使用示例

```tsx
import { renderWithForm, generateTestData } from '@/tests/utils/test-utils';
import { InputField } from '@/components/molecules';

test('表单字段验证', () => {
  const { getByRole } = renderWithForm(
    <InputField name="email" label="邮箱" />,
    { formDefaultValues: { email: '' } }
  );

  const input = getByRole('textbox');
  expect(input).toBeInTheDocument();
});
```

### 测试覆盖范围

**按类别：**
- ✅ **渲染测试**: 所有组件正确渲染
- ✅ **变体测试**: 所有样式变体工作正确
- ✅ **交互测试**: 点击、输入、焦点事件
- ✅ **可访问性**: ARIA 属性、键盘导航、触摸目标
- ✅ **状态管理**: 加载、禁用、错误状态
- ✅ **快照测试**: 意外渲染变化检测
- ✅ **集成测试**: React Hook Form 集成

### 代码质量

- **Linting**: `npm run lint` - ESLint 检查
- **格式化**: `npm run format` - Prettier 格式
- **类型检查**: `npm run type-check` - TypeScript 验证

## Phase 3 进度

### Track A: 表单组件 ✅ 完成
### Track B: 高级原子和分子 ✅ 完成
### Track C: 仪表板组件 ✅ 完成
### Track D: 页面集成 ✅ 完成
### Track E: 测试 & Storybook ✅ 完成
