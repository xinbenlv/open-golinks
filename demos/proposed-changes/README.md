# Proposed changes 交互原型

面向产品体验审批。基于 `origin/main` 的 `16499bc` 编辑页布局，复用现有 ZGZG 主题、字体、全局样式和 QR canvas；该独立入口保留审批用 fixtures，正式页面已接入真实 API。

## 运行

在仓库根目录执行：

```sh
bun install --frozen-lockfile
bun x vite --config demos/proposed-changes/vite.config.ts
```

访问 `http://127.0.0.1:5174/`。服务器仅绑定 loopback，端口冲突时退出，不影响已有 5173 预览。

## 文件

- `index.html`、`main.tsx`：独立 HTML / React 入口。
- `ProposalDemo.tsx`：角色切换、编辑页、提议提交与历史。
- `Review.tsx`：字段 diff、审核卡、可键盘及点击打开的原生 dialog。
- `model.ts`：虚构身份、保留示例 IP、待审核/过期/已通过数据及状态转换。
- `model.test.ts`：审核权限、过期防护、拒绝不变更链接、仅应用提议字段的测试。
- `preview.css`：仅原型布局，不覆盖品牌 token 或字体。
- `vite.config.ts`、`tsconfig.json`：独立启动、构建和类型检查。

## 体验路径

1. Anonymous visitor 或 Signed-in proposer → Propose a change → 修改 URL / description → Submit proposal。当前链接不变。
2. View as 切换 Link owner 或 Admin，查看 diff 与 Submission details；元数据包含虚构的近似区域图、设备类型、系统、浏览器、locale、IP 和原始 UA。
3. Approve & apply 更新当前字段并记录原提议人、审核人、两个时间及前后值。
4. Reject → 可选理由 → Confirm rejection，只记录拒绝结果；不会产生已应用 URL 变更。
5. Sam Patel 的旧提议展示过期冲突和未知位置；旧值与当前被修改字段不匹配时无法通过。
6. 审核完所有提议显示空状态；切回提交者可查看本人本轮提交的结果。Reset demo 或刷新重置所有状态。

## 范围与边界

仅 React 内存状态。所有身份、统计和设备/网络元数据均为 fixtures，无真实认证、存储、API、IP/UA/locale 采集或定位请求。敏感详情只在 reviewer UI 中呈现；这不是生产安全边界。

Go 仅显示模拟目标，Copy 复制示例短链，QR 在本地生成。提交者只可提议目标与描述；权限、公开性和 QR 设置仍由 reviewer 编辑。此原型允许 owner/admin 直接保存本地编辑；存在未保存编辑时阻止审核，避免覆盖草稿。

匿名“本人提议”仅由本轮 demo 内存标识识别。跨会话追踪、实际管理权限、隐私保留策略、数据库审计及后端并发校验已在正式页面实现，详见 ../../docs/runbooks/proposed-changes.md。

## 验证

```sh
bun run type-check
bun x tsc --noEmit -p demos/proposed-changes/tsconfig.json
bun test demos/proposed-changes/model.test.ts
OPEN_GOLINK_THEME=zgzg bun run build
bun x vite build --config demos/proposed-changes/vite.config.ts
```

已验证匿名提交 → owner 通过、登录提交 → admin 通过、admin 拒绝、过期禁用、历史归因及空状态。Codex 浏览器检查桌面和 390×844 窄屏；按钮点击打开详情，Enter 打开、Escape 关闭并恢复触发按钮焦点。窄屏文档宽度与视口均为 390px。

**2026-09-15 用户已批准体验并要求实现。此目录仍仅为原型，不用于生产。**

## 极简 diff（2026-09-09 修订）

`InlineDiff.tsx` 按 Namefi org-utility 最终需求 R16–R20 显示公共前后缀和变化片段：旧值灰色删除线，新值正常文字色，共同片段不足 3 字符时回退旧值 → 新值。字段以平铺细分隔线呈现，宽屏单行、窄屏换行；没有 Before / Proposed 双栏和内嵌容器。读屏保留完整前后值。
