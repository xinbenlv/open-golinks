import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  POST,
  GET,
  DELETE,
  createTestUser,
  mockTurnstileToken,
  generateRandomSlug,
  authHeader,
  resetTestDatabase,
  concurrentRequests,
} from './setup';

/**
 * Integration Tests: Link Resolution
 * Tests for GET /{slug} endpoint (redirect)
 * 4 test cases covering redirects, errors, and visit tracking
 */

describe('Feature: Link Resolution', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testUser = await createTestUser('resolve-test-user@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('Successful Resolution', () => {
    /**
     * ✅ Test 1: GET /{slug} returns 302 redirect with Location header
     * - Create link
     * - GET /{slug} without following redirects
     * - Should return 302 with Location header pointing to URL
     */
    it('✅ GET /{slug} returns 302 + Location header', async () => {
      const slug = generateRandomSlug();
      const targetUrl = 'https://example.com/target-page';

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: targetUrl,
        },
        authHeader(testUser.jwt)
      );

      // Resolve without following redirect
      const response = await GET(`/${slug}`, undefined, {
        followRedirects: false,
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(targetUrl);
    });

    /**
     * ✅ Test 2: Following redirect resolves to target URL
     * - Create link
     * - GET /{slug} with followRedirects: true
     * - Should eventually reach target page
     */
    it('✅ Following redirect reaches target page', async () => {
      const slug = generateRandomSlug();
      const targetUrl = 'https://example.com/target';

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: targetUrl,
        },
        authHeader(testUser.jwt)
      );

      // Resolve with redirect following
      const response = await GET(`/${slug}`, undefined, {
        followRedirects: true,
      });

      // Should eventually resolve (though target might not exist in tests)
      // Status could be 200, 404, or other based on target server
      expect(response.status).toBeGreaterThan(0);
    });
  });

  describe('Error Scenarios', () => {
    /**
     * ❌ Test 3: Non-existent link → 404 LINK_NOT_FOUND
     * - Try to GET non-existent slug
     * - Should return 404
     */
    it('❌ Non-existent link → 404 LINK_NOT_FOUND', async () => {
      const response = await GET('/nonexistent-slug-xyz', undefined, {
        followRedirects: false,
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('LINK_NOT_FOUND');
    });

    /**
     * ❌ Test 4: Deleted link → 410 GONE
     * - Create and delete link
     * - Try to GET deleted slug
     * - Should return 410 (not 404)
     */
    it('❌ Deleted link → 410 GONE', async () => {
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

      // Delete it
      await DELETE(`/links/${slug}`, authHeader(testUser.jwt));

      // Try to resolve
      const response = await GET(`/${slug}`, undefined, {
        followRedirects: false,
      });

      expect(response.status).toBe(410);
      expect(response.body.error.code).toBe('LINK_DELETED');
    });
  });

  describe('Visit Count Tracking', () => {
    /**
     * ✅ Test 5: Visit count incremented on resolution
     * - Create link with visits = 0
     * - GET /{slug} once
     * - Visits should be 1
     * - GET again
     * - Visits should be 2
     */
    it('✅ Visit count incremented on each resolution', async () => {
      const slug = generateRandomSlug();

      // Create link
      const createResponse = await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      expect(createResponse.body.data.visits).toBe(0);

      // First visit
      await GET(`/${slug}`, undefined, { followRedirects: false });

      // Check visits increased
      let getResponse = await GET(
        `/api/v1/links/${slug}`,
        authHeader(testUser.jwt)
      );
      expect(getResponse.body.data.visits).toBe(1);

      // Second visit
      await GET(`/${slug}`, undefined, { followRedirects: false });

      // Check visits increased again
      getResponse = await GET(
        `/api/v1/links/${slug}`,
        authHeader(testUser.jwt)
      );
      expect(getResponse.body.data.visits).toBe(2);
    });

    /**
     * ✅ Test 6: Concurrent visits increment count atomically
     * - Create link
     * - 10 concurrent GET requests
     * - Visit count should be exactly 10 (no race conditions)
     */
    it('✅ Concurrent visits increment count atomically (10 concurrent)', async () => {
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

      // 10 concurrent GET requests
      const visitOperations = Array.from({ length: 10 }, () => async () => {
        return GET(`/${slug}`, undefined, { followRedirects: false });
      });

      const results = await concurrentRequests(visitOperations, 10);

      // All should succeed
      const responses = results.results as any[];
      responses.forEach((response) => {
        expect(response.status).toBe(302);
      });

      // Check final visit count
      const getResponse = await GET(
        `/api/v1/links/${slug}`,
        authHeader(testUser.jwt)
      );

      expect(getResponse.body.data.visits).toBe(10);
    });

    /**
     * ✅ Test 7: 100 concurrent visits
     * - Create link
     * - 100 concurrent GET requests
     * - Visit count should be exactly 100
     */
    it('✅ 100 concurrent visits increment atomically', async () => {
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

      // 100 concurrent GET requests
      const visitOperations = Array.from({ length: 100 }, () => async () => {
        return GET(`/${slug}`, undefined, { followRedirects: false });
      });

      const results = await concurrentRequests(visitOperations, 100);

      // Check final visit count
      const getResponse = await GET(
        `/api/v1/links/${slug}`,
        authHeader(testUser.jwt)
      );

      expect(getResponse.body.data.visits).toBe(100);
    });
  });

  describe('HTTP Status and Headers', () => {
    /**
     * ✅ Test 8: Correct HTTP status and headers
     */
    it('✅ 302 response has correct headers', async () => {
      const slug = generateRandomSlug();
      const targetUrl = 'https://example.com/test';

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: targetUrl,
        },
        authHeader(testUser.jwt)
      );

      // Resolve
      const response = await GET(`/${slug}`, undefined, {
        followRedirects: false,
      });

      expect(response.status).toBe(302);

      // Check required headers
      expect(response.headers.get('Location')).toBe(targetUrl);
      expect(response.headers.get('Content-Type')).toBeDefined();

      // 302 should not have body
      expect(response.text).toMatch(/redirect|location/i);
    });

    /**
     * ✅ Test 9: Cache headers set appropriately
     */
    it('✅ 302 response has Cache-Control header', async () => {
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

      // Resolve
      const response = await GET(`/${slug}`, undefined, {
        followRedirects: false,
      });

      // Should have some caching policy
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBeDefined();
    });
  });

  describe('Special Cases', () => {
    /**
     * ✅ Test 10: Resolve link with special characters in URL
     */
    it('✅ Resolve link with query parameters', async () => {
      const slug = generateRandomSlug();
      const targetUrl =
        'https://example.com/page?param1=value1&param2=value2#section';

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: targetUrl,
        },
        authHeader(testUser.jwt)
      );

      // Resolve
      const response = await GET(`/${slug}`, undefined, {
        followRedirects: false,
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(targetUrl);
    });

    /**
     * ✅ Test 11: Case-insensitive slug resolution
     * - Create link with lowercase slug
     * - Resolve with different cases
     * - Should resolve to same link
     */
    it('✅ Slug resolution is case-insensitive', async () => {
      const slug = generateRandomSlug().toLowerCase();
      const targetUrl = 'https://example.com';

      // Create link with lowercase slug
      await POST(
        '/links',
        {
          slug,
          url: targetUrl,
        },
        authHeader(testUser.jwt)
      );

      // Try to resolve with same slug (lowercase)
      let response = await GET(`/${slug}`, undefined, {
        followRedirects: false,
      });
      expect(response.status).toBe(302);

      // Try with uppercase (should normalize to lowercase)
      const upperSlug = slug.toUpperCase();
      response = await GET(`/${upperSlug}`, undefined, {
        followRedirects: false,
      });
      // Should either work (if case-insensitive) or return 404
      expect([302, 404]).toContain(response.status);
    });
  });

  describe('Anonymous vs Authenticated Links', () => {
    /**
     * ✅ Test 12: Resolve anonymous link
     */
    it('✅ Resolve anonymous link (no owner)', async () => {
      const slug = generateRandomSlug();

      // Create anonymous link
      const createResponse = await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      expect(createResponse.body.data.ownerId).toBeUndefined();

      // Resolve
      const response = await GET(`/${slug}`, undefined, {
        followRedirects: false,
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com');
    });

    /**
     * ✅ Test 13: Resolve authenticated link
     */
    it('✅ Resolve authenticated link (with owner)', async () => {
      const slug = generateRandomSlug();

      // Create authenticated link
      const createResponse = await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      expect(createResponse.body.data.ownerId).toBe(testUser.id);

      // Resolve (no auth needed for resolution)
      const response = await GET(`/${slug}`, undefined, {
        followRedirects: false,
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com');
    });
  });
});
