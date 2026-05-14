const { createMatchSeries } = require('../services/codSeriesService');

// POST /api/match-series — admin: create a best-of container; add maps via POST /api/matches with series_id
async function create(req, res) {
  try {
    const data = await createMatchSeries(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { create };
