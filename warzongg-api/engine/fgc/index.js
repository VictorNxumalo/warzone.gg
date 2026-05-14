const { resolveFgcGame, n } = require('./resolveGame');
const { mergeFgcConfig } = require('./mergeConfig');
const { evaluateSeries, winsNeeded } = require('../cod/series');
const { needsBracketReset, isTournamentComplete } = require('./grandFinals');

module.exports = {
  resolveFgcGame,
  n,
  mergeFgcConfig,
  evaluateSeries,
  winsNeeded,
  needsBracketReset,
  isTournamentComplete,
};
