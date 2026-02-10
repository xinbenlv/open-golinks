# AI Agent 工作规范

## 语言

本Repository的所有文档和注释，默认请使用中文简体(zh-CN)、特别是README等重要文档，必须使用中文简体。
但是术语、代码命名、文件命名等，请使用英文（en-US）。

## 长度限制

- 为了确保AI Agent能够理解文档内容，所有文档（md文件和代码文件）的长度建议保持在2k tokens 以内，
- 最长的文档不应该超过10k tokens。
- 超过10k tokens的文档应该尽量被拆分到多个文件，并确保每个被拆分后的文件的长度不超过2k tokens。
- 长度例外的情况应该在该文档的首尾用 comments 注明。


## README 维护（必读）

**每次修改文件夹内容后，必须同步更新该文件夹的 README.md**（如果存在）。维护规则：

- 每次修改文件夹的内容（新增/删除/重命名文件，改动模块结构）后，**必须检查并更新该文件夹的 README.md**
- 如果文件夹包含 **5+ 个文件**，即便没有 README.md 也**必须创建** README.md，说明各文件的用途和使用方法
- README.md 应列出当前文件夹的核心内容，避免重复 CURRENT-ARCHITECT.md 中已有的信息

## README 应该包含的内容

- 该文件夹的介绍、主要可能的文件夹读者、如何使用文件夹的内容、注意事项和Caveat。
- 复杂的文件夹应该包含一个简化系统图，用ASCII图画出、并用Mermaid语法画出更详细的模块关系、数据流、外部服务依赖。
- 其他相关文档的链接和文件夹的链接。

## 必读文档

每次开始 plan 之前，必须先阅读 `<文件夹>/README.md` 和 `docs/CURRENT-ARCHITECT.md`，了解当前项目架构和代码结构。

## 修改代码后

每次修改代码之后，必须同步更新 `<文件夹>/README.md` 和 `docs/CURRENT-ARCHITECT.md`，确保架构文档与实际代码保持一致。

需要更新的内容包括但不限于：

- 新增/删除/修改的文件
- 新增/修改的模块或函数
- 数据库 schema 变更
- 新增的环境变量
- 启动流程变化
- 消息处理逻辑变化
- 依赖变更

### System Graph 要求

`docs/CURRENT-ARCHITECT.md` **最开头**必须有一个 `## System Overview` section，包含：

1. **ASCII 系统简图**：用纯文本 ASCII art 画出系统核心组件和数据流向，适合快速一览。例如：
   ```
   WeChat ←→ Wechaty Bot ←→ PostgreSQL
                  ↓
              Gemini AI → Google Maps
                  ↓
              Cloudinary
   ```

2. **Mermaid 详细系统图**（当系统较复杂时）：用 mermaid 语法画出更详细的模块关系、数据流、外部服务依赖。放在 ASCII 图下方，用 ```` ```mermaid ```` 代码块包裹。

每次修改代码后，**必须检查这两张图是否仍然准确**，如果新增了模块、外部服务、数据流等，需要同步更新图。

### 代码位置引用要求

`docs/CURRENT-ARCHITECT.md` 中描述关键逻辑时，**必须引用具体的代码文件路径和行号范围**，格式为 `文件路径:起始行-结束行`。例如：

```
- `initDatabase()`: 初始化数据库表 (`main.ts:44-67`)
- `syncStatsToDb(bot)`: 同步群统计到数据库 (`main.ts:69-137`)
```

每次修改代码导致行号变化时，必须同步更新文档中的行号引用。

### 文档长度限制

`docs/CURRENT-ARCHITECT.md` 全文总长度**不得超过 50,000 tokens**（约为 Claude Opus 4.5 context window 200K tokens 的 1/4）。

如果内容超出限制，需要：

1. 将详细内容拆分到 `docs/` 目录下的独立文档中（如 `docs/db-schema.md`、`docs/message-handling.md` 等）
2. 在 `docs/CURRENT-ARCHITECT.md` 中保留摘要，并用链接引用详细文档，例如：
   ```
   详见 [数据库 Schema 详解](./db-schema.md)
   ```

## 计划管理规范

### 目录结构

```
docs/plans/
├── <yyyy-mm-dd>-<计划名>.md          # 活跃计划
├── <yyyy-mm-dd>-<计划名>.md
└── archived/
    ├── <yyyy-mm-dd>-<计划名>-phase-n.md  # 已完成的计划
    └── <yyyy-mm-dd>-<计划名>-phase-n.md
```

### 计划生命周期

1. **计划创建**: 在 `docs/plans/` 创建新的计划文件
   - 格式: `<YYYY-MM-DD>-<计划名>.md`
   - 例如: `2026-02-10-ga-backend-proxy.md`

2. **计划执行**: Agent 按计划执行工作
   - 在计划文件中记录进度
   - 完成各个 task 后更新状态

3. **计划完成**: 计划完成后移动到 archived
   - `mv docs/plans/<plan>.md docs/plans/archived/<plan>-phase-n.md`
   - Phase 号格式: `phase-1`, `phase-2`, 等
   - 例如: `docs/plans/archived/2026-02-10-foundation-phase-1.md`

4. **版本控制**: 提交到 Git
   - 完成的计划（archived）必须提交到 git
   - 活跃计划根据需要提交

### 计划文件要求

每个计划文件必须包含:

```markdown
# <计划标题>

**Date**: YYYY-MM-DD
**Duration**: 预估时间
**Priority**: P0/P1/P2
**Status**: 📋 Planning / 🚀 In Progress / ✅ Complete

## Overview
## Deliverables
## Implementation Steps
## Timeline
## Success Criteria
```

### 已完成计划

完成的实现计划存档在 `docs/plans/archived/` 目录下。这些是**历史记录**，平时不需要阅读。仅在遇到困难、需要理解"当初为什么这样做"时参考。

已完成:
- ✅ `2026-02-10-phase-1-foundation.md` - Phase 1 完成
- ✅ `2026-02-10-phase-2-api-core.md` - Phase 2 完成
- ✅ `2026-02-10-phase-3-web-ui.md` - Phase 3 完成

### 活跃计划

当前执行中或待执行的计划:
- 📋 `2026-02-10-phase-4-chrome-extension.md` - Phase 4
- 📋 `2026-02-10-phase-5-migration.md` - Phase 5
- 📋 `2026-02-10-phase-6-production.md` - Phase 6
- 📋 `2026-02-10-ga-backend-proxy.md` - GA 后端代理方案

## 错误排查与经验积累

当 agent 在工作过程中遇到以下情况时，**必须**在 `docs/troubleshooting/` 目录下创建或更新文档：

- 遇到报错并最终解决
- 被用户纠正了错误的做法
- 发现了非显而易见的坑或注意事项
- 尝试了多种方案后找到正确方法

### 文档格式

每个问题一个 section 或一个文件，包含：

- **问题描述**: 遇到了什么错误/问题
- **错误原因**: 为什么会出现这个问题
- **解决方案**: 最终如何解决的
- **相关代码**: 涉及的文件和行号

文件命名建议：`docs/troubleshooting/<主题>.md`，例如 `docs/troubleshooting/wechaty-connection.md`。

### 查询要求

在开始任务之前，如果任务涉及以往可能踩过坑的领域，**应先查阅 `docs/troubleshooting/` 下的相关文档**，避免重复踩坑。

## 定期 README 检查与维护

在每次 git commit 之前，如果修改了任何文件夹内容，**必须检查该文件夹的 README.md 是否需要更新**：
- 新增文件 → 在 README.md 中添加该文件说明
- 删除文件 → 从 README.md 中移除该文件说明
- 改动代码结构 → 更新 README.md 中的相关描述
- 创建新的重要子目录 → 在 README.md 中添加子目录说明，或为子目录创建自己的 README.md

**检查清单：**
- [ ] 修改/新增/删除了文件或文件夹？
- [ ] 该文件夹的 README.md 是否需要更新？
- [ ] README.md 长度是否超过 2K tokens？（超过则需要考虑拆分）、是否超过10K tokens？（超过则必须拆分）
- [ ] 所有链接是否仍然有效？
- [ ] 新增的文件是否在 README.md 中有清晰说明？
- [ ] 删除的文件/文件夹是否在 README.md 中被移除？

## 前端开发与设计

### frontend-design 技能使用规范

进行**前端开发时，必须评估任务是否涉及 UI/UX 设计**。如果涉及以下情况，**应主动使用 `frontend-design` 技能提升设计质量**。

#### ✅ 应该使用 frontend-design 的场景

- 创建 web 组件、页面、应用或其他前端界面
- 设计网站、登陆页面、仪表板、React 组件等
- 任何涉及 HTML/CSS 布局或美化任何 web UI 的任务
- 需要产品级别的前端界面，避免"AI 通用美学"
- 强调设计创意和视觉细节的项目

#### ❌ 不需要使用 frontend-design 的场景

- 纯逻辑修复或 bug 修复（不涉及视觉改变）
- 简单的代码重构或性能优化
- 仅修改现有样式的微调（如改变 padding 值）

#### 设计指导要点

当使用该技能时，遵循以下设计原则：

**1. 承诺明确的设计方向**
- 选择极端风格：极简主义、极繁主义、复古未来主义、有机/自然、奢华/精致、有趣/玩具般、社论/杂志风、野蛮主义/原始等
- 关键是 **意图性和一致性**，而非强度

**2. 排版与颜色**
- ❌ 避免通用字体（Arial、Inter、系统字体）
- ✅ 选择独特、有特色的字体搭配（展示字体 + 正文字体）
- ✅ 提交一个有凝聚力的配色方案，使用 CSS 变量保持一致性

**3. 动画与交互**
- 优先使用 CSS 动画或 Motion 库
- 聚焦高影响力时刻：精心编排的页面加载动画胜于分散的微交互
- 使用滚动触发和 hover 状态创造惊喜

**4. 空间构成与细节**
- 使用非对称布局、重叠、对角流、打破网格的元素、宽敞的负空间
- 添加纹理、渐变、几何图案、阴影、装饰边框、自定义光标等

#### 示例

```
✅ 好的请求：创建一个现代的用户资料编辑页面，采用极简设计：
- 大胆选择独特的字体
- 高对比度、深思熟虑的配色
- 流畅的微交互
- 精致的空间组织

❌ 一般的请求：创建一个用户资料编辑页面
```

### skill-creator 技能使用规范

对于需要创建新的、或更新现有的 **Anthropic Skills** 的任务，使用 `skill-creator` 技能。Skills 是模块化的、自包含的包，用来扩展 Claude 的能力。

#### ✅ 应该使用 skill-creator 的场景

- 创建新的 Skill 或更新现有 Skill
- 为特定域、工作流或工具集成创建专门的 Skill
- 需要编写 SKILL.md 文件和配置资源
- 创建包含脚本、参考文档或资源的 Skill

#### Skill 的核心原则

1. **简洁至关重要** - 仅添加 Claude 没有的上下文，质疑每个信息："Claude 真的需要这个吗？"
2. **设置合适的自由度** - 高自由度用于多种方法都有效的场景；低自由度用于脆弱、需要一致性的操作
3. **标准结构**：
   ```
   skill-name/
   ├── SKILL.md (必需) - 包含 name、description、markdown 说明
   └── Bundled Resources (可选)
       ├── scripts/    - 可执行代码（Python/Bash 等）
       ├── references/ - 参考文档
       └── assets/     - 输出中使用的文件
   ```

#### 创建 Skill 的工作流

1. 定义 Skill 的名称和用途
2. 编写 SKILL.md 的 frontmatter（name、description）
3. 编写清晰、简洁的 markdown 说明
4. 根据需要添加脚本、参考或资源文件
5. 确保技能信息精准，避免重复或冗余

## React 代码质量标准

### useEffect 使用原则

**核心**：❌ 尽可能避免，✅ 仅在极其必要时使用，📝 **必须加 justification comment**

#### ✅ 合法使用场景

只有三种情况应该使用 useEffect：

1. **数据获取**（最常见）
   - 从 API 获取受保护/动态数据
   - 无法在 Server Component 中处理（如需要客户端认证）
   - 例：`apps/website/src/components/listing/contact-info.tsx:24-45`

2. **外部系统集成**
   - 订阅第三方库事件
   - 与不受 React 控制的系统同步

3. **浏览器 API**
   - localStorage、geolocation 等仅在客户端可用的 API

#### ❌ 常见误用（禁止）

- **URL 状态同步**：使用 URL 作为单一真实源，直接从事件处理器更新
- **Props 同步**：直接使用 prop，不要复制到 state
- **派生状态**：在 render 时计算，不要用 useEffect
- **事件处理**：使用 onClick/onChange，不要用 useEffect

#### Justification Comment 模板

所有 useEffect 必须有如下格式的注释：

```typescript
// JUSTIFICATION: useEffect is necessary because:
// 1. [理由1 - 为什么不能在 render 时执行]
// 2. [理由2 - 为什么不能用其他替代方案]
// 3. [理由3 - 考虑过的替代方案和为什么不适用]
// Alternative considered: [为什么不用 Server Component/事件处理/计算值]
useEffect(() => {
  // ... 实现
}, [deps])
```

### useEffect 替代方案

| 场景 | 推荐方案 | 说明 |
|------|---------|------|
| 同步 props 到 state | 直接使用 prop | `const value = prop` |
| 处理用户交互 | onClick/onChange | `<input onChange={(e) => handleChange(e)}/>` |
| 数据获取（Server） | Server Component | `export async function Page()` |
| 派生状态 | 直接计算 | `const fullName = first + last` |
| 昂贵计算缓存 | useMemo | `const cached = useMemo(() => expensive(), [deps])` |

### 性能优化原则

#### ✅ 值得优化的

- 大列表过滤/映射（100+ 项）→ 使用 `useMemo`
- 昂贵的计算（> 1ms） → 使用 `useMemo`
- 作为 props 传给 memoized 子组件 → 使用 `useCallback`
- 提取为单独组件防止不必要重新渲染

#### ❌ 不值得优化的

- 简单的字符串拼接、对象创建
- 简单的派生值
- 单次使用的函数

### 代码审查检查清单

#### 遇到 useEffect 时

- [ ] 有明确的 justification comment 吗？
- [ ] 依赖数组是否完整且准确？
- [ ] 是否会导致无限循环？
- [ ] 能用 Server Component/事件处理/计算值替代吗？
- [ ] 是否有更简单的方案？

#### 状态管理检查

- [ ] 是否只有一个状态源？
- [ ] URL 和 state 是否始终同步？
- [ ] 有没有重复的派生状态？
- [ ] 有没有不必要的 memoization？

### 参考文档

- 📖 [useEffect 使用标准](./docs/USEFFECT-STANDARDS.md)
- 📖 [代码质量标准](./docs/CODE-QUALITY-STANDARDS.md)
- 📖 [useEffect 审计报告](./docs/USEFFECT-AUDIT.md)
- 📖 [React 性能审计](./docs/REACT-PERFORMANCE-AUDIT.md)
- 🔗 [React 官方文档：You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
