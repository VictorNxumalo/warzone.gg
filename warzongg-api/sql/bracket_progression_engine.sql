-- ═══════════════════════════════════════════════════════════════════════════
-- Bracket progression engine — schema additions (Supabase / PostgreSQL)
-- Adds match graph fields for automatic winner advancement and bracket rendering.
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY
-- 1. Supabase Dashboard -> SQL Editor -> New query.
-- 2. Paste this whole file and Run.
-- 3. If "already exists" appears, keep only statements not yet applied.
-- ═══════════════════════════════════════════════════════════════════════════

-- Optional round index for deterministic ordering (independent of round labels)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS round_number smallint;

-- Optional order inside a round (1..n), used by UI for stable rendering
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS match_order integer;

-- Bracket grouping support: single-elim, upper/lower bracket, grand finals, round robin
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS bracket_type text NOT NULL DEFAULT 'upper'
  CHECK (bracket_type IN ('upper', 'lower', 'grand_finals', 'single', 'round_robin'));

-- Graph edge: where the winner of this match advances
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS next_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL;

-- Slot in the next match that receives this winner
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS next_match_slot text
  CHECK (next_match_slot IS NULL OR next_match_slot IN ('team_a', 'team_b'));

CREATE INDEX IF NOT EXISTS idx_matches_tournament_bracket_round
  ON public.matches(tournament_id, bracket_type, round_number, match_order);

CREATE INDEX IF NOT EXISTS idx_matches_next_match_id
  ON public.matches(next_match_id);

COMMENT ON COLUMN public.matches.round_number IS
  'Numeric round index for bracket rendering and sorting.';

COMMENT ON COLUMN public.matches.match_order IS
  'Display order of match inside a round.';

COMMENT ON COLUMN public.matches.bracket_type IS
  'Bracket lane: upper, lower, grand_finals, single, or round_robin.';

COMMENT ON COLUMN public.matches.next_match_id IS
  'Target match that receives this winner when status becomes completed.';

COMMENT ON COLUMN public.matches.next_match_slot IS
  'Target slot in next_match_id: team_a or team_b.';
