# 样式系统 (Styles)

该目录包含 Open GoLinks v2 的全局样式和设计系统配置。

## 文件结构

- **variables.css** - CSS 自定义属性 (CSS Variables)，定义所有设计令牌
  - 语义颜色 (primary, success, error, warning, info)
  - 中性色 (gray scale: 50-900)
  - 间距 (8px 基础单位: xs-2xl)
  - 排版 (字体族)
  - 过渡和动画配置
  - 圆角、阴影、z-index、焦点环
  - 屏幕阅读器专用文本 (.sr-only)

- **globals.css** - 全局样式
  - 集成 Tailwind CSS
  - 导入 CSS 变量
  - HTML/Body 基础样式
  - 焦点可见状态
  - 过渡配置
  - 文本选择样式

## CSS 变量命名约定

```css
--color-[semantic|gray]-[name]: 颜色值
--space-[xs|sm|md|lg|xl|2xl]: 间距
--font-[display|body|mono]: 字体族
--transition-[fast|normal|slow]: 动画时长
--radius-[sm|md|lg]: 圆角
--shadow-[sm|md|lg|xl]: 阴影
--z-[dropdown|sticky|fixed|modal|tooltip]: z-index
```

## 集成方式

### 1. Tailwind CSS 集成
在 `tailwind.config.ts` 中，所有 CSS 变量都映射到 Tailwind 的 theme 扩展：

```typescript
colors: {
  primary: 'var(--color-primary)',
  // ...
}
```

### 2. 使用 CSS 变量
直接在 CSS 中使用：

```css
.component {
  color: var(--color-gray-900);
  padding: var(--space-md);
  transition: all var(--transition-normal);
}
```

### 3. 使用 Tailwind Classes
通过预定义的 Tailwind classes：

```tsx
<div className="text-primary bg-gray-50 p-md transition-normal" />
```

## 字体配置

在 `src/app/layout.tsx` 中配置 Next.js 字体：

```typescript
import { Geist, Inter } from 'next/font/google';

const geist = Geist({ variable: '--font-display' });
const inter = Inter({ variable: '--font-body' });
```

此配置自动将字体注入到 CSS 变量中，可在全局样式和组件中使用。

## 响应式设计

所有间距、颜色、排版都支持响应式设计。使用 Tailwind 的响应式前缀：

```tsx
<div className="text-sm md:text-base lg:text-lg p-sm md:p-md lg:p-lg" />
```

## 暗色模式 (Dark Mode)

目前 `variables.css` 中暗色模式覆盖为空。后续可在 `@media (prefers-color-scheme: dark)` 中添加暗色模式的 CSS 变量覆盖。

## 焦点管理

- **Focus Ring**：`--focus-ring: 2px solid var(--color-primary)`
- **Focus Offset**：`--focus-offset: 2px`
- 自动应用于所有 `button` 和 `a` 元素

## Screen Reader Only Text

`.sr-only` class 用于隐藏屏幕中的文本，但对屏幕阅读器可见：

```tsx
<button>
  <span className="sr-only">关闭</span>
  ✕
</button>
```
