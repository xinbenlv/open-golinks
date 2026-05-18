# `docs/` - 项目文档

本目录存放架构、计划、排障、部署/运行和产品规格相关文档。修改代码后优先同步 `CURRENT-ARCHITECT.md`；遇到排障经验时同步 `troubleshooting/`。

## 结构

```text
docs/
├── CURRENT-ARCHITECT.md  # 当前系统架构与关键代码位置
├── assets/               # README 与文档使用的图片/动图
├── email-templates/      # Supabase Auth 邮件模板
├── plans/                # 计划文件与 archived 历史计划
├── runbooks/             # 运维操作手册
├── troubleshooting/      # 已踩坑记录
└── v2-SPEC-zh-2.1.md     # v2 中文规格快照
```

## 维护约定

- 代码行为或架构变化后，同步更新 `CURRENT-ARCHITECT.md` 的文字、图和代码行号引用。
- 新增计划放入 `plans/`，完成后按 `.claude/rules/planning.md` 归档。
- 解决报错、被纠正做法或发现隐蔽坑后，在 `troubleshooting/` 新增或更新对应文档。

## 相关

- [`../README.md`](../README.md)
- [`../.claude/rules/current-architect.md`](../.claude/rules/current-architect.md)
- [`../.claude/rules/write-readme.md`](../.claude/rules/write-readme.md)
