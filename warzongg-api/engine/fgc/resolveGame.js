/**
 * Single fighting-game match (one "game"): round wins → game winner.
 * score_a / score_b = rounds won by each player in this game.
 */

function n(x) {
  if (x === null || x === undefined || x === '') return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

/**
 * @param {object} input
 * @param {string} input.teamAId
 * @param {string} input.teamBId
 * @param {number|null|undefined} input.scoreA
 * @param {number|null|undefined} input.scoreB
 * @param {number} input.roundsToWin — first to this many round wins (e.g. 2)
 */
function resolveFgcGame(input) {
  const { teamAId, teamBId, scoreA, scoreB, roundsToWin: rtw } = input;
  const need = Number(rtw);
  const roundsToWin = Number.isFinite(need) && need >= 1 ? need : 2;

  const a = n(scoreA);
  const b = n(scoreB);

  if (a === null || b === null) {
    return {
      winnerId: null,
      loserId: null,
      incomplete: true,
      isDraw: false,
      reason: 'FGC game needs score_a and score_b (rounds won this game).',
    };
  }

  if (a === b) {
    return {
      winnerId: null,
      loserId: null,
      incomplete: true,
      isDraw: true,
      reason: 'Tied rounds — fighting games require a decisive winner for a completed game.',
    };
  }

  const winA = a > b && a >= roundsToWin;
  const winB = b > a && b >= roundsToWin;

  if (winA) {
    return {
      winnerId: teamAId,
      loserId: teamBId,
      incomplete: false,
      isDraw: false,
      reason: 'Round wins',
    };
  }
  if (winB) {
    return {
      winnerId: teamBId,
      loserId: teamAId,
      incomplete: false,
      isDraw: false,
      reason: 'Round wins',
    };
  }

  return {
    winnerId: null,
    loserId: null,
    incomplete: true,
    isDraw: false,
    reason: `No player reached ${roundsToWin} round wins (unfinished or invalid scoreline).`,
  };
}

module.exports = { resolveFgcGame, n };
