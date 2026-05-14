-- Free agents (left a team) must have team_id = NULL. Original schemas often used NOT NULL here.
-- Run in Supabase after review.

ALTER TABLE public.players
  ALTER COLUMN team_id DROP NOT NULL;

COMMENT ON COLUMN public.players.team_id IS
  'Current squad; NULL when player is a free agent (left team, cooldown may apply).';
