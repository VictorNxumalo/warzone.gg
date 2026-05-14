const { COD_MODES, normalizeCodMode } = require('./modes');

/**
 * @typedef {object} ResolveInput
 * @property {string} [codMode] — canonical mode (or pass gameMode to normalize)
 * @property {string} [gameMode] — raw label from DB/admin
 * @property {string} teamAId
 * @property {string} teamBId
 * @property {number|null} [scoreA]
 * @property {number|null} [scoreB]
 * @property {object} [stats] — mode-specific payload (see spec)
 */

/**
 * @typedef {object} ResolveResult
 * @property {string|null} winnerId
 * @property {string|null} loserId
 * @property {boolean} isDraw
 * @property {string} resolvedMode
 * @property {string} [reason]
 */

function n(x) {
  if (x === null || x === undefined || x === '') return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function cmpTotals(a, b, teamAId, teamBId) {
  if (a > b) return { winnerId: teamAId, loserId: teamBId, isDraw: false };
  if (b > a) return { winnerId: teamBId, loserId: teamAId, isDraw: false };
  return { winnerId: null, loserId: null, isDraw: true };
}

/**
 * FFA: stats.ffa = [{ player_id, team_id?, kills }] — highest kills wins (single winner row).
 * For team tournaments, aggregate by team_id if present.
 */
function resolveFFA(teamAId, teamBId, stats) {
  const rows = stats?.ffa;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { winnerId: null, loserId: null, isDraw: true, reason: 'FFA requires stats.ffa[]' };
  }
  const byTeam = new Map();
  for (const row of rows) {
    const tid = row.team_id || row.teamId;
    const k = n(row.kills);
    if (!tid || k === null) continue;
    byTeam.set(tid, (byTeam.get(tid) || 0) + k);
  }
  if (byTeam.size === 0) {
    return { winnerId: null, loserId: null, isDraw: true, reason: 'No team kills in FFA stats' };
  }
  let bestT = null;
  let bestK = -1;
  for (const [tid, kills] of byTeam) {
    if (kills > bestK) {
      bestK = kills;
      bestT = tid;
    }
  }
  const teams = [teamAId, teamBId].filter(Boolean);
  const other = teams.find((t) => t !== bestT) || null;
  return { winnerId: bestT, loserId: other, isDraw: false };
}

/**
 * BR: use combined points if provided, else placement + kills weighting.
 * stats.br = { team_a: { placement, kills, points? }, team_b: { ... } }
 */
function resolveBR(teamAId, teamBId, stats) {
  const br = stats?.br || stats?.battle_royale;
  if (!br) {
    return { winnerId: null, loserId: null, isDraw: true, reason: 'BR requires stats.br' };
  }
  const a = br.team_a || br.teamA || {};
  const b = br.team_b || br.teamB || {};
  const pa = n(a.points);
  const pb = n(b.points);
  if (pa !== null && pb !== null) {
    return { ...cmpTotals(pa, pb, teamAId, teamBId), reason: 'BR total points' };
  }
  const placeA = n(a.placement) ?? 999;
  const placeB = n(b.placement) ?? 999;
  const killsA = n(a.kills) ?? 0;
  const killsB = n(b.kills) ?? 0;
  // Lower placement is better; tie-break kills
  if (placeA < placeB) return { winnerId: teamAId, loserId: teamBId, isDraw: false, reason: 'BR placement' };
  if (placeB < placeA) return { winnerId: teamBId, loserId: teamAId, isDraw: false, reason: 'BR placement' };
  return { ...cmpTotals(killsA, killsB, teamAId, teamBId), reason: 'BR kills tie-break' };
}

/**
 * Core resolution: mode-specific rules from the design doc.
 */
function resolveMatch(input) {
  const {
    codMode: cm,
    gameMode,
    teamAId,
    teamBId,
    scoreA,
    scoreB,
    stats = {},
  } = input;

  const resolvedMode = cm && Object.values(COD_MODES).includes(cm)
    ? cm
    : normalizeCodMode(gameMode);

  const sa = n(scoreA);
  const sb = n(scoreB);

  // ── Modes driven primarily by stats object ─────────────────────────────
  if (resolvedMode === COD_MODES.SEARCH_DESTROY) {
    const ra = n(stats.rounds_a ?? stats.roundsA);
    const rb = n(stats.rounds_b ?? stats.roundsB);
    if (ra !== null && rb !== null) {
      return {
        ...cmpTotals(ra, rb, teamAId, teamBId),
        resolvedMode,
        reason: 'S&D rounds',
      };
    }
    if (sa !== null && sb !== null) {
      return {
        ...cmpTotals(sa, sb, teamAId, teamBId),
        resolvedMode,
        reason: 'S&D fallback scores',
      };
    }
    return { winnerId: null, loserId: null, isDraw: true, resolvedMode, reason: 'S&D needs rounds or scores' };
  }

  if (resolvedMode === COD_MODES.HARDPOINT) {
    const pa = n(stats.hardpoint_a ?? stats.points_a ?? stats.pointsA) ?? sa;
    const pb = n(stats.hardpoint_b ?? stats.points_b ?? stats.pointsB) ?? sb;
    if (pa !== null && pb !== null) {
      return {
        ...cmpTotals(pa, pb, teamAId, teamBId),
        resolvedMode,
        reason: 'Hardpoint points',
      };
    }
    return { winnerId: null, loserId: null, isDraw: true, resolvedMode, reason: 'Hardpoint needs points' };
  }

  if (resolvedMode === COD_MODES.DOMINATION) {
    const pa = n(stats.points_a ?? stats.pointsA) ?? sa;
    const pb = n(stats.points_b ?? stats.pointsB) ?? sb;
    if (pa !== null && pb !== null) {
      return {
        ...cmpTotals(pa, pb, teamAId, teamBId),
        resolvedMode,
        reason: 'Domination score',
      };
    }
    return { winnerId: null, loserId: null, isDraw: true, resolvedMode, reason: 'Domination needs scores' };
  }

  if (resolvedMode === COD_MODES.TDM || resolvedMode === COD_MODES.DUEL_1V1) {
    const ka = n(stats.kills_a ?? stats.killsA) ?? sa;
    const kb = n(stats.kills_b ?? stats.killsB) ?? sb;
    if (ka !== null && kb !== null) {
      return {
        ...cmpTotals(ka, kb, teamAId, teamBId),
        resolvedMode,
        reason: resolvedMode === COD_MODES.DUEL_1V1 ? '1v1 kills/score' : 'TDM kills',
      };
    }
    return { winnerId: null, loserId: null, isDraw: true, resolvedMode, reason: 'TDM/1v1 needs kills or scores' };
  }

  if (resolvedMode === COD_MODES.FFA) {
    const r = resolveFFA(teamAId, teamBId, stats);
    return { ...r, resolvedMode, reason: r.reason || 'FFA' };
  }

  if (resolvedMode === COD_MODES.BATTLE_ROYALE) {
    const r = resolveBR(teamAId, teamBId, stats);
    return { ...r, resolvedMode, reason: r.reason || 'BR' };
  }

  // SCORE_ONLY / unknown: primary numeric scores
  if (sa !== null && sb !== null) {
    return {
      ...cmpTotals(sa, sb, teamAId, teamBId),
      resolvedMode,
      reason: 'Primary scores',
    };
  }

  return {
    winnerId: null,
    loserId: null,
    isDraw: true,
    resolvedMode,
    reason: 'Insufficient data to determine winner',
  };
}

module.exports = { resolveMatch, n };
