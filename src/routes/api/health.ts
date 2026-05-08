import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/", (c) =>
  c.json({
    status: "ok",
    service: "open-golinks-v2-hono",
    timestamp: new Date().toISOString(),
  }),
);
