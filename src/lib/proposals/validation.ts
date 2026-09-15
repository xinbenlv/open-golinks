/** 提议输入和分页游标的严格校验。 */
import { z } from "zod";
export const cookieName = "ogl-proposer";
const valueSchema = z
  .object({ url: z.string().max(8192), description: z.string().max(280) })
  .strict();
export const inputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative(),
    before: valueSchema,
    after: valueSchema.extend({
      url: z
        .string()
        .trim()
        .max(8192)
        .url()
        .refine((v) => /^https?:\/\//i.test(v)),
      description: z.string().trim().max(280),
    }),
    note: z.string().trim().max(500).default(""),
  })
  .strict();
export const reviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(280).default(""),
  })
  .strict();
export const cursorSchema = z.object({
  time: z.string().datetime(),
  id: z.string().uuid(),
});
