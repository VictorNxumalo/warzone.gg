/**
 * Merge tournament defaults with optional fgc_match_sets row fields.
 */
function mergeFgcConfig(tournamentRow, fgcSetRow) {
  const t = tournamentRow?.fgc_config && typeof tournamentRow.fgc_config === 'object'
    ? tournamentRow.fgc_config
    : {};

  const gamesBestOf = fgcSetRow?.games_best_of != null
    ? Number(fgcSetRow.games_best_of)
    : (t.games_best_of != null ? Number(t.games_best_of) : 3);

  const roundsToWinGame = fgcSetRow?.rounds_to_win_game != null
    ? Number(fgcSetRow.rounds_to_win_game)
    : (t.rounds_to_win_game != null ? Number(t.rounds_to_win_game) : 2);

  const safeBo = [1, 3, 5, 7].includes(gamesBestOf) ? gamesBestOf : 3;
  const safeR = Number.isFinite(roundsToWinGame) && roundsToWinGame >= 1 && roundsToWinGame <= 9
    ? roundsToWinGame
    : 2;

  return {
    games_best_of: safeBo,
    rounds_to_win_game: safeR,
    allow_draws: t.allow_draws === true,
  };
}

module.exports = { mergeFgcConfig };
