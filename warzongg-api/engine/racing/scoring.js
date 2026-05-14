const DEFAULT_POINTS_BY_POSITION = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

function normalizePointsByPosition(cfg) {
  const src = cfg && typeof cfg === 'object' ? cfg : DEFAULT_POINTS_BY_POSITION;
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    const pos = Number(k);
    const pts = Number(v);
    if (Number.isFinite(pos) && pos >= 1 && Number.isFinite(pts) && pts >= 0) {
      out[pos] = pts;
    }
  }
  return Object.keys(out).length ? out : { ...DEFAULT_POINTS_BY_POSITION };
}

function pointsForPosition(position, pointsByPosition) {
  const p = Number(position);
  if (!Number.isFinite(p) || p < 1) return 0;
  return Number(pointsByPosition[p] || 0);
}

module.exports = {
  DEFAULT_POINTS_BY_POSITION,
  normalizePointsByPosition,
  pointsForPosition,
};
