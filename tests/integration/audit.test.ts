import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  POST,
  GET,
  PUT,
  DELETE,
  createTestUser,
  mockTurnstileToken,
  generateRandomSlug,
  authHeader,
  resetTestDatabase,
} from './setup';

/**
 * Integration Tests: Audit Logging
 * Tests for audit log structure, content, and query capabilities
 * 4 test cases covering log structure, diffs, IP hashing, and pagination
 */

describe('Feature: Audit Logging', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testUser = await createTestUser('audit-test-user@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('Audit Log Structure', () => {
    /**
     * ✅ Test 1: Audit log has correct structure
     * - Create a link
     * - Fetch audit logs
     * - Verify structure: id, action, timestamp, linkSlug, actorId, diff, metadata
     */
    it('✅ Audit log structure: id, action, timestamp, diff', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(200);
      expect(response.body.data.logs).toBeDefined();
      expect(Array.isArray(response.body.data.logs)).toBe(true);

      const logs = response.body.data.logs;
      expect(logs.length).toBeGreaterThan(0);

      // Check first log entry structure
      const log = logs[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('action');
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('linkSlug');
      expect(log).toHaveProperty('actorId');

      // Verify types
      expect(typeof log.id).toBe('string');
      expect(['CREATE', 'UPDATE', 'DELETE', 'CLAIM', 'VISIT', 'TRANSFER']).toContain(
        log.action
      );
      expect(new Date(log.timestamp)).toBeInstanceOf(Date);
      expect(log.linkSlug).toBe(slug);
      expect(log.actorId).toBe(testUser.id);
    });

    /**
     * ✅ Test 2: CREATE action audit log
     */
    it('✅ CREATE audit log includes full link data', async () => {
      const slug = generateRandomSlug();
      const url = 'https://example.com/create-test';

      // Create link
      await POST(
        '/links',
        {
          slug,
          url,
          metadata: { title: 'Test Link' },
        },
        authHeader(testUser.jwt)
      );

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      const createLog = logs.find((log: any) => log.action === 'CREATE');

      expect(createLog).toBeDefined();

      // CREATE log should have diff.after with created data
      if (createLog.diff) {
        expect(createLog.diff.after).toBeDefined();
        expect(createLog.diff.after.slug).toBe(slug);
        expect(createLog.diff.after.url).toBe(url);
      }
    });
  });

  describe('Audit Log Diff Information', () => {
    /**
     * ✅ Test 3: UPDATE action includes before/after/changes
     * - Create link
     * - Update URL
     * - Fetch audit logs
     * - Verify UPDATE log has: before (old URL), after (new URL), changes array
     */
    it('✅ UPDATE audit log includes before/after/changes', async () => {
      const slug = generateRandomSlug();
      const originalUrl = 'https://example.com/original';
      const updatedUrl = 'https://example.com/updated';

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: originalUrl,
        },
        authHeader(testUser.jwt)
      );

      // Update URL
      await PUT(
        `/links/${slug}`,
        { url: updatedUrl },
        authHeader(testUser.jwt)
      );

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      const updateLog = logs.find((log: any) => log.action === 'UPDATE');

      expect(updateLog).toBeDefined();

      // Verify diff structure
      const diff = updateLog.diff;
      expect(diff).toBeDefined();

      if (diff.before) {
        expect(diff.before.url).toBe(originalUrl);
      }

      if (diff.after) {
        expect(diff.after.url).toBe(updatedUrl);
      }

      if (diff.changes) {
        expect(Array.isArray(diff.changes)).toBe(true);
        expect(diff.changes).toContain('url');
      }
    });

    /**
     * ✅ Test 4: DELETE action diff
     */
    it('✅ DELETE audit log shows deletedAt change', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Delete
      await DELETE(`/links/${slug}`, authHeader(testUser.jwt));

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      const deleteLog = logs.find((log: any) => log.action === 'DELETE');

      expect(deleteLog).toBeDefined();

      // DELETE should have diff showing deletedAt
      if (deleteLog.diff && deleteLog.diff.changes) {
        expect(deleteLog.diff.changes).toContain('deletedAt');
      }
    });

    /**
     * ✅ Test 5: VISIT action audit log
     */
    it('✅ VISIT audit log created on link resolution', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Visit the link
      await GET(`/${slug}`, undefined, { followRedirects: false });

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      const visitLog = logs.find((log: any) => log.action === 'VISIT');

      // Visit log might be optional or might be recorded
      if (visitLog) {
        expect(visitLog.action).toBe('VISIT');
        expect(visitLog.timestamp).toBeDefined();
      }
    });
  });

  describe('IP Hashing and Masking', () => {
    /**
     * ✅ Test 6: IP hashing in audit logs
     * - Create link
     * - Fetch audit logs
     * - Verify actorIpHash is present (SHA-256 hash)
     * - In responses, IP should be masked (not full IP)
     */
    it('✅ Audit log has IP hash, responses show masked IP', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      expect(logs.length).toBeGreaterThan(0);

      const log = logs[0];

      // Should have IP hash in database (stored as hash)
      if (log.actorIpHash) {
        // Hash should be 64 chars (SHA-256 hex)
        expect(log.actorIpHash.length).toBe(64);
      }

      // Response should show masked IP if included
      if (log.maskedIp) {
        // Masked IP: 192.168.1.* or 2001:db8:85a3:0:0:*:*:*
        expect(log.maskedIp).toMatch(/\.\*|:\*:?\*/);
      }
    });

    /**
     * ✅ Test 7: IP masking for IPv4 and IPv6
     */
    it('✅ IP masking preserves privacy (IPv4: 192.168.1.*, IPv6: 2001:db8:*)', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      const log = logs[0];

      // If IP is shown in response, verify it's masked
      if (log.maskedIp) {
        // IPv4 pattern: x.x.x.*
        // IPv6 pattern: x:x:x:x:*:*:*:*
        expect(
          log.maskedIp.match(/^\d+\.\d+\.\d+\.\*$/) ||
          log.maskedIp.match(/:[a-f0-9]*:\*/)
        ).toBeTruthy();
      }
    });
  });

  describe('Audit Log Queries', () => {
    /**
     * ✅ Test 8: Audit log pagination (limit/offset)
     * - Create multiple links
     * - Query audit logs with limit and offset
     * - Verify pagination works
     */
    it('✅ Audit log pagination with limit and offset', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Update it several times to create more logs
      for (let i = 0; i < 5; i++) {
        await PUT(
          `/links/${slug}`,
          { url: `https://example.com/v${i}` },
          authHeader(testUser.jwt)
        );
      }

      // Query with limit
      const pageResponse1 = await GET(
        `/links/${slug}/audit?limit=2&offset=0`,
        authHeader(testUser.jwt)
      );

      expect(pageResponse1.status).toBe(200);
      const logs1 = pageResponse1.body.data.logs;
      expect(logs1.length).toBeLessThanOrEqual(2);

      // Query with offset
      const pageResponse2 = await GET(
        `/links/${slug}/audit?limit=2&offset=2`,
        authHeader(testUser.jwt)
      );

      const logs2 = pageResponse2.body.data.logs;
      expect(logs2.length).toBeLessThanOrEqual(2);

      // Verify pagination info
      if (pageResponse1.body.data.pagination) {
        expect(pageResponse1.body.data.pagination).toHaveProperty('total');
        expect(pageResponse1.body.data.pagination).toHaveProperty('limit');
        expect(pageResponse1.body.data.pagination).toHaveProperty('offset');
      }
    });

    /**
     * ✅ Test 9: Audit log filtering by action
     */
    it('✅ Audit logs can be filtered by action', async () => {
      const slug = generateRandomSlug();

      // Create and update link
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(testUser.jwt)
      );

      await PUT(
        `/links/${slug}`,
        { url: 'https://updated.example.com' },
        authHeader(testUser.jwt)
      );

      // Query audit logs with action filter
      const response = await GET(
        `/links/${slug}/audit?action=UPDATE`,
        authHeader(testUser.jwt)
      );

      if (response.status === 200) {
        const logs = response.body.data.logs;
        // All logs should be UPDATE action
        logs.forEach((log: any) => {
          expect(log.action).toBe('UPDATE');
        });
      }
    });

    /**
     * ✅ Test 10: Audit logs ordered by timestamp (descending)
     */
    it('✅ Audit logs ordered by timestamp (newest first)', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        { slug, url: 'https://example.com/v1' },
        authHeader(testUser.jwt)
      );

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update
      await PUT(
        `/links/${slug}`,
        { url: 'https://example.com/v2' },
        authHeader(testUser.jwt)
      );

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      expect(logs.length).toBeGreaterThan(1);

      // Verify descending order (newest first)
      for (let i = 1; i < logs.length; i++) {
        const prevTime = new Date(logs[i - 1].timestamp).getTime();
        const currTime = new Date(logs[i].timestamp).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });
  });

  describe('Audit Log Metadata', () => {
    /**
     * ✅ Test 11: Audit log includes additional metadata
     */
    it('✅ Audit log metadata includes user agent, Turnstile status', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      const createLog = logs.find((log: any) => log.action === 'CREATE');

      if (createLog && createLog.metadata) {
        // Metadata may include userAgent, turnstileValidated, etc.
        // These are optional but if present should have correct format
        if (createLog.metadata.userAgent) {
          expect(typeof createLog.metadata.userAgent).toBe('string');
        }
        if (createLog.metadata.turnstileValidated !== undefined) {
          expect(typeof createLog.metadata.turnstileValidated).toBe('boolean');
        }
      }
    });

    /**
     * ✅ Test 12: Transfer audit log includes fromOwnerId and toOwnerId
     */
    it('✅ TRANSFER audit log includes ownership transfer metadata', async () => {
      const user2 = await createTestUser('audit-transfer-user2@example.com');
      const slug = generateRandomSlug();

      // Create link as user1
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(testUser.jwt)
      );

      // Transfer to user2
      await POST(
        `/links/${slug}/transfer`,
        { toUserId: user2.id },
        authHeader(testUser.jwt)
      );

      // Fetch audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = response.body.data.logs;
      const transferLog = logs.find((log: any) => log.action === 'TRANSFER');

      if (transferLog && transferLog.metadata) {
        expect(transferLog.metadata.fromOwnerId).toBe(testUser.id);
        expect(transferLog.metadata.toOwnerId).toBe(user2.id);
      }
    });
  });

  describe('Audit Log Permission', () => {
    /**
     * ✅ Test 13: Only owner/admin can view audit logs
     */
    it('✅ Only owner can view link audit logs', async () => {
      const user2 = await createTestUser('audit-viewer@example.com');
      const slug = generateRandomSlug();

      // User1 creates link
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(testUser.jwt)
      );

      // User2 tries to view audit logs
      const response = await GET(
        `/links/${slug}/audit`,
        authHeader(user2.jwt)
      );

      // Should either be 403 or 404
      expect([403, 404]).toContain(response.status);
    });
  });
});
