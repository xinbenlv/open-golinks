# Proposed changes UI

标题和操作已表达的说明不重复展示；空状态只保留一行。提交前的审批/隐私提示和冲突恢复说明保留。

`Proposals.tsx` 连接提议列表、提交、审核与历史 API；`ProposalComposer` 保留打开时的基线，`ProposalCard` 展示审核状态，`MetadataDialog` 按需读取私有详情。

`Diff` / `InlineDiff` 复用 Namefi 极简语法：公共前后缀一次、旧值灰色删除线、新值普通文字色。样式集中在 `../../styles/proposals.css` 并由 main.tsx 导入。没有 mock 角色或测试数据。

`useProposalList.ts` 在身份、页签或版本切换后丢弃旧请求响应。Proposals 保留约 180 行的状态编排与 JSX（略超 5KiB），避免拆分相互依赖的提交/审核刷新动作。
