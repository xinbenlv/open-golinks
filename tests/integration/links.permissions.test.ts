import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  POST,
  PUT,
  DELETE,
  GET,
  createTestUser,
  mockTurnstileToken,
  generateRandomSlug,
  authHeader,
  resetTestDatabase,
  TEST_CONFIG,
} from './setup';

/**
 * Integration Tests: Link Permissions
 *
 * Tests for critical permission scenarios:
 * 1. Anonymous links cannot be modified without claiming
 * 2. Only owners can edit/delete links
 * 3. Deleted slugs can only be reused by original owner
 * 4. Deleted slugs block other users from recreating
 *
 * These tests verify the security fixes for the vulnerability where
 * anonymous users could modify anonymous links (ownerId === null comparison bug)
 */

describe('Feature: Link Permission Controls', () => {
  let user1: Awaited<ReturnType<typeof createTestUser>>;
  let user2: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user1 = await createTestUser('perm-user1@example.com');
    user2 = await createTestUser('perm-user2@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('Scenario 1: Anonymous Link Protection', () => {
    /**
     * ❌ Anonymous users CANNOT modify anonymous links (core security fix)
     * - Create anonymous link
     * - Unauthenticated PUT should return 403 ANONYMOUS_LINK_MODIFICATION_FORBIDDEN
     * - Unauthenticated DELETE should return 403 ANONYMOUS_LINK_MODIFICATION_FORBIDDEN
     */
    it('❌ Anonymous PUT to anonymous link → 403 FORBIDDEN', async () => {
      // Step 1: Create anonymous link
      const slug = generateRandomSlug();
      const createResponse = await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.ownerId).toBeUndefined();

      // Step 2: Unauthenticated user tries to modify
      const updateResponse = await PUT(`/links/${slug}`, {
        url: 'https://malicious.com',
      });

      expect(updateResponse.status).toBe(403);
      expect(updateResponse.body.success).toBe(false);
      expect(updateResponse.body.error.code).toBe(
        'ANONYMOUS_LINK_MODIFICATION_FORBIDDEN'
      );
    });

    it('❌ Anonymous DELETE to anonymous link → 403 FORBIDDEN', async () => {
      // Step 1: Create anonymous link
      const slug = generateRandomSlug();
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Step 2: Unauthenticated user tries to delete
      const deleteResponse = await DELETE(`/links/${slug}`);

      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.success).toBe(false);
      expect(deleteResponse.body.error.code).toBe(
        'ANONYMOUS_LINK_MODIFICATION_FORBIDDEN'
      );
    });

    /**
     * ✅ Authenticated user CANNOT modify anonymous link without claiming first
     */
    it('❌ Authenticated PUT to unclaimed anonymous link → 403 FORBIDDEN', async () => {
      // Step 1: Create anonymous link
      const slug = generateRandomSlug();
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Step 2: User1 tries to modify without claiming
      const updateResponse = await PUT(
        `/links/${slug}`,
        { url: 'https://hijacked.com' },
        authHeader(user1.jwt)
      );

      expect(updateResponse.status).toBe(403);
      expect(updateResponse.body.error.code).toBe(
        'ANONYMOUS_LINK_MODIFICATION_FORBIDDEN'
      );
    });

    /**
     * ✅ After claiming, user CAN modify the link
     */
    it('✅ Authenticated PUT after claim → 200 SUCCESS', async () => {
      // Step 1: Create anonymous link
      const slug = generateRandomSlug();
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Step 2: User1 claims ownership
      const claimResponse = await POST(
        `/links/${slug}/claim`,
        {},
        authHeader(user1.jwt)
      );
      expect(claimResponse.status).toBe(200);
      expect(claimResponse.body.data.ownerId).toBe(user1.id);

      // Step 3: User1 modifies the link
      const updateResponse = await PUT(
        `/links/${slug}`,
        { url: 'https://updated.com' },
        authHeader(user1.jwt)
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.url).toBe('https://updated.com');
    });

    /**
     * ✅ After claiming, user CAN delete the link
     */
    it('✅ Authenticated DELETE after claim → 200 SUCCESS', async () => {
      // Step 1: Create anonymous link
      const slug = generateRandomSlug();
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Step 2: User1 claims ownership
      await POST(`/links/${slug}/claim`, {}, authHeader(user1.jwt));

      // Step 3: User1 deletes the link
      const deleteResponse = await DELETE(
        `/links/${slug}`,
        authHeader(user1.jwt)
      );

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.data.deletedAt).toBeDefined();
    });
  });

  describe('Scenario 2: Owner-Only Modification', () => {
    /**
     * ❌ Non-owner cannot modify owned link
     */
    it('❌ Non-owner PUT to owned link → 403 FORBIDDEN', async () => {
      // Step 1: User1 creates owned link
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(user1.jwt)
      );

      // Step 2: User2 tries to modify
      const updateResponse = await PUT(
        `/links/${slug}`,
        { url: 'https://hijacked.com' },
        authHeader(user2.jwt)
      );

      expect(updateResponse.status).toBe(403);
      expect(updateResponse.body.error.code).toBe('FORBIDDEN');
    });

    /**
     * ❌ Non-owner cannot delete owned link
     */
    it('❌ Non-owner DELETE to owned link → 403 FORBIDDEN', async () => {
      // Step 1: User1 creates owned link
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(user1.jwt)
      );

      // Step 2: User2 tries to delete
      const deleteResponse = await DELETE(
        `/links/${slug}`,
        authHeader(user2.jwt)
      );

      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.error.code).toBe('FORBIDDEN');
    });

    /**
     * ✅ Owner CAN modify their own link
     */
    it('✅ Owner PUT to owned link → 200 SUCCESS', async () => {
      // Step 1: User1 creates owned link
      const slug = generateRandomSlug();
      const createResponse = await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(user1.jwt)
      );
      expect(createResponse.body.data.ownerId).toBe(user1.id);

      // Step 2: Owner modifies
      const updateResponse = await PUT(
        `/links/${slug}`,
        { url: 'https://updated.com' },
        authHeader(user1.jwt)
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.url).toBe('https://updated.com');
    });

    /**
     * ✅ Owner CAN delete their own link
     */
    it('✅ Owner DELETE to owned link → 200 SUCCESS', async () => {
      // Step 1: User1 creates owned link
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(user1.jwt)
      );

      // Step 2: Owner deletes
      const deleteResponse = await DELETE(
        `/links/${slug}`,
        authHeader(user1.jwt)
      );

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.data.deletedAt).toBeDefined();
    });
  });

  describe('Scenario 3: Deleted Slug Reuse Protection', () => {
    /**
     * ❌ Non-owner CANNOT reuse deleted slug
     */
    it('❌ Non-owner cannot reuse deleted slug → 403 DELETED_SLUG_FORBIDDEN', async () => {
      // Step 1: User1 creates, then deletes link
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://user1.com' },
        authHeader(user1.jwt)
      );
      await DELETE(`/links/${slug}`, authHeader(user1.jwt));

      // Step 2: User2 tries to reuse slug
      const recreateResponse = await POST(
        '/links',
        { slug, url: 'https://user2-hijack.com' },
        authHeader(user2.jwt)
      );

      expect(recreateResponse.status).toBe(403);
      expect(recreateResponse.body.error.code).toBe('DELETED_SLUG_FORBIDDEN');
    });

    /**
     * ✅ Original owner CAN reuse deleted slug (reactivate)
     */
    it('✅ Original owner can reuse deleted slug → 200 REACTIVATED', async () => {
      // Step 1: User1 creates, then deletes link
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://user1.com' },
        authHeader(user1.jwt)
      );
      await DELETE(`/links/${slug}`, authHeader(user1.jwt));

      // Step 2: User1 reactivates by recreating with same slug
      const recreateResponse = await POST(
        '/links',
        { slug, url: 'https://user1-new.com' },
        authHeader(user1.jwt)
      );

      expect(recreateResponse.status).toBe(200);
      expect(recreateResponse.body.data.message).toContain('reactivated');
      expect(recreateResponse.body.data.slug).toBe(slug);
      expect(recreateResponse.body.data.url).toBe('https://user1-new.com');
    });

    /**
     * ❌ Anonymous user CANNOT reuse deleted slug
     * (prevents hostile takeover after anonymous link deletion)
     */
    it('❌ Anonymous user cannot reuse deleted slug → 403 DELETED_SLUG_FORBIDDEN', async () => {
      // Step 1: User1 creates, then deletes link
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://user1.com' },
        authHeader(user1.jwt)
      );
      await DELETE(`/links/${slug}`, authHeader(user1.jwt));

      // Step 2: Anonymous user tries to reuse slug
      const recreateResponse = await POST('/links', {
        slug,
        url: 'https://hijacked.com',
        turnstileToken: mockTurnstileToken(),
      });

      expect(recreateResponse.status).toBe(403);
      expect(recreateResponse.body.error.code).toBe('DELETED_SLUG_FORBIDDEN');
    });

    /**
     * ✅ Owner CAN reuse slug multiple times
     */
    it('✅ Owner can reuse deleted slug multiple times', async () => {
      const slug = generateRandomSlug();

      // First cycle
      await POST(
        '/links',
        { slug, url: 'https://v1.com' },
        authHeader(user1.jwt)
      );
      await DELETE(`/links/${slug}`, authHeader(user1.jwt));

      const reactivate1 = await POST(
        '/links',
        { slug, url: 'https://v2.com' },
        authHeader(user1.jwt)
      );
      expect(reactivate1.status).toBe(200);

      // Second cycle
      await DELETE(`/links/${slug}`, authHeader(user1.jwt));

      const reactivate2 = await POST(
        '/links',
        { slug, url: 'https://v3.com' },
        authHeader(user1.jwt)
      );
      expect(reactivate2.status).toBe(200);
      expect(reactivate2.body.data.url).toBe('https://v3.com');
    });
  });

  describe('Scenario 4: Edge Cases and State Transitions', () => {
    /**
     * ✅ Verify state after deletion
     */
    it('✅ Deleted link cannot be accessed via GET (soft deleted)', async () => {
      // Step 1: User1 creates and deletes link
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(user1.jwt)
      );
      await DELETE(`/links/${slug}`, authHeader(user1.jwt));

      // Step 2: Try to access deleted link
      const getResponse = await GET(`/links/${slug}`, authHeader(user1.jwt));

      // Note: This should return 404 or 410 depending on implementation
      expect([404, 410]).toContain(getResponse.status);
    });

    /**
     * ✅ Verify reactivation preserves original owner
     */
    it('✅ Reactivation preserves original owner', async () => {
      // Step 1: User1 creates and deletes
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://user1.com' },
        authHeader(user1.jwt)
      );
      await DELETE(`/links/${slug}`, authHeader(user1.jwt));

      // Step 2: User1 reactivates
      const reactivateResponse = await POST(
        '/links',
        { slug, url: 'https://user1-new.com' },
        authHeader(user1.jwt)
      );

      // Step 3: Verify owner still user1
      expect(reactivateResponse.body.data.ownerId).toBe(user1.id);

      // Step 4: User2 still cannot modify
      const user2UpdateResponse = await PUT(
        `/links/${slug}`,
        { url: 'https://hijack.com' },
        authHeader(user2.jwt)
      );
      expect(user2UpdateResponse.status).toBe(403);
    });

    /**
     * ✅ Permission check happens before other validations
     */
    it('✅ Anonymous link check triggers before URL validation', async () => {
      // Step 1: Create anonymous link
      const slug = generateRandomSlug();
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Step 2: Try to update with invalid URL
      const updateResponse = await PUT(
        `/links/${slug}`,
        { url: 'invalid-url' }, // Not a valid HTTPS URL
        authHeader(user1.jwt)
      );

      // Should fail with permission error first, not URL validation
      expect(updateResponse.status).toBe(403);
      expect(updateResponse.body.error.code).toBe(
        'ANONYMOUS_LINK_MODIFICATION_FORBIDDEN'
      );
    });
  });

  describe('Scenario 5: Audit Trail Verification', () => {
    /**
     * ✅ Audit log captures ownership claims
     */
    it('✅ Audit log records ownership claim', async () => {
      // Step 1: Create anonymous link
      const slug = generateRandomSlug();
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Step 2: User1 claims
      await POST(`/links/${slug}/claim`, {}, authHeader(user1.jwt));

      // Step 3: Check audit log
      const auditResponse = await GET(
        `/links/${slug}/audit`,
        authHeader(user1.jwt)
      );

      expect(auditResponse.status).toBe(200);
      const claimLog = auditResponse.body.data.logs?.find(
        (log: any) => log.action === 'CLAIM'
      );
      expect(claimLog).toBeDefined();
    });

    /**
     * ✅ Audit log captures reactivation
     */
    it('✅ Audit log records link reactivation', async () => {
      // Step 1: Create and delete
      const slug = generateRandomSlug();
      await POST(
        '/links',
        { slug, url: 'https://v1.com' },
        authHeader(user1.jwt)
      );
      await DELETE(`/links/${slug}`, authHeader(user1.jwt));

      // Step 2: Reactivate
      const reactivateResponse = await POST(
        '/links',
        { slug, url: 'https://v2.com' },
        authHeader(user1.jwt)
      );
      expect(reactivateResponse.status).toBe(200);

      // Step 3: Check audit log for reactivation
      const auditResponse = await GET(
        `/links/${slug}/audit`,
        authHeader(user1.jwt)
      );

      expect(auditResponse.status).toBe(200);
      // Should have logs for CREATE, DELETE, and reactivation
      expect(auditResponse.body.data.logs?.length).toBeGreaterThanOrEqual(2);
    });
  });
});
