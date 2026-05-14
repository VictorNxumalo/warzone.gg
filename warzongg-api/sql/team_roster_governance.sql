-- team_roster_governance.sql — Leave locks, free-agent tracking, team invites
-- Run in Supabase SQL Editor after reviewing.

-- 1) Free-agent timestamp (set when a roster member leaves voluntarily)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS free_agent_since timestamptz;

COMMENT ON COLUMN public.players.free_agent_since IS
  'When the player last became teamless via leave flow; used for join cooldown.';

CREATE INDEX IF NOT EXISTS players_free_agent_since_idx
  ON public.players (free_agent_since)
  WHERE free_agent_since IS NOT NULL;

-- 2) Team invites (captain → existing player account that is currently teamless)
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invitee_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  invited_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS team_invites_one_pending_per_team_player
  ON public.team_invites (team_id, invitee_player_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_invites_invitee_pending_idx
  ON public.team_invites (invitee_player_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_invites_team_idx
  ON public.team_invites (team_id);
