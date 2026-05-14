-- Align players.codm_uid with app validation (register + teamsController):
-- 3–32 chars, letters, digits, ".", "_", "-"
-- Run in Supabase → SQL Editor if you see: players_codm_uid_check violation

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_codm_uid_check;

ALTER TABLE public.players
  ADD CONSTRAINT players_codm_uid_check
  CHECK (
    codm_uid IS NOT NULL
    AND char_length(trim(codm_uid)) >= 3
    AND char_length(trim(codm_uid)) <= 32
    AND trim(codm_uid) ~ '^[A-Za-z0-9._-]+$'
  );
