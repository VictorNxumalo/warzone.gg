-- P1.4 Data/Migration Validation
-- Run this in Supabase SQL Editor against PRODUCTION.
-- Goal: detect schema drift vs current EVOLVE API + engine expectations.

-- ============================================================================
-- 1) Required tables
-- ============================================================================
WITH required_tables(name) AS (
  VALUES
    ('users'),
    ('players'),
    ('teams'),
    ('tournaments'),
    ('registrations'),
    ('matches'),
    ('announcements'),
    ('notifications'),
    ('match_series'),
    ('fgc_match_sets'),
    ('team_saved_rosters'),
    ('team_join_requests'),
    ('team_invites')
)
SELECT rt.name AS missing_table
FROM required_tables rt
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
 AND t.table_name = rt.name
WHERE t.table_name IS NULL
ORDER BY rt.name;

-- ============================================================================
-- 2) Required columns used by API/engines
-- ============================================================================
WITH required_columns(table_name, column_name) AS (
  VALUES
    -- tournaments
    ('tournaments', 'registered_count'),
    ('tournaments', 'default_series_best_of'),
    ('tournaments', 'cod_scoring_config'),
    ('tournaments', 'fifa_scoring_config'),
    ('tournaments', 'fgc_config'),
    ('tournaments', 'racing_config'),
    ('tournaments', 'game_rule_profile'),
    -- matches
    ('matches', 'series_id'),
    ('matches', 'map_number'),
    ('matches', 'stats'),
    ('matches', 'cod_mode'),
    ('matches', 'counts_for_standings'),
    ('matches', 'fifa_leg'),
    ('matches', 'fifa_aggregate_pair_id'),
    ('matches', 'round_number'),
    ('matches', 'match_order'),
    ('matches', 'bracket_type'),
    ('matches', 'next_match_id'),
    ('matches', 'next_match_slot'),
    ('matches', 'fgc_set_id'),
    ('matches', 'fgc_game_number'),
    ('matches', 'racing_event'),
    ('matches', 'racing_session_type'),
    ('matches', 'dispute_status'),
    ('matches', 'dispute_notes'),
    ('matches', 'dispute_proof_url'),
    ('matches', 'disputed_by_team_id'),
    ('matches', 'dispute_opened_at'),
    ('matches', 'dispute_opened_by'),
    ('matches', 'dispute_resolved_at'),
    ('matches', 'dispute_resolved_by'),
    -- registrations / players
    ('registrations', 'saved_roster_id'),
    ('players', 'free_agent_since')
)
SELECT rc.table_name, rc.column_name
FROM required_columns rc
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = rc.table_name
 AND c.column_name = rc.column_name
WHERE c.column_name IS NULL
ORDER BY rc.table_name, rc.column_name;

-- ============================================================================
-- 3) Key constraints/checks
-- ============================================================================
SELECT
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'players'
      AND con.conname = 'players_codm_uid_check'
      AND con.contype = 'c'
  ) THEN 'ok' ELSE 'missing' END AS players_codm_uid_check_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'matches'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%dispute_status%'
  ) THEN 'ok' ELSE 'missing' END AS matches_dispute_status_check_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'matches'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%bracket_type%'
  ) THEN 'ok' ELSE 'missing' END AS matches_bracket_type_check_status;

-- ============================================================================
-- 4) Trigger/function checks for updated_at touch behavior
-- ============================================================================
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'touch_match_series'
  ) THEN 'ok' ELSE 'missing' END AS touch_match_series_function_status,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_class rel ON rel.oid = tg.tgrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'match_series'
      AND tg.tgname = 'trg_match_series_touch'
      AND NOT tg.tgisinternal
  ) THEN 'ok' ELSE 'missing' END AS trg_match_series_touch_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'touch_fgc_match_sets'
  ) THEN 'ok' ELSE 'missing' END AS touch_fgc_match_sets_function_status,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_class rel ON rel.oid = tg.tgrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'fgc_match_sets'
      AND tg.tgname = 'trg_fgc_match_sets_touch'
      AND NOT tg.tgisinternal
  ) THEN 'ok' ELSE 'missing' END AS trg_fgc_match_sets_touch_status;

-- ============================================================================
-- 5) Trigger behavior smoke checks (non-destructive; rolled back)
-- ============================================================================
BEGIN;

-- match_series.updated_at should change on UPDATE (if any row exists)
WITH sample AS (
  SELECT id, updated_at FROM public.match_series ORDER BY created_at DESC LIMIT 1
),
touch AS (
  UPDATE public.match_series ms
  SET status = ms.status
  FROM sample s
  WHERE ms.id = s.id
  RETURNING ms.id, ms.updated_at
)
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM sample) THEN 'skipped_no_rows'
    WHEN EXISTS (
      SELECT 1
      FROM touch t
      JOIN sample s ON s.id = t.id
      WHERE t.updated_at > s.updated_at
    ) THEN 'ok'
    ELSE 'failed'
  END AS match_series_touch_trigger_runtime_status;

-- fgc_match_sets.updated_at should change on UPDATE (if any row exists)
WITH sample AS (
  SELECT id, updated_at FROM public.fgc_match_sets ORDER BY created_at DESC LIMIT 1
),
touch AS (
  UPDATE public.fgc_match_sets fs
  SET status = fs.status
  FROM sample s
  WHERE fs.id = s.id
  RETURNING fs.id, fs.updated_at
)
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM sample) THEN 'skipped_no_rows'
    WHEN EXISTS (
      SELECT 1
      FROM touch t
      JOIN sample s ON s.id = t.id
      WHERE t.updated_at > s.updated_at
    ) THEN 'ok'
    ELSE 'failed'
  END AS fgc_match_sets_touch_trigger_runtime_status;

ROLLBACK;

-- ============================================================================
-- 6) Notes on behavior ownership
-- ============================================================================
-- Important: in this codebase, registration_count and standings updates are
-- app-layer behaviors in controllers/services, not DB triggers.
-- Validate these with API smoke tests after schema parity:
--   - Approve registration -> tournaments.registered_count increments
--   - Submit/patch completed match -> teams wins/losses/points update correctly
