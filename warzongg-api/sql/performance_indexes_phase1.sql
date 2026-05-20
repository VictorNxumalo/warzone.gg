-- EVOLVE / WARZONE.GG - Phase 1 performance indexes
-- Purpose: reduce query latency on high-frequency API filters, joins, and sorts.
-- Safety: uses CONCURRENTLY + IF NOT EXISTS for production-friendly creation.
--
-- IMPORTANT:
-- 1) Run each statement separately in Supabase SQL Editor (CONCURRENTLY cannot run inside a transaction).
-- 2) Prefer off-peak execution windows.

-- ============================================================================
-- TOURNAMENTS
-- ============================================================================
create index concurrently if not exists idx_tournaments_status_start_date
  on public.tournaments (status, start_date);

create index concurrently if not exists idx_tournaments_type_start_date
  on public.tournaments (type, start_date);

-- ============================================================================
-- REGISTRATIONS
-- ============================================================================
create index concurrently if not exists idx_registrations_tournament_status_submitted
  on public.registrations (tournament_id, status, submitted_at);

create index concurrently if not exists idx_registrations_status_submitted
  on public.registrations (status, submitted_at);

create index concurrently if not exists idx_registrations_team_submitted
  on public.registrations (team_id, submitted_at desc);

-- ============================================================================
-- TEAMS
-- ============================================================================
create index concurrently if not exists idx_teams_captain_id
  on public.teams (captain_id);

create index concurrently if not exists idx_teams_created_at
  on public.teams (created_at desc);

create index concurrently if not exists idx_teams_name
  on public.teams (name);

-- ============================================================================
-- PLAYERS
-- ============================================================================
create index concurrently if not exists idx_players_team_id
  on public.players (team_id);

create index concurrently if not exists idx_players_user_id
  on public.players (user_id);

create index concurrently if not exists idx_players_team_email
  on public.players (team_id, email);

-- ============================================================================
-- MATCHES
-- ============================================================================
-- API: /api/matches?tournament_id=&round=&status=&bracket_type=...
create index concurrently if not exists idx_matches_tournament_round_status_bracket_sched
  on public.matches (tournament_id, round, status, bracket_type, scheduled_at);

-- API: bracket view ordering by round_number + match_order + scheduled_at
create index concurrently if not exists idx_matches_tournament_bracket_round_match_sched
  on public.matches (tournament_id, bracket_type, round_number, match_order, scheduled_at);

-- API: incremental updates by updated_at with optional tournament/bracket filters.
-- Run these only if public.matches.updated_at exists in your environment.
-- create index concurrently if not exists idx_matches_updated_at
--   on public.matches (updated_at);
--
-- create index concurrently if not exists idx_matches_tournament_bracket_updated
--   on public.matches (tournament_id, bracket_type, updated_at);

-- API: schedule view status + scheduled_at
create index concurrently if not exists idx_matches_status_scheduled_at
  on public.matches (status, scheduled_at);

-- API: team match-history OR queries (team_a_id or team_b_id)
create index concurrently if not exists idx_matches_team_a_played_at
  on public.matches (team_a_id, played_at desc);

create index concurrently if not exists idx_matches_team_b_played_at
  on public.matches (team_b_id, played_at desc);

-- API: leaderboard derivation from tournament completed rows
create index concurrently if not exists idx_matches_tournament_completed_counts
  on public.matches (tournament_id, status, counts_for_standings);

-- ============================================================================
-- NOTIFICATIONS / ANNOUNCEMENTS
-- ============================================================================
create index concurrently if not exists idx_notifications_user_type_read_created
  on public.notifications (user_id, type, read, created_at desc);

create index concurrently if not exists idx_announcements_created_at
  on public.announcements (created_at desc);

create index concurrently if not exists idx_announcements_tournament_created
  on public.announcements (tournament_id, created_at desc);

-- ============================================================================
-- TEAM SAVED ROSTERS / INVITES / JOIN REQUESTS
-- ============================================================================
create index concurrently if not exists idx_team_saved_rosters_team_updated
  on public.team_saved_rosters (team_id, updated_at desc);

create index concurrently if not exists idx_team_invites_team_status_created
  on public.team_invites (team_id, status, created_at desc);

create index concurrently if not exists idx_team_invites_invitee_status_created
  on public.team_invites (invitee_player_id, status, created_at desc);

create index concurrently if not exists idx_team_join_requests_requester_status_created
  on public.team_join_requests (requester_player_id, status, created_at desc);

create index concurrently if not exists idx_team_join_requests_team_status_created
  on public.team_join_requests (team_id, status, created_at desc);

-- ============================================================================
-- VERIFY INDEX PRESENCE
-- ============================================================================
select schemaname, tablename, indexname
from pg_indexes
where schemaname = 'public'
  and (
    indexname like 'idx_tournaments_%'
    or indexname like 'idx_registrations_%'
    or indexname like 'idx_teams_%'
    or indexname like 'idx_players_%'
    or indexname like 'idx_matches_%'
    or indexname like 'idx_notifications_%'
    or indexname like 'idx_announcements_%'
    or indexname like 'idx_team_saved_rosters_%'
    or indexname like 'idx_team_invites_%'
    or indexname like 'idx_team_join_requests_%'
  )
order by tablename, indexname;

