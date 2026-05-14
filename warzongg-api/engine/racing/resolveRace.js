const { normalizePointsByPosition, pointsForPosition } = require('./scoring');

function isObj(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row) {
  if (!isObj(row)) return null;
  const participantId = row.participant_id || row.team_id || row.player_id || row.id || null;
  const position = toNum(row.position);
  if (!participantId || position === null || position < 1) return null;
  return {
    participant_id: String(participantId),
    position,
    dnf: !!row.dnf,
    fastest_lap: !!(row.fastest_lap || row.fastestLap),
    penalty_seconds: toNum(row.penalty_seconds ?? row.penaltySeconds) || 0,
  };
}

function resolveRaceResults({ results, config = {} }) {
  if (!Array.isArray(results) || results.length === 0) {
    return { ok: false, reason: 'Racing results require a non-empty array.' };
  }

  const clean = results.map(normalizeRow).filter(Boolean);
  if (clean.length !== results.length) {
    return { ok: false, reason: 'Every result row needs participant_id and position >= 1.' };
  }

  const ids = new Set();
  const positions = new Set();
  for (const r of clean) {
    if (ids.has(r.participant_id)) return { ok: false, reason: 'Duplicate participant in race results.' };
    if (positions.has(r.position)) return { ok: false, reason: 'Duplicate finishing position in race results.' };
    ids.add(r.participant_id);
    positions.add(r.position);
  }

  const pointsByPosition = normalizePointsByPosition(config.points_by_position);
  const bonusFastestLap = Number(config.fastest_lap_bonus || 0);
  const applyFastestLap = bonusFastestLap > 0;

  const ranked = [...clean]
    .sort((a, b) => a.position - b.position)
    .map((r) => {
      const base = r.dnf ? 0 : pointsForPosition(r.position, pointsByPosition);
      const bonus = applyFastestLap && r.fastest_lap ? bonusFastestLap : 0;
      return { ...r, points: base + bonus };
    });

  const winner = ranked[0] || null;
  return {
    ok: true,
    winnerParticipantId: winner ? winner.participant_id : null,
    winnerPosition: winner ? winner.position : null,
    rows: ranked,
  };
}

module.exports = { resolveRaceResults };
