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

## Documentation (`docs/`)

- **`docs/project/`** — Word/PDF write-ups (architecture notes, progress reports, folder-structure reference).
- **`docs/design/`** — Diagrams (e.g. backend implementation flow SVG).
- **`docs/user-flows/`** — Standalone HTML prototypes for member/platform flows (not linked from the main site).
- **`docs/notes/`** — Generated or extracted text (e.g. plain text pulled from a Word doc via `scripts/extract-docx.ps1`).
