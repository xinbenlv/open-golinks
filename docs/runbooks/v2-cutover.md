# v2-hono Cutover Runbook

**Status**: Draft, ready for human cutover planning  
**Production candidate**: `https://open-golinks-v2-hono-production.up.railway.app`  
**Branch**: `v2-hono`

## Current Gate

Do not switch DNS until the Identity/ACL repair report has been reviewed and the owner strategy for remaining unowned legacy links is explicitly accepted.

Latest legacy owner dry-run:

- `total=5804`
- `unowned=4959`
- `unowned_with_legacy_email=0`
- `unowned_with_fingerprint=0`

There is no automatic email/fingerprint backfill path for those 4959 rows. Options are manual review, bulk assignment policy, or accepting that old unowned links remain claim-only/manual.

Before cutover, refresh this with the current identity-aware scripts:

```sh
bun scripts/reconcile-legacy-owners.ts
bun run migrate:legacy:dry
```

Required acceptance points:

- `links.owner_id` non-null values must map to Supabase Auth users.
- synthetic `public.users` rows must either be remapped/deleted or confirmed unreferenced by `links.owner_id` and `audit_logs.actor_id`.
- any remaining `unowned` links, especially `unowned_with_legacy_email`, must have an accepted support/claim policy.
- `public.users.email` must be canonical and pass the `unique_users_email_lower` migration gate.

## Pre-Cutover Checklist

- Confirm production SHA:
  ```sh
  curl -s https://open-golinks-v2-hono-production.up.railway.app/api/v1/version
  ```
- Confirm Railway deployment status is `SUCCESS`:
  ```sh
  railway deployment list --service open-golinks-v2-hono --environment production
  ```
- Run targeted production browser smoke for the latest feature set, or at minimum:
  ```sh
  railway run --service open-golinks-v2-hono --environment production --no-local -- sh -c 'RUN_BROWSER_TESTS=1 EXPECTED_SHA=<sha6> bun test tests/browser/F14.spec.ts'
  ```
- Confirm Supabase Auth redirect URLs include the production domain and future custom domain.
- Confirm `SUPABASE_URL`/`SUPABASE_SECRET_KEY` or service-role equivalent are available only to migration/repair operators, not the public runtime.
- Confirm GA4 env and GCP credentials are configured on Railway.
- Confirm the DNS owner, cutover window, rollback approver, and alert receiver.

## Cutover Steps

1. Announce a write-freeze window for master.
2. Put master in read-only mode if the old service supports it; otherwise stop accepting new writes operationally.
3. Confirm v2-hono health:
   ```sh
   curl -fsS https://open-golinks-v2-hono-production.up.railway.app/api/v1/health
   curl -fsS https://open-golinks-v2-hono-production.up.railway.app/api/v1/version
   ```
4. Point the production go-links DNS record at Railway.
5. Verify on the production domain:
   - `/api/v1/health`
   - `/api/v1/version`
   - a known redirect slug
   - `/login`
   - `/dashboard`
   - `/qr/<slug>`
   - `/stats`
6. Watch logs and error rate for at least 30 minutes.

## Rollback

1. DNS back to master.
2. Keep v2-hono running for investigation.
3. Export links created during the v2-hono window before discarding or replaying.
4. Compare audit logs and link rows for changed slugs.

## Post-Cutover Checks

- Redirect P99 within 24 hours: target `<= 100 ms`.
- Healthcheck remains green.
- GA4 events continue with `source=v2-hono`.
- Owner support issues are triaged, especially legacy unowned links.
