import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TurnstileService } from '@/lib/services/turnstile.service';
import { ErrorCode } from '@/lib/constants/errors';

describe('TurnstileService', () => {
  let service: TurnstileService;

  beforeEach(() => {
    // Mock environment variables
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
    service = new TurnstileService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('verify', () => {
    it('should reject invalid token format', async () => {
      expect.assertions(1);
      try {
        await service.verify('short');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.TURNSTILE_VERIFICATION_FAILED);
      }
    });

    it('should reject null/undefined token', async () => {
      expect.assertions(1);
      try {
        await service.verify('');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.TURNSTILE_VERIFICATION_FAILED);
      }
    });

    it('should reject non-string token', async () => {
      expect.assertions(1);
      try {
        await service.verify(123 as any);
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.TURNSTILE_VERIFICATION_FAILED);
      }
    });

    it('should verify valid token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          challengeTs: new Date().toISOString(),
          hostname: 'example.com',
        }),
      });
      global.fetch = mockFetch;

      const result = await service.verify('valid-test-token-12345');

      expect(result.success).toBe(true);
      expect(result.hostname).toBe('example.com');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      const pastDate = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          challengeTs: pastDate.toISOString(),
          hostname: 'example.com',
        }),
      });
      global.fetch = mockFetch;

      expect.assertions(1);
      try {
        await service.verify('valid-test-token-12345');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.TURNSTILE_VERIFICATION_FAILED);
      }
    });

    it('should handle Cloudflare verification failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          errorCodes: ['invalid-input-response'],
        }),
      });
      global.fetch = mockFetch;

      expect.assertions(1);
      try {
        await service.verify('valid-test-token-12345');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.TURNSTILE_VERIFICATION_FAILED);
      }
    });

    it('should handle network timeout', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });
      global.fetch = mockFetch;

      expect.assertions(1);
      try {
        await service.verify('valid-test-token-12345');
      } catch (error: any) {
        expect(error.statusCode).toBe(503);
      }
    });

    it('should handle HTTP errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch;

      expect.assertions(1);
      try {
        await service.verify('valid-test-token-12345');
      } catch (error: any) {
        expect(error.statusCode).toBe(503);
      }
    });

    it('should pass remote IP to Cloudflare', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          challengeTs: new Date().toISOString(),
          hostname: 'example.com',
        }),
      });
      global.fetch = mockFetch;

      await service.verify('valid-test-token-12345', '192.168.1.1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('remoteip'),
        })
      );
    });
  });

  describe('verifyWithRateCheck', () => {
    it('should verify token without audit service', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          challengeTs: new Date().toISOString(),
          hostname: 'example.com',
        }),
      });
      global.fetch = mockFetch;

      const result = await service.verifyWithRateCheck('valid-test-token-12345', 'fingerprint-123');

      expect(result.verified).toBe(true);
    });

    it('should return error on verification failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          errorCodes: ['invalid-input-response'],
        }),
      });
      global.fetch = mockFetch;

      const result = await service.verifyWithRateCheck('invalid-token', 'fingerprint-123');

      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should check rate limit if audit service provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          challengeTs: new Date().toISOString(),
          hostname: 'example.com',
        }),
      });
      global.fetch = mockFetch;

      const mockAuditService = {
        getRecentAttempts: vi.fn().mockResolvedValue(3),
      };

      const result = await service.verifyWithRateCheck(
        'valid-test-token-12345',
        'fingerprint-123',
        '192.168.1.1',
        mockAuditService
      );

      expect(result.verified).toBe(true);
      expect(mockAuditService.getRecentAttempts).toHaveBeenCalledWith('fingerprint-123', 3600);
    });

    it('should return rate limit error if attempts exceeded', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          challengeTs: new Date().toISOString(),
          hostname: 'example.com',
        }),
      });
      global.fetch = mockFetch;

      const mockAuditService = {
        getRecentAttempts: vi.fn().mockResolvedValue(10), // Exceeds max of 5
      };

      const result = await service.verifyWithRateCheck(
        'valid-test-token-12345',
        'fingerprint-123',
        '192.168.1.1',
        mockAuditService
      );

      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.RATE_LIMITED);
    });
  });

  describe('refreshToken', () => {
    it('should return token if valid', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          challengeTs: new Date().toISOString(),
          hostname: 'example.com',
        }),
      });
      global.fetch = mockFetch;

      const result = await service.refreshToken('valid-test-token-12345');

      expect(result).toBe('valid-test-token-12345');
    });

    it('should return null if token invalid', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          errorCodes: ['invalid-input-response'],
        }),
      });
      global.fetch = mockFetch;

      const result = await service.refreshToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.refreshToken('valid-test-token-12345');

      expect(result).toBeNull();
    });
  });

  describe('getSiteKey', () => {
    it('should return site key', () => {
      const key = service.getSiteKey();
      expect(key).toBe('test-site-key');
    });
  });

  describe('isConfigured', () => {
    it('should return true when both keys configured', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when secret key missing', () => {
      process.env.TURNSTILE_SECRET_KEY = '';
      const newService = new TurnstileService();
      expect(newService.isConfigured()).toBe(false);
    });

    it('should return false when site key missing', () => {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '';
      const newService = new TurnstileService();
      expect(newService.isConfigured()).toBe(false);
    });
  });
});

describe('IPMaskingService', () => {
  const { ipMaskingService } = require('@/lib/services/ip-masking.service');

  describe('getMaskedIPForDisplay', () => {
    it('should mask IPv4 address', () => {
      const result = ipMaskingService.getMaskedIPForDisplay('192.168.1.100');
      expect(result).toBe('192.168.1.*');
    });

    it('should mask IPv6 address', () => {
      const result = ipMaskingService.getMaskedIPForDisplay('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      expect(result).toMatch(/2001:db8:85a3:0:\*:\*:\*:\*/);
    });

    it('should handle invalid IPv4', () => {
      const result = ipMaskingService.getMaskedIPForDisplay('192.168');
      expect(result).toBe('0.0.0.*');
    });
  });

  describe('shouldRevealIP', () => {
    it('should reveal IP for admin', () => {
      const result = ipMaskingService.shouldRevealIP(
        'user-123',
        'requester-123',
        'admin'
      );
      expect(result).toBe(true);
    });

    it('should reveal IP for link owner viewing own links', () => {
      const result = ipMaskingService.shouldRevealIP(
        'user-123',
        'user-123'
      );
      expect(result).toBe(true);
    });

    it('should not reveal IP for non-owner', () => {
      const result = ipMaskingService.shouldRevealIP(
        'user-123',
        'other-user'
      );
      expect(result).toBe(false);
    });

    it('should not reveal IP for anonymous link', () => {
      const result = ipMaskingService.shouldRevealIP(
        null,
        'user-123'
      );
      expect(result).toBe(false);
    });
  });

  describe('getActorDisplay', () => {
    it('should display Registered User for authenticated actor', () => {
      const result = ipMaskingService.getActorDisplay(
        'user-123',
        '192.168.1.1',
        false
      );
      expect(result).toBe('Registered User');
    });

    it('should display masked IP for anonymous with reveal permission', () => {
      const result = ipMaskingService.getActorDisplay(
        null,
        '192.168.1.1',
        true
      );
      expect(result).toBe('192.168.1.*');
    });

    it('should display Anonymous without reveal permission', () => {
      const result = ipMaskingService.getActorDisplay(
        null,
        '192.168.1.1',
        false
      );
      expect(result).toBe('Anonymous');
    });
  });

  describe('extractClientIP', () => {
    it('should extract from x-forwarded-for', () => {
      const headers = {
        get: (key: string) => key === 'x-forwarded-for' ? '192.168.1.1, 10.0.0.1' : null,
      };
      const result = ipMaskingService.extractClientIP(headers);
      expect(result).toBe('192.168.1.1');
    });

    it('should extract from x-real-ip', () => {
      const headers = {
        get: (key: string) => key === 'x-real-ip' ? '10.0.0.1' : null,
      };
      const result = ipMaskingService.extractClientIP(headers);
      expect(result).toBe('10.0.0.1');
    });

    it('should extract from cf-connecting-ip', () => {
      const headers = {
        get: (key: string) => key === 'cf-connecting-ip' ? '172.16.0.1' : null,
      };
      const result = ipMaskingService.extractClientIP(headers);
      expect(result).toBe('172.16.0.1');
    });

    it('should return unknown if no IP headers', () => {
      const headers = {
        get: () => null,
      };
      const result = ipMaskingService.extractClientIP(headers);
      expect(result).toBe('unknown');
    });
  });

  describe('isPrivateIP', () => {
    it('should identify 10.x.x.x as private', () => {
      expect(ipMaskingService.isPrivateIP('10.0.0.1')).toBe(true);
    });

    it('should identify 192.168.x.x as private', () => {
      expect(ipMaskingService.isPrivateIP('192.168.1.1')).toBe(true);
    });

    it('should identify 172.16-31.x.x as private', () => {
      expect(ipMaskingService.isPrivateIP('172.16.0.1')).toBe(true);
      expect(ipMaskingService.isPrivateIP('172.31.255.255')).toBe(true);
    });

    it('should identify 127.x.x.x as private (loopback)', () => {
      expect(ipMaskingService.isPrivateIP('127.0.0.1')).toBe(true);
    });

    it('should identify public IP as non-private', () => {
      expect(ipMaskingService.isPrivateIP('8.8.8.8')).toBe(false);
    });

    it('should identify IPv6 loopback as private', () => {
      expect(ipMaskingService.isPrivateIP('::1')).toBe(true);
    });

    it('should identify IPv6 unique local as private', () => {
      expect(ipMaskingService.isPrivateIP('fc00::1')).toBe(true);
      expect(ipMaskingService.isPrivateIP('fd00::1')).toBe(true);
    });

    it('should identify IPv6 link-local as private', () => {
      expect(ipMaskingService.isPrivateIP('fe80::1')).toBe(true);
    });

    it('should identify public IPv6 as non-private', () => {
      expect(ipMaskingService.isPrivateIP('2001:4860:4860::8888')).toBe(false);
    });
  });

  describe('maskAuditDiff', () => {
    it('should remove sensitive fields when not revealing IPs', () => {
      const diff = {
        before: { url: 'http://example.com', ownerId: 'user-123' },
        after: { url: 'http://example.com', ownerId: 'user-456' },
        changes: [
          { field: 'ownerId', before: 'user-123', after: 'user-456' },
          { field: 'url', before: 'http://example.com', after: 'http://example.com' },
        ],
      };

      const result = ipMaskingService.maskAuditDiff(diff, false);

      expect(result.before.ownerId).toBeUndefined();
      expect(result.after.ownerId).toBeUndefined();
      expect(result.changes).toEqual([
        { field: 'url', before: 'http://example.com', after: 'http://example.com' },
      ]);
    });

    it('should keep all fields when revealing IPs', () => {
      const diff = {
        before: { url: 'http://example.com', ownerId: 'user-123' },
        after: { url: 'http://example.com', ownerId: 'user-456' },
        changes: [
          { field: 'ownerId', before: 'user-123', after: 'user-456' },
        ],
      };

      const result = ipMaskingService.maskAuditDiff(diff, true);

      expect(result).toEqual(diff);
    });
  });
});
