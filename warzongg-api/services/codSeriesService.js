const { supabaseAdmin } = require('../config/supabase');
const { evaluateSeries } = require('../engine/cod');

/**
 * Create a new head-to-head series (best-of) for a tournament.
 * Individual maps are stored as `matches` rows with `series_id` set.
 */
async function createMatchSeries({
  tournament_id,
  team_a_id,
  team_b_id,
  best_of = 3,
  round = 'group_stage',
}) {
  const bestOf = [1, 3, 5, 7].includes(Number(best_of)) ? Number(best_of) : 3;
  const { data, error } = await supabaseAdmin
    .from('match_series')
    .insert({
      tournament_id,
      team_a_id,
      team_b_id,
      best_of: bestOf,
      status: 'open',
      round,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getSeriesById(id) {
  const { data, error } = await supabaseAdmin
    .from('match_series')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function listSeriesMaps(seriesId) {
  const { data, error } = await supabaseAdmin
    .from('matches')
    .select('id, status, winner_id, team_a_id, team_b_id, map_number')
    .eq('series_id', seriesId)
    .order('map_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Recompute open/complete + winner from child matches; update `match_series` row.
 * @returns {Promise<{ series: object, eval: ReturnType<typeof evaluateSeries>, previous: object }>}
 */
async function recomputeSeriesFromMaps(seriesId) {
  const series = await getSeriesById(seriesId);
  if (!series) return null;

  const maps = await listSeriesMaps(seriesId);
  const ev = evaluateSeries(series.best_of, maps, series.team_a_id, series.team_b_id);

  const nextStatus = ev.complete ? 'complete' : 'open';
  const nextWinner = ev.winnerTeamId;

  const previous = { status: series.status, winner_team_id: series.winner_team_id };

  const { data: updated, error } = await supabaseAdmin
    .from('match_series')
    .update({
      status: nextStatus,
      winner_team_id: nextWinner,
      updated_at: new Date().toISOString(),
    })
    .eq('id', seriesId)
    .select()
    .single();

  if (error) throw error;
  return { series: updated, eval: ev, previous };
}

module.exports = {
  createMatchSeries,
  getSeriesById,
  listSeriesMaps,
  recomputeSeriesFromMaps,
};
