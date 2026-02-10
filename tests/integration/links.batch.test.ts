import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  POST,
  GET,
  createTestUser,
  generateRandomSlug,
  authHeader,
  resetTestDatabase,
} from './setup';

/**
 * Integration Tests: Batch Operations
 * Tests for POST /api/v1/links/batch endpoint
 * 4 test cases covering batch creation, validation, and error handling
 */

describe('Feature: Batch Operations', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testUser = await createTestUser('batch-test-user@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('Successful Batch Operations', () => {
    /**
     * ✅ Test 1: Create 3 links in batch
     * - POST /api/v1/links/batch with array of 3 links
     * - Should return 201
     * - Response should show created=3, failed=0
     * - All links should be created with correct data
     */
    it('✅ Create 3 links in batch → 201, created=3', async () => {
      const slug1 = generateRandomSlug();
      const slug2 = generateRandomSlug();
      const slug3 = generateRandomSlug();

      const batchRequest = [
        {
          slug: slug1,
          url: 'https://example.com/1',
          metadata: { title: 'Link 1' },
        },
        {
          slug: slug2,
          url: 'https://example.com/2',
          metadata: { title: 'Link 2' },
        },
        {
          slug: slug3,
          url: 'https://example.com/3',
          metadata: { title: 'Link 3' },
        },
      ];

      const response = await POST(
        '/links/batch',
        { links: batchRequest },
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.created).toBe(3);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.total).toBe(3);

      // Verify all links created
      const createdLinks = response.body.data.results.filter(
        (r: any) => r.success === true
      );
      expect(createdLinks.length).toBe(3);

      const slugs = createdLinks.map((r: any) => r.data.slug);
      expect(slugs).toContain(slug1);
      expect(slugs).toContain(slug2);
      expect(slugs).toContain(slug3);
    });

    /**
     * ✅ Test 2: Batch with mixed success and failure
     * - 5 links: 3 valid, 1 duplicate, 1 reserved
     * - Should return 207 Multi-Status (or 201)
     * - created=3, failed=2
     */
    it('✅ Batch with 3 successes and 2 failures', async () => {
      const slug1 = generateRandomSlug();
      const slug2 = generateRandomSlug();
      const slug3 = generateRandomSlug();
      const duplicateSlug = generateRandomSlug();

      // Pre-create duplicate
      await POST(
        '/links',
        { slug: duplicateSlug, url: 'https://example.com/original' },
        authHeader(testUser.jwt)
      );

      const batchRequest = [
        {
          slug: slug1,
          url: 'https://example.com/1',
        },
        {
          slug: slug2,
          url: 'https://example.com/2',
        },
        {
          slug: 'admin', // Reserved slug
          url: 'https://example.com/reserved',
        },
        {
          slug: slug3,
          url: 'https://example.com/3',
        },
        {
          slug: duplicateSlug, // Duplicate
          url: 'https://example.com/duplicate-attempt',
        },
      ];

      const response = await POST(
        '/links/batch',
        { links: batchRequest },
        authHeader(testUser.jwt)
      );

      expect([201, 207]).toContain(response.status);
      expect(response.body.data.created).toBe(3);
      expect(response.body.data.failed).toBe(2);
      expect(response.body.data.total).toBe(5);

      // Check individual results
      const results = response.body.data.results;
      const successes = results.filter((r: any) => r.success === true);
      const failures = results.filter((r: any) => r.success === false);

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(2);

      // Verify error codes
      const errorCodes = failures.map((r: any) => r.error?.code);
      expect(errorCodes).toContain('SLUG_RESERVED');
      expect(errorCodes).toContain('SLUG_ALREADY_EXISTS');
    });

    /**
     * ✅ Test 3: Large batch (50 links)
     * - POST with 50 valid links
     * - Should succeed with created=50
     */
    it('✅ Batch with 50 links succeeds', async () => {
      const links = Array.from({ length: 50 }, (_, i) => ({
        slug: generateRandomSlug(),
        url: `https://example.com/${i}`,
        metadata: { title: `Link ${i}` },
      }));

      const response = await POST(
        '/links/batch',
        { links },
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(201);
      expect(response.body.data.created).toBe(50);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.total).toBe(50);
    });
  });

  describe('Batch Size Validation', () => {
    /**
     * ❌ Test 4: Batch > 100 items → 400 BATCH_SIZE_EXCEEDED
     * - POST batch with 101 links
     * - Should return 400 with error code
     */
    it('❌ Batch > 100 items → 400 BATCH_SIZE_EXCEEDED', async () => {
      const links = Array.from({ length: 101 }, (_, i) => ({
        slug: generateRandomSlug(),
        url: `https://example.com/${i}`,
      }));

      const response = await POST(
        '/links/batch',
        { links },
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BATCH_SIZE_EXCEEDED');
    });

    /**
     * ❌ Test 5: Empty batch
     * - POST batch with 0 links
     * - Should return error
     */
    it('❌ Empty batch → error', async () => {
      const response = await POST(
        '/links/batch',
        { links: [] },
        authHeader(testUser.jwt)
      );

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Audit Logging for Batch', () => {
    /**
     * ✅ Test 6: Batch operations logged individually
     * - Create 2 links in batch
     * - Fetch audit logs
     * - Should have 2 CREATE entries (not 1 BATCH entry)
     */
    it('✅ Batch operations logged individually', async () => {
      const slug1 = generateRandomSlug();
      const slug2 = generateRandomSlug();

      // Batch create
      const batchResponse = await POST(
        '/links/batch',
        {
          links: [
            { slug: slug1, url: 'https://example.com/1' },
            { slug: slug2, url: 'https://example.com/2' },
          ],
        },
        authHeader(testUser.jwt)
      );

      expect(batchResponse.status).toBe(201);

      // Check audit logs for first link
      const auditResponse1 = await GET(
        `/links/${slug1}/audit`,
        authHeader(testUser.jwt)
      );

      expect(auditResponse1.status).toBe(200);
      const createLogs1 = auditResponse1.body.data.logs.filter(
        (log: any) => log.action === 'CREATE'
      );
      expect(createLogs1.length).toBe(1);

      // Check audit logs for second link
      const auditResponse2 = await GET(
        `/links/${slug2}/audit`,
        authHeader(testUser.jwt)
      );

      expect(auditResponse2.status).toBe(200);
      const createLogs2 = auditResponse2.body.data.logs.filter(
        (log: any) => log.action === 'CREATE'
      );
      expect(createLogs2.length).toBe(1);
    });

    /**
     * ✅ Test 7: Each audit log has correct metadata
     */
    it('✅ Batch audit logs include correct metadata', async () => {
      const slug = generateRandomSlug();

      await POST(
        '/links/batch',
        {
          links: [{ slug, url: 'https://example.com' }],
        },
        authHeader(testUser.jwt)
      );

      const auditResponse = await GET(
        `/links/${slug}/audit`,
        authHeader(testUser.jwt)
      );

      const logs = auditResponse.body.data.logs;
      expect(logs.length).toBeGreaterThan(0);

      const createLog = logs[0];
      expect(createLog.action).toBe('CREATE');
      expect(createLog.actorId).toBe(testUser.id);
      expect(createLog.linkSlug).toBe(slug);
      expect(createLog.timestamp).toBeDefined();
    });
  });

  describe('Batch Response Format', () => {
    /**
     * ✅ Test 8: Batch response structure
     */
    it('✅ Batch response has correct structure', async () => {
      const response = await POST(
        '/links/batch',
        {
          links: [
            {
              slug: generateRandomSlug(),
              url: 'https://example.com',
            },
          ],
        },
        authHeader(testUser.jwt)
      );

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('created');
      expect(response.body.data).toHaveProperty('failed');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('results');
      expect(Array.isArray(response.body.data.results)).toBe(true);

      // Check result item structure
      const result = response.body.data.results[0];
      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('slug');
        expect(result.data).toHaveProperty('url');
      } else {
        expect(result).toHaveProperty('error');
        expect(result.error).toHaveProperty('code');
      }
    });
  });

  describe('Batch Transaction Semantics', () => {
    /**
     * ✅ Test 9: Batch is atomic (all or nothing) or partial success
     * - In strict mode: all fail if any fail
     * - In partial mode: each item processed independently
     * - Verify consistency
     */
    it('✅ Batch operations maintain consistency', async () => {
      const slug1 = generateRandomSlug();
      const slug2 = generateRandomSlug();
      const duplicateSlug = generateRandomSlug();

      // Pre-create duplicate
      await POST(
        '/links',
        { slug: duplicateSlug, url: 'https://example.com/original' },
        authHeader(testUser.jwt)
      );

      const response = await POST(
        '/links/batch',
        {
          links: [
            { slug: slug1, url: 'https://example.com/1' },
            { slug: duplicateSlug, url: 'https://example.com/dup' },
            { slug: slug2, url: 'https://example.com/2' },
          ],
        },
        authHeader(testUser.jwt)
      );

      // Verify independent processing
      const results = response.body.data.results;

      // First should succeed
      expect(results[0].success).toBe(true);
      expect(results[0].data.slug).toBe(slug1);

      // Second should fail (duplicate)
      expect(results[1].success).toBe(false);
      expect(results[1].error.code).toBe('SLUG_ALREADY_EXISTS');

      // Third should succeed
      expect(results[2].success).toBe(true);
      expect(results[2].data.slug).toBe(slug2);

      // Verify actual state
      const getSlug1 = await GET(
        `/api/v1/links/${slug1}`,
        authHeader(testUser.jwt)
      );
      expect(getSlug1.status).toBe(200);

      const getSlug2 = await GET(
        `/api/v1/links/${slug2}`,
        authHeader(testUser.jwt)
      );
      expect(getSlug2.status).toBe(200);
    });
  });

  describe('Batch with Different User Scenarios', () => {
    /**
     * ✅ Test 10: Batch creates with authenticated user as owner
     */
    it('✅ Batch links get owner set to authenticated user', async () => {
      const slug1 = generateRandomSlug();

      const response = await POST(
        '/links/batch',
        {
          links: [
            {
              slug: slug1,
              url: 'https://example.com',
            },
          ],
        },
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(201);
      const createdLink = response.body.data.results[0].data;
      expect(createdLink.ownerId).toBe(testUser.id);
    });
  });
});
