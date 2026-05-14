-- ═══════════════════════════════════════════════════════════════════════════
-- Fighting games (FGC) engine — schema (Supabase / PostgreSQL)
-- Set = best-of games; each game = `matches` row with fgc_set_id (rounds in score_a/score_b).
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY
-- 1. Supabase Dashboard → SQL Editor → paste → Run.
-- 2. Comment out sections that error with "already exists" if re-running.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tournament-level defaults (rounds per game, Bo games, bracket flags) ───
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS fgc_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tournaments.fgc_config IS
  'FGC defaults: rounds_to_win_game, games_best_of, grand_finals_reset, format hints; merged with fgc_match_sets row.';

-- ── 2. Set container (best-of games within one bracket pairing) ─────────────
CREATE TABLE IF NOT EXISTS public.fgc_match_sets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_a_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_b_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  games_best_of   smallint NOT NULL DEFAULT 3 CHECK (games_best_of IN (1, 3, 5, 7)),
  rounds_to_win_game smallint NOT NULL DEFAULT 2 CHECK (rounds_to_win_game >= 1 AND rounds_to_win_game <= 9),
  round           text NOT NULL DEFAULT 'group_stage'
    CHECK (round IN ('group_stage', 'quarter_final', 'semi_final', 'grand_final')),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete')),
  winner_team_id  uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fgc_match_sets_tournament ON public.fgc_match_sets(tournament_id);
CREATE INDEX IF NOT EXISTS idx_fgc_match_sets_teams ON public.fgc_match_sets(team_a_id, team_b_id);

COMMENT ON TABLE public.fgc_match_sets IS
  'Best-of-N games; each game is a matches row with fgc_set_id and round wins in score_a/score_b.';

-- ── 3. Match row extensions ─────────────────────────────────────────────────
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS fgc_set_id uuid REFERENCES public.fgc_match_sets(id) ON DELETE SET NULL;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS fgc_game_number smallint;

COMMENT ON COLUMN public.matches.fgc_set_id IS
  'When set, this row is one game within an FGC set; set outcome drives standings/bracket.';

COMMENT ON COLUMN public.matches.fgc_game_number IS
  'Game index within the set (1, 2, …).';

CREATE INDEX IF NOT EXISTS idx_matches_fgc_set ON public.matches(fgc_set_id);

-- ── 4. Trigger: touch fgc_match_sets.updated_at ──────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_fgc_match_sets()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fgc_match_sets_touch ON public.fgc_match_sets;
CREATE TRIGGER trg_fgc_match_sets_touch
  BEFORE UPDATE ON public.fgc_match_sets
  FOR EACH ROW EXECUTE PROCEDURE public.touch_fgc_match_sets();
