import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  POST,
  createTestUser,
  mockTurnstileToken,
  generateRandomSlug,
  authHeader,
  resetTestDatabase,
  testAssert,
  testData,
  TEST_CONFIG,
} from './setup';

/**
 * Integration Tests: Link Creation
 * Tests for POST /api/v1/links endpoint
 * 8 test cases covering success and error scenarios
 */

describe('Feature: Link Creation', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testUser = await createTestUser('create-test-user@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('Anonymous Creation', () => {
    /**
     * ✅ Test 1: Anonymous user creates link with valid Turnstile
     * - No auth header
     * - Valid Turnstile token
     * - Should return 201 with slug and shortUrl
     */
    it('✅ Anonymous + valid Turnstile → 201 Created', async () => {
      const slug = generateRandomSlug();
      const response = await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.slug).toBe(slug);
      expect(response.body.data.url).toBe('https://example.com');
      expect(response.body.data.shortUrl).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
      // Anonymous link should not have ownerId
      expect(response.body.data.ownerId).toBeUndefined();
    });

    /**
     * ❌ Test 2: Anonymous user without Turnstile → 403 TURNSTILE_REQUIRED
     * - No auth header
     * - No Turnstile token
     * - Should return 403 with error code
     */
    it('❌ Anonymous without Turnstile → 403 TURNSTILE_REQUIRED', async () => {
      const response = await POST('/links', {
        slug: generateRandomSlug(),
        url: 'https://example.com',
        // No turnstileToken
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TURNSTILE_REQUIRED');
    });

    /**
     * ❌ Test 3: Anonymous user with invalid Turnstile → 403 TURNSTILE_VERIFICATION_FAILED
     * - No auth header
     * - Invalid Turnstile token
     * - Should return 403
     */
    it('❌ Anonymous + invalid Turnstile → 403 TURNSTILE_VERIFICATION_FAILED', async () => {
      const response = await POST('/links', {
        slug: generateRandomSlug(),
        url: 'https://example.com',
        turnstileToken: 'invalid-token-123',
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TURNSTILE_VERIFICATION_FAILED');
    });
  });

  describe('Authenticated Creation', () => {
    /**
     * ✅ Test 4: Authenticated user skips Turnstile verification
     * - Valid JWT in Authorization header
     * - No Turnstile token
     * - Should return 201 with ownerId set
     */
    it('✅ Authenticated skips Turnstile → 201 Created', async () => {
      const slug = generateRandomSlug();
      const response = await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
          // No Turnstile needed for authenticated users
        },
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe(slug);
      expect(response.body.data.ownerId).toBe(testUser.id);
    });

    /**
     * ✅ Test 5: Auto-generate slug if not provided
     * - Authenticated user
     * - No slug in request
     * - Should return 201 with auto-generated slug
     */
    it('✅ Auto-generate slug if not provided → 201', async () => {
      const response = await POST(
        '/links',
        {
          url: 'https://example.com/auto-slug-test',
          // No slug provided
        },
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBeDefined();
      // Auto-generated slug should match format: 3-50 chars, alphanumeric + hyphens
      expect(response.body.data.slug).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{3}$/);
      expect(response.body.data.slug.length).toBeGreaterThanOrEqual(3);
      expect(response.body.data.slug.length).toBeLessThanOrEqual(50);
    });

    /**
     * ✅ Test 6: Create link with metadata (title, tags, warning)
     * - Authenticated user
     * - Include metadata fields
     * - Should return 201 with metadata preserved
     */
    it('✅ Create with metadata → 201', async () => {
      const slug = generateRandomSlug();
      const response = await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
          metadata: {
            title: 'My Test Link',
            description: 'This is a test description',
            tags: ['test', 'integration', 'create'],
            showWarning: true,
          },
        },
        authHeader(testUser.jwt)
      );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.data.metadata.title).toBe('My Test Link');
      expect(response.body.data.metadata.tags).toContain('test');
      expect(response.body.data.metadata.showWarning).toBe(true);
    });
  });

  describe('Validation and Conflicts', () => {
    /**
     * ❌ Test 7: Duplicate slug → 409 SLUG_ALREADY_EXISTS
     * - Create first link successfully
     * - Try to create another with same slug
     * - Should return 409 with conflict error
     */
    it('❌ Duplicate slug → 409 SLUG_ALREADY_EXISTS', async () => {
      const slug = generateRandomSlug();

      // Create first link
      const firstResponse = await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
          turnstileToken: mockTurnstileToken(),
        }
      );
      expect(firstResponse.status).toBe(201);

      // Try to create duplicate
      const secondResponse = await POST(
        '/links',
        {
          slug, // Same slug
          url: 'https://different.example.com',
          turnstileToken: mockTurnstileToken(),
        }
      );

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.error.code).toBe('SLUG_ALREADY_EXISTS');
    });

    /**
     * ❌ Test 8: Reserved slug → 400 SLUG_RESERVED
     * - Try to create link with reserved slug (e.g., 'api', 'admin')
     * - Should return 400 with reserved error
     */
    it('❌ Reserved slug (api, admin, etc.) → 400 SLUG_RESERVED', async () => {
      const reservedSlugs = ['api', 'admin', 'dashboard', 'login', 'settings'];

      for (const slug of reservedSlugs) {
        const response = await POST(
          '/links',
          {
            slug,
            url: 'https://example.com',
            turnstileToken: mockTurnstileToken(),
          }
        );

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('SLUG_RESERVED');
      }
    });
  });

  describe('Edge Cases and Validation', () => {
    /**
     * ❌ Invalid slug format tests
     */
    it('❌ Invalid slug format (too short) → 400 SLUG_TOO_SHORT', async () => {
      const response = await POST(
        '/links',
        {
          slug: 'ab', // 2 chars, need at least 3
          url: 'https://example.com',
          turnstileToken: mockTurnstileToken(),
        }
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SLUG_TOO_SHORT');
    });

    /**
     * ❌ Invalid slug format (too long)
     */
    it('❌ Invalid slug format (too long) → 400 SLUG_TOO_LONG', async () => {
      const response = await POST(
        '/links',
        {
          slug: 'a'.repeat(51), // 51 chars, max is 50
          url: 'https://example.com',
          turnstileToken: mockTurnstileToken(),
        }
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SLUG_TOO_LONG');
    });

    /**
     * ❌ Invalid URL format (private IP)
     */
    it('❌ Invalid URL (private IP) → 400 URL_PRIVATE_IP_BLOCKED', async () => {
      const privateIPs = [
        'https://192.168.1.1',
        'https://10.0.0.1',
        'https://172.16.0.1',
        'https://localhost',
        'https://127.0.0.1',
      ];

      for (const url of privateIPs) {
        const response = await POST(
          '/links',
          {
            slug: generateRandomSlug(),
            url,
            turnstileToken: mockTurnstileToken(),
          }
        );

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('URL_PRIVATE_IP_BLOCKED');
      }
    });

    /**
     * ❌ Invalid URL format (missing protocol)
     */
    it('❌ Invalid URL (missing protocol) → 400 URL_MISSING_PROTOCOL', async () => {
      const response = await POST(
        '/links',
        {
          slug: generateRandomSlug(),
          url: 'example.com', // Missing https://
          turnstileToken: mockTurnstileToken(),
        }
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('URL_MISSING_PROTOCOL');
    });

    /**
     * ❌ Invalid slug format (invalid characters)
     */
    it('❌ Invalid slug format (special chars) → 400 SLUG_INVALID_FORMAT', async () => {
      const invalidSlugs = [
        'slug-with-UPPERCASE',
        'slug_with_underscore',
        'slug with spaces',
        '-starts-with-hyphen',
        'ends-with-hyphen-',
      ];

      for (const slug of invalidSlugs) {
        const response = await POST(
          '/links',
          {
            slug,
            url: 'https://example.com',
            turnstileToken: mockTurnstileToken(),
          }
        );

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('SLUG_INVALID_FORMAT');
      }
    });
  });

  describe('Response Format', () => {
    /**
     * ✅ Verify response structure
     */
    it('✅ Response has correct structure', async () => {
      const response = await POST(
        '/links',
        {
          slug: generateRandomSlug(),
          url: 'https://example.com',
          turnstileToken: mockTurnstileToken(),
        }
      );

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');

      // Check timestamp is ISO 8601
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);

      // Check data structure
      expect(response.body.data).toHaveProperty('slug');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data).toHaveProperty('shortUrl');
      expect(response.body.data).toHaveProperty('createdAt');
    });

    /**
     * ✅ Error response has correct structure
     */
    it('✅ Error response has correct structure', async () => {
      const response = await POST(
        '/links',
        {
          slug: generateRandomSlug(),
          url: 'https://example.com',
          // Missing Turnstile
        }
      );

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
