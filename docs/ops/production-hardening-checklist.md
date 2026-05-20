# EVOLVE Production Hardening Checklist

Use this before high-traffic tournament windows and after significant releases.

## 1) Auth and Access

- Verify `requireAuth` returns `401` for missing/expired tokens and `503` during Supabase outages.
- Verify all `/api/admin/*` routes are protected by `requireAdmin`.
- Confirm no frontend bundle references `SUPABASE_SERVICE_KEY`.
- Confirm admin and player accounts follow least-privilege model.

## 2) Database and Query Health

- Run phase 1 index script: `warzongg-api/sql/performance_indexes_phase1.sql`.
- Run phase 2 script where needed: `warzongg-api/sql/performance_indexes_phase2_search_and_partials.sql`.
- Check index usage in `pg_stat_user_indexes` (non-zero `idx_scan` for hot paths).
- Run `EXPLAIN ANALYZE` on:
  - tournament listing by status/type
  - admin registration queue
  - matches by tournament/round/status
  - player/team lookup by email/user_id

## 3) API Runtime Controls

- Confirm CORS allows only expected frontend origins.
- Confirm rate limits are active for auth, write, and admin routes.
- Confirm `/healthz` and `/readyz` return expected status.
- Confirm response cache settings are tuned for public read endpoints.

## 4) Data Integrity

- Validate required tables/columns/triggers via `warzongg-api/sql/prod_schema_validation.sql`.
- Verify `registrations` transitions (`pending -> approved/rejected`) work idempotently.
- Verify standings updates on match create/update are consistent.
- Verify team transfer/leave flows maintain `users.player_id` and `players.user_id` linkage.

## 5) UX and Functional Smoke Tests

- New user signup -> register page gating -> team creation -> My Team works.
- Existing team member/captain visiting register page redirects to tournaments.
- Captain tournament entry flow works (including saved lineup enforcement).
- Admin queue approve/reject reflects immediately in teams and overview sections.
- Live bracket and schedule refresh after match updates.

## 6) Deployment and Recovery

- Confirm Netlify and Render are both pointing to intended branch/repo visibility.
- Confirm environment variables are present in each environment (dev/staging/prod).
- Capture database backup before major schema changes.
- Keep rollback notes: previous stable commit + emergency DB change reversal plan.

## 7) Observability

- Log and track top 5 API errors by route.
- Track p95 latency for:
  - `/api/tournaments`
  - `/api/registrations`
  - `/api/matches`
  - `/api/admin/dashboard`
- Track auth failure spikes (401/403) and DB outage spikes (503).

