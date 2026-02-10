import { describe, it, expect } from 'vitest';
import { hashSHA256, hashFingerprint, hashIP, verifyHash } from '@/lib/utils/hash';

describe('Hash Utilities', () => {
  describe('hashSHA256', () => {
    it('should hash strings consistently', () => {
      const input = 'test-input';
      const hash1 = hashSHA256(input);
      const hash2 = hashSHA256(input);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashSHA256('input1');
      const hash2 = hashSHA256('input2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce fixed length SHA-256 hash', () => {
      const hash = hashSHA256('test');
      // SHA-256 produces 64 hex characters
      expect(hash.length).toBe(64);
    });
  });

  describe('hashFingerprint', () => {
    it('should combine user agent and IP', () => {
      const ua = 'Mozilla/5.0';
      const ip = '192.168.1.1';
      const hash = hashFingerprint(ua, ip);
      expect(hash.length).toBe(64);
    });

    it('should produce consistent fingerprints', () => {
      const ua = 'Mozilla/5.0';
      const ip = '192.168.1.1';
      const hash1 = hashFingerprint(ua, ip);
      const hash2 = hashFingerprint(ua, ip);
      expect(hash1).toBe(hash2);
    });
  });

  describe('hashIP', () => {
    it('should hash IP with salt', () => {
      const ip = '192.168.1.1';
      const salt = 'test-salt';
      const hash = hashIP(ip, salt);
      expect(hash.length).toBe(64);
    });

    it('should produce different hashes with different salts', () => {
      const ip = '192.168.1.1';
      const hash1 = hashIP(ip, 'salt1');
      const hash2 = hashIP(ip, 'salt2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyHash', () => {
    it('should verify correct hashes', () => {
      const input = 'test-input';
      const hash = hashSHA256(input);
      expect(verifyHash(input, hash)).toBe(true);
    });

    it('should reject incorrect hashes', () => {
      const input = 'test-input';
      const wrongHash = hashSHA256('different-input');
      expect(verifyHash(input, wrongHash)).toBe(false);
    });
  });
});
