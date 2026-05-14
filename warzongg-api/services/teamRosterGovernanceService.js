const { supabaseAdmin } = require('../config/supabase');

/** Tournament is considered “active” for roster-leave restrictions while in these statuses (approved registration). */
const LOCKING_TOURNAMENT_STATUSES = ['upcoming', 'open', 'live'];

/** Cooldown before a free agent can join-request / accept invite / register a new squad (ms). */
const FREE_AGENT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * If the team is in an active competitive window, returns a structured reason; otherwise null.
 */
async function getTeamCompetitionLock(teamId) {
  if (!teamId) return null;

  const { data: activeMatches, error: mErr } = await supabaseAdmin
    .from('matches')
    .select('id, round, status')
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .in('status', ['scheduled', 'live'])
    .limit(8);

  if (mErr) {
    return {
      code: 'LOCK_CHECK_UNAVAILABLE',
      message:
        'Could not verify roster lock status due to a temporary data-service issue. Please retry in a moment.',
      details: { source: 'matches', error: mErr.message },
    };
  }

  if (activeMatches?.length) {
    return {
      code: 'ACTIVE_MATCHES',
      message:
        'Your team has scheduled or live matches. Finish or withdraw via admins before roster changes.',
      details: { matches: activeMatches },
    };
  }

  const { data: regs, error: rErr } = await supabaseAdmin
    .from('registrations')
    .select(`
      id,
      tournament:tournaments ( id, name, status )
    `)
    .eq('team_id', teamId)
    .eq('status', 'approved');

  if (rErr) {
    return {
      code: 'LOCK_CHECK_UNAVAILABLE',
      message:
        'Could not verify roster lock status due to a temporary data-service issue. Please retry in a moment.',
      details: { source: 'registrations', error: rErr.message },
    };
  }

  if (!regs?.length) return null;

  for (const r of regs) {
    const ts = r.tournament?.status;
    if (ts && LOCKING_TOURNAMENT_STATUSES.includes(ts)) {
      return {
        code: 'ACTIVE_TOURNAMENT',
        message: `Your team is entered in an active tournament (${r.tournament?.name || 'event'}). You cannot leave the roster until the event is completed or admins release your squad.`,
        details: { registration_id: r.id, tournament: r.tournament },
      };
    }
  }

  return null;
}

function msUntilCooldownEnds(freeAgentSince) {
  if (!freeAgentSince) return 0;
  const started = new Date(freeAgentSince).getTime();
  if (Number.isNaN(started)) return 0;
  const ends = started + FREE_AGENT_COOLDOWN_MS;
  return Math.max(0, ends - Date.now());
}

module.exports = {
  getTeamCompetitionLock,
  FREE_AGENT_COOLDOWN_MS,
  LOCKING_TOURNAMENT_STATUSES,
  msUntilCooldownEnds,
};
