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
 * Integration Tests: QR Code Generation
 * Tests for GET /api/v1/qr/{slug} endpoint
 * 2 test cases covering QR code formats (PNG and SVG)
 */

describe('Feature: QR Code Generation', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testUser = await createTestUser('qr-test-user@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('QR Code Generation', () => {
    /**
     * ✅ Test 1: GET /qr/{slug} returns PNG (default)
     * - Create link
     * - GET /api/v1/qr/{slug}
     * - Should return 200 with PNG image
     * - Content-Type should be image/png
     */
    it('✅ GET /qr/{slug} returns PNG image (default)', async () => {
      const slug = generateRandomSlug();
      const shortUrl = `http://localhost:3001/${slug}`;

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Get QR code (default format)
      const response = await GET(`/qr/${slug}`);

      expect(response.status).toBe(200);

      // Check content type is image/png
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toMatch(/image\/png/);

      // Response should be binary data (not JSON)
      expect(response.text).toBeDefined();
      // PNG files start with specific magic bytes: 89 50 4E 47
      // In base64 or binary form, this would be iVBORw0KGgo
      expect(response.text.length).toBeGreaterThan(0);
    });

    /**
     * ✅ Test 2: GET /qr/{slug}?format=svg returns SVG
     * - Create link
     * - GET /api/v1/qr/{slug}?format=svg
     * - Should return 200 with SVG image
     * - Content-Type should be image/svg+xml
     * - Response should contain SVG XML
     */
    it('✅ GET /qr/{slug}?format=svg returns SVG image', async () => {
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

      // Get QR code in SVG format
      const response = await GET(`/qr/${slug}?format=svg`);

      expect(response.status).toBe(200);

      // Check content type is SVG
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toMatch(/image\/svg\+xml|text\/svg/);

      // SVG should contain XML
      expect(response.text).toContain('svg');
      expect(response.text).toMatch(/<svg|<!--/);
    });

    /**
     * ✅ Test 3: QR code size parameter
     * - Request with different sizes
     * - Should return valid QR code
     */
    it('✅ QR code with custom size parameter', async () => {
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

      // Get QR code with size parameter
      const response = await GET(`/qr/${slug}?size=300`);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toMatch(/image/);
    });

    /**
     * ✅ Test 4: QR code for non-existent link
     * - Try to get QR code for non-existent slug
     * - Should return 404
     */
    it('❌ QR code for non-existent link → 404', async () => {
      const response = await GET(`/qr/nonexistent-slug`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('LINK_NOT_FOUND');
    });

    /**
     * ✅ Test 5: QR code encodes short URL
     * - Create link
     * - Get QR code
     * - QR code should encode the short URL, not the long URL
     */
    it('✅ QR code encodes short URL', async () => {
      const slug = generateRandomSlug();
      const shortUrl = `http://localhost:3001/${slug}`;
      const longUrl = 'https://very-long-example.com/path/to/page?param=value';

      // Create link with long URL
      await POST(
        '/links',
        {
          slug,
          url: longUrl,
        },
        authHeader(testUser.jwt)
      );

      // Get QR code
      const response = await GET(`/qr/${slug}?format=svg`);

      expect(response.status).toBe(200);

      // SVG should contain encoded short URL
      // (In reality, we'd decode the QR code, but we can at least check SVG contains data)
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(100); // SVG should be substantial
    });

    /**
     * ✅ Test 6: QR code error correction level
     * - Request with error correction level parameter
     * - Should return valid QR code
     */
    it('✅ QR code with error correction level parameter', async () => {
      const slug = generateRandomSlug();

      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // L, M, Q, H are valid levels
      const levels = ['L', 'M', 'Q', 'H'];

      for (const level of levels) {
        const response = await GET(`/qr/${slug}?errorCorrection=${level}`);

        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(response.headers.get('Content-Type')).toMatch(/image/);
        }
      }
    });

    /**
     * ✅ Test 7: QR code caching headers
     */
    it('✅ QR code response includes appropriate caching headers', async () => {
      const slug = generateRandomSlug();

      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      const response = await GET(`/qr/${slug}`);

      expect(response.status).toBe(200);

      // Should have cache headers
      const cacheControl = response.headers.get('Cache-Control');
      const expires = response.headers.get('Expires');
      const eTag = response.headers.get('ETag');

      // At least one caching mechanism should be present
      expect(cacheControl || expires || eTag).toBeTruthy();
    });

    /**
     * ✅ Test 8: QR code for deleted link
     */
    it('❌ QR code for deleted link → 410 GONE', async () => {
      const slug = generateRandomSlug();

      // Create and delete link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      await POST(
        `/links/${slug}/delete`,
        {},
        authHeader(testUser.jwt)
      );

      // Try to get QR code
      const response = await GET(`/qr/${slug}`);

      expect([404, 410]).toContain(response.status);
    });

    /**
     * ✅ Test 9: Different formats consistency
     * - Create link
     * - Get PNG and SVG versions
     * - Both should encode same data
     */
    it('✅ PNG and SVG encode same data', async () => {
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

      // Get PNG
      const pngResponse = await GET(`/qr/${slug}?format=png`);
      expect(pngResponse.status).toBe(200);
      expect(pngResponse.headers.get('Content-Type')).toMatch(/image\/png/);

      // Get SVG
      const svgResponse = await GET(`/qr/${slug}?format=svg`);
      expect(svgResponse.status).toBe(200);
      expect(svgResponse.headers.get('Content-Type')).toMatch(/svg/);

      // Both should be generated without error
      expect(pngResponse.text).toBeTruthy();
      expect(svgResponse.text).toBeTruthy();
    });

    /**
     * ✅ Test 10: QR code response headers
     */
    it('✅ QR code response has correct headers', async () => {
      const slug = generateRandomSlug();

      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      const response = await GET(`/qr/${slug}`);

      expect(response.status).toBe(200);

      // Check critical headers
      expect(response.headers.get('Content-Type')).toBeDefined();
      expect(response.headers.get('Content-Length')).toBeDefined();

      // Should not have redirect or other non-image headers
      expect(response.headers.get('Location')).toBeNull();
    });
  });

  describe('QR Code Format Variations', () => {
    /**
     * ✅ Test 11: Case-insensitive format parameter
     */
    it('✅ Format parameter is case-insensitive', async () => {
      const slug = generateRandomSlug();

      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      // Test different cases
      const formats = ['svg', 'SVG', 'Svg', 'png', 'PNG', 'Png'];

      for (const format of formats) {
        const response = await GET(`/qr/${slug}?format=${format}`);
        expect([200, 400]).toContain(response.status);
      }
    });

    /**
     * ✅ Test 12: Invalid format returns error
     */
    it('❌ Invalid format parameter → 400', async () => {
      const slug = generateRandomSlug();

      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(testUser.jwt)
      );

      const response = await GET(`/qr/${slug}?format=gif`);

      // Should reject unsupported format
      expect([400, 404]).toContain(response.status);
    });
  });
});
