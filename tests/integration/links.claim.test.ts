import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  POST,
  GET,
  createTestUser,
  mockTurnstileToken,
  generateRandomSlug,
  authHeader,
  resetTestDatabase,
  concurrentRequests,
  TEST_CONFIG,
} from './setup';

/**
 * Integration Tests: Link Claiming
 * Tests for POST /api/v1/links/{slug}/claim endpoint
 * 6 test cases covering success, errors, and concurrency
 */

describe('Feature: Link Claiming', () => {
  let user1: Awaited<ReturnType<typeof createTestUser>>;
  let user2: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user1 = await createTestUser('claim-user1@example.com');
    user2 = await createTestUser('claim-user2@example.com');
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  describe('Successful Claiming', () => {
    /**
     * ✅ Test 1: Authenticated user claims anonymous link
     * - Create anonymous link
     * - User claims it with valid JWT
     * - Should return 200 with updated link ownership
     */
    it('✅ Authenticated user claims anonymous link → 200', async () => {
      // Step 1: Create anonymous link
      const slug = generateRandomSlug();
      const createResponse = await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.ownerId).toBeUndefined();

      // Step 2: User claims the link
      const claimResponse = await POST(
        `/links/${slug}/claim`,
        {},
        authHeader(user1.jwt)
      );

      expect(claimResponse.status).toBe(200);
      expect(claimResponse.body.success).toBe(true);
      expect(claimResponse.body.data.slug).toBe(slug);
      expect(claimResponse.body.data.ownerId).toBe(user1.id);
    });

    /**
     * ✅ Test 2: Verify link ownership after claim
     * - Create anonymous link
     * - Claim it
     * - Fetch link data to verify ownership
     */
    it('✅ Verify link ownership updated after claim', async () => {
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
      expect(claimResponse.status).toBe(200);

      // Verify ownership in claim response
      expect(claimResponse.body.data.ownerId).toBe(user1.id);
    });
  });

  describe('Error Scenarios', () => {
    /**
     * ❌ Test 3: Unauthenticated claim attempt → 401 UNAUTHORIZED
     * - Try to claim without JWT
     * - Should return 401
     */
    it('❌ Unauthenticated claim → 401 UNAUTHORIZED', async () => {
      const slug = generateRandomSlug();

      // Create anonymous link
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Try to claim without auth
      const claimResponse = await POST(`/links/${slug}/claim`, {});

      expect(claimResponse.status).toBe(401);
      expect(claimResponse.body.success).toBe(false);
      expect(claimResponse.body.error.code).toBe('UNAUTHORIZED');
    });

    /**
     * ❌ Test 4: Claim already-owned link → 409 LINK_ALREADY_CLAIMED
     * - Create link owned by user1
     * - Try to claim with user2
     * - Should return 409
     */
    it('❌ Claim already-owned link → 409 LINK_ALREADY_CLAIMED', async () => {
      const slug = generateRandomSlug();

      // Create link owned by user1
      await POST(
        '/links',
        {
          slug,
          url: 'https://example.com',
        },
        authHeader(user1.jwt)
      );

      // Try to claim with user2
      const claimResponse = await POST(
        `/links/${slug}/claim`,
        {},
        authHeader(user2.jwt)
      );

      expect(claimResponse.status).toBe(409);
      expect(claimResponse.body.success).toBe(false);
      expect(claimResponse.body.error.code).toBe('LINK_ALREADY_CLAIMED');
    });

    /**
     * ❌ Test 5: Claim non-existent link → 404 LINK_NOT_FOUND
     * - Try to claim with non-existent slug
     * - Should return 404
     */
    it('❌ Claim non-existent link → 404 LINK_NOT_FOUND', async () => {
      const nonExistentSlug = 'does-not-exist-xyz';

      const claimResponse = await POST(
        `/links/${nonExistentSlug}/claim`,
        {},
        authHeader(user1.jwt)
      );

      expect(claimResponse.status).toBe(404);
      expect(claimResponse.body.success).toBe(false);
      expect(claimResponse.body.error.code).toBe('LINK_NOT_FOUND');
    });
  });

  describe('Concurrency Tests', () => {
    /**
     * ✅ Test 6: Concurrent claims - 1 succeeds, 9 fail
     * - Create single anonymous link
     * - 10 users simultaneously try to claim it
     * - Exactly 1 should succeed (201), others should fail (409)
     * - Tests race condition handling and atomic operations
     */
    it('✅ Concurrent claims: 1 succeeds, 9 fail with 409', async () => {
      const slug = generateRandomSlug();

      // Create anonymous link
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Create 10 users
      const claimUsers = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          createTestUser(`claim-concurrent-${i}@example.com`)
        )
      );

      // Concurrent claim attempts
      const claimOperations = claimUsers.map((user) => async () => {
        return POST(`/links/${slug}/claim`, {}, authHeader(user.jwt));
      });

      const results = await concurrentRequests(claimOperations);

      // Check results
      const responses = results.results as any[];
      const successCount = responses.filter((r) => r.status === 200).length;
      const conflictCount = responses.filter((r) => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(9);

      // Verify successful claimer
      const successResponse = responses.find((r) => r.status === 200);
      expect(successResponse.body.data.ownerId).toBeDefined();

      // Verify failed claims have correct error
      responses
        .filter((r) => r.status === 409)
        .forEach((response) => {
          expect(response.body.error.code).toBe('LINK_ALREADY_CLAIMED');
        });
    });
  });

  describe('Audit Logging', () => {
    /**
     * ✅ Test 7: Claim creates audit log entry
     * - Create anonymous link
     * - Claim it
     * - Verify audit log entry exists with CLAIM action
     */
    it('✅ Claim audit log created with correct action', async () => {
      const slug = generateRandomSlug();

      // Create anonymous link
      await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Claim it
      await POST(`/links/${slug}/claim`, {}, authHeader(user1.jwt));

      // Fetch audit logs for this link
      const auditResponse = await GET(
        `/links/${slug}/audit`,
        authHeader(user1.jwt)
      );

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.body.data.logs).toBeDefined();

      // Find CLAIM action in audit logs
      const claimLog = auditResponse.body.data.logs.find(
        (log: any) => log.action === 'CLAIM'
      );

      expect(claimLog).toBeDefined();
      expect(claimLog.actorId).toBe(user1.id);
      expect(claimLog.linkSlug).toBe(slug);
      expect(claimLog.timestamp).toBeDefined();
    });
  });

  describe('State Transitions', () => {
    /**
     * ✅ Test 8: Verify state after successful claim
     * - Anonymous link before claim: ownerId is null
     * - After claim: ownerId is set to claiming user
     * - Link should be retrievable by owner
     */
    it('✅ Link state transitions correctly after claim', async () => {
      const slug = generateRandomSlug();

      // Create anonymous link
      const createResponse = await POST('/links', {
        slug,
        url: 'https://example.com',
        turnstileToken: mockTurnstileToken(),
      });

      // Verify anonymous ownership
      expect(createResponse.body.data.ownerId).toBeUndefined();

      // Claim it
      const claimResponse = await POST(
        `/links/${slug}/claim`,
        {},
        authHeader(user1.jwt)
      );

      // Verify new ownership
      expect(claimResponse.body.data.ownerId).toBe(user1.id);

      // Verify user can now modify the link
      const updateResponse = await POST(
        `/links/${slug}`,
        {
          url: 'https://updated.example.com',
        },
        authHeader(user1.jwt)
      );

      expect(updateResponse.status).toBe(200);
    });
  });
});
