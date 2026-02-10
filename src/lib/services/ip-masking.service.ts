import { hashIP } from '@/lib/utils/hash';
import { maskIPv4, maskIPv6, getMaskedIP } from '@/lib/utils/ip-mask';

export class IPMaskingService {
  /**
   * Get masked IP for public display
   */
  getMaskedIPForDisplay(ip: string): string {
    return getMaskedIP(ip);
  }

  /**
   * Get hashed IP for audit storage
   */
  getHashedIPForStorage(ip: string, salt: string): string {
    return hashIP(ip, salt);
  }

  /**
   * Decide if IP should be revealed to requester
   */
  shouldRevealIP(
    linkOwnerId: string | null,
    requestingUserId: string | null,
    requestingUserRole?: string
  ): boolean {
    // Admin can see all
    if (requestingUserRole === 'admin') {
      return true;
    }

    // Link owner can see their own link's IPs
    if (
      linkOwnerId &&
      requestingUserId &&
      linkOwnerId === requestingUserId
    ) {
      return true;
    }

    // Anonymous links: never reveal IPs
    return false;
  }

  /**
   * Get display representation for audit logs
   */
  getActorDisplay(
    actorId: string | null,
    ip: string,
    shouldRevealIP: boolean
  ): string {
    if (actorId) {
      // Registered user - never reveal email or ID
      return 'Registered User';
    }

    // Anonymous user
    if (shouldRevealIP) {
      return this.getMaskedIPForDisplay(ip);
    }

    return 'Anonymous';
  }

  /**
   * Mask audit log diff for public view
   */
  maskAuditDiff(
    diff: any,
    shouldRevealIPs: boolean
  ): any {
    // If sensitive info, remove it
    if (!shouldRevealIPs) {
      return {
        before: diff?.before ? { ...diff.before, ownerId: undefined } : undefined,
        after: diff?.after ? { ...diff.after, ownerId: undefined } : undefined,
        changes: diff?.changes?.filter(
          (c: any) => !['ownerId', 'createdByFingerprint'].includes(c.field)
        ),
      };
    }

    return diff;
  }

  /**
   * Validate IP format
   */
  isValidIP(ip: string): boolean {
    // Simple validation: contains dots or colons
    return /[\d.:]/.test(ip);
  }

  /**
   * Extract client IP from request headers
   */
  extractClientIP(headers: {
    get: (key: string) => string | null;
  }): string {
    // Check common headers in order of preference
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
      // Can be comma-separated, take first
      return forwarded.split(',')[0].trim();
    }

    const realIP = headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    const cfConnectingIP = headers.get('cf-connecting-ip');
    if (cfConnectingIP) {
      return cfConnectingIP;
    }

    return 'unknown';
  }

  /**
   * Get masked IP for specific roles
   */
  getMaskedIPForRole(
    ip: string,
    role?: string
  ): string {
    // Admin sees full IP
    if (role === 'admin') {
      return ip;
    }

    // Everyone else sees masked IP
    return this.getMaskedIPForDisplay(ip);
  }

  /**
   * Check if IP is private (RFC1918, loopback, link-local)
   */
  isPrivateIP(ip: string): boolean {
    // IPv4 private ranges
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        const firstOctet = parseInt(parts[0]);
        const secondOctet = parseInt(parts[1]);

        // 10.0.0.0 - 10.255.255.255
        if (firstOctet === 10) return true;
        // 127.0.0.0 - 127.255.255.255 (loopback)
        if (firstOctet === 127) return true;
        // 172.16.0.0 - 172.31.255.255
        if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) return true;
        // 192.168.0.0 - 192.168.255.255
        if (firstOctet === 192 && secondOctet === 168) return true;
      }
    }

    // IPv6 private ranges
    if (ip.includes(':')) {
      // ::1 (loopback)
      if (ip === '::1') return true;
      // fc00::/7 (unique local addresses)
      if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
      // fe80::/10 (link-local)
      if (ip.startsWith('fe80')) return true;
    }

    return false;
  }
}

export const ipMaskingService = new IPMaskingService();
