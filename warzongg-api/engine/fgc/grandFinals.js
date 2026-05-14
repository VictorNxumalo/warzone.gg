/**
 * Grand finals bracket-reset helpers (double elimination).
 * Pure logic — wire to bracket storage when you persist winners/losers bracket state.
 */

/**
 * After first grand-final set: if winners-bracket player lost, a reset set is required.
 * @param {boolean} firstSetWonByLosersBracketPlayer - true if underdog from losers won set 1
 * @param {boolean} grandFinalsResetEnabled — from tournament.fgc_config.grand_finals_reset
 */
function needsBracketReset(firstSetWonByLosersBracketPlayer, grandFinalsResetEnabled) {
  if (!grandFinalsResetEnabled) return false;
  return !!firstSetWonByLosersBracketPlayer;
}

/**
 * Tournament complete when: winners player won first set, OR losers player won both reset + first (simplified model).
 * @param {{ winnersSideWonFirstSet: boolean, resetSetCompleted?: boolean, resetWonByWinnersSide?: boolean }} state
 */
function isTournamentComplete(state) {
  if (!state) return false;
  if (state.winnersSideWonFirstSet) return true;
  if (state.resetSetCompleted && state.resetWonByWinnersSide === false) return true;
  return false;
}

module.exports = {
  needsBracketReset,
  isTournamentComplete,
};
