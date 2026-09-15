# 共享样式

`tokens.css` 定义主题 token；`global.css` 为现有页面和布局样式；`proposals.css` 为已批准的提议、极简 diff 和私有详情弹窗样式，限定在 proposals-ui 作用域。

统一由 `../main.tsx` 导入，组件中不导入 CSS。

编辑页 tab 使用四列自适应布局、44px 触摸目标和键盘焦点；面板 hidden 时退出布局。

提交身份提示在保存区内换行，长邮箱/account ID 不撑宽手机布局。

移除 edit-fields 的局部卡片外观；提议确认在手机使用可滚动底部 sheet。

确认弹窗身份区用紧凑键值布局；IP 和长 User-Agent 可换行。

slug/复制图标和认领入口均保留 44px 触控目标；长 slug 换行且保留键盘焦点。global.css 为既有共享级联文件，本次保留超过 600 行的结构，避免无关样式拆分改变优先级。

owner-avatar 样式提供圆形头像、44px 触控区域和可关闭的焦点/悬停提示。

unowned-avatar 显式覆盖编辑页通用 details 箭头和 padding，保持 32px 空头像与 44px 触控区；关闭时隐藏面板，窄屏限宽。
