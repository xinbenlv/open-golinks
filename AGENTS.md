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

### 当需要创建或者修改 React 有关代码时：请查阅 `.agents/skills/vercel-react-best-practices/AGENTS.md` 和 `.agents/skills/vercel-composition-patterns/AGENTS.md`

