# Google Analytics Backend Proxy - BFF Pattern

**Priority**: Post-Phase 3
**Status**: 📋 Ready for Implementation
**Type**: Security/Architecture Enhancement

## Problem

Currently GA_API_SECRET is exposed as `NEXT_PUBLIC_GA4_API_SECRET`, creating security risks:
- Secret visible to all clients (browser)
- Could be misused or rate-limited
- Not following BFF (Backend For Frontend) pattern
- Violates security best practices

## Solution Overview

Implement Backend For Frontend (BFF) pattern:
- Frontend calls own backend API
- Backend securely stores and uses GA credentials
- Backend proxies requests to Google Analytics

### Architecture

```
Browser ──> Own API ──> Google Analytics
            ↑
       (holds secrets)
```

## Implementation Plan

### Phase 1: Environment Setup

1. **Update `.env` file**:
```bash
# Remove (or comment out)
# NEXT_PUBLIC_GA4_API_SECRET=xxx

# Add (server-side only)
GA4_API_SECRET=xxx
GA4_MEASUREMENT_ID=G-XXXXX
```

### Phase 2: Create Proxy Endpoints

**File**: `src/app/api/v1/analytics/events/route.ts`

```typescript
/**
 * POST /api/v1/analytics/events
 * Proxy for Google Analytics Measurement Protocol
 * - Authenticates user
 * - Validates event data
 * - Forwards to GA with API Secret
 */
export async function POST(request: NextRequest) {
  // Validate user is authenticated
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Validate event data
  const body = await request.json();
  // ... validation ...

  // Forward to GA with server-side API Secret
  const response = await fetch(
    'https://www.google-analytics.com/mp/collect',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        measurement_id: process.env.GA4_MEASUREMENT_ID,
        api_secret: process.env.GA4_API_SECRET, // ✅ Server-side
        client_id: body.clientId,
        events: body.events,
      }),
    }
  );

  return NextResponse.json(await response.json());
}
```

**File**: `src/app/api/v1/analytics/stats/route.ts`

```typescript
/**
 * GET /api/v1/analytics/stats
 * Proxy for Google Analytics Data API
 * - Returns user's link statistics
 * - Uses Service Account on backend
 */
export async function GET(request: NextRequest) {
  // Validate user is authenticated
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user's links from database
  const links = await db.query.linksTable.findMany({
    where: eq(linksTable.ownerId, user.id),
  });

  // For each link, query GA Data API on backend
  const stats = await Promise.all(
    links.map(async (link) => {
      const data = await analyticsDataClient.runReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
          dimensions: [{ name: 'pagePath' }],
          dimensionFilter: {
            filter: {
              fieldName: 'pagePath',
              stringFilter: { matchType: 'EXACT', value: `/${link.slug}` },
            },
          },
        },
      });
      return { slug: link.slug, data };
    })
  );

  return NextResponse.json({ stats });
}
```

### Phase 3: Update Frontend

**Before**:
```typescript
// ❌ Directly calling GA with secret exposed
fetch('https://www.google-analytics.com/mp/collect', {
  method: 'POST',
  body: JSON.stringify({
    api_secret: process.env.NEXT_PUBLIC_GA4_API_SECRET, // ❌ EXPOSED!
    // ...
  })
});
```

**After**:
```typescript
// ✅ Calling own API
async function trackEvent(event) {
  const response = await fetch('/api/v1/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  return response.json();
}
```

### Phase 4: Environment Variables

**New structure**:
```bash
# Public (frontend-accessible)
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXX

# Private (server-only)
GA4_API_SECRET=your_secret
GA4_PROPERTY_ID=123456
GA4_SERVICE_ACCOUNT_KEY="{...json...}"
```

### Phase 5: Testing

- Unit tests for proxy endpoints
- Integration tests with mocked GA API
- Performance tests (latency overhead)
- Security tests (secret not exposed)

## Benefits

✅ **Security**: Secrets never exposed to clients
✅ **Flexibility**: Can add rate limiting, caching, logging
✅ **Audit**: Track all GA requests server-side
✅ **Performance**: Backend caching of stats
✅ **Scalability**: Server handles GA API complexity
✅ **Maintenance**: Easy to swap GA implementation

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Extra latency | Cache frequently accessed stats |
| GA API limits | Implement server-side rate limiting |
| Proxy becomes bottleneck | Async processing, queuing |
| Complex GA queries | Simplify queries, pre-compute |

## Implementation Timeline

- **Day 1-2**: Create proxy endpoints
- **Day 3**: Update frontend
- **Day 4**: Testing and validation
- **Day 5**: Deployment

## Alternatives Considered

1. **Measurement Protocol (Direct)** ✅ Choose this for event tracking
   - Pro: Simple, no backend needed
   - Con: Still need secret management

2. **OAuth2 (User-based)** ❌ Not suitable for SaaS
   - Pro: User controls access
   - Con: Requires user authorization

3. **Backend Proxy** ✅ RECOMMENDED for data queries
   - Pro: Secure, flexible, auditable
   - Con: Extra latency

## Success Criteria

✅ `GA4_API_SECRET` not exposed to frontend
✅ All GA calls routed through `/api/v1/analytics/*`
✅ Event tracking works with new endpoint
✅ Stats queries work with new endpoint
✅ Performance impact < 100ms
✅ No data loss during migration

## Notes

- Keep `NEXT_PUBLIC_GA4_MEASUREMENT_ID` public (no sensitive data)
- Use measurements Protocol for event sending (can be from browser with proper setup)
- Use Data API on backend for stats/reports
- Consider implementing caching to reduce GA API calls
