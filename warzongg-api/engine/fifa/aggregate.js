const { n } = require('./resolveMatch');

/**
 * Two-leg aggregate from two completed matches (any order in `legs` array).
 * Each leg: { team_a_id, team_b_id, score_a, score_b } (scores = regulation goals for that leg).
 *
 * @param {string} sideAId — entity (team) considered "A" for aggregate reporting
 * @param {string} sideBId
 * @param {Array<{ team_a_id: string, team_b_id: string, score_a: number, score_b: number }>} legs
 * @param {object} [opts]
 * @param {boolean} [opts.awayGoalsRule] — if aggregate tied, higher away goals wins
 */
function computeAggregate(sideAId, sideBId, legs, opts = {}) {
  const awayGoalsRule = !!opts.awayGoalsRule;

  if (!Array.isArray(legs) || legs.length === 0) {
    return {
      aggregateA: null,
      aggregateB: null,
      awayGoalsA: null,
      awayGoalsB: null,
      winnerId: null,
      reason: 'Need at least one completed leg.',
    };
  }

  let aggA = 0;
  let aggB = 0;
  let awayA = 0;
  let awayB = 0;

  for (const leg of legs) {
    const ta = leg.team_a_id;
    const tb = leg.team_b_id;
    const sa = n(leg.score_a);
    const sb = n(leg.score_b);
    if (sa === null || sb === null) continue;

    const aIsHome = ta === sideAId && tb === sideBId;
    const bIsHome = tb === sideAId && ta === sideBId;
    if (!aIsHome && !bIsHome) continue;

    if (aIsHome) {
      aggA += sa;
      aggB += sb;
      awayB += sb;
    } else {
      aggA += sb;
      aggB += sa;
      awayA += sb;
    }
  }

  if (aggA > aggB) {
    return {
      aggregateA: aggA,
      aggregateB: aggB,
      awayGoalsA: awayA,
      awayGoalsB: awayB,
      winnerId: sideAId,
      loserId: sideBId,
      reason: 'Aggregate goals',
    };
  }
  if (aggB > aggA) {
    return {
      aggregateA: aggA,
      aggregateB: aggB,
      awayGoalsA: awayA,
      awayGoalsB: awayB,
      winnerId: sideBId,
      loserId: sideAId,
      reason: 'Aggregate goals',
    };
  }

  if (awayGoalsRule) {
    if (awayA > awayB) {
      return {
        aggregateA: aggA,
        aggregateB: aggB,
        awayGoalsA: awayA,
        awayGoalsB: awayB,
        winnerId: sideAId,
        loserId: sideBId,
        reason: 'Away goals rule',
      };
    }
    if (awayB > awayA) {
      return {
        aggregateA: aggA,
        aggregateB: aggB,
        awayGoalsA: awayA,
        awayGoalsB: awayB,
        winnerId: sideBId,
        loserId: sideAId,
        reason: 'Away goals rule',
      };
    }
  }

  return {
    aggregateA: aggA,
    aggregateB: aggB,
    awayGoalsA: awayA,
    awayGoalsB: awayB,
    winnerId: null,
    loserId: null,
    reason: awayGoalsRule
      ? 'Aggregate and away goals tied — use stats.fifa.admin_winner_team_id on a decider row or ET/PEN.'
      : 'Aggregate tied — enable awayGoalsRule or supply admin winner.',
  };
}

module.exports = { computeAggregate };
