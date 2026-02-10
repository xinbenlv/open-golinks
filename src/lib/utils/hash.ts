import CryptoJS from 'crypto-js';

/**
 * 使用 SHA-256 进行哈希处理
 */
export function hashSHA256(input: string): string {
  return CryptoJS.SHA256(input).toString();
}

/**
 * 为用户代理和 IP 生成指纹哈希
 * 用于匿名用户跟踪
 */
export function hashFingerprint(userAgent: string, ip: string): string {
  const combined = `${userAgent}::${ip}`;
  return hashSHA256(combined);
}

/**
 * 为 IP 地址生成哈希（符合 GDPR）
 * 添加盐值以增加安全性
 */
export function hashIP(ip: string, salt: string): string {
  const combined = `${ip}::${salt}`;
  return hashSHA256(combined);
}

/**
 * 验证哈希（简单比对）
 * 注意：这只是基本的字符串比较，生产环境应使用 bcrypt 等
 */
export function verifyHash(input: string, hash: string): boolean {
  return hashSHA256(input) === hash;
}
