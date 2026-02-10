import { URL_PROTOCOL_REGEX, PRIVATE_IPV4_PATTERNS, IPV4_REGEX } from '@/lib/constants/regex';
import { ErrorCode } from '@/lib/constants/errors';

/**
 * 检查是否为私有 IP 地址
 */
export function isPrivateIP(hostname: string): boolean {
  // 检查 localhost 和 localhost.*
  if (hostname === 'localhost' || hostname.startsWith('localhost.')) {
    return true;
  }

  // 检查私有 IPv4 范围
  if (IPV4_REGEX.test(hostname)) {
    for (const pattern of PRIVATE_IPV4_PATTERNS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }
  }

  // 检查私有 IPv6（简化版）
  if (hostname.includes(':')) {
    if (hostname === '::1' || hostname.startsWith('fe80:') || hostname.startsWith('fc00:')) {
      return true;
    }
  }

  return false;
}

/**
 * 验证 URL 协议
 */
export function validateProtocol(url: string): {
  valid: boolean;
  error?: ErrorCode;
} {
  if (!url) {
    return { valid: false, error: ErrorCode.URL_INVALID };
  }

  if (!URL_PROTOCOL_REGEX.test(url)) {
    return { valid: false, error: ErrorCode.URL_MISSING_PROTOCOL };
  }

  // 只允许 http:// 和 https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, error: ErrorCode.URL_INVALID_PROTOCOL };
  }

  return { valid: true };
}

/**
 * 完整的 URL 验证
 */
export function validateURL(url: string): {
  valid: boolean;
  error?: ErrorCode;
} {
  // 协议验证
  const protocolCheck = validateProtocol(url);
  if (!protocolCheck.valid) {
    return { valid: false, error: protocolCheck.error || undefined };
  }

  // 尝试解析 URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: ErrorCode.URL_MALFORMED };
  }

  // 检查主机名是否为私有 IP
  if (isPrivateIP(parsedUrl.hostname)) {
    return { valid: false, error: ErrorCode.URL_PRIVATE_IP_BLOCKED };
  }

  return { valid: true };
}
