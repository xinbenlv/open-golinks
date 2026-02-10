import { describe, it, expect } from 'vitest';
import { maskIPv4, maskIPv6, getMaskedIP } from '@/lib/utils/ip-mask';

describe('IP Masking', () => {
  describe('maskIPv4', () => {
    it('should mask the last octet', () => {
      expect(maskIPv4('192.168.1.100')).toBe('192.168.1.*');
    });

    it('should work with different IPs', () => {
      expect(maskIPv4('10.0.0.1')).toBe('10.0.0.*');
      expect(maskIPv4('172.16.0.255')).toBe('172.16.0.*');
    });

    it('should handle invalid IPs', () => {
      expect(maskIPv4('invalid')).toBe('0.0.0.*');
    });
  });

  describe('maskIPv6', () => {
    it('should mask IPv6 addresses', () => {
      const masked = maskIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      expect(masked).toContain('*');
      expect(masked).toContain('2001');
      expect(masked).toContain('0db8');
    });

    it('should handle loopback', () => {
      const masked = maskIPv6('::1');
      expect(masked).toBe('::*');
    });
  });

  describe('getMaskedIP', () => {
    it('should detect and mask IPv4', () => {
      expect(getMaskedIP('192.168.1.1')).toBe('192.168.1.*');
    });

    it('should detect and mask IPv6', () => {
      const masked = getMaskedIP('2001:db8::1');
      expect(masked).toContain('*');
    });
  });
});
