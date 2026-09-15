# 独立提议预览的依赖与样式

## 问题描述

隔离工作树中的 Bun 安装与 loopback Vite 启动会被 sandbox 限制；独立入口只导入 global.css 时，按钮缺少原项目样式。

## 错误原因

Bun 需要写入临时缓存，Vite 需要监听本地端口。项目 `.btn` 的基础和变体定义在 `src/web/pages/Landing/landing.css`，不在 global.css 中。

## 解决方案

通过正常命令审批运行依赖安装与仅绑定 `127.0.0.1:5174` 的 Vite。独立入口按生产入口顺序导入 tokens、global、landing，再导入原型专用布局样式，不复制或改写品牌 token。

原生 dialog 卸载后的焦点恢复不能依赖浏览器默认行为；保留触发按钮引用，关闭后显式恢复焦点。浏览器 HMR 可能重置 fixture 状态，修改入口后应重新读取页面再继续操作，不能沿用旧节点或状态假设。

仓库引用的 `.agents/skills/*/AGENTS.md` 当前不存在，已读取本机对应 React skills 指引作为补充。

## 相关代码

- `demos/proposed-changes/main.tsx`：共享样式导入。
- `demos/proposed-changes/vite.config.ts`：独立 root、loopback 和 strictPort。
- `demos/proposed-changes/ProposalDemo.tsx:25-33`：metadata 触发器和焦点恢复。

## 文档编辑工具的编码问题

本环境调用 Python 处理包含中文的内联脚本时报告编码声明错误。改用 UTF-8 文件 patch 和 shell heredoc 写入中文文档，避免依赖 Python 运行时的默认编码。

## 极简 diff 应以已有设计为准

用户指出应复用此前 Namefi proposed-change 的极简 diff。原先双栏重复了完整字段值和标签。已核对 Namefi org-utility 的最终需求 R16–R20 与 React InlineDiff：公共前后缀只显示一次，旧片段灰色删除线，新片段正常文字色，短公共片段使用箭头形式。旧实现注释提及绿色，但最终需求和实际 CSS 已改成正常文字色，不能按旧注释复刻。

相关代码：`demos/proposed-changes/InlineDiff.tsx:1-46`、`demos/proposed-changes/Review.tsx:12-52`。

## Hono 提议根路径漏过中间件

`/:slug/proposals*` 没有覆盖预期的根路径，导致带无效 bearer 的提交变成匿名。改为分别注册 `/:slug/proposals` 与 `/:slug/proposals/*`；真实数据库测试先复现 201，再验证修复后 401，并覆盖 Origin/body limit。相关：`src/routes/api/proposals.ts`。

## 本地测试工具

- Xcode 未接受许可会阻塞 `/usr/bin/git` 和 `/usr/bin/python3`。使用已可用的 `/Library/Developer/CommandLineTools/usr/bin/` 工具，不修改系统许可状态。
- `initdb` 需要共享内存权限；通过正常审批运行，仅创建一次性 loopback PostgreSQL。
- Drizzle 会改写 postgres-js JSON serializer；迁移与原生 SQL fixtures 使用独立连接，避免对象参数被当成字符串编码。
- 浏览器文字定位器曾误点顶部 Copy。回归使用组件 `data-testid` 加 CSS 选择器，并断言真实表单/状态变化，不能把工具返回 Done 当成成功。相关：`tests/proposals/browser.spec.ts`。

## Lighthouse 的真实加载与对比度

本地测试服务器未压缩资源，首次测量编辑页 Performance 60；统计卡片还会在没有数据时拉取完整图表包。生产静态路由增加协商压缩并设置 Vary，统计图改为有数据时 lazy，复测 97。首页原有 footer 的 text-faint 对比度 4.09:1，改用既有 text-muted token，不改变主题颜色定义。
