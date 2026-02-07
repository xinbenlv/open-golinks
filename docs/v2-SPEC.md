# Open GoLinks v2 - Technical Specification

**Version:** 2.0.0
**Date:** 2026-02-06
**Status:** Draft
**Architect:** Senior System Architect
**Model:** Claude Opus 4.6

---

## Executive Summary

Open GoLinks v2 modernizes the URL shortening service while preserving "Anonymous Create" philosophy. This specification defines requirements, acceptance criteria, and test cases for a secure, scalable system using 2026-stable technologies.

**Core Principle:** Zero-friction link creation with progressive security (Turnstile + Rate Limiting + Claim Flow).

---

## 1. Context & Legacy Analysis

### 1.1 Core Philosophy

**Anonymous Create:** Zero-friction link creation without authentication.
- **Preserve:** Instant utility, no onboarding barrier
- **Address:** Spam, ownership conflicts, compliance

### 1.2 Legacy Feature Parity (MongoDB + Express)

| Feature | V2 Strategy | Acceptance Criteria |
|---------|-------------|---------------------|
| **Anonymous Create** | ✅ KEEP with Turnstile | POST without auth succeeds with valid Turnstile token |
| **Claim Flow** | ✅ NEW | Authenticated user can claim anonymous link (solves legacy pain) |
| **Conflict Resolution** | ✅ NEW | Returns 409 for claimed slugs, 200 for claim success |
| **URL History** | ✅ KEEP | All URL changes logged in `audit_logs` + `url_history` JSONB |
| **Change History (Public)** | ✅ NEW | Public `/history/{slug}` page with IP masking rules |
| **Rate Limiting** | ✅ Cloudflare WAF | Handled at edge, no internal implementation |
| **Bot Protection** | ✅ Turnstile | Anonymous POST fails without valid Turnstile token |
| **Edge Caching** | ✅ UPGRADE | Redirect latency p95 < 100ms globally |
| **Redirect Warning** | ✅ KEEP | Opt-in per link, 5-second countdown before redirect |
| **QR Code** | ✅ KEEP | GET `/api/v1/qr/{slug}` returns PNG/SVG |
| **Auto-create UX** | ✅ KEEP | Missing slug redirects to `/edit/{slug}` |
| **Google Analytics** | ✅ KEEP | Track redirect and creation events |
| **Dashboard** | ✅ ENHANCED | User statistics, RegEx filter, edit buttons, analytics charts |

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 15.x (App Router) |
| Database | Supabase (Postgres) | 2.x |
| ORM | Drizzle ORM | 0.36+ |
| Auth | Supabase Auth | `@supabase/ssr` |
| Bot Protection | Cloudflare Turnstile | Latest |
| Rate Limiting | Cloudflare WAF | Latest |
| Analytics | Google Analytics | GA4 |
| Charts | Recharts / Chart.js | Latest |
| Testing | Vitest + Playwright + Storybook | Latest |
| Language | TypeScript | 5.x (strict) |

---

## 3. Feature Requirements

### 3.1 Anonymous Link Creation

**Requirement:** Unauthenticated users can create links with bot protection.

**Authorization Tiers:**
- **Anonymous:** Turnstile required, rate limit 5/hour (IP-based)
- **Authenticated:** Turnstile optional, rate limit 50/hour (user-based)
- **Admin:** No Turnstile, elevated permissions

**Acceptance Criteria:**

| Scenario | Expected Result |
|----------|-----------------|
| POST `/api/v1/links` without auth, without Turnstile token | 403 Forbidden with error code `TURNSTILE_REQUIRED` |
| POST `/api/v1/links` without auth, with valid Turnstile token | 201 Created with `owner_id = null` |
| POST `/api/v1/links` without auth, with invalid Turnstile token | 403 Forbidden with error code `TURNSTILE_INVALID` |
| POST `/api/v1/links` 6 times in 1 hour (anonymous) | 6th request returns 429 with `retry_after` field |
| POST `/api/v1/links` with valid JWT (authenticated) | 201 Created with `owner_id = <user_uuid>` |
| POST `/api/v1/links` 51 times in 1 hour (authenticated) | 51st request returns 429 |
| Anonymous link creation logs `created_by_fingerprint` | Audit log contains SHA-256 hash, not raw IP |
| Anonymous link creation with invalid URL format | 400 Bad Request with validation error |

### 3.2 Conflict Resolution & Claim Flow

**Requirement:** Explicit conflict handling when slug already exists.

**Rules:**
- Anonymous links (owner_id = null) can be claimed by authenticated users
- Owned links cannot be overwritten without permission
- Return clear error codes for conflict scenarios

**Acceptance Criteria:**

| Scenario | Expected Result |
|----------|-----------------|
| POST `/api/v1/links` for existing slug (anonymous → anonymous) | 409 Conflict with `SLUG_CONFLICT` error |
| POST `/api/v1/links/{slug}/claim` for anonymous link (authenticated user) | 200 OK, sets `owner_id = user.id`, logs CLAIM action |
| POST `/api/v1/links/{slug}/claim` for owned link | 403 Forbidden with `ALREADY_OWNED` error |
| PUT `/api/v1/links/{slug}` by owner | 200 OK, updates URL, logs UPDATE action with diff |
| PUT `/api/v1/links/{slug}` by non-owner | 403 Forbidden with `OWNERSHIP_REQUIRED` error |
| POST `/api/v1/links/{slug}/claim` for non-existent slug | 404 Not Found |
| Claim updates `url_history` JSONB array | Old URL appended to `url_history` with timestamp |

### 3.3 Link Resolution & Caching

**Requirement:** Fast, globally distributed redirect resolution with edge caching.

**Caching Strategy:**
- Cloudflare CDN: 5 minutes (static assets, QR codes)
- Vercel Edge: 60 seconds (link resolution)
- Database: Postgres with connection pooling

**Acceptance Criteria:**

| Scenario | Expected Result |
|----------|-----------------|
| GET `/{slug}` for existing link | 302 redirect to destination URL |
| GET `/{slug}` for non-existent slug | 302 redirect to `/edit/{slug}` (auto-create UX) |
| GET `/{slug}` increments visit count | Database `visits` field incremented by 1 (async) |
| GET `/{slug}` with `show_warning: true` | 10% probability redirect to `/warn/{slug}` |
| GET `/api/v1/resolve?slug={slug}` | 200 JSON response with `{slug, url, metadata}` |
| GET `/{slug}` p95 latency | < 100ms globally |
| Cache-Control header on redirect | `s-maxage=60, stale-while-revalidate=300` |

### 3.4 Redirect Warning Page

**Requirement:** Optional phishing protection with countdown before external redirect.

**Acceptance Criteria:**

| Scenario | Expected Result |
|----------|-----------------|
| GET `/warn/{slug}` displays countdown | 5-second countdown timer visible |
| Warning page shows destination URL | Destination URL displayed in `<code>` block |
| "Go Now" button bypasses countdown | Immediate redirect to destination |
| "Cancel" button returns to homepage | Redirect to `/` |
| Countdown reaches 0 | Auto-redirect to destination URL |

### 3.5 QR Code Generation

**Requirement:** Generate QR codes for go-links with customization options.

**Acceptance Criteria:**

| Scenario | Expected Result |
|----------|-----------------|
| GET `/api/v1/qr/{slug}` | Returns PNG QR code (400x400px default) |
| GET `/api/v1/qr/{slug}?size=200` | Returns 200x200px PNG |
| GET `/api/v1/qr/{slug}?format=svg` | Returns SVG QR code |
| GET `/api/v1/qr/{non-existent}` | 404 Not Found |
| QR code scans to correct URL | Mobile scanner redirects to `/{slug}` |
| Cache-Control header | `max-age=86400` (24 hours) |

### 3.6 Change History (Public)

**Requirement:** Any user (without login) can view the change history of a link.

**History Visibility Rules:**
- **Anonymous Links (unclaimed):** Show IP addresses in history
- **Claimed Links:** Hide IP addresses and ownership details from history
- Show all URL changes with timestamps
- Show creation timestamp and all update timestamps

**Acceptance Criteria:**

| Scenario | Expected Result |
|----------|-----------------|
| GET `/history/{slug}` for anonymous link | Returns history with visible IP addresses (last 3 octets masked: `192.168.1.xxx`) |
| GET `/history/{slug}` for claimed link | Returns history without IP addresses, shows "Registered User" |
| History shows creation timestamp | First entry displays `created_at` with "Created" action |
| History shows all URL changes | Each update shows old URL → new URL with timestamp |
| GET `/api/v1/links/{slug}/history` (API) | Returns JSON array of history entries |
| Anonymous link later claimed | History before claim shows IPs, history after claim hides IPs |
| History ordered by timestamp | Most recent changes appear first (DESC order) |

**History Entry Format:**
```json
{
  "action": "CREATE | UPDATE | CLAIM",
  "timestamp": "2026-02-06T12:00:00Z",
  "old_url": null,
  "new_url": "https://example.com",
  "actor": {
    "type": "anonymous | user",
    "display": "192.168.1.xxx" | "user@example.com" | "Registered User"
  }
}
```

### 3.7 Analytics & Dashboard

**Requirement:** Track link usage with Google Analytics and provide internal dashboard with RegEx filtering.

**Dashboard Features:**
1. **Google Analytics Integration:** Track redirect/creation events
2. **User Dashboard:** View and edit personal links with statistics
3. **RegEx Filter:** Filter links by slug pattern for campaign analysis
4. **Analytics Detail Page:** Individual link analytics with time-series charts
5. **Aggregate Analytics:** Combined analytics for filtered links
6. **Admin Dashboard:** System-wide statistics

**Use Case - RegEx Filtering:**
> Non-profit organization runs multiple events with naming convention:
> - `event-2024-fundraiser`, `event-2024-conference`, `event-2025-workshop`
> - Filter: `^event-2024-.*` to see all 2024 events
> - View: Individual + cumulative analytics with timeline charts

**Acceptance Criteria:**

| Scenario | Expected Result |
|----------|-----------------|
| Redirect triggers GA event | Google Analytics receives `event: redirect, slug: {slug}` |
| GET `/dashboard` (authenticated) | Shows user's links table with slug, URL, visits, edit button |
| Dashboard shows total visits | Sum of all visits for user's owned links |
| Dashboard shows per-link visits | Each link displays individual visit count |
| Click "Edit" button on dashboard | Navigate to `/edit/{slug}` with pre-filled form |
| Click link slug on dashboard | Navigate to `/stats/{slug}` (analytics detail page) |
| GET `/api/v1/stats/me` (API) | Returns `{total_links, total_visits, links: [{slug, url, visits}]}` |
| GET `/api/v1/stats/me?filter=^event-.*` | Returns only links matching RegEx pattern |
| Dashboard RegEx filter input | Text input accepts RegEx, filters table on submit |
| Invalid RegEx pattern | Shows error message "Invalid regular expression" |
| Filtered links show aggregate stats | Total visits and total links count for filtered results |
| GET `/stats/{slug}` (detail page) | Shows single link analytics: daily visits chart (30 days), total visits, creation date |
| Analytics chart displays timeline | Line chart with X-axis: dates, Y-axis: visits |
| GET `/api/v1/stats/links/{slug}` (API) | Returns `{slug, total_visits, daily_visits: [{date, count}]}` |
| Filtered links aggregate chart | Combined timeline chart for all filtered links |
| GET `/admin/dashboard` (admin only) | Shows system-wide stats (total users, links, visits) |
| GET `/api/v1/stats/global` (admin) | Returns `{total_users, total_links, total_visits, top_links}` |
| Non-authenticated user dashboard access | Redirect to `/login` |

**Dashboard UI Components:**

```typescript
// User Dashboard Table
interface DashboardLink {
  slug: string;
  url: string;
  visits: number;
  created_at: string;
  actions: {
    edit: () => void;      // Navigate to /edit/{slug}
    analytics: () => void; // Navigate to /stats/{slug}
  };
}

// RegEx Filter
interface FilterState {
  pattern: string;        // User input RegEx
  isValid: boolean;       // Pattern validation
  matchCount: number;     // Number of matching links
}

// Analytics Chart Data
interface AnalyticsData {
  slug: string;
  total_visits: number;
  daily_visits: Array<{
    date: string;          // ISO format: "2026-02-06"
    count: number;
  }>;
}
```

**Google Analytics Events:**
```javascript
// On redirect
gtag('event', 'link_redirect', {
  'slug': 'meet',
  'destination_domain': 'zoom.us'
});

// On link creation
gtag('event', 'link_create', {
  'slug': 'meet',
  'user_type': 'anonymous' | 'authenticated'
});
```

---

## 4. Database Schema

**Tables:** `links`, `audit_logs`, `users`, `daily_visits`

### 4.1 Links Table

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `slug` | varchar(100) | PRIMARY KEY | Unique identifier |
| `url` | text | NOT NULL | Destination URL |
| `owner_id` | uuid | FK → users.id, nullable | Owner (null = anonymous) |
| `created_at` | timestamp | NOT NULL, default now() | Creation time |
| `updated_at` | timestamp | NOT NULL, default now() | Last update |
| `visits` | integer | NOT NULL, default 0 | Visit counter |
| `created_by_fingerprint` | varchar(64) | nullable | SHA-256 hash for anonymous tracking |
| `url_history` | jsonb | default [] | Array of `{url, changed_at, changed_by}` |
| `metadata` | jsonb | nullable | `{title?, description?, tags[], show_warning?}` |

**Indexes:** `owner_id`, `created_at`, `created_by_fingerprint`

### 4.2 Audit Logs Table

| Field | Type | Purpose |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY |
| `link_slug` | varchar(100) | FK → links.slug (CASCADE) |
| `actor_id` | uuid | FK → users.id (nullable) |
| `actor_fingerprint` | varchar(64) | SHA-256 hash (anonymous) |
| `actor_ip_hash` | varchar(64) | SHA-256(IP + salt) |
| `action` | varchar(50) | CREATE, UPDATE, DELETE, CLAIM, VISIT |
| `diff` | jsonb | `{before?, after?, changes[]}` |
| `metadata` | jsonb | `{user_agent?, referer?, turnstile_validated?}` |
| `timestamp` | timestamp | NOT NULL, default now() |

**Indexes:** `link_slug`, `actor_id`, `timestamp`, `actor_fingerprint`

### 4.3 Users Table

| Field | Type | Purpose |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY (matches Supabase auth.users.id) |
| `email` | varchar(255) | NOT NULL, unique |
| `role` | varchar(20) | `user` or `admin` |
| `created_at` | timestamp | NOT NULL |

### 4.4 Daily Visits Table (Analytics)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | uuid | PRIMARY KEY |
| `link_slug` | varchar(100) | FK → links.slug (CASCADE) |
| `date` | date | Visit date (UTC, date-only) |
| `count` | integer | Number of visits on this date |

**Indexes:** `(link_slug, date)` UNIQUE - prevents duplicate date entries per link

**Aggregation:**
- Daily visit counts are pre-aggregated for performance
- Background job increments `count` for each redirect
- Queries are fast (no need to COUNT audit_logs)

**Note:** Rate limiting is handled by Cloudflare WAF, so no `rate_limits` table is needed.

---

## 5. API Contract (Extension-First Design)

All endpoints use `/api/v1` prefix for versioning. Chrome Extension MV3 compatible.

### 5.1 Core Endpoints

#### POST `/api/v1/links` - Create/Update Link

**Request:**
```json
{
  "slug": "meet",
  "url": "https://zoom.us/j/123",
  "turnstile_token": "<token>", // Required if unauthenticated
  "metadata": { "title": "Meeting", "tags": ["work"] }
}
```

**Responses:**
- `201` Created: `{slug, url, owner_id, created_at, claim_url?}`
- `400` Bad Request: Invalid URL or slug format
- `403` Forbidden: Missing/invalid Turnstile token
- `409` Conflict: Slug already exists (includes `suggestion` field)
- `429` Too Many Requests: Rate limit exceeded (includes `retry_after`)

#### GET `/api/v1/resolve?slug={slug}` - Resolve Link

**Responses:**
- `200` OK: `{slug, url, metadata: {title, visits}}`
- `404` Not Found: `{error: "SLUG_NOT_FOUND", slug}`
- `429` Too Many Requests

#### POST `/api/v1/links/{slug}/claim` - Claim Anonymous Link

**Auth:** Required (Bearer token)

**Responses:**
- `200` OK: `{slug, previous_owner_id, new_owner_id, claimed_at}`
- `403` Forbidden: `ALREADY_OWNED` or `OWNERSHIP_REQUIRED`
- `404` Not Found

#### GET `/api/v1/links?owner=me&limit=50&offset=0` - List User Links

**Auth:** Required

**Response:** `{links: [], total, limit, offset}`

#### GET `/api/v1/audit/{slug}` - Audit Log Retrieval

**Auth:** Required (owner or admin)

**Response:** `{slug, logs: [{id, action, actor_id, timestamp, diff}]}`

#### GET `/api/v1/qr/{slug}?size=400&format=png` - QR Code

**Query Params:**
- `size`: 200-2000 (default: 400)
- `format`: png | svg (default: png)

**Responses:**
- `200` OK: Binary image (PNG/SVG)
- `404` Not Found

#### GET `/api/v1/links/{slug}/history` - Change History

**Auth:** Optional (public endpoint)

**Response:**
```json
{
  "slug": "meet",
  "history": [
    {
      "action": "UPDATE",
      "timestamp": "2026-02-06T14:00:00Z",
      "old_url": "https://zoom.us/j/123",
      "new_url": "https://zoom.us/j/456",
      "actor": {
        "type": "user",
        "display": "Registered User"
      }
    },
    {
      "action": "CLAIM",
      "timestamp": "2026-02-06T13:00:00Z",
      "actor": {
        "type": "user",
        "display": "user@example.com"
      }
    },
    {
      "action": "CREATE",
      "timestamp": "2026-02-06T12:00:00Z",
      "new_url": "https://zoom.us/j/123",
      "actor": {
        "type": "anonymous",
        "display": "192.168.1.xxx"
      }
    }
  ]
}
```

**IP Masking Rules:**
- Unclaimed links: Show masked IP (`192.168.1.xxx`)
- Claimed links: Hide IPs, show "Registered User" or email (if user is viewing own link)

#### GET `/api/v1/stats/me?filter={regex}` - User Statistics

**Auth:** Required

**Query Params:**
- `filter`: Optional RegEx pattern (e.g., `^event-.*`)

**Response:**
```json
{
  "total_links": 5,
  "total_visits": 142,
  "filter_applied": "^event-.*",
  "links": [
    {
      "slug": "meet",
      "url": "https://zoom.us/j/123",
      "visits": 42,
      "created_at": "2026-02-06T12:00:00Z"
    }
  ]
}
```

**Error:**
- `400` Bad Request: Invalid RegEx pattern

#### GET `/api/v1/stats/links/{slug}` - Link Analytics Detail

**Auth:** Required (owner or admin)

**Response:**
```json
{
  "slug": "meet",
  "url": "https://zoom.us/j/123",
  "total_visits": 142,
  "created_at": "2026-02-06T12:00:00Z",
  "daily_visits": [
    {"date": "2026-02-06", "count": 15},
    {"date": "2026-02-05", "count": 23},
    {"date": "2026-02-04", "count": 18}
  ]
}
```

**Responses:**
- `200` OK: Analytics data
- `403` Forbidden: Not owner or admin
- `404` Not Found: Link doesn't exist

#### GET `/api/v1/stats/global` - Global Statistics

**Auth:** Required (admin only)

**Response:**
```json
{
  "total_users": 50,
  "total_links": 200,
  "total_visits": 5000,
  "top_links": [
    {"slug": "meet", "visits": 500},
    {"slug": "docs", "visits": 350}
  ]
}
```

### 5.2 Security Headers

**CORS:** Allow `chrome-extension://` origins
**Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS`


---

## 6. Testing Strategy

### 6.1 Testing Stack

| Type | Framework | Purpose |
|------|-----------|---------|
| **Unit Tests** | Vitest | Individual functions, utilities, validation logic |
| **Integration Tests** | Vitest + Drizzle | API endpoints, database transactions, auth flows |
| **Component Tests** | Storybook | UI component isolation, visual testing, interaction testing |
| **E2E Tests** | Playwright | Full user journeys, browser interactions, extension |

### 6.2 Unit Tests (Vitest)

**Verification Strategy:**

Test isolated functions and utilities with fast, deterministic tests:

- **URL Validation:** Verify invalid URLs are rejected and valid URLs pass through unit tests
- **Turnstile Validation:** Test token validation logic in isolation with mocked API responses
- **Slug Sanitization:** Verify special characters, spaces, and invalid patterns are properly handled
- **Fingerprint Hashing:** Confirm SHA-256 hash generation produces consistent 64-character hex strings
- **IP Masking:** Test that IP addresses are masked to show only first octets (e.g., `192.168.1.xxx`)
- **Cache Header Generation:** Verify correct cache-control headers are generated for different resource types

### 6.3 Integration Tests (Vitest)

**Verification Strategy:**

Test API endpoints with real database transactions against isolated test database:

**Link Creation & Turnstile Protection:**
- Verify POST without Turnstile token returns 403 with `TURNSTILE_REQUIRED` error
- Verify POST with valid Turnstile creates anonymous link (owner_id = null)
- Verify anonymous creation writes SHA-256 fingerprint to audit_logs table

**Claim Flow:**
- Verify authenticated user can claim anonymous link and owner_id is updated
- Verify claim attempt on owned link returns 403 with `ALREADY_OWNED` error

**Change History API:**
- Verify history endpoint for anonymous link returns masked IP addresses
- Verify history endpoint for claimed link hides IP addresses
- Verify history entries are ordered by timestamp (most recent first)

**Dashboard Statistics API:**
- Verify `/api/v1/stats/me` returns correct total_links, total_visits, and links array
- Verify RegEx filter parameter filters links correctly (e.g., `^event-2024-.*` matches only matching slugs)
- Verify invalid RegEx pattern returns 400 with validation error message

**Link Analytics API:**
- Verify `/api/v1/stats/links/{slug}` returns correct daily_visits array from database
- Verify non-owner access returns 403 Forbidden
- Verify non-existent link returns 404 Not Found

### 6.4 Component Tests (Storybook)

**Verification Strategy:**

Isolate UI components and test visual states independently from backend logic:

**Dashboard Link Table Component:**
- Test default state with multiple links showing slug, URL, visits, edit buttons
- Test empty state with no links
- Test filtered state showing only matching links with applied RegEx pattern

**RegEx Filter Input Component:**
- Test valid pattern state (displays match count)
- Test invalid pattern state (displays error message)
- Test pattern submission and clear functionality

**Analytics Time-Series Chart Component:**
- Test single link chart with 30-day data visualization
- Test aggregate chart combining multiple filtered links
- Test empty state and loading state

**Link Creation Form Component:**
- Test form with Turnstile widget integration
- Test validation error states
- Test authenticated vs. anonymous user states

**Change History Timeline Component:**
- Test history entries with different action types (CREATE, UPDATE, CLAIM)
- Test IP masking display for anonymous vs. claimed links
- Test timestamp formatting and ordering

**Visual Regression Testing:**
- Use Chromatic for automated screenshot comparison
- Test all states: default, loading, error, empty
- Test responsive layouts: mobile, tablet, desktop breakpoints

### 6.5 E2E Tests (Playwright)

**Verification Strategy:**

Test complete user journeys in real browser environment with all systems integrated:

**Anonymous Link Creation Flow:**
- Verify anonymous user can fill form, complete Turnstile challenge, and create link successfully

**Authenticated Link Creation & Claiming:**
- Verify user can log in, navigate to anonymous link, click claim button, and see success message

**Link Redirect Resolution:**
- Verify browser navigates to correct destination URL when visiting go-link slug
- Verify visit count increments in database after redirect

**Redirect Warning Page:**
- Verify warning page displays 5-second countdown and auto-redirects to destination

**Change History Page (Public Access):**
- Verify public history page shows masked IP addresses for anonymous links (e.g., `192.168.1.xxx`)
- Verify claimed link history hides IP addresses and shows "Registered User" label

**User Dashboard:**
- Verify authenticated user sees complete dashboard with total statistics and link table
- Verify table displays slug, URL, visits, and edit buttons for each link
- Verify clicking edit button navigates to edit page with pre-filled form
- Verify RegEx filter input filters table to show only matching links
- Verify invalid RegEx pattern displays error message
- Verify clicking link slug navigates to analytics detail page with chart visible
- Verify filtered links show aggregate chart combining all matched links' statistics

**Google Analytics Integration:**
- Verify redirect triggers GA event with correct slug and destination parameters

**Auto-create UX:**
- Verify visiting non-existent slug redirects to creation form page

**QR Code Generation:**
- Verify QR code endpoint returns valid image and mobile scanner resolves correctly

**Chrome Extension Integration:**
- Verify extension can create and resolve links via API
- Verify omnibox integration works correctly

### 6.6 Test Environment Setup

**Requirements:**
- Isolated test database (separate Supabase test project)
- Mock Turnstile API for token validation
- Pre-configured test users with known credentials
- Seed data scripts for links and daily_visits tables

**CI/CD Pipeline Stages:**
1. Lint & Type Check (ESLint + TypeScript)
2. Unit Tests (Vitest)
3. Integration Tests (Vitest with test database)
4. Component Tests (Storybook build + Chromatic visual regression)
5. E2E Tests (Playwright in headless mode)
6. Coverage Report (enforce minimum 80% threshold)

**Local Development:**
- Storybook runs on local port for component development
- Chromatic integration for automated visual regression testing

---

## 7. Security & Compliance

### 7.1 Bot Protection

**Turnstile:** Cloudflare CAPTCHA alternative (privacy-focused)
- Required for anonymous link creation
- Optional for authenticated users
- Validated server-side via Cloudflare API

### 7.2 Rate Limiting

**Strategy:** Delegated to Cloudflare WAF (Web Application Firewall)

**Configuration:**
- Cloudflare Rate Limiting rules handle all rate limits
- No internal rate limiting implementation
- Cloudflare blocks requests before reaching Next.js app

**Recommended Cloudflare Rules:**

| User Type | Limit | Window | Cloudflare Rule |
|-----------|-------|--------|-----------------|
| Anonymous Create | 5 requests | 1 hour | Path: `/api/v1/links`, Method: POST, No auth header |
| Authenticated Create | 50 requests | 1 hour | Path: `/api/v1/links`, Method: POST, Has auth header |
| Resolve | 100 requests | 1 minute | Path: `/*` (except `/api/*`) |

**Benefits:**
- ✅ No database overhead for rate limit tracking
- ✅ Edge-level protection (blocks at CDN)
- ✅ Removes need for `rate_limits` table
- ✅ Cloudflare dashboard provides analytics

**Internal Validation:**
- Application still validates Turnstile tokens
- Application still checks ownership/permissions
- Rate limiting is purely infrastructure-level

### 7.3 GDPR Compliance

**Data Minimization:**
- Anonymous: SHA-256 fingerprints only (no raw IP storage)
- Authenticated: Email, user_id (consent via OAuth)

**User Rights:**
- **Access:** `GET /api/v1/users/me/data` (export all data)
- **Erasure:** `DELETE /api/v1/users/me` (sets `owner_id = NULL`, preserves audit logs)

### 7.4 Security Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000`
- CORS: Allow `chrome-extension://` origins

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Next.js 15 + TypeScript setup
- Supabase + Drizzle schema migration
- Supabase Auth integration
- **Tests:** Unit tests for validation logic (Vitest)

### Phase 2: Core API (Week 3-4)
- API endpoints: `POST /api/v1/links`, `GET /api/v1/resolve`, `POST /api/v1/links/{slug}/claim`
- API endpoints: `GET /api/v1/links/{slug}/history`, `GET /api/v1/stats/me`, `GET /api/v1/stats/global`
- Turnstile validation middleware
- Audit logging with IP masking
- **Tests:** Integration tests for all endpoints (Vitest)

### Phase 3: Web UI (Week 5-6)
- Link creation form with Turnstile
- Auto-create UX (`/{slug}` → `/edit/{slug}`)
- Redirect warning page
- Change history page (`/history/{slug}`)
- User dashboard with RegEx filter
- Edit buttons and analytics detail pages
- Time-series charts (Recharts/Chart.js)
- QR code endpoint
- Google Analytics integration
- **Tests:** Storybook stories for components, E2E tests for user flows (Playwright)

### Phase 4: Extension (Week 7-8)
- Chrome Extension MV3
- Omnibox integration
- **Tests:** Extension E2E tests (Playwright)

### Phase 5: Production (Week 9-10)
- Load testing + optimization
- Security audit
- Monitoring (Sentry, Vercel Analytics)
- **Tests:** Full regression suite

---

## 9. Success Metrics

### Technical KPIs
- **Availability:** 99.9% uptime
- **Latency:** p95 < 100ms
- **Test Coverage:** > 80%
- **Abuse Rate:** < 1% flagged links

### User Metrics
- **Adoption:** 1000+ links (month 1)
- **Retention:** 50% create 2+ links
- **Claim Rate:** > 30% within 7 days

---

## 10. Conclusion

**Core Innovations:**
1. **Turnstile-Protected Anonymous Creation** (solves spam)
2. **Claim Flow** (solves legacy ownership problem)
3. **Public Change History** (transparency with privacy via IP masking)
4. **Enhanced Analytics Dashboard** (RegEx filtering for campaign analysis, time-series charts)
5. **Google Analytics Integration** (track redirect and creation events)
6. **Cloudflare Rate Limiting** (edge-level protection, no internal overhead)
7. **Comprehensive Testing** (Vitest + Playwright + Storybook)

**Dashboard Features (User-Centric):**
- View all owned links with edit buttons
- RegEx filter for batch analytics (e.g., `^event-2024-.*` for campaign tracking)
- Single link analytics detail page with 30-day timeline chart
- Aggregate analytics for filtered links
- Time-series visualization (Recharts/Chart.js)

**Test-First Development:**
- **58 explicit acceptance criteria** across all features
- Unit, integration, component (Storybook), and E2E tests required before merge
- CI/CD pipeline enforces 80% coverage
- Visual regression testing with Chromatic

**Key Dependencies:**
- **External:** Cloudflare (WAF + Turnstile), Google Analytics GA4, Chromatic (visual testing)
- **Internal:** Next.js 15, Supabase (Postgres + Auth), Drizzle ORM, Recharts/Chart.js
- **Testing:** Vitest (unit/integration), Storybook (components), Playwright (E2E)

**Next Steps:**
1. Approve specification
2. Configure Cloudflare rate limiting rules
3. Set up test environments (Supabase test project, Turnstile test keys, GA4 property, Chromatic project)
4. Set up Storybook with initial component stories
5. Begin Phase 1 with TDD approach

---

**Document Version:** 2.1.0
**Last Updated:** 2026-02-06
**Status:** Ready for Approval
