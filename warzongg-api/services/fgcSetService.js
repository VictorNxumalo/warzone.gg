const { supabaseAdmin } = require('../config/supabase');
const { evaluateSeries } = require('../engine/cod');

/**
 * Fighting-game set: best-of games (maps); each game is one `matches` row with fgc_set_id + fgc_game_number.
 * Same numeric progression as COD match_series / best_of.
 */
async function createFgcSet({
  tournament_id,
  team_a_id,
  team_b_id,
  games_best_of = 3,
  rounds_to_win_game = 2,
  round = 'group_stage',
}) {
  const bo = [1, 3, 5, 7].includes(Number(games_best_of)) ? Number(games_best_of) : 3;
  const rtw = Number(rounds_to_win_game);
  const rounds = Number.isFinite(rtw) && rtw >= 1 && rtw <= 9 ? rtw : 2;

  const { data, error } = await supabaseAdmin
    .from('fgc_match_sets')
    .insert({
      tournament_id,
      team_a_id,
      team_b_id,
      games_best_of: bo,
      rounds_to_win_game: rounds,
      status: 'open',
      round,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getFgcSetById(id) {
  const { data, error } = await supabaseAdmin
    .from('fgc_match_sets')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function listFgcGames(setId) {
  const { data, error } = await supabaseAdmin
    .from('matches')
    .select('id, status, winner_id, team_a_id, team_b_id, fgc_game_number')
    .eq('fgc_set_id', setId)
    .order('fgc_game_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Recompute set status + winner from child games.
 */
async function recomputeFgcSetFromGames(setId) {
  const set = await getFgcSetById(setId);
  if (!set) return null;

  const games = await listFgcGames(setId);
  const ev = evaluateSeries(set.games_best_of, games, set.team_a_id, set.team_b_id);

  const nextStatus = ev.complete ? 'complete' : 'open';
  const nextWinner = ev.winnerTeamId;

  const previous = { status: set.status, winner_team_id: set.winner_team_id };

  const { data: updated, error } = await supabaseAdmin
    .from('fgc_match_sets')
    .update({
      status: nextStatus,
      winner_team_id: nextWinner,
      updated_at: new Date().toISOString(),
    })
    .eq('id', setId)
    .select()
    .single();

  if (error) throw error;
  return { set: updated, eval: ev, previous };
}

module.exports = {
  createFgcSet,
  getFgcSetById,
  listFgcGames,
  recomputeFgcSetFromGames,
};
