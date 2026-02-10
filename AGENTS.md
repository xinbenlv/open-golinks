# AI Agent 工作规范

## 语言

本Repository的所有文档和注释，默认请使用中文简体(zh-CN)、特别是README等重要文档，必须使用中文简体。
但是术语、代码命名、文件命名等，请使用英文（en-US）。

## 长度限制

- 为了确保AI Agent能够理解文档内容，所有文档（md文件和代码文件）的长度建议保持在2k tokens 以内，
- 最长的文档不应该超过10k tokens。
- 超过10k tokens的文档应该尽量被拆分到多个文件，并确保每个被拆分后的文件的长度不超过2k tokens。
- 长度例外的情况应该在该文档的首尾用 comments 注明。


## 文档维护规范

**Trigger**: 修改文件内容时（新增、删除、修改代码结构）

详见 [`.claude/rules/documentation.rules`](./.claude/rules/documentation.rules)

### 概述

- 每次修改文件夹内容后，**必须同步更新** `README.md` 和 `docs/CURRENT-ARCHITECT.md`
- README.md 用于说明文件夹用途；CURRENT-ARCHITECT.md 用于记录系统架构
- System Graph 必须包含 ASCII 简图 + Mermaid 详细图
- 代码位置引用格式：`文件路径:起始行-结束行`
- 文档长度限制：CURRENT-ARCHITECT.md < 50K tokens

### 检查清单（每次 commit 前）

- [ ] 修改/新增/删除了文件或文件夹？
- [ ] README.md 是否需要更新？
- [ ] CURRENT-ARCHITECT.md 中行号引用是否准确？
- [ ] 系统图是否仍然准确？

---

## 计划管理规范

**Trigger**: 创建或处理计划时

详见 [`.claude/rules/planning.rules`](./.claude/rules/planning.rules)

### 概述

- 计划文件存放在 `docs/plans/` 目录
- 格式：`<YYYY-MM-DD>-<计划名>.md`
- 完成后移动到 `docs/plans/archived/`，添加 `-phase-n` 后缀
- 必须包含：Overview、Deliverables、Implementation Steps、Timeline、Success Criteria

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

## React 代码规范

当需要创建或修改 React 相关代码时，请查阅：
- [`.agents/skills/vercel-react-best-practices/AGENTS.md`](.agents/skills/vercel-react-best-practices/AGENTS.md)
- [`.agents/skills/vercel-composition-patterns/AGENTS.md`](.agents/skills/vercel-composition-patterns/AGENTS.md)

## 参考

- 📖 [Anthropic's Offical Guide: Modular Rules with .claude/rules/](https://code.claude.com/docs/en/memory#modular-rules-with-claude%2Frules%2F)
