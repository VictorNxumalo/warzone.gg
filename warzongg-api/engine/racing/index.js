const { resolveRaceResults } = require('./resolveRace');
const { buildRaceStandings } = require('./standings');
const { DEFAULT_POINTS_BY_POSITION, normalizePointsByPosition, pointsForPosition } = require('./scoring');

module.exports = {
  resolveRaceResults,
  buildRaceStandings,
  DEFAULT_POINTS_BY_POSITION,
  normalizePointsByPosition,
  pointsForPosition,
};
