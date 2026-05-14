-- Pending join requests from teamless players → squads with open roster slots.
-- Run in Supabase SQL editor after reviewing.

CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requester_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

COMMENT ON TABLE public.team_join_requests IS
  'Player-initiated request to join a team with an open roster slot; captain accepts/declines.';

CREATE UNIQUE INDEX IF NOT EXISTS team_join_requests_one_pending
  ON public.team_join_requests (team_id, requester_player_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_join_requests_team_pending_idx
  ON public.team_join_requests (team_id)
  WHERE status = 'pending';
