-- ═══════════════════════════════════════════════════════════════════════════
-- team_saved_rosters.sql — Named tournament lineups per team (captain-managed)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- HOW TO APPLY (step by step)
-- 1. Open Supabase Dashboard → SQL Editor → New query.
-- 2. Paste this entire file and click Run.
-- 3. If any step errors on "already exists", skip or comment that section.
-- 4. Review Table Editor → team_saved_rosters / registrations.saved_roster_id.
-- 5. Optional: add RLS policies (below) if anon/authenticated clients query these
--    tables directly; the EVOLVE API uses the service role and bypasses RLS.
--
-- PURPOSE
-- Captains keep one canonical squad on `players`, but may save multiple ordered
-- lineups (same six player IDs, different order / who starts vs sub) for
-- different games or events. Tournament registration stores which lineup applies.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Saved roster header (per team, captain-owned via teams.captain_id) ───
CREATE TABLE IF NOT EXISTS public.team_saved_rosters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name        text NOT NULL,
  lineup      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_saved_rosters_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT team_saved_rosters_lineup_array CHECK (jsonb_typeof(lineup) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_team_saved_rosters_team_id
  ON public.team_saved_rosters(team_id);

COMMENT ON TABLE public.team_saved_rosters IS
  'Captain-managed named lineups: lineup is ordered JSON array of player UUID strings.';

COMMENT ON COLUMN public.team_saved_rosters.lineup IS
  'Ordered player ids (uuid strings), length must match all players on the team.';

-- ── 2. Link registration to the lineup submitted for that tournament entry ───
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS saved_roster_id uuid
    REFERENCES public.team_saved_rosters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_saved_roster_id
  ON public.registrations(saved_roster_id)
  WHERE saved_roster_id IS NOT NULL;

-- The API sets updated_at on PATCH. (Optional: add a BEFORE UPDATE trigger locally.)

-- ═══════════════════════════════════════════════════════════════════════════
-- OPTIONAL — Row Level Security (only if the browser uses Supabase anon key
-- on these tables). Uncomment and adjust to your auth.uid() model.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ALTER TABLE public.team_saved_rosters ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY team_saved_rosters_select_captain ON public.team_saved_rosters
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM public.teams t
--       WHERE t.id = team_id AND t.captain_id = auth.uid()
--     )
--   );
--
-- CREATE POLICY team_saved_rosters_mutate_captain ON public.team_saved_rosters
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM public.teams t
--       WHERE t.id = team_id AND t.captain_id = auth.uid()
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM public.teams t
--       WHERE t.id = team_id AND t.captain_id = auth.uid()
--     )
--   );
