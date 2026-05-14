# Plain-English Ops Guide

If this is your first live app, this page explains the core terms in simple language.

## Common Terms

- **Branch protection**
  - A GitHub safety lock for `main` so changes are reviewed before going live.
- **CI (Continuous Integration)**
  - Automatic checks that run on each push/PR to catch obvious issues early.
- **Health check (`/healthz`)**
  - "Is the server process alive?"
- **Readiness check (`/readyz`)**
  - "Is the server ready to serve real traffic (including DB)?"
- **Redeploy**
  - Rebuild/restart your service with the latest code/env vars.

## What to do after every important change

1. Push code to GitHub.
2. Wait for Render/Netlify deploy to finish.
3. Open app and do a quick smoke test:
   - login
   - one read endpoint
   - one write flow
4. Check API:
   - `/healthz` should return `ok`
   - `/readyz` should return `ready`

## Where to click in GitHub for safer production

Repository -> `Settings` -> `Branches` -> `Add branch protection rule` for `main`:

- Require a pull request before merging
- Require approvals (at least 1)
- Require status checks to pass before merging
- Block force pushes

## Where to click in Render when things break

Service -> `Logs`:
- Look for latest error stack
- Check env vars if it looks like CORS/DB auth/config issue

Service -> `Manual Deploy`:
- Trigger when you changed config or need a clean restart
