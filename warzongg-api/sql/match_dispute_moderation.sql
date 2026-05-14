-- ═══════════════════════════════════════════════════════════════════════════
-- Match dispute + moderation lifecycle fields (Supabase / PostgreSQL)
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO APPLY
-- 1. Supabase Dashboard -> SQL Editor -> New query.
-- 2. Paste this file and Run.
-- 3. Ignore "already exists" by re-running unapplied statements only.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dispute_status text
  CHECK (dispute_status IS NULL OR dispute_status IN ('open', 'resolved', 'rejected'));

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dispute_notes text;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dispute_proof_url text;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS disputed_by_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dispute_opened_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dispute_resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_dispute_status ON public.matches(dispute_status);

COMMENT ON COLUMN public.matches.dispute_status IS
  'Dispute lifecycle state: open, resolved, or rejected.';
