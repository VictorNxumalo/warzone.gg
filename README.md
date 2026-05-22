# WarzoneGG (warzongg)

Monorepo for the **WARZONE.GG** tournament platform: a static web UI served from the repo root and a **Node.js + Express** API in `warzongg-api/` backed by Supabase.

## Repository layout

| Path | Purpose |
|------|---------|
| `index.html`, `css/`, `js/`, `pages/`, `assets/` | Static site (HTML/CSS/JS). Entry point is `index.html`. |
| `data/` | Sample and mock JSON used for local demos or fixtures. |
| `scripts/` | Tooling: LAN static server (`dev-static-server.js`), maintenance scripts (e.g. `extract-docx.ps1`). |
| `docs/` | Product and engineering documentation (not required to run the app). See below. |
| `warzongg-api/` | REST API (`server.js`), routes, controllers, tournament engines (CoD, FIFA), SQL migrations. |

## Quick start

**Static UI (same machine or LAN):**

```bash
npm install
npm run dev:lan
```

Opens `http://127.0.0.1:3333/` (see console for LAN URLs).

**API:** see `warzongg-api/` — copy `.env.example` to `.env`, install dependencies, and run the server per that package’s scripts.

## Security baseline already implemented

- Server-side input validation on critical write paths.
- Rate limiting for auth, read, write, and admin endpoints.
- Security headers via `helmet`.
- CORS allowlist with environment-aware behavior.
- Public read caching to reduce latency on high-read endpoints.
- Legal documents for privacy, terms, and data inventory under `docs/legal/`.

## Required environment variables (API)

Set these in your deployed backend service:

- `NODE_ENV=production`
- `PORT`
- `LISTEN_HOST`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `FRONTEND_URL`
- `FRONTEND_URL_PROD`
- `CORS_ORIGINS` (optional, comma-separated)
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `AUTH_RATE_LIMIT_MAX`
- `PUBLIC_READ_RATE_LIMIT_WINDOW_MS`
- `PUBLIC_READ_RATE_LIMIT_MAX`
- `WRITE_RATE_LIMIT_WINDOW_MS`
- `WRITE_RATE_LIMIT_MAX`
- `ADMIN_RATE_LIMIT_WINDOW_MS`
- `ADMIN_RATE_LIMIT_MAX`
- `PUBLIC_READ_CACHE_TTL_SECONDS`
- `PUBLIC_READ_CACHE_MAX_ENTRIES`

## Deployment checklist

Use `docs/release/release-checklist.md` before every production release.

Minimum must-pass checks:

- Rotate and verify all API keys/secrets.
- Confirm legal links are visible from the frontend.
- Verify production CORS origins.
- Smoke test auth, registration, and key read APIs.
- Confirm `main` is clean and pushed to GitHub.

## Operations and monitoring

- API liveness: `/healthz`
- API readiness: `/readyz`
- Plain-English operations notes: `docs/release/plain-english-ops-guide.md`
- CI checks run on push/PR via `.github/workflows/ci.yml`

## Documentation (`docs/`)

- **`docs/project/`** — Word/PDF write-ups (architecture notes, progress reports, folder-structure reference).
- **`docs/design/`** — Diagrams (e.g. backend implementation flow SVG).
- **`docs/frontend/`** — Frontend structure and naming conventions for safe file cleanup.
- **`docs/user-flows/`** — Standalone HTML prototypes for member/platform flows (not linked from the main site).
- **`docs/notes/`** — Generated or extracted text (e.g. plain text pulled from a Word doc via `scripts/extract-docx.ps1`).
- **`docs/legal/`** — Privacy policy, terms of service, data inventory and compliance register.
- **`docs/release/`** — Release readiness and GitHub hardening checklist.
