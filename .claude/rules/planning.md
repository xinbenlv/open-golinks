---
description: "Planning management rules - triggered when creating or handling plans"
---

# Planning Rules

**Trigger**: 创建或处理计划时

## 计划管理规范

### 目录结构

```
docs/plans/
├── <yyyy-mm-dd>-<计划名>.md          # 活跃计划
├── <yyyy-mm-dd>-<计划名>.md
└── archived/
    ├── <yyyy-mm-dd>-<计划名>-phase-n.md  # 已完成的计划
    └── <yyyy-mm-dd>-<计划名>-phase-n.md
```

### 计划生命周期

1. **计划创建**: 在 `docs/plans/` 创建新的计划文件
   - 格式: `<YYYY-MM-DD>-<计划名>.md`
   - 例如: `2026-02-10-ga-backend-proxy.md`

2. **计划执行**: Agent 按计划执行工作
   - 在计划文件中记录进度
   - 完成各个 task 后更新状态

3. **计划完成**: 计划完成后移动到 archived
   - `mv docs/plans/<plan>.md docs/plans/archived/<plan>-phase-n.md`
   - Phase 号格式: `phase-1`, `phase-2`, 等
   - 例如: `docs/plans/archived/2026-02-10-foundation-phase-1.md`

4. **版本控制**: 提交到 Git
   - 完成的计划（archived）必须提交到 git
   - 活跃计划根据需要提交

### 计划文件要求

每个计划文件必须包含:

```markdown
# <计划标题>

**Date**: YYYY-MM-DD
**Duration**: 预估时间
**Priority**: P0/P1/P2
**Status**: 📋 Planning / 🚀 In Progress / ✅ Complete

## Overview
## Deliverables
## Implementation Steps
## Timeline
## Success Criteria
```

### 已完成计划

完成的实现计划存档在 `docs/plans/archived/` 目录下。这些是**历史记录**，平时不需要阅读。仅在遇到困难、需要理解"当初为什么这样做"时参考。

已完成:
- ✅ `2026-02-10-phase-1-foundation.md` - Phase 1 完成
- ✅ `2026-02-10-phase-2-api-core.md` - Phase 2 完成
- ✅ `2026-02-10-phase-3-web-ui.md` - Phase 3 完成

### 活跃计划

当前执行中或待执行的计划:
- 📋 `2026-02-10-phase-4-chrome-extension.md` - Phase 4
- 📋 `2026-02-10-phase-5-migration.md` - Phase 5
- 📋 `2026-02-10-phase-6-production.md` - Phase 6
- 📋 `2026-02-10-ga-backend-proxy.md` - GA 后端代理方案
