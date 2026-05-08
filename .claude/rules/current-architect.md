---
description: "CURRENT-ARCHITECT.md maintenance rules - triggered when modifying code"
---

# CURRENT-ARCHITECT.md Maintenance Rules

**Trigger**: 修改代码之后（新增/删除/修改文件、模块、函数或依赖）

## 修改代码后的更新要求

每次修改代码之后，必须同步更新 `docs/CURRENT-ARCHITECT.md`，确保架构文档与实际代码保持一致。

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

### 1. ASCII 系统简图

用纯文本 ASCII art 画出系统核心组件和数据流向，适合快速一览。例如：

```
WeChat ←→ Wechaty Bot ←→ PostgreSQL
               ↓
           Gemini AI → Google Maps
               ↓
           Cloudinary
```

### 2. Mermaid 详细系统图（当系统较复杂时）

用 mermaid 语法画出更详细的模块关系、数据流、外部服务依赖。放在 ASCII 图下方，用 ```` ```mermaid ```` 代码块包裹。

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

## 检查清单（每次 commit 前）

- [ ] 修改/新增/删除了代码文件？
- [ ] `docs/CURRENT-ARCHITECT.md` 是否需要更新？
- [ ] 代码位置引用的行号是否准确？
- [ ] 系统图是否仍然准确？
- [ ] 文档长度是否超过 50K tokens？
