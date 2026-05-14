const assert = require('assert');
const { resolveFgcGame } = require('./resolveGame');
const { mergeFgcConfig } = require('./mergeConfig');
const { evaluateSeries } = require('../cod/series');
const { needsBracketReset } = require('./grandFinals');

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const g = resolveFgcGame({
  teamAId: A,
  teamBId: B,
  scoreA: 2,
  scoreB: 1,
  roundsToWin: 2,
});
assert.strictEqual(g.winnerId, A);
assert.strictEqual(g.incomplete, false);

const bad = resolveFgcGame({
  teamAId: A,
  teamBId: B,
  scoreA: 1,
  scoreB: 1,
  roundsToWin: 2,
});
assert.strictEqual(bad.incomplete, true);

const cfg = mergeFgcConfig(
  { fgc_config: { games_best_of: 5, rounds_to_win_game: 2 } },
  { games_best_of: 3, rounds_to_win_game: 3 },
);
assert.strictEqual(cfg.games_best_of, 3);
assert.strictEqual(cfg.rounds_to_win_game, 3);

const ev = evaluateSeries(
  3,
  [
    { status: 'completed', winner_id: A },
    { status: 'completed', winner_id: B },
    { status: 'completed', winner_id: A },
  ],
  A,
  B,
);
assert.strictEqual(ev.complete, true);
assert.strictEqual(ev.winnerTeamId, A);

assert.strictEqual(needsBracketReset(true, true), true);
assert.strictEqual(needsBracketReset(true, false), false);

console.log('FGC engine selfTest OK');
