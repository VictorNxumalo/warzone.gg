const { resolveFifaMatch, n, drawsAllowedForRound, isGroupRound } = require('./resolveMatch');
const { computeAggregate } = require('./aggregate');
const { sortStandings, standingsFromMatches } = require('./standings');

module.exports = {
  resolveFifaMatch,
  n,
  drawsAllowedForRound,
  isGroupRound,
  computeAggregate,
  sortStandings,
  standingsFromMatches,
};
