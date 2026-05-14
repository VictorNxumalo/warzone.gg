/**
 * Best-of series: first to win ceil(bestOf / 2) maps.
 * (Bo3 → first to 2, Bo5 → first to 3.)
 */
function winsNeeded(bestOf) {
  const b = Number(bestOf);
  if (!Number.isFinite(b) || b < 1) return 1;
  return Math.ceil(b / 2);
}

/**
 * @param {Array<{ status: string, winner_id: string | null }>} completedMaps
 * @param {string} teamAId
 * @param {string} teamBId
 */
function countMapWins(completedMaps, teamAId, teamBId) {
  let winsA = 0;
  let winsB = 0;
  for (const m of completedMaps) {
    if (m.status !== 'completed' || !m.winner_id) continue;
    if (m.winner_id === teamAId) winsA += 1;
    else if (m.winner_id === teamBId) winsB += 1;
  }
  return { winsA, winsB };
}

/**
 * @returns {{ complete: boolean, winnerTeamId: string|null, winsA: number, winsB: number }}
 */
function evaluateSeries(bestOf, completedMaps, teamAId, teamBId) {
  const { winsA, winsB } = countMapWins(completedMaps, teamAId, teamBId);
  const need = winsNeeded(bestOf);
  let winnerTeamId = null;
  if (winsA >= need) winnerTeamId = teamAId;
  else if (winsB >= need) winnerTeamId = teamBId;
  return {
    complete: winnerTeamId !== null,
    winnerTeamId,
    winsA,
    winsB,
    mapsNeeded: need,
  };
}

module.exports = { winsNeeded, countMapWins, evaluateSeries };
