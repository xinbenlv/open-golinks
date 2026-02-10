import { z } from 'zod';

/**
 * Zod 验证模式
 */

// ============ 链接创建 ============
export const CreateLinkSchema = z.object({
  slug: z.string().optional(),
  url: z.string().url('Invalid URL'),
  customSlug: z.boolean().optional().default(false),
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      showWarning: z.boolean().optional(),
    })
    .optional(),
  turnstileToken: z.string().optional(),
});

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;

// ============ 链接解析 ============
export const ResolveLinkSchema = z.object({
  slug: z.string().min(3).max(50),
});

export type ResolveLinkInput = z.infer<typeof ResolveLinkSchema>;

// ============ 声明链接 ============
export const ClaimLinkSchema = z.object({
  slug: z.string().min(3).max(50),
  email: z.string().email().optional(),
  fingerprint: z.string().optional(),
});

export type ClaimLinkInput = z.infer<typeof ClaimLinkSchema>;

// ============ 更新链接 ============
export const UpdateLinkSchema = z.object({
  slug: z.string().min(3).max(50),
  url: z.string().url('Invalid URL').optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      showWarning: z.boolean().optional(),
    })
    .optional(),
});

export type UpdateLinkInput = z.infer<typeof UpdateLinkSchema>;

// ============ 分页 ============
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;
