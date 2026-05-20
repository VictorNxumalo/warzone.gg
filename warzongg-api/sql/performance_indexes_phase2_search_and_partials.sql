-- EVOLVE / WARZONE.GG - Phase 2 indexing
-- Focus: search-heavy endpoints and partial indexes for common status slices.
--
-- Run in Supabase SQL Editor. Execute statement-by-statement.
-- NOTE: CONCURRENTLY cannot run inside BEGIN/COMMIT.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists pg_trgm;

-- ============================================================================
-- TRIGRAM INDEXES (ILIKE / fuzzy text search)
-- ============================================================================
create index concurrently if not exists idx_teams_name_trgm
  on public.teams using gin (name gin_trgm_ops);

create index concurrently if not exists idx_teams_tag_trgm
  on public.teams using gin (tag gin_trgm_ops);

create index concurrently if not exists idx_players_email_trgm
  on public.players using gin (email gin_trgm_ops);

create index concurrently if not exists idx_players_ign_trgm
  on public.players using gin (ign gin_trgm_ops);

create index concurrently if not exists idx_tournaments_name_trgm
  on public.tournaments using gin (name gin_trgm_ops);

-- ============================================================================
-- PARTIAL INDEXES (high-frequency filtered subsets)
-- ============================================================================
create index concurrently if not exists idx_registrations_pending_submitted_partial
  on public.registrations (submitted_at desc)
  where status = 'pending';

create index concurrently if not exists idx_registrations_approved_tournament_partial
  on public.registrations (tournament_id, submitted_at)
  where status = 'approved';

create index concurrently if not exists idx_team_invites_pending_team_created_partial
  on public.team_invites (team_id, created_at desc)
  where status = 'pending';

create index concurrently if not exists idx_team_invites_pending_invitee_created_partial
  on public.team_invites (invitee_player_id, created_at desc)
  where status = 'pending';

create index concurrently if not exists idx_team_join_requests_pending_team_created_partial
  on public.team_join_requests (team_id, created_at desc)
  where status = 'pending';

create index concurrently if not exists idx_team_join_requests_pending_requester_created_partial
  on public.team_join_requests (requester_player_id, created_at desc)
  where status = 'pending';

create index concurrently if not exists idx_matches_live_sched_partial
  on public.matches (scheduled_at)
  where status in ('scheduled', 'live');

create index concurrently if not exists idx_matches_completed_tournament_partial
  on public.matches (tournament_id, round)
  where status = 'completed';

-- ============================================================================
-- OPTIONAL CLEANUP CANDIDATES (review before using)
-- These are commented intentionally; keep only if planner confirms redundancy.
-- ============================================================================
-- drop index concurrently if exists public.idx_matches_status_scheduled_at;
-- drop index concurrently if exists public.idx_matches_tournament_completed_counts;

-- ============================================================================
-- QUICK HEALTH CHECK
-- ============================================================================
select
  relname as table_name,
  indexrelname as index_name,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
from pg_stat_user_indexes
where schemaname = 'public'
  and (
    indexrelname like 'idx_%trgm%'
    or indexrelname like 'idx_%pending_%'
    or indexrelname like 'idx_%completed_%'
  )
order by relname, indexrelname;

