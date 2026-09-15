# Landing 页面

`index.tsx` 组合 Header、Hero/CreateForm、Features、HowItWorks、ForTeams 和 Footer；`icons.tsx` 为共享图标，`landing.css` 包含页面及全局按钮样式。

首页会被 prerender；创建入口被 Create 和未找到链接的 Edit 页复用。footer 使用 text-muted，确保正文与版本信息满足对比度要求。

Header 被 Edit 共用，锚点使用首页绝对路径；会话加载中显示状态，登录入口保留来源。Landing 接受 header 插槽供外层布局复用。
