import { SLUG_REGEX } from '@/lib/constants/regex';
import { isReservedSlug } from '@/lib/constants/reserved-slugs';
import { ErrorCode } from '@/lib/constants/errors';

/**
 * 标准化 slug：转为小写并去除空格
 */
export function normalizeSlug(slug: string): string {
  return slug.toLowerCase().trim();
}

/**
 * 验证 slug 格式
 * 返回 {valid, error} 对象
 */
export function validateSlugFormat(slug: string): {
  valid: boolean;
  error?: ErrorCode;
} {
  if (!slug || slug.length === 0) {
    return { valid: false, error: ErrorCode.SLUG_INVALID_FORMAT };
  }

  if (slug.length < 3) {
    return { valid: false, error: ErrorCode.SLUG_TOO_SHORT };
  }

  if (slug.length > 50) {
    return { valid: false, error: ErrorCode.SLUG_TOO_LONG };
  }

  const normalizedSlug = normalizeSlug(slug);

  if (!SLUG_REGEX.test(normalizedSlug)) {
    return { valid: false, error: ErrorCode.SLUG_INVALID_FORMAT };
  }

  return { valid: true };
}

/**
 * 检查 slug 是否被保留
 */
export function checkReservedSlug(slug: string): {
  reserved: boolean;
  error?: ErrorCode;
} {
  const normalizedSlug = normalizeSlug(slug);

  if (isReservedSlug(normalizedSlug)) {
    return { reserved: true, error: ErrorCode.SLUG_RESERVED };
  }

  return { reserved: false };
}

/**
 * 完整的 slug 验证
 * 返回 {valid, error, normalized} 对象
 */
export function validateSlug(slug: string): {
  valid: boolean;
  error?: ErrorCode;
  normalized?: string;
} {
  // 验证格式
  const formatCheck = validateSlugFormat(slug);
  if (!formatCheck.valid) {
    return { valid: false, error: formatCheck.error };
  }

  const normalizedSlug = normalizeSlug(slug);

  // 检查保留
  const reservedCheck = checkReservedSlug(normalizedSlug);
  if (reservedCheck.reserved) {
    return { valid: false, error: reservedCheck.error };
  }

  return { valid: true, normalized: normalizedSlug };
}
