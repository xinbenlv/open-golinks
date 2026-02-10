import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  POST,
  GET,
  createTestUser,
  mockTurnstileToken,
  generateRandomSlug,
  authHeader,
  resetTestDatabase,
} from './setup';

/**
 * Integration Tests: Link Transfer/Ownership
 * Tests for POST /api/v1/links/{slug}/transfer endpoint
 * 3 test cases covering transfers, permissions, and state changes
 */

describe('Feature: Link Transfer', () => {
  let user1: Awaited<ReturnType<typeof createTestUser>>;
  let user2: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user1 = await createTestUser('transfer-user1@example.com');
    user2 = await createTestUser('transfer-user2@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('Successful Transfer', () => {
    /**
     * ✅ Test 1: Owner transfers link to another user
     * - User1 creates link
     * - User1 transfers to User2
     * - Should return 200
     * - ownerId should change to User2
     * - User2 should now be able to modify
     */
    it('✅ Owner transfers to another user → 200, ownerId changed', async () => {
      const slug = generateRandomSlug();

      // Create link as user1
      const createResponse = await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(user1.jwt)
      );

      expect(createResponse.body.data.ownerId).toBe(user1.id);

      // Transfer to user2
      const transferResponse = await POST(
        `/links/${slug}/transfer`,
        {
          toUserId: user2.id,
        },
        authHeader(user1.jwt)
      );

      expect(transferResponse.status).toBe(200);
      expect(transferResponse.body.success).toBe(true);
      expect(transferResponse.body.data.ownerId).toBe(user2.id);
      expect(transferResponse.body.data.slug).toBe(slug);
    });

    /**
     * ✅ Test 2: Transferred user can modify the link
     * - User1 creates and transfers to User2
     * - User2 should be able to update URL
     * - User1 should no longer be able to modify
     */
    it('✅ Transferred user can modify, previous owner cannot', async () => {
      const slug = generateRandomSlug();

      // Create link as user1
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(user1.jwt)
      );

      // Transfer to user2
      await POST(
        `/links/${slug}/transfer`,
        { toUserId: user2.id },
        authHeader(user1.jwt)
      );

      // User2 can update
      const updateAsUser2 = await POST(
        `/links/${slug}`,
        {
          url: 'https://user2-updated.example.com',
        },
        authHeader(user2.jwt)
      );

      expect(updateAsUser2.status).toBe(200);
      expect(updateAsUser2.body.data.url).toBe('https://user2-updated.example.com');

      // User1 cannot update
      const updateAsUser1 = await POST(
        `/links/${slug}`,
        {
          url: 'https://user1-update-attempt.example.com',
        },
        authHeader(user1.jwt)
      );

      expect(updateAsUser1.status).toBe(403);
      expect(updateAsUser1.body.error.code).toBe('OWNERSHIP_REQUIRED');
    });

    /**
     * ✅ Test 3: Transfer creates audit log
     * - Create and transfer link
     * - Verify TRANSFER audit log entry exists
     */
    it('✅ Transfer creates audit log entry', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(user1.jwt)
      );

      // Transfer
      await POST(
        `/links/${slug}/transfer`,
        { toUserId: user2.id },
        authHeader(user1.jwt)
      );

      // Check audit logs
      const auditResponse = await GET(
        `/links/${slug}/audit`,
        authHeader(user2.jwt)
      );

      expect(auditResponse.status).toBe(200);

      const logs = auditResponse.body.data.logs;
      const transferLog = logs.find((log: any) => log.action === 'TRANSFER');

      expect(transferLog).toBeDefined();
      expect(transferLog.actorId).toBe(user1.id);
      expect(transferLog.metadata?.fromOwnerId).toBe(user1.id);
      expect(transferLog.metadata?.toOwnerId).toBe(user2.id);
    });
  });

  describe('Permission Tests', () => {
    /**
     * ❌ Test 4: Non-owner cannot transfer → 403 OWNERSHIP_REQUIRED
     * - User1 creates link
     * - User2 tries to transfer
     * - Should return 403
     */
    it('❌ Non-owner transfer → 403 OWNERSHIP_REQUIRED', async () => {
      const slug = generateRandomSlug();

      // Create link as user1
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(user1.jwt)
      );

      // User2 tries to transfer
      const transferResponse = await POST(
        `/links/${slug}/transfer`,
        { toUserId: user2.id },
        authHeader(user2.jwt)
      );

      expect(transferResponse.status).toBe(403);
      expect(transferResponse.body.error.code).toBe('OWNERSHIP_REQUIRED');
    });

    /**
     * ❌ Test 5: Cannot transfer to self
     * - Create link
     * - Transfer to self
     * - Should return error
     */
    it('❌ Cannot transfer to self', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(user1.jwt)
      );

      // Try to transfer to self
      const transferResponse = await POST(
        `/links/${slug}/transfer`,
        { toUserId: user1.id },
        authHeader(user1.jwt)
      );

      expect(transferResponse.status).toBe(400);
      expect(transferResponse.body.error).toBeDefined();
    });
  });

  describe('Anonymous Link Transfer', () => {
    /**
     * ❌ Test 6: Anonymous link cannot be transferred → 403 CANNOT_TRANSFER
     * - Create anonymous link
     * - Try to transfer (even with fingerprint auth)
     * - Should return 403
     */
    it('❌ Anonymous link transfer → 403 CANNOT_TRANSFER', async () => {
      const slug = generateRandomSlug();

      // Create anonymous link
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Try to transfer anonymous link
      const transferResponse = await POST(
        `/links/${slug}/transfer`,
        { toUserId: user1.id },
        // No auth - anonymous link has no owner
        undefined
      );

      expect(transferResponse.status).toBe(401);
    });

    /**
     * ❌ Test 7: Cannot transfer anonymous link even after claiming
     * - Create anonymous link
     * - Claim it (User1 becomes owner)
     * - Try to transfer to User2 then back to anonymous
     * - Should fail
     */
    it('✅ Claimed anonymous link can be transferred', async () => {
      const slug = generateRandomSlug();

      // Create anonymous link
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Claim it
      const claimResponse = await POST(
        `/links/${slug}/claim`,
        {},
        authHeader(user1.jwt)
      );

      expect(claimResponse.body.data.ownerId).toBe(user1.id);

      // Now it can be transferred
      const transferResponse = await POST(
        `/links/${slug}/transfer`,
        { toUserId: user2.id },
        authHeader(user1.jwt)
      );

      expect(transferResponse.status).toBe(200);
      expect(transferResponse.body.data.ownerId).toBe(user2.id);
    });
  });

  describe('Transfer Validation', () => {
    /**
     * ❌ Test 8: Transfer to non-existent user
     */
    it('❌ Transfer to non-existent user → 400', async () => {
      const slug = generateRandomSlug();

      // Create link
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(user1.jwt)
      );

      // Try to transfer to invalid user ID
      const transferResponse = await POST(
        `/links/${slug}/transfer`,
        { toUserId: 'nonexistent-user-id' },
        authHeader(user1.jwt)
      );

      expect(transferResponse.status).toBe(400);
      expect(transferResponse.body.error).toBeDefined();
    });

    /**
     * ❌ Test 9: Transfer non-existent link
     */
    it('❌ Transfer non-existent link → 404', async () => {
      const transferResponse = await POST(
        '/links/nonexistent/transfer',
        { toUserId: user2.id },
        authHeader(user1.jwt)
      );

      expect(transferResponse.status).toBe(404);
      expect(transferResponse.body.error.code).toBe('LINK_NOT_FOUND');
    });
  });

  describe('Transfer Chain', () => {
    /**
     * ✅ Test 10: Transfer through chain of users
     * - User1 creates link
     * - Transfers to User2
     * - User2 transfers to... User1 (circular)
     * - Should work fine
     */
    it('✅ Transfer chain works correctly', async () => {
      const slug = generateRandomSlug();

      // Create as User1
      let response = await POST(
        '/links',
        { slug, url: 'https://example.com' },
        authHeader(user1.jwt)
      );
      expect(response.body.data.ownerId).toBe(user1.id);

      // Transfer to User2
      response = await POST(
        `/links/${slug}/transfer`,
        { toUserId: user2.id },
        authHeader(user1.jwt)
      );
      expect(response.body.data.ownerId).toBe(user2.id);

      // Transfer back to User1
      response = await POST(
        `/links/${slug}/transfer`,
        { toUserId: user1.id },
        authHeader(user2.jwt)
      );
      expect(response.body.data.ownerId).toBe(user1.id);

      // Verify final state
      const getResponse = await GET(
        `/api/v1/links/${slug}`,
        authHeader(user1.jwt)
      );
      expect(getResponse.body.data.ownerId).toBe(user1.id);
    });
  });

  describe('Transfer with Link Modifications', () => {
    /**
     * ✅ Test 11: Transfer preserves link state
     * - Create link with metadata
     * - Transfer it
     * - Verify all metadata and data preserved
     */
    it('✅ Transfer preserves all link data', async () => {
      const slug = generateRandomSlug();
      const metadata = {
        title: 'Important Link',
        tags: ['archived', 'important'],
        showWarning: true,
      };

      // Create with metadata
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
          metadata,
        },
        authHeader(user1.jwt)
      );

      // Transfer
      const transferResponse = await POST(
        `/links/${slug}/transfer`,
        { toUserId: user2.id },
        authHeader(user1.jwt)
      );

      // Verify metadata preserved
      expect(transferResponse.body.data.metadata.title).toBe(metadata.title);
      expect(transferResponse.body.data.metadata.tags).toEqual(metadata.tags);
      expect(transferResponse.body.data.metadata.showWarning).toBe(metadata.showWarning);
      expect(transferResponse.body.data.url).toBe('https://example.com');
    });
  });
});
