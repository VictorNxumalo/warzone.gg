-- ═══════════════════════════════════════════════════════════════════════════
-- Racing tournament engine — schema additions (Supabase / PostgreSQL)
-- Supports Forza / Gran Turismo / F1-style points championships.
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY
-- 1. Supabase Dashboard -> SQL Editor -> New query.
-- 2. Paste this whole file and Run.
-- 3. If "already exists" appears, skip/comment those lines and run remaining.
-- ═══════════════════════════════════════════════════════════════════════════

-- Tournament-level scoring and options (config-driven, not hardcoded)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS racing_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tournaments.racing_config IS
  'Racing rules: points_by_position map, fastest_lap_bonus, optional drop_worst_results, etc.';

-- Optional metadata to mark race events/weekends in the existing matches table
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS racing_event text;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS racing_session_type text;

COMMENT ON COLUMN public.matches.racing_event IS
  'Optional grouping key for race weekend/event, e.g. "Monza Weekend".';

COMMENT ON COLUMN public.matches.racing_session_type IS
  'Optional session type, e.g. qualifying, sprint, main_race.';

-- Admin result payload reference (stored in matches.stats JSON)
-- stats.racing.results = [
--   { "participant_id": "<team_uuid>", "position": 1, "dnf": false, "fastest_lap": true },
--   { "participant_id": "<team_uuid>", "position": 2, "dnf": false }
-- ]
-- Engine writes back computed points and winner_participant_id into stats.racing.
