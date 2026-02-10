# 快速开始 - Atom 组件使用指南

## 安装

```bash
npm install
```

## 基础导入

```typescript
import {
  Button,
  Input,
  Label,
  Card,
  Badge,
  Alert,
  Icon,
  Avatar,
  Spinner
} from '@/components';
```

## 组件速查表

### Button - 按钮

```typescript
// 基础用法
<Button>Click me</Button>

// 变体和尺寸
<Button variant="primary" size="lg">Create</Button>
<Button variant="secondary" size="md">Save</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="danger">Delete</Button>

// 加载状态
<Button isLoading>Saving...</Button>

// 带图标
<Button icon={<CheckIcon />}>Confirm</Button>

// 禁用状态
<Button disabled>Disabled</Button>
```

**Props**:
- `variant`: 'primary' | 'secondary' | 'ghost' | 'danger'
- `size`: 'sm' | 'md' | 'lg'
- `isLoading`: boolean
- `icon`: ReactNode
- `disabled`: boolean

---

### Input - 输入框

```typescript
// 基础用法
<Input placeholder="Enter text..." />

// 不同类型
<Input type="email" placeholder="your@email.com" />
<Input type="password" placeholder="Enter password" />
<Input type="url" placeholder="https://..." />

// 错误状态
<Input error="Email is invalid" />

// 禁用状态
<Input disabled />

// 受控输入
<Input
  value={text}
  onChange={(e) => setText(e.target.value)}
/>
```

**Props**:
- `type`: HTML input type
- `error`: string (显示错误)
- `placeholder`: string
- `disabled`: boolean
- `value`, `onChange`: React 事件

---

### Label - 标签

```typescript
// 基础用法
<Label htmlFor="username">Username</Label>
<Input id="username" />

// Required 标记
<Label htmlFor="email" required>
  Email
</Label>
<Input id="email" type="email" required />
```

**Props**:
- `htmlFor`: string (对应 input id)
- `required`: boolean (显示 * 标记)

---

### Card - 卡片

```typescript
// 基础用法
<Card>
  <h3>Card Title</h3>
  <p>Card content here...</p>
</Card>

// 交互式卡片
<Card interactive onClick={() => navigate('/detail')}>
  Click to open details
</Card>

// 带自定义样式
<Card className="border-2 border-primary">
  Custom styled card
</Card>
```

**Props**:
- `interactive`: boolean (cursor-pointer, hover border)
- `className`: string (自定义样式)

---

### Badge - 徽章

```typescript
// 颜色变体
<Badge variant="primary">Primary</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="gray">Inactive</Badge>

// 在 Card 中使用
<Card>
  <Badge variant="success">Active</Badge>
  <h3>Link Status</h3>
</Card>
```

**Props**:
- `variant`: 'primary' | 'success' | 'error' | 'warning' | 'gray'

---

### Alert - 提示框

```typescript
// 基础用法
<Alert>Simple notification</Alert>

// 带标题
<Alert title="Success">Operation completed!</Alert>

// 不同类型
<Alert variant="success" title="Saved">
  Changes have been saved
</Alert>

<Alert variant="error" title="Error">
  Something went wrong
</Alert>

<Alert variant="warning" title="Warning">
  Please review before continuing
</Alert>

<Alert variant="info">
  Informational message
</Alert>

// 可关闭
<Alert variant="error" onClose={() => setError(null)}>
  You can close this alert
</Alert>
```

**Props**:
- `variant`: 'success' | 'error' | 'warning' | 'info'
- `title`: string
- `onClose`: () => void

---

### Icon - 图标

```typescript
// 预定义图标
import { Icon, CheckIcon, XIcon, AlertIcon } from '@/components';

<CheckIcon className="w-6 h-6 text-green-600" />
<XIcon className="w-4 h-4 text-red-600" />
<AlertIcon className="w-5 h-5 text-yellow-600" />

// 自定义尺寸
<CheckIcon className="w-8 h-8" />

// 在按钮中使用
<Button icon={<CheckIcon />}>Confirm</Button>
```

**常用图标**:
- `CheckIcon` - 勾选
- `XIcon` - 关闭/删除
- `AlertIcon` - 警告

---

### Avatar - 头像

```typescript
// 显示头像图像
<Avatar
  src="/path/to/avatar.jpg"
  alt="User name"
  size="md"
/>

// 显示缩写
<Avatar initials="JD" size="md" />

// 不同尺寸
<Avatar initials="A" size="sm" />
<Avatar initials="B" size="md" />
<Avatar initials="C" size="lg" />

// 用户列表
<div className="flex gap-2">
  <Avatar initials="JD" />
  <Avatar src="/avatar2.jpg" />
</div>
```

**Props**:
- `src`: string (图像 URL)
- `initials`: string (缩写，e.g. "JD")
- `size`: 'sm' | 'md' | 'lg'
- `alt`: string

---

### Spinner - 加载动画

```typescript
// 基础用法
<Spinner />

// 不同尺寸
<Spinner size="sm" />
<Spinner size="md" />
<Spinner size="lg" />

// 自定义颜色
<Spinner className="text-primary" />

// 加载状态显示
{isLoading ? <Spinner /> : <div>Content</div>}

// 在按钮中
<Button isLoading>
  {isLoading && <Spinner size="sm" />}
  Processing...
</Button>
```

**Props**:
- `size`: 'sm' | 'md' | 'lg'
- `className`: string (自定义颜色等)

---

## 常见组合模式

### 表单

```typescript
'use client';

import {
  Button,
  Input,
  Label,
  Card,
  Alert
} from '@/components';

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // API 调用
    } catch (err) {
      setError('Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2>Contact Us</h2>

      {error && (
        <Alert
          variant="error"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="your@email.com"
          />
        </div>

        <div>
          <Label htmlFor="message">Message</Label>
          <textarea
            id="message"
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Your message..."
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
        >
          {loading ? 'Sending...' : 'Send'}
        </Button>
      </form>
    </Card>
  );
}
```

### 列表项目

```typescript
import { Card, Badge, Avatar, Button } from '@/components';

export function UserCard({ user }) {
  return (
    <Card interactive className="hover:border-primary">
      <div className="flex items-center gap-4">
        <Avatar initials={user.initials} size="lg" />

        <div className="flex-1">
          <h3 className="font-bold">{user.name}</h3>
          <Badge variant={user.active ? 'success' : 'gray'}>
            {user.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <Button variant="ghost" size="sm">
          View
        </Button>
      </div>
    </Card>
  );
}
```

### 操作反馈

```typescript
'use client';

import { Button, Alert, Spinner } from '@/components';
import { useState } from 'react';

export function ActionDemo() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleAction = async () => {
    setState('loading');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setState('success');
      setTimeout(() => setState('idle'), 3000);
    } catch (err) {
      setState('error');
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleAction} isLoading={state === 'loading'}>
        {state === 'loading' ? 'Processing...' : 'Click me'}
      </Button>

      {state === 'success' && (
        <Alert variant="success" title="Success!">
          Operation completed successfully
        </Alert>
      )}

      {state === 'error' && (
        <Alert variant="error" title="Error">
          Something went wrong
        </Alert>
      )}
    </div>
  );
}
```

## CSS 类名使用

```typescript
// 应用自定义 className
<Button className="uppercase">
  Uppercase Button
</Button>

// 结合 Tailwind classes
<Card className="border-2 border-primary shadow-lg">
  Styled Card
</Card>

// 条件样式
<Button className={isLoading ? 'opacity-75' : ''}>
  Click
</Button>
```

## 颜色和样式

### 使用 Tailwind classes

```typescript
// 文本颜色
<div className="text-primary">Primary text</div>
<div className="text-gray-600">Gray text</div>

// 背景颜色
<div className="bg-primary-light">Light background</div>
<div className="bg-error">Error background</div>

// 间距
<div className="p-md">Padding medium</div>
<div className="gap-lg">Gap large</div>

// 阴影
<div className="shadow-md">Medium shadow</div>

// 过渡
<div className="transition-normal hover:bg-primary">
  Smooth transition
</div>
```

### 使用 CSS 变量

```css
.custom-style {
  color: var(--color-primary);
  background: var(--color-gray-50);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal);
}
```

## 无障碍最佳实践

```typescript
// ✅ 为输入框关联标签
<Label htmlFor="username">Username</Label>
<Input id="username" />

// ✅ 标记必填字段
<Label htmlFor="email" required>Email</Label>

// ✅ 为按钮提供清晰文本
<Button>Save Changes</Button>  // 好的

// ❌ 避免
<Button>OK</Button>  // 不够清晰

// ✅ 为关闭按钮提供 aria-label
<Alert onClose={() => setError(null)}>
  Error message
</Alert>

// ✅ 使用语义化 HTML
<Card role="article">Content</Card>
<Alert role="alert">Alert message</Alert>
```

## 调试技巧

```typescript
// 使用 React DevTools 检查组件属性
// F12 -> Components 标签

// 检查 Tailwind classes 是否正确应用
// 右键 -> 检查 -> Styles 标签

// 测试焦点状态
// Tab 键导航，应该看到焦点环

// 测试键盘导航
// Tab / Shift+Tab 在按钮和输入框间移动
// Enter 激活按钮
// Space 激活复选框
```

## 常见问题

### Q: 如何改变按钮颜色?

A: 使用 `variant` prop 或自定义 className:

```typescript
// 使用预定义变体
<Button variant="danger">Delete</Button>

// 自定义颜色
<Button className="bg-blue-600 hover:bg-blue-700">
  Custom
</Button>
```

### Q: 如何让 Input 显示错误?

A: 使用 `error` prop:

```typescript
<Input error="Email is invalid" />
```

### Q: 如何禁用按钮?

A: 使用 `disabled` prop:

```typescript
<Button disabled>Disabled</Button>
```

### Q: 如何在 Card 中添加点击事件?

A: 使用 `interactive` prop 和 `onClick`:

```typescript
<Card
  interactive
  onClick={() => navigate('/details')}
>
  Click me
</Card>
```

### Q: 如何创建响应式布局?

A: 使用 Tailwind 响应式前缀:

```typescript
<div className="
  grid
  grid-cols-1 md:grid-cols-2 lg:grid-cols-3
  gap-sm md:gap-md lg:gap-lg
">
  {items.map(item => <Card key={item.id}>{item}</Card>)}
</div>
```

## 更多资源

- 完整组件文档: `src/components/README.md`
- 设计系统文档: `src/styles/README.md`
- 系统架构: `docs/CURRENT-ARCHITECT.md`
- Tailwind 文档: https://tailwindcss.com
- React 文档: https://react.dev

## 开发流程

```bash
# 启动开发服务器
npm run dev

# 格式化代码
npm run format

# 检查类型
npm run type-check

# 运行 linter
npm run lint
```

祝开发愉快! 🚀
