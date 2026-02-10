import { describe, it, expect } from 'vitest';
import { validateProtocol, isPrivateIP, validateURL } from '@/lib/validations/url';
import { ErrorCode } from '@/lib/constants/errors';

describe('URL Validation', () => {
  describe('validateProtocol', () => {
    it('should accept https URLs', () => {
      const result = validateProtocol('https://example.com');
      expect(result.valid).toBe(true);
    });

    it('should accept http URLs', () => {
      const result = validateProtocol('http://example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject URLs without protocol', () => {
      const result = validateProtocol('example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.URL_MISSING_PROTOCOL);
    });

    it('should reject unsupported protocols', () => {
      const result = validateProtocol('ftp://example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.URL_INVALID_PROTOCOL);
    });

    it('should reject empty URLs', () => {
      const result = validateProtocol('');
      expect(result.valid).toBe(false);
    });
  });

  describe('isPrivateIP', () => {
    it('should detect localhost', () => {
      expect(isPrivateIP('localhost')).toBe(true);
      expect(isPrivateIP('localhost.localdomain')).toBe(true);
    });

    it('should detect 127.0.0.1', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
    });

    it('should detect 10.0.0.0/8', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);
    });

    it('should detect 192.168.0.0/16', () => {
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('192.168.255.255')).toBe(true);
    });

    it('should detect 172.16.0.0/12', () => {
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
    });

    it('should detect IPv6 loopback', () => {
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
    });
  });

  describe('validateURL', () => {
    it('should accept valid public URLs', () => {
      const validURLs = [
        'https://example.com',
        'https://example.com/path',
        'https://sub.example.com',
      ];
      for (const url of validURLs) {
        const result = validateURL(url);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject private IPs', () => {
      const privateURLs = [
        'https://localhost',
        'https://192.168.1.1',
        'https://10.0.0.1',
        'https://127.0.0.1',
      ];
      for (const url of privateURLs) {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(ErrorCode.URL_PRIVATE_IP_BLOCKED);
      }
    });

    it('should reject malformed URLs', () => {
      const result = validateURL('https://[invalid]');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.URL_MALFORMED);
    });
  });
});
