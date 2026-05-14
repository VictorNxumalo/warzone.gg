const assert = require('assert');
const { resolveRaceResults } = require('./resolveRace');
const { buildRaceStandings } = require('./standings');

const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const c = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const r1 = resolveRaceResults({
  results: [
    { participant_id: a, position: 1, fastest_lap: true },
    { participant_id: b, position: 2 },
    { participant_id: c, position: 3 },
  ],
  config: { fastest_lap_bonus: 1 },
});

assert.strictEqual(r1.ok, true);
assert.strictEqual(r1.rows[0].points, 26);
assert.strictEqual(r1.rows[1].points, 18);

const r2 = resolveRaceResults({
  results: [
    { participant_id: b, position: 1 },
    { participant_id: a, position: 2 },
    { participant_id: c, position: 3, dnf: true },
  ],
});

assert.strictEqual(r2.ok, true);
assert.strictEqual(r2.rows[2].points, 0);

const table = buildRaceStandings([r1.rows, r2.rows]);
assert.strictEqual(table[0].participant_id, a);
assert.strictEqual(table[0].total_points, 44);

console.log('Racing engine selfTest OK');
