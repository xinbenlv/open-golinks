import { describe, it, expect } from 'vitest';
import {
  normalizeSlug,
  validateSlugFormat,
  checkReservedSlug,
  validateSlug,
} from '@/lib/validations/slug';
import { ErrorCode } from '@/lib/constants/errors';

describe('Slug Validation', () => {
  describe('normalizeSlug', () => {
    it('should convert to lowercase', () => {
      expect(normalizeSlug('EXAMPLE')).toBe('example');
    });

    it('should trim whitespace', () => {
      expect(normalizeSlug('  example  ')).toBe('example');
    });
  });

  describe('validateSlugFormat', () => {
    it('should accept valid slugs', () => {
      const validSlugs = ['abc', 'example', 'my-link', 'test-123', 'a1b2c3'];
      for (const slug of validSlugs) {
        const result = validateSlugFormat(slug);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject too short slugs', () => {
      const result = validateSlugFormat('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.SLUG_TOO_SHORT);
    });

    it('should reject too long slugs', () => {
      const slug = 'a'.repeat(51);
      const result = validateSlugFormat(slug);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.SLUG_TOO_LONG);
    });

    it('should reject slugs starting with hyphen', () => {
      const result = validateSlugFormat('-example');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.SLUG_INVALID_FORMAT);
    });

    it('should reject slugs ending with hyphen', () => {
      const result = validateSlugFormat('example-');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.SLUG_INVALID_FORMAT);
    });

    it('should reject empty slugs', () => {
      const result = validateSlugFormat('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.SLUG_INVALID_FORMAT);
    });
  });

  describe('checkReservedSlug', () => {
    it('should reject reserved slugs', () => {
      const reserved = ['api', 'admin', 'dashboard', 'login'];
      for (const slug of reserved) {
        const result = checkReservedSlug(slug);
        expect(result.reserved).toBe(true);
        expect(result.error).toBe(ErrorCode.SLUG_RESERVED);
      }
    });

    it('should allow non-reserved slugs', () => {
      const result = checkReservedSlug('example');
      expect(result.reserved).toBe(false);
    });
  });

  describe('validateSlug', () => {
    it('should return valid with normalized slug', () => {
      const result = validateSlug('EXAMPLE');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('example');
    });

    it('should reject invalid format and return error', () => {
      const result = validateSlug('-invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.SLUG_INVALID_FORMAT);
    });

    it('should reject reserved slugs', () => {
      const result = validateSlug('api');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ErrorCode.SLUG_RESERVED);
    });
  });
});
