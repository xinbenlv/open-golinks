---
description: "README maintenance rules - triggered when modifying folder content"
---

# README Maintenance Rules

**Trigger**: 修改文件夹内容时（新增/删除/重命名文件，改动模块结构）

## README 维护（必读）

**每次修改文件夹内容后，必须同步更新该文件夹的 README.md**（如果存在）。维护规则：

- 每次修改文件夹的内容（新增/删除/重命名文件，改动模块结构）后，**必须检查并更新该文件夹的 README.md**
- 如果文件夹包含 **5+ 个文件**，即便没有 README.md 也**必须创建** README.md，说明各文件的用途和使用方法
- README.md 应列出当前文件夹的核心内容，避免重复 CURRENT-ARCHITECT.md 中已有的信息

## README 应该包含的内容

- 该文件夹的介绍、主要可能的文件夹读者、如何使用文件夹的内容、注意事项和Caveat。
- 复杂的文件夹应该包含一个简化系统图，用ASCII图画出、并用Mermaid语法画出更详细的模块关系、数据流、外部服务依赖。
- 其他相关文档的链接和文件夹的链接。

## 定期 README 检查与维护

在每次 git commit 之前，如果修改了任何文件夹内容，**必须检查该文件夹的 README.md 是否需要更新**：

- 新增文件 → 在 README.md 中添加该文件说明
- 删除文件 → 从 README.md 中移除该文件说明
- 改动代码结构 → 更新 README.md 中的相关描述
- 创建新的重要子目录 → 在 README.md 中添加子目录说明，或为子目录创建自己的 README.md

### 检查清单（每次 commit 前）

- [ ] 修改/新增/删除了文件或文件夹？
- [ ] 该文件夹的 README.md 是否需要更新？
- [ ] README.md 长度是否超过 2K tokens？（超过则需要考虑拆分）、是否超过10K tokens？（超过则必须拆分）
- [ ] 所有链接是否仍然有效？
- [ ] 新增的文件是否在 README.md 中有清晰说明？
- [ ] 删除的文件/文件夹是否在 README.md 中被移除？
