# Stats public scope 测试不能假设空数据库

## 问题描述

给 `/api/v1/stats/trending` 写 e2e 测试时，最初断言 GA4 provider 收到的 `slugs` 必须只等于测试插入的 public slug。实际测试数据库已有大量历史 `is_public=true` 链接，导致断言失败并输出很长的 slug diff。

## 错误原因

Trending 的正确语义是查询所有 `links.is_public=true AND deleted_at IS NULL` 的 slug。共享测试数据库不保证 public link 集合为空，因此测试不能把 scope 全集假设成本用例插入的数据。

## 解决方案

测试应断言边界而不是全集：

- 新插入的 public slug 必须出现在 `input.slugs`
- 新插入的 private slug 不得出现
- 新插入的 deleted public slug 不得出现
- 响应 DTO 可由测试 provider 控制，只断言 endpoint 对 provider 输出的映射

## 相关代码

- `tests/e2e/F8-detailed-stats.test.ts:201-247`
- `src/routes/api/stats.ts:72-141`
