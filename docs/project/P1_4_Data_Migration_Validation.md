# P1.4 Data/Migration Validation

This checklist validates production schema parity with the current API and tournament engines.

## 1) Run schema parity SQL on production

Run `warzongg-api/sql/prod_schema_validation.sql` in Supabase SQL Editor (production project).

Expected outcome:
- Missing tables query returns **0 rows**
- Missing columns query returns **0 rows**
- Constraint/trigger status queries return **ok**
- Runtime trigger checks return **ok** or `skipped_no_rows` (if no data yet)

If any query reports `missing` or returns rows, production is drifted and must be migrated before launch.

## 2) Apply migrations if drift is detected

Apply missing files from `warzongg-api/sql/` directly in Supabase SQL Editor:

- `cod_tournament_engine.sql`
- `fifa_tournament_engine.sql`
- `fgc_tournament_engine.sql`
- `racing_tournament_engine.sql`
- `bracket_progression_engine.sql`
- `match_dispute_moderation.sql`
- `game_rule_profiles.sql`
- `team_saved_rosters.sql`
- `team_roster_governance.sql`
- `team_join_requests.sql`
- `players_team_id_nullable_for_free_agents.sql`
- `fix_players_codm_uid_check.sql`

Re-run `prod_schema_validation.sql` until all checks pass.

## 3) Validate app-layer behaviors (not DB trigger driven)

In this codebase, two critical behaviors are implemented in API code, not DB triggers:

- Registration approval increments `tournaments.registered_count`
- Match completion/correction updates team standings (`wins/losses/points`)

Validate via API/admin flow:

1. Approve one pending registration.
2. Confirm `registered_count` increased by 1 for that tournament.
3. Submit one completed match with a winner.
4. Confirm winner/loser stats changed as expected.
5. Patch that match to flip winner (or revert completion).
6. Confirm standings reverse/reapply correctly.

## Gate

- **Ready:** schema parity checks clean + behavior tests pass.
- **Not ready:** any missing table/column/constraint/trigger, or behavior mismatch.
