---
description: "Documentation and README maintenance rules - triggered when modifying file content"
---

# Documentation Rules

**Trigger**: 修改文件内容时（新增、删除、修改、重构代码）

## README 维护（必读）

**每次修改文件夹内容后，必须同步更新该文件夹的 README.md**（如果存在）。维护规则：

- 每次修改文件夹的内容（新增/删除/重命名文件，改动模块结构）后，**必须检查并更新该文件夹的 README.md**
- 如果文件夹包含 **5+ 个文件**，即便没有 README.md 也**必须创建** README.md，说明各文件的用途和使用方法
- README.md 应列出当前文件夹的核心内容，避免重复 CURRENT-ARCHITECT.md 中已有的信息

### README 应该包含的内容

- 该文件夹的介绍、主要可能的文件夹读者、如何使用文件夹的内容、注意事项和Caveat。
- 复杂的文件夹应该包含一个简化系统图，用ASCII图画出、并用Mermaid语法画出更详细的模块关系、数据流、外部服务依赖。
- 其他相关文档的链接和文件夹的链接。

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

## System Graph 要求

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

## 代码位置引用要求

`docs/CURRENT-ARCHITECT.md` 中描述关键逻辑时，**必须引用具体的代码文件路径和行号范围**，格式为 `文件路径:起始行-结束行`。例如：

```
- `initDatabase()`: 初始化数据库表 (`main.ts:44-67`)
- `syncStatsToDb(bot)`: 同步群统计到数据库 (`main.ts:69-137`)
```

每次修改代码导致行号变化时，必须同步更新文档中的行号引用。

## 文档长度限制

`docs/CURRENT-ARCHITECT.md` 全文总长度**不得超过 50,000 tokens**（约为 Claude Opus 4.5 context window 200K tokens 的 1/4）。

如果内容超出限制，需要：

1. 将详细内容拆分到 `docs/` 目录下的独立文档中（如 `docs/db-schema.md`、`docs/message-handling.md` 等）
2. 在 `docs/CURRENT-ARCHITECT.md` 中保留摘要，并用链接引用详细文档，例如：
   ```
   详见 [数据库 Schema 详解](./db-schema.md)
   ```

## 定期 README 检查与维护

在每次 git commit 之前，如果修改了任何文件夹内容，**必须检查该文件夹的 README.md 是否需要更新**：
- 新增文件 → 在 README.md 中添加该文件说明
- 删除文件 → 从 README.md 中移除该文件说明
- 改动代码结构 → 更新 README.md 中的相关描述
- 创建新的重要子目录 → 在 README.md 中添加子目录说明，或为子目录创建自己的 README.md

### 检查清单

在每次 git commit 之前：
- [ ] 修改/新增/删除了文件或文件夹？
- [ ] 该文件夹的 README.md 是否需要更新？
- [ ] README.md 长度是否超过 2K tokens？（超过则需要考虑拆分）、是否超过10K tokens？（超过则必须拆分）
- [ ] 所有链接是否仍然有效？
- [ ] 新增的文件是否在 README.md 中有清晰说明？
- [ ] 删除的文件/文件夹是否在 README.md 中被移除？
