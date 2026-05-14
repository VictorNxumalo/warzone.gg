-- ═══════════════════════════════════════════════════════════════════════════
-- FIFA / football tournament engine — schema additions (Supabase / PostgreSQL)
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY (step by step)
-- 1. Open Supabase Dashboard → SQL Editor → New query.
-- 2. Paste this entire file and click Run.
-- 3. If any step errors on "already exists", skip or comment that section.
-- 4. Verify Table Editor → tournaments.fifa_scoring_config and matches optional columns.
-- 5. Optional: extend RLS policies if your project uses RLS on these tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tournament-level FIFA config (tie-breakers, optional rules) ───────────
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS fifa_scoring_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tournaments.fifa_scoring_config IS
  'FIFA engine overrides, e.g. {"allow_draw": false} for custom phases, '
  'or group defaults. Empty object uses engine defaults (group draws allowed).';

-- ── 2. Match metadata for two-leg ties (optional; pair rows share an id) ────
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS fifa_leg smallint CHECK (fifa_leg IS NULL OR fifa_leg IN (1, 2));

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS fifa_aggregate_pair_id uuid;

COMMENT ON COLUMN public.matches.fifa_leg IS
  '1 or 2 for home/away leg in a two-tie aggregate (optional).';

COMMENT ON COLUMN public.matches.fifa_aggregate_pair_id IS
  'Same UUID on both leg rows to link them for aggregate calculations in the app layer.';

CREATE INDEX IF NOT EXISTS idx_matches_fifa_pair ON public.matches(fifa_aggregate_pair_id)
  WHERE fifa_aggregate_pair_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Admin payload reference (stored in matches.stats JSON — no migration needed)
-- ═══════════════════════════════════════════════════════════════════════════
-- stats.fifa.extra_time   → { "a": 1, "b": 0 }  OR  et_goals_a / et_goals_b
-- stats.fifa.penalties    → { "a": 5, "b": 4 } OR pen_goals_a / pen_goals_b
-- stats.fifa.admin_winner_team_id → uuid when regulation is tied and admin records winner
-- Resolution metadata is written back by the API (resolved_phase, resolution_reason).
