-- ═══════════════════════════════════════════════════════════════════════════
-- Call of Duty tournament engine — schema additions (Supabase / PostgreSQL)
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY (step by step)
-- 1. Open Supabase Dashboard → SQL Editor → New query.
-- 2. Paste this entire file and click Run.
-- 3. If any step errors on "already exists", skip or comment that section.
-- 4. Review Table Editor → match_series / matches columns.
-- 5. Optional: add RLS policies for match_series (below) if you use RLS on these tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Series container (two teams, best-of, bracket phase) ───────────────
CREATE TABLE IF NOT EXISTS public.match_series (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_a_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_b_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  best_of         smallint NOT NULL DEFAULT 3 CHECK (best_of IN (1, 3, 5, 7)),
  round           text NOT NULL DEFAULT 'group_stage'
    CHECK (round IN ('group_stage', 'quarter_final', 'semi_final', 'grand_final')),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete')),
  winner_team_id  uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_series_tournament ON public.match_series(tournament_id);
CREATE INDEX IF NOT EXISTS idx_match_series_teams ON public.match_series(team_a_id, team_b_id);

COMMENT ON TABLE public.match_series IS
  'Head-to-head best-of series; individual maps are rows in matches with series_id set.';

-- ── 2. Match row extensions (single map OR legacy whole match) ────────────
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.match_series(id) ON DELETE SET NULL;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS map_number smallint;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS stats jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS cod_mode text;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS counts_for_standings boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.matches.series_id IS
  'When set, this row is one map inside a best-of; standings use series outcome, not each map.';

COMMENT ON COLUMN public.matches.stats IS
  'Mode-specific payload for the COD engine (e.g. rounds_a/rounds_b for S&D, kills_a/kills_b for TDM).';

COMMENT ON COLUMN public.matches.cod_mode IS
  'Normalized engine key (search_destroy, hardpoint, …); optional mirror of game_mode label.';

COMMENT ON COLUMN public.matches.counts_for_standings IS
  'false for maps inside a series (only the series result updates W/L/points once).';

CREATE INDEX IF NOT EXISTS idx_matches_series ON public.matches(series_id);

-- ── 3. Tournament default for admin UI (optional) ───────────────────────────
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS default_series_best_of smallint NOT NULL DEFAULT 3
  CHECK (default_series_best_of IN (1, 3, 5, 7));

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS cod_scoring_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tournaments.cod_scoring_config IS
  'Optional overrides: BR placement/kill weights, leaderboard tie-breakers, etc.';

-- ── 4. Trigger: touch match_series.updated_at ───────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_match_series()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_match_series_touch ON public.match_series;
CREATE TRIGGER trg_match_series_touch
  BEFORE UPDATE ON public.match_series
  FOR EACH ROW EXECUTE PROCEDURE public.touch_match_series();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS (optional): enable only if the rest of your app uses RLS.
-- Anon from the browser should NOT write these; the API should use the service role
-- or policies tied to authenticated admin users.
-- ═══════════════════════════════════════════════════════════════════════════
-- ALTER TABLE public.match_series ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public read match_series" ON public.match_series FOR SELECT USING (true);
-- CREATE POLICY "Service role all match_series" ON public.match_series FOR ALL
--   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
