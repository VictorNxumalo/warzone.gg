#!/usr/bin/env node
/* eslint-disable no-console */
const assert = require('assert');
const { resolveMatch } = require('./resolveMatch');
const { COD_MODES } = require('./modes');
const { evaluateSeries, winsNeeded } = require('./series');

const tA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const tB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let r = resolveMatch({
  codMode: COD_MODES.SEARCH_DESTROY,
  teamAId: tA,
  teamBId: tB,
  scoreA: null,
  scoreB: null,
  stats: { rounds_a: 6, rounds_b: 4 },
});
assert.strictEqual(r.winnerId, tA);

r = resolveMatch({
  gameMode: 'Hardpoint',
  teamAId: tA,
  teamBId: tB,
  stats: { hardpoint_a: 250, hardpoint_b: 180 },
});
assert.strictEqual(r.winnerId, tA);

r = resolveMatch({
  gameMode: 'TDM',
  teamAId: tA,
  teamBId: tB,
  stats: { kills_a: 75, kills_b: 60 },
});
assert.strictEqual(r.winnerId, tA);

assert.strictEqual(winsNeeded(3), 2);
assert.strictEqual(winsNeeded(5), 3);

const ev = evaluateSeries(
  3,
  [
    { status: 'completed', winner_id: tA },
    { status: 'completed', winner_id: tB },
  ],
  tA,
  tB
);
assert.strictEqual(ev.complete, false);

const ev2 = evaluateSeries(
  3,
  [
    { status: 'completed', winner_id: tA },
    { status: 'completed', winner_id: tA },
  ],
  tA,
  tB
);
assert.strictEqual(ev2.complete, true);
assert.strictEqual(ev2.winnerTeamId, tA);

console.log('COD engine selfTest OK');
