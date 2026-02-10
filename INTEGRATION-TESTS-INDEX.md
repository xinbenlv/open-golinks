# Integration Tests - Quick Reference

## Overview
Complete integration test suite for Phase 2 with **136+ test cases** across **12 files**.

📊 **Stats:** 5,216 lines of test code | 11 test suites | 1 setup module

## Test Files Quick Links

### Setup & Utilities
- **[setup.ts](./tests/integration/setup.ts)** (445 lines)
  - Test user creation and authentication
  - API request helpers (GET, POST, PUT, DELETE)
  - Test data builders and fixtures
  - Concurrency testing utilities
  - Assertion helpers

### Feature Tests

#### Links Management
1. **[links.create.test.ts](./tests/integration/links.create.test.ts)** - 15 cases
   - Anonymous creation with/without Turnstile
   - Authenticated creation (skips Turnstile)
   - Auto-slug generation
   - Metadata handling
   - Slug validation (reserved, duplicate, format)
   - URL validation (private IP, missing protocol)

2. **[links.update.test.ts](./tests/integration/links.update.test.ts)** - 11 cases
   - Owner URL updates
   - Metadata updates
   - URL history tracking (JSONB)
   - Permission enforcement
   - Validation errors
   - Idempotent updates

3. **[links.delete.test.ts](./tests/integration/links.delete.test.ts)** - 11 cases
   - Soft delete with deletedAt
   - Exclusion from list queries
   - Data preservation
   - Permission enforcement
   - Audit logging
   - 410 GONE for deleted links

4. **[links.resolve.test.ts](./tests/integration/links.resolve.test.ts)** - 13 cases
   - 302 redirects with Location header
   - Visit count tracking (atomic)
   - Concurrent visit handling (10, 100+)
   - Non-existent (404) and deleted (410)
   - Query parameter preservation
   - Anonymous vs authenticated links

#### Advanced Operations
5. **[links.claim.test.ts](./tests/integration/links.claim.test.ts)** - 8 cases
   - Claiming anonymous links
   - Concurrent claims (1 succeeds, 9 fail)
   - Permission checks
   - Audit log creation
   - State transitions

6. **[links.transfer.test.ts](./tests/integration/links.transfer.test.ts)** - 11 cases
   - Ownership transfer
   - State preservation after transfer
   - Permission enforcement
   - Transfer chains
   - Anonymous link restrictions
   - Audit logging with metadata

7. **[links.batch.test.ts](./tests/integration/links.batch.test.ts)** - 10 cases
   - Batch creation (3, 50 links)
   - Mixed success/failure handling
   - Batch size validation (max 100)
   - Individual audit logging
   - Response structure
   - Transaction semantics

#### Data & Logging
8. **[audit.test.ts](./tests/integration/audit.test.ts)** - 13 cases
   - Log structure (id, action, timestamp, diff)
   - CREATE/UPDATE/DELETE/VISIT/TRANSFER actions
   - Diff information (before/after/changes)
   - IP hashing (SHA-256)
   - IP masking (privacy)
   - Pagination and filtering
   - Timestamp ordering

9. **[stats.test.ts](./tests/integration/stats.test.ts)** - 13 cases
   - User stats (links, visits)
   - Regex filtering with validation
   - Link analytics (daily visits)
   - Concurrent aggregation
   - Global admin stats
   - Sorting and date range filtering

#### Additional Features
10. **[qr.test.ts](./tests/integration/qr.test.ts)** - 12 cases
    - PNG format (default)
    - SVG format with headers
    - Custom size parameters
    - Short URL encoding
    - Error correction levels
    - Caching headers
    - Format validation

11. **[error-handling.test.ts](./tests/integration/error-handling.test.ts)** - 19 cases
    - Response format validation
    - Error code matching
    - HTTP status codes (400, 401, 403, 404, 409, 429, 500)
    - 404 vs 410 distinction
    - Rate limiting (429)
    - Database errors (generic)
    - Input validation
    - Concurrency errors
    - Authentication errors

## Running Tests

```bash
# All integration tests
npm test tests/integration

# Specific file
npm test tests/integration/links.create.test.ts

# Watch mode
npm test -- --watch tests/integration

# Coverage report
npm test -- --coverage tests/integration

# UI dashboard
npm test -- --ui tests/integration
```

## Key Testing Patterns

### Concurrency Testing
```typescript
const operations = Array.from({ length: 10 }, () => async () => {
  return POST(`/links/${slug}/claim`, {}, authHeader(user.jwt));
});

const results = await concurrentRequests(operations, 10);
// Exactly 1 succeeds (201), 9 fail (409)
```

### URL History Verification
```typescript
const response = await PUT(`/links/${slug}`, { url: 'new-url' });
expect(response.body.data.urlHistory).toContainEqual({
  url: 'old-url',
  changedAt: ISO_TIMESTAMP,
  changedBy: USER_ID
});
```

### Atomic Visit Counting
```typescript
// 100 concurrent visits
const visitOps = Array.from({ length: 100 }, () => 
  async () => GET(`/${slug}`, undefined, { followRedirects: false })
);

await concurrentRequests(visitOps, 100);
// Exactly 100 visits counted, no race conditions
```

## Test Utilities Summary

### API Methods
```typescript
GET(endpoint, headers?, {followRedirects?})
POST(endpoint, body, headers?)
PUT(endpoint, body, headers?)
DELETE(endpoint, headers?)
```

### Helpers
```typescript
createTestUser(email) → {id, jwt}
mockTurnstileToken() → "mock-token-xyz"
generateRandomSlug() → "test-xxx-yyy"
authHeader(jwt) → {Authorization: "Bearer ..."}
resetTestDatabase() → Promise
```

### Test Data
```typescript
testData.validLink()
testData.linkWithMetadata()
testData.claimRequest(slug)
testData.updateRequest()
```

### Advanced
```typescript
concurrentRequests(operations[], expectedSuccessCount?)
waitFor(condition, timeout, interval)
testAssert.{hasErrorCode, isSuccess, hasData, fieldEquals, ...}
```

## Coverage Summary

| Feature | Test Cases | Status |
|---------|-----------|--------|
| Link Creation | 15 | ✅ |
| Link Claiming | 8 | ✅ |
| Link Updates | 11 | ✅ |
| Link Deletion | 11 | ✅ |
| Link Resolution | 13 | ✅ |
| Link Transfer | 11 | ✅ |
| Batch Operations | 10 | ✅ |
| Audit Logging | 13 | ✅ |
| Statistics | 13 | ✅ |
| QR Codes | 12 | ✅ |
| Error Handling | 19 | ✅ |
| **TOTAL** | **136+** | **✅** |

## Error Codes Tested

✅ TURNSTILE_REQUIRED
✅ TURNSTILE_VERIFICATION_FAILED
✅ SLUG_RESERVED
✅ SLUG_TOO_SHORT
✅ SLUG_TOO_LONG
✅ SLUG_INVALID_FORMAT
✅ SLUG_ALREADY_EXISTS
✅ URL_MISSING_PROTOCOL
✅ URL_PRIVATE_IP_BLOCKED
✅ LINK_NOT_FOUND
✅ LINK_ALREADY_CLAIMED
✅ UNAUTHORIZED
✅ OWNERSHIP_REQUIRED
✅ INVALID_REGEX
✅ BATCH_SIZE_EXCEEDED
✅ RATE_LIMITED
✅ INVALID_REQUEST
✅ And more...

## HTTP Status Codes Tested

✅ 201 Created
✅ 200 OK
✅ 302 Found (redirects)
✅ 400 Bad Request
✅ 401 Unauthorized
✅ 403 Forbidden
✅ 404 Not Found
✅ 409 Conflict
✅ 410 Gone
✅ 429 Too Many Requests
✅ 500 Internal Server Error

## Documentation

- [PHASE2-INTEGRATION-TESTS.md](./PHASE2-INTEGRATION-TESTS.md) - Comprehensive guide
- [INTEGRATION-TESTS-SUMMARY.txt](./INTEGRATION-TESTS-SUMMARY.txt) - Executive summary
- This file - Quick reference

## Quick Start

1. **Ensure server is running:**
   ```bash
   npm run dev  # Starts on port 3001
   ```

2. **Run tests:**
   ```bash
   npm test tests/integration
   ```

3. **Check coverage:**
   ```bash
   npm test -- --coverage tests/integration
   ```

## Notes

- All tests use real database (not mocked)
- Turnstile is mocked for testing
- JWT tokens are generated for test users
- Tests are isolated and can run in parallel
- IP hashing uses SHA-256 (salted)
- Soft deletes preserve data
- Audit logs are immutable
- No test interdependencies

## Files Reference

| File | Lines | Tests | Purpose |
|------|-------|-------|---------|
| setup.ts | 445 | - | Utilities |
| links.create.test.ts | 394 | 15 | Creation |
| links.claim.test.ts | 304 | 8 | Claiming |
| links.update.test.ts | 438 | 11 | Updates |
| links.delete.test.ts | 379 | 11 | Deletion |
| links.resolve.test.ts | 438 | 13 | Resolution |
| links.transfer.test.ts | 419 | 11 | Transfer |
| links.batch.test.ts | 418 | 10 | Batch |
| audit.test.ts | 564 | 13 | Audit |
| stats.test.ts | 477 | 13 | Stats |
| qr.test.ts | 365 | 12 | QR Codes |
| error-handling.test.ts | 575 | 19 | Errors |
| **TOTAL** | **5,216** | **136+** | **Complete** |

---

**Status:** ✅ Production Ready
**Version:** Phase 2 Complete
**Last Updated:** 2026-02-09
