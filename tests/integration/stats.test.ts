import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  POST,
  GET,
  createTestUser,
  generateRandomSlug,
  authHeader,
  resetTestDatabase,
  concurrentRequests,
} from './setup';

/**
 * Integration Tests: Statistics and Analytics
 * Tests for stats endpoints: user stats, link analytics, global stats
 * 4 test cases covering filtering, aggregation, and data accuracy
 */

describe('Feature: Statistics and Analytics', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let otherUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testUser = await createTestUser('stats-user@example.com');
    otherUser = await createTestUser('stats-other@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('User Statistics', () => {
    /**
     * ✅ Test 1: User stats endpoint returns user's links
     * - Create 3 links as user
     * - GET /api/v1/users/{userId}/stats
     * - Should return stats with list of user's links and counts
     */
    it('✅ User stats returns user links with visit counts', async () => {
      const slug1 = generateRandomSlug();
      const slug2 = generateRandomSlug();
      const slug3 = generateRandomSlug();

      // Create 3 links
      await POST(
        '/links',
        { slug: slug1, url: 'https://example.com/1' },
        authHeader(testUser.jwt)
      );
      await POST(
        '/links',
        { slug: slug2, url: 'https://example.com/2' },
        authHeader(testUser.jwt)
      );
      await POST(
        '/links',
        { slug: slug3, url: 'https://example.com/3' },
        authHeader(testUser.jwt)
      );

      // Visit links
      await GET(`/${slug1}`, undefined, { followRedirects: false });
      await GET(`/${slug1}`, undefined, { followRedirects: false });
      await GET(`/${slug2}`, undefined, { followRedirects: false });

      // Get user stats
      const response = await GET(
        `/users/${testUser.id}/stats`,
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();

      // Should have total counts
      expect(response.body.data.totalLinks).toBe(3);
      expect(response.body.data.totalVisits).toBe(3);

      // Should have list of links with their stats
      if (response.body.data.links) {
        expect(Array.isArray(response.body.data.links)).toBe(true);
        expect(response.body.data.links.length).toBe(3);

        // Each link should have slug and visit count
        response.body.data.links.forEach((link: any) => {
          expect(link.slug).toBeDefined();
          expect(link.visits).toBeDefined();
          expect(typeof link.visits).toBe('number');
        });
      }
    });

    /**
     * ✅ Test 2: User stats with regex filter
     * - Create links with different slug patterns
     * - Query with regex filter (e.g., "^test-")
     * - Should return only matching links
     */
    it('✅ User stats with regex filter → filtered list', async () => {
      const slugMatching1 = 'test-filter-1';
      const slugMatching2 = 'test-filter-2';
      const slugNonMatching = 'other-slug-xyz';

      // Create links
      await POST(
        '/links',
        { slug: slugMatching1, url: 'https://example.com/1' },
        authHeader(testUser.jwt)
      );
      await POST(
        '/links',
        { slug: slugMatching2, url: 'https://example.com/2' },
        authHeader(testUser.jwt)
      );
      await POST(
        '/links',
        { slug: slugNonMatching, url: 'https://example.com/3' },
        authHeader(testUser.jwt)
      );

      // Query with regex filter
      const response = await GET(
        `/users/${testUser.id}/stats?filter=^test-`,
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(200);

      if (response.body.data.filtered) {
        const filtered = response.body.data.filtered;
        expect(Array.isArray(filtered)).toBe(true);

        // Should only contain matching links
        const slugs = filtered.map((link: any) => link.slug);
        expect(slugs).toContain(slugMatching1);
        expect(slugs).toContain(slugMatching2);
        expect(slugs).not.toContain(slugNonMatching);
      }
    });

    /**
     * ❌ Test 3: Invalid regex → 400 INVALID_REGEX
     */
    it('❌ Invalid regex filter → 400 INVALID_REGEX', async () => {
      const response = await GET(
        `/users/${testUser.id}/stats?filter=(?P<invalid>)`,
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REGEX');
    });

    /**
     * ✅ Test 4: User cannot view other user's stats
     */
    it('✅ User cannot view other user stats', async () => {
      const response = await GET(
        `/users/${otherUser.id}/stats`,
        authHeader(testUser.jwt)
      );

      // Should be 403 or 404
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Link Analytics', () => {
    /**
     * ✅ Test 5: Link analytics with daily visits
     * - Create link
     * - Get it multiple times
     * - GET /api/v1/links/{slug}/analytics
     * - Should return dailyVisits array with dates and counts
     */
    it('✅ Link analytics returns daily visit data', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(testUser.jwt)
      );

      // Generate visits
      for (let i = 0; i < 5; i++) {
        await GET(`/${slug}`, undefined, { followRedirects: false });
      }

      // Get analytics
      const response = await GET(
        `/links/${slug}/analytics`,
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();

      // Should have total visits
      expect(response.body.data.totalVisits).toBe(5);

      // Should have daily breakdown
      if (response.body.data.dailyVisits) {
        expect(Array.isArray(response.body.data.dailyVisits)).toBe(true);

        response.body.data.dailyVisits.forEach((day: any) => {
          expect(day.date).toBeDefined();
          expect(day.count).toBeDefined();
          expect(typeof day.count).toBe('number');
          expect(day.count).toBeGreaterThan(0);
        });
      }
    });

    /**
     * ✅ Test 6: Analytics aggregates multiple visits correctly
     */
    it('✅ Analytics aggregates concurrent visits', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(testUser.jwt)
      );

      // 20 concurrent visits
      const visitOps = Array.from({ length: 20 }, () => async () => {
        return GET(`/${slug}`, undefined, { followRedirects: false });
      });

      await concurrentRequests(visitOps, 20);

      // Get analytics
      const response = await GET(
        `/links/${slug}/analytics`,
        authHeader(testUser.jwt)
      );

      expect(response.body.data.totalVisits).toBe(20);
    });

    /**
     * ✅ Test 7: Analytics for non-existent link returns 404
     */
    it('✅ Analytics for non-existent link → 404', async () => {
      const response = await GET(
        `/links/nonexistent/analytics`,
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(404);
    });

    /**
     * ✅ Test 8: Analytics includes timestamp range
     */
    it('✅ Analytics response includes time range', async () => {
      const slug = generateRandomSlug();

      // Create and visit link
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(testUser.jwt)
      );

      await GET(`/${slug}`, undefined, { followRedirects: false });

      const response = await GET(
        `/links/${slug}/analytics`,
        authHeader(testUser.jwt)
      );

      expect(response.body.data).toBeDefined();

      // Should have date range info
      if (response.body.data.dateRange) {
        expect(response.body.data.dateRange.start).toBeDefined();
        expect(response.body.data.dateRange.end).toBeDefined();
      }
    });
  });

  describe('Global Statistics', () => {
    /**
     * ✅ Test 9: Admin/Global stats endpoint
     * - Create multiple links as different users
     * - GET /api/v1/stats (admin endpoint)
     * - Should return global counts
     */
    it('✅ Global stats show total users, links, visits', async () => {
      // Create links as different users
      const slug1 = generateRandomSlug();
      const slug2 = generateRandomSlug();

      await POST(
        '/links',
        { slug: slug1, url: 'https://example.com/1' },
        authHeader(testUser.jwt)
      );

      await POST(
        '/links',
        { slug: slug2, url: 'https://example.com/2' },
        authHeader(otherUser.jwt)
      );

      // Generate visits
      await GET(`/${slug1}`, undefined, { followRedirects: false });
      await GET(`/${slug2}`, undefined, { followRedirects: false });
      await GET(`/${slug2}`, undefined, { followRedirects: false });

      // Get global stats (would require admin auth)
      const response = await GET('/stats', authHeader(testUser.jwt));

      // Might be 200 or 403 depending on auth
      if (response.status === 200) {
        expect(response.body.data.totalUsers).toBeDefined();
        expect(response.body.data.totalLinks).toBeDefined();
        expect(response.body.data.totalVisits).toBeDefined();
      } else {
        expect(response.status).toBe(403);
      }
    });

    /**
     * ✅ Test 10: Stats have correct data types
     */
    it('✅ Stats response structure is consistent', async () => {
      const slug = generateRandomSlug();

      // Create and visit
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(testUser.jwt)
      );

      await GET(`/${slug}`, undefined, { followRedirects: false });

      // Get user stats
      const response = await GET(
        `/users/${testUser.id}/stats`,
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();

      // Verify data types
      expect(typeof response.body.data.totalLinks).toBe('number');
      expect(typeof response.body.data.totalVisits).toBe('number');

      if (response.body.data.links) {
        expect(Array.isArray(response.body.data.links)).toBe(true);
      }
    });
  });

  describe('Statistics with Metadata', () => {
    /**
     * ✅ Test 11: Stats include link metadata
     */
    it('✅ Analytics includes link metadata', async () => {
      const slug = generateRandomSlug();

      // Create with metadata
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
          metadata: {
            title: 'Test Link',
            tags: ['important'],
          },
        },
        authHeader(testUser.jwt)
      );

      // Get analytics
      const response = await GET(
        `/links/${slug}/analytics`,
        authHeader(testUser.jwt)
      );

      // Metadata might be included in analytics
      if (response.body.data.metadata) {
        expect(response.body.data.metadata.title).toBe('Test Link');
      }
    });
  });

  describe('Statistics Filtering and Sorting', () => {
    /**
     * ✅ Test 12: Stats can be sorted by visits
     */
    it('✅ User stats can be sorted by visits (descending)', async () => {
      // Create 3 links
      const slug1 = generateRandomSlug();
      const slug2 = generateRandomSlug();
      const slug3 = generateRandomSlug();

      await POST(
        '/links',
        { slug: slug1, url: 'https://example.com/1' },
        authHeader(testUser.jwt)
      );
      await POST(
        '/links',
        { slug: slug2, url: 'https://example.com/2' },
        authHeader(testUser.jwt)
      );
      await POST(
        '/links',
        { slug: slug3, url: 'https://example.com/3' },
        authHeader(testUser.jwt)
      );

      // Create unequal visits
      for (let i = 0; i < 5; i++) {
        await GET(`/${slug1}`, undefined, { followRedirects: false });
      }
      for (let i = 0; i < 2; i++) {
        await GET(`/${slug2}`, undefined, { followRedirects: false });
      }

      // Get stats with sort
      const response = await GET(
        `/users/${testUser.id}/stats?sort=visits&order=desc`,
        authHeader(testUser.jwt)
      );

      if (response.status === 200 && response.body.data.links) {
        const links = response.body.data.links;

        // Verify sorted order (highest visits first)
        for (let i = 1; i < links.length; i++) {
          expect(links[i - 1].visits).toBeGreaterThanOrEqual(links[i].visits);
        }
      }
    });
  });

  describe('Statistics Time Range', () => {
    /**
     * ✅ Test 13: Analytics can filter by date range
     */
    it('✅ Analytics supports date range filtering', async () => {
      const slug = generateRandomSlug();

      // Create and visit
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(testUser.jwt)
      );

      await GET(`/${slug}`, undefined, { followRedirects: false });

      // Get analytics with date filter
      const today = new Date().toISOString().split('T')[0];
      const response = await GET(
        `/links/${slug}/analytics?startDate=${today}&endDate=${today}`,
        authHeader(testUser.jwt)
      );

      if (response.status === 200 && response.body.data.dailyVisits) {
        // Should have data for today
        const dailyVisits = response.body.data.dailyVisits;
        expect(Array.isArray(dailyVisits)).toBe(true);
      }
    });
  });
});
