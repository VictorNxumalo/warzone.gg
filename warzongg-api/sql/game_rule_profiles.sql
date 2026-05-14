-- ═══════════════════════════════════════════════════════════════════════════
-- Game rule profile system (Supabase / PostgreSQL)
-- Explicit per-tournament rule profile so engine selection is config-driven.
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY
-- 1. Supabase Dashboard -> SQL Editor -> New query.
-- 2. Paste this file and Run.
-- 3. If "already exists" appears, keep only unapplied statements.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS game_rule_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tournaments.game_rule_profile IS
  'Per-tournament game rule profile, e.g. {"engine":"fifa","best_of":3,"allow_draw":false}.';

CREATE INDEX IF NOT EXISTS idx_tournaments_game_rule_profile
  ON public.tournaments USING GIN (game_rule_profile);
