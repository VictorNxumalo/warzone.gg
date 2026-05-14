/**
 * FIFA / football-style match resolution (goals, draws, ET/PEN for knockout).
 * Teams use the same UUID columns as the rest of the platform (`team_a_id` / `team_b_id`).
 */

/**
 * @typedef {object} FifaResolveInput
 * @property {string} teamAId
 * @property {string} teamBId
 * @property {number|null|undefined} scoreA — regulation goals (maps to score_a)
 * @property {number|null|undefined} scoreB
 * @property {string} [round] — structural phase; group_stage allows draws
 * @property {object} [stats] — may contain `fifa` payload
 * @property {object} [config] — overrides from tournament.fifa_scoring_config
 */

/**
 * @typedef {object} FifaResolveResult
 * @property {string|null} winnerId
 * @property {string|null} loserId
 * @property {boolean} isDraw — true only when the match is a valid completed draw
 * @property {boolean} [incomplete] — true when scores alone cannot finish (e.g. knockout tie without ET/PEN)
 * @property {string} phase — 'regular' | 'extra_time' | 'penalties' | 'admin'
 * @property {string} [reason]
 */

const GROUP_ROUNDS = new Set(['group_stage']);

function n(x) {
  if (x === null || x === undefined || x === '') return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function isGroupRound(round) {
  return GROUP_ROUNDS.has(String(round || 'group_stage'));
}

/** Whether a tied scoreline can remain a draw for this round. */
function drawsAllowedForRound(round, config) {
  if (config && typeof config.allow_draw === 'boolean') return config.allow_draw;
  if (config && typeof config.group_stage_allows_draw === 'boolean') {
    return config.group_stage_allows_draw;
  }
  return isGroupRound(round);
}

function readFifa(stats) {
  const raw = stats && typeof stats === 'object' ? stats.fifa : null;
  return raw && typeof raw === 'object' ? raw : {};
}

function cmpTotals(a, b, teamAId, teamBId) {
  if (a > b) return { winnerId: teamAId, loserId: teamBId, isDraw: false };
  if (b > a) return { winnerId: teamBId, loserId: teamAId, isDraw: false };
  return { winnerId: null, loserId: null, isDraw: true };
}

/**
 * Resolve a single match (one leg). Two-leg ties use `aggregate.js`.
 */
function resolveFifaMatch(input) {
  const {
    teamAId,
    teamBId,
    scoreA,
    scoreB,
    round = 'group_stage',
    stats = {},
    config = {},
  } = input;

  const fifa = readFifa(stats);
  const ga = n(scoreA);
  const gb = n(scoreB);

  if (ga === null || gb === null) {
    return {
      winnerId: null,
      loserId: null,
      isDraw: false,
      incomplete: true,
      phase: 'regular',
      reason: 'FIFA match needs score_a and score_b (goals).',
    };
  }

  if (ga > gb) {
    return {
      winnerId: teamAId,
      loserId: teamBId,
      isDraw: false,
      phase: 'regular',
      reason: 'Regulation goals',
    };
  }
  if (gb > ga) {
    return {
      winnerId: teamBId,
      loserId: teamAId,
      isDraw: false,
      phase: 'regular',
      reason: 'Regulation goals',
    };
  }

  // Regulation draw (equal goals)
  if (drawsAllowedForRound(round, config)) {
    return {
      winnerId: null,
      loserId: null,
      isDraw: true,
      phase: 'regular',
      reason: 'Draw',
    };
  }

  const adminW = fifa.admin_winner_team_id || fifa.winner_team_id;
  if (adminW === teamAId || adminW === teamBId) {
    return {
      winnerId: adminW,
      loserId: adminW === teamAId ? teamBId : teamAId,
      isDraw: false,
      phase: 'admin',
      reason: 'Admin-provided winner (stats.fifa.admin_winner_team_id)',
    };
  }

  const etA = n(fifa.et_goals_a ?? fifa.extra_time?.a ?? fifa.extra_time?.team_a);
  const etB = n(fifa.et_goals_b ?? fifa.extra_time?.b ?? fifa.extra_time?.team_b);
  if (etA !== null && etB !== null) {
    const r = cmpTotals(etA, etB, teamAId, teamBId);
    if (!r.isDraw) {
      return { ...r, phase: 'extra_time', reason: 'Extra time goals' };
    }
  }

  const penA = n(fifa.pen_goals_a ?? fifa.penalties?.a ?? fifa.penalties?.team_a);
  const penB = n(fifa.pen_goals_b ?? fifa.penalties?.b ?? fifa.penalties?.team_b);
  if (penA !== null && penB !== null) {
    const r = cmpTotals(penA, penB, teamAId, teamBId);
    if (!r.isDraw) {
      return { ...r, phase: 'penalties', reason: 'Penalty shootout' };
    }
  }

  return {
    winnerId: null,
    loserId: null,
    isDraw: false,
    incomplete: true,
    phase: 'regular',
    reason:
      'Knockout tie after regulation — add stats.fifa.extra_time / stats.fifa.penalties, '
      + 'or stats.fifa.admin_winner_team_id.',
  };
}

module.exports = {
  resolveFifaMatch,
  n,
  drawsAllowedForRound,
  isGroupRound,
};
