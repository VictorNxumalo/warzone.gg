/**
 * Group-stage style standings rows (one row per participant).
 *
 * @typedef {object} StandingRow
 * @property {string} teamId
 * @property {number} played
 * @property {number} wins
 * @property {number} draws
 * @property {number} losses
 * @property {number} points — 3 / 1 / 0
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 * @property {number} goalDifference
 */

function sortStandings(rows, options = {}) {
  const useHeadToHead = !!options.headToHead && typeof options.headToHeadCompare === 'function';

  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (useHeadToHead) {
      const h = options.headToHeadCompare(a.teamId, b.teamId);
      if (h !== 0) return h;
    }
    return String(a.teamId).localeCompare(String(b.teamId));
  });

  return sorted.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}

/**
 * Build standings from flat list of completed group matches (team_a vs team_b, scores = goals).
 */
function standingsFromMatches(matches, participantIds) {
  const idSet = new Set(participantIds.map(String));
  const byId = new Map();
  for (const id of participantIds) {
    byId.set(String(id), {
      teamId: String(id),
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
    });
  }

  for (const m of matches) {
    const ta = m.team_a_id && String(m.team_a_id);
    const tb = m.team_b_id && String(m.team_b_id);
    if (!ta || !tb || !idSet.has(ta) || !idSet.has(tb)) continue;
    const sa = Number(m.score_a);
    const sb = Number(m.score_b);
    if (!Number.isFinite(sa) || !Number.isFinite(sb)) continue;

    const rowA = byId.get(ta);
    const rowB = byId.get(tb);
    if (!rowA || !rowB) continue;

    rowA.played += 1;
    rowB.played += 1;
    rowA.goalsFor += sa;
    rowA.goalsAgainst += sb;
    rowB.goalsFor += sb;
    rowB.goalsAgainst += sa;
    rowA.goalDifference = rowA.goalsFor - rowA.goalsAgainst;
    rowB.goalDifference = rowB.goalsFor - rowB.goalsAgainst;

    if (sa > sb) {
      rowA.wins += 1;
      rowA.points += 3;
      rowB.losses += 1;
    } else if (sb > sa) {
      rowB.wins += 1;
      rowB.points += 3;
      rowA.losses += 1;
    } else {
      rowA.draws += 1;
      rowB.draws += 1;
      rowA.points += 1;
      rowB.points += 1;
    }
  }

  return Array.from(byId.values());
}

module.exports = {
  sortStandings,
  standingsFromMatches,
};
