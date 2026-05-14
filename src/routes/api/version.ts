// GET /api/v1/version: 返回当前服务的 BUILD_INFO 四元组. 无需鉴权.
// 供 oncall / 调试 / 用户上报 bug 时确认所看的具体构建.

import { Hono } from "hono";
import { BUILD_INFO } from "../../build-info.ts";

export const versionRoute = new Hono();

versionRoute.get("/", (c) => c.json(BUILD_INFO));
