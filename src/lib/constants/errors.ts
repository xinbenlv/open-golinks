/**
 * API 错误码和消息定义
 */

export enum ErrorCode {
  // Slug 验证错误
  SLUG_INVALID_FORMAT = 'SLUG_INVALID_FORMAT',
  SLUG_TOO_SHORT = 'SLUG_TOO_SHORT',
  SLUG_TOO_LONG = 'SLUG_TOO_LONG',
  SLUG_RESERVED = 'SLUG_RESERVED',
  SLUG_ALREADY_EXISTS = 'SLUG_ALREADY_EXISTS',

  // URL 验证错误
  URL_INVALID = 'URL_INVALID',
  URL_PRIVATE_IP_BLOCKED = 'URL_PRIVATE_IP_BLOCKED',
  URL_MALFORMED = 'URL_MALFORMED',
  URL_MISSING_PROTOCOL = 'URL_MISSING_PROTOCOL',
  URL_INVALID_PROTOCOL = 'URL_INVALID_PROTOCOL',

  // 链接错误
  LINK_NOT_FOUND = 'LINK_NOT_FOUND',
  LINK_ALREADY_CLAIMED = 'LINK_ALREADY_CLAIMED',
  LINK_DELETED = 'LINK_DELETED',

  // 认证和授权错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  ANONYMOUS_LINK_MODIFICATION_FORBIDDEN = 'ANONYMOUS_LINK_MODIFICATION_FORBIDDEN',
  DELETED_SLUG_FORBIDDEN = 'DELETED_SLUG_FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // 验证错误
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Turnstile 验证
  TURNSTILE_VERIFICATION_FAILED = 'TURNSTILE_VERIFICATION_FAILED',
  TURNSTILE_REQUIRED = 'TURNSTILE_REQUIRED',

  // 速率限制
  RATE_LIMITED = 'RATE_LIMITED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // 服务器错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // 其他
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  INVALID_REQUEST = 'INVALID_REQUEST',
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.SLUG_INVALID_FORMAT]: 'Slug 格式无效。必须以字母或数字开头和结尾，可以包含中间的连字符。',
  [ErrorCode.SLUG_TOO_SHORT]: 'Slug 太短。最少需要 3 个字符。',
  [ErrorCode.SLUG_TOO_LONG]: 'Slug 太长。最多 50 个字符。',
  [ErrorCode.SLUG_RESERVED]: '此 slug 被系统保留，无法使用。',
  [ErrorCode.SLUG_ALREADY_EXISTS]: '此 slug 已被占用。',

  [ErrorCode.URL_INVALID]: 'URL 格式无效。',
  [ErrorCode.URL_PRIVATE_IP_BLOCKED]: '不支持私有 IP 地址。',
  [ErrorCode.URL_MALFORMED]: 'URL 格式错误。',
  [ErrorCode.URL_MISSING_PROTOCOL]: '缺少协议（http:// 或 https://）。',
  [ErrorCode.URL_INVALID_PROTOCOL]: '无效的协议。仅支持 http:// 和 https://。',

  [ErrorCode.LINK_NOT_FOUND]: '链接不存在或已删除。',
  [ErrorCode.LINK_ALREADY_CLAIMED]: '此链接已被认领。',
  [ErrorCode.LINK_DELETED]: '此链接已被删除。',

  [ErrorCode.UNAUTHORIZED]: '未认证。请登录。',
  [ErrorCode.FORBIDDEN]: '无权访问此资源。',
  [ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN]: '匿名链接需要先声明所有权才能修改。请使用 POST /api/v1/links/{slug}/claim 声明所有权。',
  [ErrorCode.DELETED_SLUG_FORBIDDEN]: '此 slug 之前被使用并删除。只有原所有者可以重新使用。',
  [ErrorCode.INVALID_TOKEN]: '无效的令牌。',
  [ErrorCode.TOKEN_EXPIRED]: '令牌已过期。',

  [ErrorCode.INVALID_INPUT]: '输入无效。',
  [ErrorCode.MISSING_REQUIRED_FIELD]: '缺少必需字段。',

  [ErrorCode.TURNSTILE_VERIFICATION_FAILED]: 'Turnstile 验证失败。',
  [ErrorCode.TURNSTILE_REQUIRED]: '需要完成 Turnstile 验证。',

  [ErrorCode.RATE_LIMITED]: '请求过于频繁，请稍后再试。',
  [ErrorCode.TOO_MANY_REQUESTS]: '超出请求限制。',

  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误。',
  [ErrorCode.DATABASE_ERROR]: '数据库错误。',

  [ErrorCode.NOT_IMPLEMENTED]: '此功能尚未实现。',
  [ErrorCode.INVALID_REQUEST]: '无效的请求。',
};

export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] || '未知错误';
}

export const HTTP_STATUS_CODES: Record<ErrorCode, number> = {
  [ErrorCode.SLUG_INVALID_FORMAT]: 400,
  [ErrorCode.SLUG_TOO_SHORT]: 400,
  [ErrorCode.SLUG_TOO_LONG]: 400,
  [ErrorCode.SLUG_RESERVED]: 400,
  [ErrorCode.SLUG_ALREADY_EXISTS]: 409,

  [ErrorCode.URL_INVALID]: 400,
  [ErrorCode.URL_PRIVATE_IP_BLOCKED]: 400,
  [ErrorCode.URL_MALFORMED]: 400,
  [ErrorCode.URL_MISSING_PROTOCOL]: 400,
  [ErrorCode.URL_INVALID_PROTOCOL]: 400,

  [ErrorCode.LINK_NOT_FOUND]: 404,
  [ErrorCode.LINK_ALREADY_CLAIMED]: 409,
  [ErrorCode.LINK_DELETED]: 410,

  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN]: 403,
  [ErrorCode.DELETED_SLUG_FORBIDDEN]: 403,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,

  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,

  [ErrorCode.TURNSTILE_VERIFICATION_FAILED]: 400,
  [ErrorCode.TURNSTILE_REQUIRED]: 400,

  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,

  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,

  [ErrorCode.NOT_IMPLEMENTED]: 501,
  [ErrorCode.INVALID_REQUEST]: 400,
};

export function getHttpStatusCode(code: ErrorCode): number {
  return HTTP_STATUS_CODES[code] || 500;
}
