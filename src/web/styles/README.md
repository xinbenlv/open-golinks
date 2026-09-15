# 共享样式

`tokens.css` 定义主题 token；`global.css` 为现有页面和布局样式；`proposals.css` 为已批准的提议、极简 diff 和私有详情弹窗样式，限定在 proposals-ui 作用域。

统一由 `../main.tsx` 导入，组件中不导入 CSS。
