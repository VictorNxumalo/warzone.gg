# WARZONE.GG Release Checklist

Use this checklist before every production deployment.

## 1) Secrets and Access

- [ ] Rotate Supabase keys if previously exposed.
- [ ] Confirm `SUPABASE_SERVICE_KEY` exists only in backend environment variables.
- [ ] Confirm no `.env` files are tracked by git.
- [ ] Confirm production deploy platform secrets are set (not hardcoded in code).

## 2) Legal and Compliance

- [ ] `pages/privacy-policy.html` is publicly reachable.
- [ ] `pages/terms-of-service.html` is publicly reachable.
- [ ] `docs/legal/privacy-policy.md` placeholders are filled (`contact email`).
- [ ] `docs/legal/terms-of-service.md` placeholders are filled (`jurisdiction`, `contact email`).
- [ ] Data inventory is current in `docs/legal/data-inventory-and-compliance.md`.

## 3) Backend Security Controls

- [ ] `NODE_ENV=production` is set in backend runtime.
- [ ] CORS is restricted to production frontend domains.
- [ ] Rate limits are configured and tested (auth/read/write/admin).
- [ ] Security headers (`helmet`) are active.
- [ ] Server-side validation rejects malformed/unknown payloads on critical write routes.

## 4) Performance and Reliability

- [ ] Public read cache values are configured (`PUBLIC_READ_CACHE_*`).
- [ ] `/api/tournaments`, `/api/leaderboard`, `/api/schedule`, `/api/announcements` respond quickly.
- [ ] Basic smoke tests pass for login, register, team flows, and admin announcements.

## 5) GitHub and Release Hygiene

- [ ] `main` branch is up to date and clean.
- [ ] Release notes/changelog are updated (if applicable).
- [ ] Branch protection is enabled (recommended):
  - require pull requests before merge
  - require status checks before merge
  - block force pushes to `main`

## 6) Post-Deploy Verification

- [ ] Frontend loads and API calls succeed from production domain.
- [ ] Auth works (register/login/logout/me).
- [ ] Rate limit behavior returns `429` when intentionally exceeded.
- [ ] No severe errors in runtime logs after initial traffic.

## 7) Rollback Readiness

- [ ] Previous stable deployment version is known.
- [ ] Rollback command/process is documented in deployment platform.
- [ ] Team knows who can execute emergency rollback.
