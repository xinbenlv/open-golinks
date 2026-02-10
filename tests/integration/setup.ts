import { beforeAll, afterEach, vi } from 'vitest';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Integration Test Setup and Utilities
 * Provides test helpers for API testing with Fetch API
 */

// Test configuration
const API_BASE_URL = 'http://localhost:3001/api/v1';
const TEST_TIMEOUT = 30000;

// Mock Turnstile token
const MOCK_TURNSTILE_TOKEN = 'mock-token-xyz-success-123';

/**
 * Test user credentials
 */
export interface TestUser {
  id: string;
  email: string;
  jwt: string;
  fingerprint?: string;
}

/**
 * Mock Turnstile token response
 */
export function mockTurnstileToken(): string {
  return MOCK_TURNSTILE_TOKEN;
}

/**
 * Create test user with JWT token
 * In a real scenario, this would call Supabase Auth API
 */
export async function createTestUser(email: string): Promise<TestUser> {
  // Mock user creation - in production this would call real auth service
  const userId = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke3VzZXJJZH0iLCJlbWFpbCI6IiR7ZW1haWx9IiwiaWF0IjoxNTE2MjM5MDIyfQ.mock-signature-${Math.random()}`;

  return {
    id: userId,
    email,
    jwt: mockJwt,
    fingerprint: `fp-${Math.random().toString(36).substr(2, 9)}`,
  };
}

/**
 * API request wrapper with fetch
 */
async function apiRequest<T = any>(
  method: string,
  endpoint: string,
  body?: any,
  headers?: Record<string, string>,
  options?: { followRedirects?: boolean }
): Promise<{
  status: number;
  body: T;
  headers: Headers;
  text: string;
}> {
  const url = `${API_BASE_URL}${endpoint}`;
  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: options?.followRedirects ? 'follow' : 'manual',
  };

  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();

    let parsedBody: T;
    try {
      parsedBody = text ? JSON.parse(text) : ({} as T);
    } catch {
      parsedBody = text as any;
    }

    return {
      status: response.status,
      body: parsedBody,
      headers: response.headers,
      text,
    };
  } catch (error) {
    throw new Error(`API request failed: ${method} ${endpoint}: ${error}`);
  }
}

/**
 * GET request helper
 */
export async function GET<T = any>(
  endpoint: string,
  headers?: Record<string, string>,
  options?: { followRedirects?: boolean }
) {
  return apiRequest<T>('GET', endpoint, undefined, headers, options);
}

/**
 * POST request helper
 */
export async function POST<T = any>(
  endpoint: string,
  body?: any,
  headers?: Record<string, string>
) {
  return apiRequest<T>('POST', endpoint, body, headers);
}

/**
 * PUT request helper
 */
export async function PUT<T = any>(
  endpoint: string,
  body?: any,
  headers?: Record<string, string>
) {
  return apiRequest<T>('PUT', endpoint, body, headers);
}

/**
 * PATCH request helper
 */
export async function PATCH<T = any>(
  endpoint: string,
  body?: any,
  headers?: Record<string, string>
) {
  return apiRequest<T>('PATCH', endpoint, body, headers);
}

/**
 * DELETE request helper
 */
export async function DELETE<T = any>(
  endpoint: string,
  headers?: Record<string, string>
) {
  return apiRequest<T>('DELETE', endpoint, undefined, headers);
}

/**
 * Helper to add auth header for authenticated requests
 */
export function authHeader(jwt: string): Record<string, string> {
  return {
    Authorization: `Bearer ${jwt}`,
  };
}

/**
 * Generate random slug for testing
 */
export function generateRandomSlug(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Get client IP (for testing purposes)
 */
export function getTestClientIP(): string {
  return '127.0.0.1';
}

/**
 * Generate fingerprint for anonymous user
 */
export function generateFingerprint(): string {
  const userAgent = 'test-ua';
  const ip = getTestClientIP();
  // Simplified fingerprint for testing
  return `fp-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clear test database (reset state between tests)
 * This is a mock implementation - in production would use actual DB connection
 */
export async function clearTestDatabase(): Promise<void> {
  // In a real scenario, this would:
  // 1. Connect to test database
  // 2. Clear relevant tables (respecting foreign keys)
  // 3. Reset sequences
  // 4. Disconnect

  // For now, we'll rely on test isolation via unique test data
  await new Promise((resolve) => setTimeout(resolve, 10));
}

/**
 * Reset database state after each test
 */
export async function resetTestDatabase(): Promise<void> {
  await clearTestDatabase();
}

/**
 * Setup fixtures: creates commonly used test data
 */
export async function setupFixtures() {
  // Create fixture users
  const user1 = await createTestUser('fixture-user1@example.com');
  const user2 = await createTestUser('fixture-user2@example.com');
  const adminUser = await createTestUser('fixture-admin@example.com');

  return { user1, user2, adminUser };
}

/**
 * Global setup for all integration tests
 */
export async function setupIntegrationTests() {
  // Set test environment variables
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001';
  process.env.IP_HASH_SALT = 'test-salt-integration-12345678';

  // Mock global fetch if needed (it's already global in Node 18+)
  if (typeof global.fetch === 'undefined') {
    global.fetch = fetch;
  }

  // Wait for test server to be ready
  let retries = 10;
  while (retries > 0) {
    try {
      const response = await fetch('http://localhost:3001/api/v1/health');
      if (response.ok) {
        console.log('✓ Test server is ready');
        break;
      }
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.warn('⚠ Test server health check failed, proceeding anyway');
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Test assertions helper
 */
export const testAssert = {
  /**
   * Assert response has error with code
   */
  hasErrorCode(body: any, expectedCode: string) {
    if (!body.error || body.error.code !== expectedCode) {
      throw new Error(`Expected error code ${expectedCode}, got ${body?.error?.code}`);
    }
  },

  /**
   * Assert response is successful
   */
  isSuccess(body: any) {
    if (!body.success) {
      throw new Error(`Expected success: true, got ${body?.success}`);
    }
  },

  /**
   * Assert response has data
   */
  hasData(body: any) {
    if (!body.data) {
      throw new Error(`Expected response to have data property`);
    }
  },

  /**
   * Assert field value
   */
  fieldEquals(body: any, path: string, expected: any) {
    const parts = path.split('.');
    let value = body;
    for (const part of parts) {
      value = value?.[part];
    }
    if (value !== expected) {
      throw new Error(`Expected ${path} to be ${expected}, got ${value}`);
    }
  },

  /**
   * Assert field type
   */
  fieldIsType(body: any, path: string, expectedType: string) {
    const parts = path.split('.');
    let value = body;
    for (const part of parts) {
      value = value?.[part];
    }
    const actualType = typeof value;
    if (actualType !== expectedType) {
      throw new Error(`Expected ${path} to be ${expectedType}, got ${actualType}`);
    }
  },
};

/**
 * Test data builders
 */
export const testData = {
  /**
   * Create valid link request
   */
  validLink(overrides?: any) {
    return {
      slug: generateRandomSlug(),
      url: 'https://example.com',
      turnstileToken: mockTurnstileToken(),
      ...overrides,
    };
  },

  /**
   * Create link with metadata
   */
  linkWithMetadata(overrides?: any) {
    return {
      slug: generateRandomSlug(),
      url: 'https://example.com',
      turnstileToken: mockTurnstileToken(),
      metadata: {
        title: 'Test Link',
        tags: ['test', 'integration'],
        showWarning: false,
        ...overrides?.metadata,
      },
      ...overrides,
    };
  },

  /**
   * Create claim request
   */
  claimRequest(slug: string, overrides?: any) {
    return {
      slug,
      ...overrides,
    };
  },

  /**
   * Create update request
   */
  updateRequest(overrides?: any) {
    return {
      url: 'https://updated.example.com',
      ...overrides,
    };
  },
};

/**
 * Concurrency test helper
 * Run multiple async operations concurrently
 */
export async function concurrentRequests<T>(
  operations: (() => Promise<T>)[],
  expectedSuccessCount?: number
): Promise<{
  results: (T | Error)[];
  successCount: number;
  failureCount: number;
}> {
  const results = await Promise.allSettled(
    operations.map((op) => op())
  );

  const successCount = results.filter((r) => r.status === 'fulfilled').length;
  const failureCount = results.filter((r) => r.status === 'rejected').length;

  const values = results.map((r) =>
    r.status === 'fulfilled' ? r.value : (r.reason instanceof Error ? r.reason : new Error(String(r.reason)))
  );

  if (expectedSuccessCount !== undefined && successCount !== expectedSuccessCount) {
    throw new Error(
      `Expected ${expectedSuccessCount} successes, got ${successCount}`
    );
  }

  return {
    results: values,
    successCount,
    failureCount,
  };
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const result = await Promise.resolve(condition());
      if (result) return;
    } catch (error) {
      // Continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Export test constants
 */
export const TEST_CONFIG = {
  API_BASE_URL,
  TEST_TIMEOUT,
  MOCK_TURNSTILE_TOKEN,
};

/**
 * Setup hooks (run once before all tests)
 */
beforeAll(async () => {
  await setupIntegrationTests();
}, TEST_TIMEOUT);

/**
 * Cleanup hooks (run after each test)
 */
afterEach(async () => {
  await resetTestDatabase();
});
