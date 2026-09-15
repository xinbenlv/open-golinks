# Proposed changes UI

标题和操作已表达的说明不重复展示；空状态只保留一行。提交前的审批/隐私提示和冲突恢复说明保留。

`Proposals.tsx` 连接提议列表、审核与历史 API；统一 Edit 表单保留加载时的基线，`ProposalCard` 展示审核状态，`MetadataDialog` 按需读取私有详情。

`Diff` / `InlineDiff` 复用 Namefi 极简语法：公共前后缀一次、旧值灰色删除线、新值普通文字色。样式集中在 `../../styles/proposals.css` 并由 main.tsx 导入。没有 mock 角色或测试数据。

`useProposalList.ts` 在身份、页签或版本切换后丢弃旧请求响应。Proposals 保留约 180 行的状态编排与 JSX（略超 5KiB），避免拆分相互依赖的提交/审核刷新动作。

Proposals 仅展示待审列表或 history；统一编辑表单负责提议提交和极简 diff。

MetadataDialog 同时兼容匿名浏览器详情和登录用户邮箱/account ID，避免文案与记录不一致。

Diff 显示标签增删；审核者看到匿名 IP，hover 显示 GeoIP 位置/浏览器/OS，点击可在手机打开详情。

ProposalConfirmation 展示统一表单的差异及身份关联提示；确认才提交，支持 Escape、取消恢复焦点和手机底部 sheet。

Proposals 在 tab 内不重复显示标题，只有基本信息页的 reviewer 待审区保留标题。

确认弹窗从服务端回显当前请求的具体 IP、浏览器/OS；完整 User-Agent 可展开，加载失败可重试。身份加载完成后才允许匿名提交。
