# Data Inventory and Compliance Register

Last updated: 2026-05-14

This document tracks what data WARZONE.GG collects, where it is stored, why it is collected, and how long it is retained.

## 1. Data Inventory

- `users.email`
  - Purpose: authentication, account recovery, communication.
  - Classification: personal data.
  - Retention: while account is active and as needed for legal/security records.

- `users.username`
  - Purpose: public profile and platform identity.
  - Classification: personal data (public-facing).
  - Retention: while account is active.

- `users.whatsapp` (optional)
  - Purpose: optional communication.
  - Classification: personal contact data.
  - Retention: until removed by user or account deletion.

- `users.role`
  - Purpose: authorization and access control.
  - Classification: security/authorization metadata.
  - Retention: while account is active.

- `players` profile attributes (IGN, team linkage, status)
  - Purpose: tournament operations and roster management.
  - Classification: gameplay/profile data.
  - Retention: while account/team records are active.

- `teams`, `registrations`, `matches`, `leaderboard`, `schedule` records
  - Purpose: core platform operations and competitive history.
  - Classification: operational and competition data.
  - Retention: long-term for audit, history, and reporting unless legal requirements say otherwise.

- `announcements`, `notifications`, `invites`, `join requests`
  - Purpose: platform communication and workflow events.
  - Classification: operational communication data.
  - Retention: operational lifecycle with optional archive period.

- Request metadata (IP, user agent, request rate events)
  - Purpose: abuse prevention, rate limiting, incident response.
  - Classification: technical/security logs.
  - Retention: short rolling window (recommended 30-90 days unless incident requires extension).

## 2. Security Controls (Current Baseline)

- Backend-only privileged keys (`SUPABASE_SERVICE_KEY`) via environment variables.
- Frontend hardcoded key defaults removed.
- API rate limiting applied globally and stricter limits on auth endpoints.
- Server-side input validation for sensitive write endpoints.

## 3. Compliance Checklist Before Production

- [ ] Publish public Privacy Policy page.
- [ ] Publish public Terms of Service page.
- [ ] Add contact email and jurisdiction placeholders in legal documents.
- [ ] Confirm age policy and parental consent requirements for target countries.
- [ ] Verify Supabase RLS is enabled on all exposed tables.
- [ ] Validate backup, recovery, and incident response process.
- [ ] Add cookie/session notice if tracking cookies are introduced.

## 4. Data Subject Request Workflow

- Intake channel: [REPLACE_WITH_CONTACT_EMAIL]
- Identity verification: required before releasing or deleting data.
- Target SLA: respond within 30 days (or local legal requirement).
- Actions supported: access, correction, deletion (where legally allowed), objection/restriction.

## 5. Third-Party Processors

- Supabase (database/auth/realtime infrastructure)
- Hosting provider(s) for backend and static frontend

Document each processor's legal terms, region, and data protection commitments before launch.
