# Frontend Structure and Naming Conventions

This project currently keeps frontend files in top-level folders:

- `pages/` for HTML pages
- `js/` for browser scripts
- `css/` for styles
- `assets/` for images/icons

## Naming conventions (from now on)

- Use lowercase kebab-case for all new files.
  - Good: `player-profile.html`, `team-roster.js`, `hero-banner.png`
- Avoid spaces in new file names.
- Keep page names feature-oriented and explicit (`find-squad.html`, `tournament-hub.html`).

## Asset reference conventions

- Use a single canonical path style in HTML/JS references.
- Prefer readable asset paths in markup/scripts (avoid mixed encoded variants).

## Legacy exceptions

- `assets/Evolve WebApp Logo.png` remains as the single canonical logo file for current live references.
- Previously unused legacy logo variants were removed in cleanup.

## Safe cleanup rules

- Do not move top-level frontend folders without a dedicated migration pass.
- When renaming referenced files, update all references and run quick syntax/path checks before deploy.
