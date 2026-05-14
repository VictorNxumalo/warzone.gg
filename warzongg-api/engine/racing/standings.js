function buildRaceStandings(raceRowsByEvent) {
  const byId = new Map();

  for (const rows of raceRowsByEvent) {
    for (const r of rows || []) {
      const id = String(r.participant_id);
      const cur = byId.get(id) || {
        participant_id: id,
        total_points: 0,
        wins: 0,
        best_finish: null,
        races_counted: 0,
      };
      cur.total_points += Number(r.points || 0);
      if (Number(r.position) === 1) cur.wins += 1;
      if (cur.best_finish == null || Number(r.position) < cur.best_finish) {
        cur.best_finish = Number(r.position);
      }
      cur.races_counted += 1;
      byId.set(id, cur);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if ((a.best_finish || 999) !== (b.best_finish || 999)) {
        return (a.best_finish || 999) - (b.best_finish || 999);
      }
      return a.participant_id.localeCompare(b.participant_id);
    })
    .map((row, i) => ({ rank: i + 1, ...row }));
}

module.exports = { buildRaceStandings };
