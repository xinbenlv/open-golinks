# Phase 3 Web UI 验证清单

Phase 3: Web UI Implementation 完成度验证指南

## 🚀 快速验证（10 分钟）

```bash
# 1. 安装依赖
npm install

# 2. 类型检查
npm run type-check

# 3. 运行所有单元测试
npm test

# 4. Lint 检查
npm run lint

# 5. 构建应用
npm run build

# 6. 启动 Storybook（新终端）
npm run storybook

# 7. 启动开发服务器（第三个终端）
npm run dev
```

**预期结果：**
- ✅ npm install 成功
- ✅ 0 TypeScript 错误
- ✅ 117+ 测试通过
- ✅ 0 lint 错误
- ✅ 构建成功
- ✅ Storybook 启动（http://localhost:6006）
- ✅ Dev 服务器启动（http://localhost:3000）

---

## ✅ 文件完成度检查清单

### Track A: Design System + Atoms (14 files)
```bash
# 检查设计系统文件
ls -la src/styles/variables.css
ls -la src/styles/globals.css
ls -la tailwind.config.ts

# 检查 12 个原子组件
ls -la src/components/atoms/
```

**验证清单：**
- [ ] `src/styles/variables.css` 包含 70+ 设计令牌
- [ ] `tailwind.config.ts` 配置所有颜色、间距、字体
- [ ] `globals.css` 导入并应用 Tailwind
- [ ] Button 组件有 4 个变体 (primary, secondary, ghost, danger)
- [ ] Button 组件有 3 个尺寸 (sm, md, lg)
- [ ] Input 组件支持所有输入类型
- [ ] Label, Badge, Card, Alert, Avatar, Spinner 都已创建
- [ ] Icon 组件包含预定义图标 (CheckIcon, XIcon, AlertIcon)
- [ ] 所有组件导出在 `src/components/atoms/index.ts`
- [ ] 所有组件使用 React.forwardRef
- [ ] 所有组件完全类型安全

### Track B: Link Creation Form (5 files)
```bash
ls -la src/components/molecules/InputField.tsx
ls -la src/components/organisms/LinkCreationForm.tsx
ls -la src/app/\(public\)/create/page.tsx
```

**验证清单：**
- [ ] InputField 分子组件使用 React Hook Form 的 useFormContext
- [ ] TextAreaField 分子组件可用
- [ ] LinkCreationForm 完整，包含：
  - [ ] Slug 输入 + 自动生成按钮
  - [ ] URL 输入（HTTPS 验证）
  - [ ] 元数据字段（title, description, showWarning）
  - [ ] 错误处理（SLUG_CONFLICT, SLUG_RESERVED, URL_INVALID 等）
  - [ ] 成功状态显示
  - [ ] 加载状态
  - [ ] Turnstile 集成就绪
- [ ] `/create` 页面可访问，显示完整表单
- [ ] 表单验证工作（Zod schemas）
- [ ] 错误消息用户友好（中文）

### Track C: Dashboard (9 files)
```bash
ls -la src/lib/hooks/useDebounce.ts
ls -la src/lib/hooks/useCopyToClipboard.ts
ls -la src/components/molecules/SearchInput.tsx
ls -la src/components/molecules/Pagination.tsx
ls -la src/components/molecules/FilterBar.tsx
ls -la src/components/organisms/LinksDashboardTable.tsx
ls -la src/app/\(protected\)/dashboard/page.tsx
```

**验证清单：**
- [ ] useDebounce 钩子工作正常（300ms 默认）
- [ ] useCopyToClipboard 钩子可用
- [ ] SearchInput 分子组件防抖搜索
- [ ] Pagination 分子组件显示页数、上一页、下一页
- [ ] FilterBar 分子组件：
  - [ ] 搜索输入
  - [ ] Regex 过滤输入 + 验证
  - [ ] 表格/网格视图切换
- [ ] LinksDashboardTable 生物体组件：
  - [ ] 显示用户链接列表
  - [ ] 搜索功能（slug + URL）
  - [ ] Regex 过滤（例如 ^event-, meeting.*2024$）
  - [ ] 分页（20 项/页）
  - [ ] 复选框选择（单个 + 全选）
  - [ ] 批量删除
  - [ ] 表格和网格视图
  - [ ] 编辑/删除按钮
- [ ] `/dashboard` 页面需要认证
- [ ] 仪表板显示用户链接

### Track D: Analytics (4 files)
```bash
ls -la src/lib/utils/analytics.ts
ls -la src/components/molecules/StatCard.tsx
ls -la src/components/organisms/AnalyticsChart.tsx
ls -la src/app/\(protected\)/dashboard/\[slug\]/analytics/page.tsx
ls -la src/app/\(protected\)/stats/page.tsx
```

**验证清单：**
- [ ] analytics.ts 工具函数：
  - [ ] formatVisits() 格式化访问数
  - [ ] calculateTrend() 计算趋势
  - [ ] getDateRange() 生成日期范围
  - [ ] exportToCSV() 导出功能
- [ ] StatCard 分子组件：
  - [ ] 显示数值 + 标签
  - [ ] 可选趋势指标（绿/红）
  - [ ] 5 个颜色变体
- [ ] AnalyticsChart 生物体组件：
  - [ ] 使用 Recharts 线图
  - [ ] 日期范围选择器（7/30/90 天）
  - [ ] 统计卡片（平均、峰值、总计）
  - [ ] CSV 导出
  - [ ] 响应式设计
- [ ] `/dashboard/[slug]/analytics` 页面：
  - [ ] 显示单个链接分析
  - [ ] 总访问、趋势、峰值统计
  - [ ] 90 天访问图表
- [ ] `/stats` 页面：
  - [ ] 显示用户所有链接的聚合统计
  - [ ] Regex 过滤支持
  - [ ] 排名前 5 的链接
  - [ ] CSV 导出

### Track E: Testing + Storybook (12 files)
```bash
ls -la .storybook/main.ts
ls -la .storybook/preview.tsx
ls -la src/components/atoms/*.stories.tsx
ls -la tests/components/
npm run storybook
npm test
```

**验证清单：**
- [ ] Storybook 配置完成
- [ ] 41 个 Storybook stories（4 个组件）：
  - [ ] Button.stories.tsx (17 stories)
  - [ ] Input.stories.tsx (11 stories)
  - [ ] Badge.stories.tsx (6 stories)
  - [ ] Card.stories.tsx (7 stories)
- [ ] 117+ 单元测试：
  - [ ] Button.test.tsx (50+ 测试)
  - [ ] Input.test.tsx (48+ 测试)
  - [ ] InputField.test.tsx (24+ 测试)
- [ ] 所有测试通过（117/117 ✅）
- [ ] 测试覆盖率 ≥ 80%
- [ ] 快照测试存在
- [ ] 无障碍测试包含
- [ ] Storybook 能启动（npm run storybook）

---

## 📋 功能验证

### 1. 设计系统验证

```bash
# 启动 Storybook
npm run storybook
# 访问 http://localhost:6006

# 检查以下 stories：
# ✅ atoms/Button - 所有 4 个变体可见
# ✅ atoms/Input - 所有输入类型
# ✅ atoms/Badge - 5 个颜色变体
# ✅ atoms/Card - 基础和交互式卡片
```

**预期结果：** Storybook 显示所有组件的实时预览

### 2. 表单验证

```bash
# 启动开发服务器
npm run dev

# 导航到 http://localhost:3000/create
# 测试：
# ✅ 输入有效的 URL
# ✅ 自动生成 slug（点击 Generate）
# ✅ 输入自定义 slug
# ✅ 提交表单（模拟，因为需要 API）
# ✅ 查看验证错误
```

**预期结果：**
- 表单渲染正确
- 验证工作（slug 格式、URL 格式）
- 错误消息显示
- 自动生成功能工作

### 3. 仪表板验证

```bash
# 已登录后访问 http://localhost:3000/dashboard
# 测试：
# ✅ 显示链接表格
# ✅ 搜索功能工作
# ✅ Regex 过滤工作（例如 ^test）
# ✅ 分页工作（20 项/页）
# ✅ 表格/网格视图切换
# ✅ 复选框选择工作
# ✅ 复制链接工作
```

**预期结果：**
- 仪表板完全可用
- 所有过滤和搜索工作正常
- UI 响应式和流畅

### 4. 分析验证

```bash
# 访问 http://localhost:3000/dashboard/[slug]/analytics
# 测试：
# ✅ 统计卡片显示数据
# ✅ 图表渲染（Recharts）
# ✅ 日期范围选择器工作
# ✅ CSV 导出功能工作

# 访问 http://localhost:3000/stats
# 测试：
# ✅ 聚合统计显示
# ✅ Regex 过滤工作
# ✅ 排名表格显示
```

**预期结果：**
- 图表显示（Recharts）
- 统计数据准确
- 过滤工作正常

### 5. 无障碍验证

```bash
# 在 Storybook 中：
# ✅ 检查 a11y addon（Accessibility 选项卡）
# ✅ 没有颜色对比错误
# ✅ ARIA 标签存在
# ✅ 焦点顺序正确

# 在浏览器中运行 Axe DevTools：
# ✅ 无关键问题
# ✅ 无高优先级问题
```

**预期结果：** WCAG 2.1 AA 合规

---

## 🧪 测试验证

### 单元测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test Button
npm test Input
npm test InputField

# 监视模式
npm test -- --watch

# 覆盖率报告
npm test -- --coverage
```

**预期结果：**
- ✅ 117+ 测试全部通过
- ✅ 覆盖率 ≥ 80%
- ✅ 无警告或错误

### 快照测试

```bash
# 快照已生成
ls -la tests/components/atoms/__snapshots__/

# 如果更新组件，更新快照：
npm test -- -u
```

**预期结果：**
- ✅ 快照文件存在
- ✅ 所有快照匹配

---

## 🔍 代码质量验证

### 类型检查

```bash
npm run type-check
```

**预期结果：** 0 TypeScript 错误

### Linting

```bash
npm run lint
```

**预期结果：** 0 lint 错误

### 构建

```bash
npm run build
```

**预期结果：**
- ✅ 构建成功
- ✅ 没有构建错误
- ✅ `.next/` 目录已创建

---

## 📊 完整验证脚本

```bash
#!/bin/bash
set -e

echo "🧪 Phase 3 完整验证开始..."

echo "1️⃣ 安装依赖..."
npm install

echo "2️⃣ 类型检查..."
npm run type-check

echo "3️⃣ ESLint..."
npm run lint

echo "4️⃣ 运行单元测试..."
npm test -- --run

echo "5️⃣ 生成覆盖率报告..."
npm test -- --coverage

echo "6️⃣ 构建应用..."
npm run build

echo "7️⃣ 构建 Storybook..."
npm run storybook:build

echo "✅ Phase 3 验证完成！"
echo ""
echo "验证项目："
echo "  ✅ 依赖安装"
echo "  ✅ TypeScript 类型检查"
echo "  ✅ 代码规范"
echo "  ✅ 单元测试 (117+)"
echo "  ✅ 覆盖率 ≥ 80%"
echo "  ✅ 生产构建"
echo "  ✅ Storybook 构建"
echo ""
echo "后续步骤："
echo "  1. npm run dev（启动开发服务器）"
echo "  2. npm run storybook（启动 Storybook）"
echo "  3. 在浏览器中测试页面"
echo "  4. 验证无障碍（使用 Axe DevTools）"
echo "  5. 开始 Phase 4（Chrome Extension）"
```

保存为 `validate-phase3.sh`：
```bash
chmod +x validate-phase3.sh
./validate-phase3.sh
```

---

## 📱 浏览器验证

### Desktop (1024px+)
```
访问页面：
✅ http://localhost:3000/ (首页)
✅ http://localhost:3000/create (创建表单)
✅ http://localhost:3000/dashboard (仪表板 - 需要认证)
✅ http://localhost:3000/dashboard/[slug]/edit (编辑页面)
✅ http://localhost:3000/dashboard/[slug]/analytics (分析)
✅ http://localhost:3000/stats (统计)

检查：
✅ 布局正确
✅ 所有组件渲染
✅ 交互工作
✅ 响应式工作
```

### Tablet (768px)
```
缩放浏览器到 768px 宽度
检查：
✅ 菜单响应式
✅ 表格变为卡片视图或滚动
✅ 按钮仍然可点击
✅ 表单可用
```

### Mobile (320px)
```
缩放浏览器到 320px 宽度（或使用手机）
检查：
✅ 堆栈布局正确
✅ 触摸目标足够大（≥44px）
✅ 没有水平滚动
✅ 菜单响应式（汉堡菜单或堆栈）
```

---

## ✅ 完整验证检查清单

| 项目 | 命令/检查 | 预期结果 |
|------|---------|---------|
| **依赖** | `npm install` | 成功 |
| **类型检查** | `npm run type-check` | 0 错误 |
| **代码规范** | `npm run lint` | 0 错误 |
| **单元测试** | `npm test` | 117+ 通过 |
| **覆盖率** | `npm test -- --coverage` | ≥ 80% |
| **构建** | `npm run build` | 成功 |
| **Storybook** | `npm run storybook` | 启动成功 |
| **开发服务器** | `npm run dev` | 启动成功 |
| **首页** | 浏览器：localhost:3000 | 显示正确 |
| **创建表单** | 浏览器：localhost:3000/create | 表单渲染 |
| **仪表板** | 浏览器：localhost:3000/dashboard | 表格显示 |
| **分析** | 浏览器：localhost:3000/dashboard/[slug]/analytics | 图表显示 |
| **无障碍** | Axe DevTools 检查 | 无关键问题 |
| **响应式** | 缩放测试（320/768/1024px） | 所有尺寸工作 |

---

## 🎯 Phase 3 完成标准

当以下全部通过时，Phase 3 完成：

```
✅ 44 个文件已创建
✅ 20+ 可重用组件已构建
✅ 6 个页面已实现
✅ TypeScript 类型检查：0 错误
✅ ESLint：0 错误
✅ 单元测试：117+ 通过
✅ 测试覆盖率：≥ 80%
✅ Storybook：41 stories，全部显示
✅ 构建：成功，无错误
✅ 开发服务器：启动成功
✅ 无障碍：WCAG 2.1 AA 合规
✅ 响应式：所有尺寸工作
```

---

## 📚 相关文档

- [PHASE3-PLAN.md](PHASE3-PLAN.md) - 实现计划概览
- [src/components/README.md](src/components/README.md) - 组件库文档
- [src/styles/README.md](src/styles/README.md) - 设计系统文档
- [QUICK-START-ATOMS.md](QUICK-START-ATOMS.md) - 原子组件快速参考
- [docs/CURRENT-ARCHITECT.md](docs/CURRENT-ARCHITECT.md) - 系统架构

---

**预计验证时间：30-45 分钟**

如有任何问题，检查详细日志：
```bash
npm test -- --reporter=verbose
npm run storybook  # 查看实时组件
```
