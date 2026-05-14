const { COD_MODES, normalizeCodMode } = require('./modes');
const { resolveMatch, n } = require('./resolveMatch');
const { winsNeeded, countMapWins, evaluateSeries } = require('./series');

module.exports = {
  COD_MODES,
  normalizeCodMode,
  resolveMatch,
  n,
  winsNeeded,
  countMapWins,
  evaluateSeries,
};
