const assert = require('assert');
const { resolveFifaMatch } = require('./resolveMatch');
const { computeAggregate } = require('./aggregate');
const { standingsFromMatches, sortStandings } = require('./standings');

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

// Group draw
const g = resolveFifaMatch({
  teamAId: A,
  teamBId: B,
  scoreA: 2,
  scoreB: 2,
  round: 'group_stage',
  stats: {},
});
assert.strictEqual(g.isDraw, true);
assert.strictEqual(g.winnerId, null);

// Knockout needs ET/PEN/admin
const k = resolveFifaMatch({
  teamAId: A,
  teamBId: B,
  scoreA: 1,
  scoreB: 1,
  round: 'quarter_final',
  stats: {},
});
assert.strictEqual(k.winnerId, null);
assert.strictEqual(k.incomplete, true);

const k2 = resolveFifaMatch({
  teamAId: A,
  teamBId: B,
  scoreA: 1,
  scoreB: 1,
  round: 'quarter_final',
  stats: { fifa: { pen_goals_a: 4, pen_goals_b: 3 } },
});
assert.strictEqual(k2.winnerId, A);

const agg = computeAggregate(A, B, [
  { team_a_id: A, team_b_id: B, score_a: 2, score_b: 1 },
  { team_a_id: B, team_b_id: A, score_a: 2, score_b: 0 },
]);
assert.strictEqual(agg.aggregateA, 2);
assert.strictEqual(agg.aggregateB, 3);
assert.strictEqual(agg.winnerId, B);

const rows = standingsFromMatches(
  [
    { team_a_id: A, team_b_id: B, score_a: 3, score_b: 1 },
    { team_a_id: A, team_b_id: B, score_a: 0, score_b: 0 },
  ],
  [A, B],
);
const ranked = sortStandings(rows);
assert.strictEqual(ranked[0].teamId, A);

console.log('FIFA engine selfTest OK');
