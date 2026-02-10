import { hashIP } from './hash';

/**
 * 掩盖 IPv4 地址（保留前 3 个八位字节）
 * 例如：192.168.1.100 → 192.168.1.*
 */
export function maskIPv4(ip: string): string {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return '0.0.0.*';
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
}

/**
 * 掩盖 IPv6 地址（保留前 64 位）
 * 例如：2001:0db8:85a3:0000:0000:8a2e:0370:7334 → 2001:db8:85a3:0:0:*:*:*
 */
export function maskIPv6(ip: string): string {
  const parts = ip.split(':');
  if (parts.length < 4) {
    return '::*';
  }
  // 只保留前 4 部分
  return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:*:*:*:*`;
}

/**
 * 获取掩盖后的 IP（用于审计日志显示）
 */
export function getMaskedIP(ip: string): string {
  if (ip.includes(':')) {
    // IPv6
    return maskIPv6(ip);
  }
  // IPv4
  return maskIPv4(ip);
}

/**
 * 获取哈希后的 IP（用于审计日志存储）
 * 符合 GDPR 要求
 */
export function getHashedIP(ip: string, salt: string): string {
  return hashIP(ip, salt);
}
