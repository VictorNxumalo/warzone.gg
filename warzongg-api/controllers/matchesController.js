// ─────────────────────────────────────────────────────────────────────────────
// Matches — COD (modes + series), FIFA (goals), FGC (rounds → game → set, best-of games)
// POINTS_TABLE: COD global team row updates per structural round
// Series maps / FGC games: counts_for_standings = false; one W/L when container completes.
// FIFA: tournament leaderboard match-derived; FGC: set-based (no per-game points table).
// ─────────────────────────────────────────────────────────────────────────────

const { supabase, supabaseAdmin } = require('../config/supabase');
const { resolveMatch } = require('../engine/cod');
const { resolveFifaMatch } = require('../engine/fifa');
const { resolveFgcGame, mergeFgcConfig } = require('../engine/fgc');
const { resolveRaceResults } = require('../engine/racing');
const codSeriesService = require('../services/codSeriesService');
const fgcSetService = require('../services/fgcSetService');
const { syncWinnerProgression } = require('../services/bracketProgressionService');

const POINTS_TABLE = {
  group_stage:   2,
  quarter_final: 3,
  semi_final:    4,
  grand_final:   5,
};

function pickOpponent(series, winnerId) {
  if (!series || !winnerId) return null;
  if (winnerId === series.team_a_id) return series.team_b_id;
  if (winnerId === series.team_b_id) return series.team_a_id;
  return null;
}

function tournamentLooksLikeFifa(t) {
  if (!t) return false;
  const engine = String(t.game_rule_profile?.engine || '').toLowerCase();
  if (engine) return engine === 'fifa';
  const s = `${t.type || ''} ${t.mode || ''}`.toLowerCase();
  return s.includes('fifa');
}

function tournamentLooksLikeFgc(t) {
  if (!t) return false;
  const engine = String(t.game_rule_profile?.engine || '').toLowerCase();
  if (engine) return engine === 'fgc';
  if (t.fgc_config && typeof t.fgc_config === 'object' && Object.keys(t.fgc_config).length > 0) {
    return true;
  }
  const s = `${t.type || ''} ${t.mode || ''} ${t.name || ''}`.toLowerCase();
  return /mortal kombat|\btekken\b|street fighter|soulcalibur|guilty gear|king of fighters|kof\b|\bfgc\b|fighting game|super smash|ea sports ufc/.test(s);
}

function tournamentLooksLikeRacing(t) {
  if (!t) return false;
  const engine = String(t.game_rule_profile?.engine || '').toLowerCase();
  if (engine) return engine === 'racing';
  if (t.racing_config && typeof t.racing_config === 'object' && Object.keys(t.racing_config).length > 0) {
    return true;
  }
  const s = `${t.type || ''} ${t.mode || ''} ${t.name || ''}`.toLowerCase();
  return /forza|gran turismo|\bf1\b|formula|nascar|rally|motorsport|racing/.test(s);
}

function getMatchDisputePatch({ existing, body, actorUserId }) {
  const action = body.dispute_action;
  if (!action) return { patch: {}, winnerOverride: undefined };

  const now = new Date().toISOString();
  const validActions = ['open', 'resolve', 'reject', 'clear'];
  if (!validActions.includes(action)) {
    throw new Error('Invalid dispute_action. Use open, resolve, reject, or clear.');
  }

  if (action === 'open') {
    return {
      patch: {
        dispute_status: 'open',
        dispute_notes: body.dispute_notes ?? existing.dispute_notes ?? null,
        dispute_proof_url: body.dispute_proof_url ?? existing.dispute_proof_url ?? null,
        disputed_by_team_id: body.disputed_by_team_id ?? existing.disputed_by_team_id ?? null,
        dispute_opened_at: now,
        dispute_opened_by: actorUserId,
        dispute_resolved_at: null,
        dispute_resolved_by: null,
      },
      winnerOverride: undefined,
    };
  }

  if (action === 'resolve') {
    return {
      patch: {
        dispute_status: 'resolved',
        dispute_notes: body.dispute_notes ?? existing.dispute_notes ?? null,
        dispute_proof_url: body.dispute_proof_url ?? existing.dispute_proof_url ?? null,
        disputed_by_team_id: body.disputed_by_team_id ?? existing.disputed_by_team_id ?? null,
        dispute_resolved_at: now,
        dispute_resolved_by: actorUserId,
      },
      winnerOverride: body.dispute_resolved_winner_id ?? undefined,
    };
  }

  if (action === 'reject') {
    return {
      patch: {
        dispute_status: 'rejected',
        dispute_notes: body.dispute_notes ?? existing.dispute_notes ?? null,
        dispute_resolved_at: now,
        dispute_resolved_by: actorUserId,
      },
      winnerOverride: undefined,
    };
  }

  return {
    patch: {
      dispute_status: null,
      dispute_notes: null,
      dispute_proof_url: null,
      disputed_by_team_id: null,
      dispute_opened_at: null,
      dispute_opened_by: null,
      dispute_resolved_at: null,
      dispute_resolved_by: null,
    },
    winnerOverride: undefined,
  };
}

async function getTournamentRow(tournamentId) {
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Derive winner + display scores + cod_mode from body + optional existing row.
 */
function computeCodOutcome(body, existing = null) {
  const team_a_id = body.team_a_id ?? existing?.team_a_id;
  const team_b_id = body.team_b_id ?? existing?.team_b_id;
  const stats = {
    ...(existing?.stats && typeof existing.stats === 'object' ? existing.stats : {}),
    ...(body.stats && typeof body.stats === 'object' ? body.stats : {}),
  };

  const score_a = body.score_a !== undefined ? body.score_a : existing?.score_a;
  const score_b = body.score_b !== undefined ? body.score_b : existing?.score_b;
  const game_mode = body.game_mode !== undefined ? body.game_mode : existing?.game_mode;
  const cod_mode_in = body.cod_mode !== undefined ? body.cod_mode : existing?.cod_mode;

  const res = resolveMatch({
    codMode: cod_mode_in || undefined,
    gameMode: game_mode,
    teamAId: team_a_id,
    teamBId: team_b_id,
    scoreA: score_a,
    scoreB: score_b,
    stats,
  });

  let displayA = score_a != null ? Number(score_a) : null;
  let displayB = score_b != null ? Number(score_b) : null;
  if (displayA == null && stats.rounds_a != null) displayA = Number(stats.rounds_a);
  if (displayB == null && stats.rounds_b != null) displayB = Number(stats.rounds_b);
  if (displayA == null && stats.roundsA != null) displayA = Number(stats.roundsA);
  if (displayB == null && stats.roundsB != null) displayB = Number(stats.roundsB);
  if (displayA == null && (stats.points_a != null || stats.hardpoint_a != null)) {
    displayA = Number(stats.hardpoint_a ?? stats.points_a ?? stats.pointsA);
  }
  if (displayB == null && (stats.points_b != null || stats.hardpoint_b != null)) {
    displayB = Number(stats.hardpoint_b ?? stats.points_b ?? stats.pointsB);
  }
  if (displayA == null && stats.kills_a != null) displayA = Number(stats.kills_a ?? stats.killsA);
  if (displayB == null && stats.kills_b != null) displayB = Number(stats.kills_b ?? stats.killsB);

  return {
    winner_id: res.winnerId,
    is_draw: res.isDraw,
    incomplete: false,
    resolved_mode: res.resolvedMode,
    reason: res.reason,
    stats,
    score_a: displayA,
    score_b: displayB,
    game_mode,
    cod_mode: res.resolvedMode,
  };
}

function computeFifaOutcome(body, existing = null, tournamentRow = null) {
  const team_a_id = body.team_a_id ?? existing?.team_a_id;
  const team_b_id = body.team_b_id ?? existing?.team_b_id;
  const stats = {
    ...(existing?.stats && typeof existing.stats === 'object' ? existing.stats : {}),
    ...(body.stats && typeof body.stats === 'object' ? body.stats : {}),
  };

  const score_a = body.score_a !== undefined ? body.score_a : existing?.score_a;
  const score_b = body.score_b !== undefined ? body.score_b : existing?.score_b;
  const round = body.round !== undefined ? body.round : existing?.round;
  const game_mode = body.game_mode !== undefined ? body.game_mode : existing?.game_mode;

  const config = tournamentRow?.fifa_scoring_config && typeof tournamentRow.fifa_scoring_config === 'object'
    ? tournamentRow.fifa_scoring_config
    : {};

  const res = resolveFifaMatch({
    teamAId: team_a_id,
    teamBId: team_b_id,
    scoreA: score_a,
    scoreB: score_b,
    round: round || 'group_stage',
    stats,
    config,
  });

  const statsOut = {
    ...stats,
    fifa: {
      ...(stats.fifa && typeof stats.fifa === 'object' ? stats.fifa : {}),
      resolved_phase: res.phase,
      resolution_reason: res.reason,
    },
  };

  const displayA = score_a != null ? Number(score_a) : null;
  const displayB = score_b != null ? Number(score_b) : null;

  return {
    winner_id: res.winnerId,
    is_draw: res.isDraw,
    incomplete: !!res.incomplete,
    resolved_mode: 'fifa',
    reason: res.reason,
    stats: statsOut,
    score_a: displayA,
    score_b: displayB,
    game_mode,
    cod_mode: null,
  };
}

function computeFgcOutcome(body, existing = null, tournamentRow = null, fgcSetRow = null) {
  const team_a_id = body.team_a_id ?? existing?.team_a_id;
  const team_b_id = body.team_b_id ?? existing?.team_b_id;
  const stats = {
    ...(existing?.stats && typeof existing.stats === 'object' ? existing.stats : {}),
    ...(body.stats && typeof body.stats === 'object' ? body.stats : {}),
  };

  const score_a = body.score_a !== undefined ? body.score_a : existing?.score_a;
  const score_b = body.score_b !== undefined ? body.score_b : existing?.score_b;
  const game_mode = body.game_mode !== undefined ? body.game_mode : existing?.game_mode;

  const mc = mergeFgcConfig(tournamentRow, fgcSetRow);
  const res = resolveFgcGame({
    teamAId: team_a_id,
    teamBId: team_b_id,
    scoreA: score_a,
    scoreB: score_b,
    roundsToWin: mc.rounds_to_win_game,
  });

  const statsOut = {
    ...stats,
    fgc: {
      ...(stats.fgc && typeof stats.fgc === 'object' ? stats.fgc : {}),
      rounds_to_win_game: mc.rounds_to_win_game,
      games_best_of: mc.games_best_of,
      resolution_reason: res.reason,
    },
  };

  const displayA = score_a != null ? Number(score_a) : null;
  const displayB = score_b != null ? Number(score_b) : null;

  return {
    winner_id: res.winnerId,
    is_draw: !!res.isDraw,
    incomplete: !!res.incomplete,
    resolved_mode: 'fgc',
    reason: res.reason,
    stats: statsOut,
    score_a: displayA,
    score_b: displayB,
    game_mode,
    cod_mode: null,
  };
}

function computeRacingOutcome(body, existing = null, tournamentRow = null) {
  const team_a_id = body.team_a_id ?? existing?.team_a_id;
  const team_b_id = body.team_b_id ?? existing?.team_b_id;
  const stats = {
    ...(existing?.stats && typeof existing.stats === 'object' ? existing.stats : {}),
    ...(body.stats && typeof body.stats === 'object' ? body.stats : {}),
  };
  const game_mode = body.game_mode !== undefined ? body.game_mode : existing?.game_mode;

  const racingCfg = tournamentRow?.racing_config && typeof tournamentRow.racing_config === 'object'
    ? tournamentRow.racing_config
    : {};
  const racingStats = stats.racing && typeof stats.racing === 'object' ? stats.racing : {};
  const raceRowsInput = Array.isArray(racingStats.results) ? racingStats.results : [];

  const rr = resolveRaceResults({
    results: raceRowsInput,
    config: racingCfg,
  });

  if (!rr.ok) {
    return {
      winner_id: null,
      is_draw: false,
      incomplete: true,
      resolved_mode: 'racing',
      reason: rr.reason,
      stats,
      score_a: null,
      score_b: null,
      game_mode,
      cod_mode: null,
    };
  }

  const rowA = rr.rows.find((r) => String(r.participant_id) === String(team_a_id));
  const rowB = rr.rows.find((r) => String(r.participant_id) === String(team_b_id));
  let winner_id = null;
  if (rr.winnerParticipantId && String(rr.winnerParticipantId) === String(team_a_id)) winner_id = team_a_id;
  else if (rr.winnerParticipantId && String(rr.winnerParticipantId) === String(team_b_id)) winner_id = team_b_id;

  const statsOut = {
    ...stats,
    racing: {
      ...racingStats,
      results: rr.rows,
      winner_participant_id: rr.winnerParticipantId,
      resolution_reason: 'Position-based race ranking',
    },
  };

  return {
    winner_id,
    is_draw: false,
    incomplete: false,
    resolved_mode: 'racing',
    reason: 'Position-based race ranking',
    stats: statsOut,
    score_a: rowA ? Number(rowA.points) : null,
    score_b: rowB ? Number(rowB.points) : null,
    game_mode,
    cod_mode: null,
  };
}

async function applySeriesStandingsAfterRecompute(seriesId) {
  const out = await codSeriesService.recomputeSeriesFromMaps(seriesId);
  if (!out) return;
  const { series: updated, previous } = out;
  const prev = previous;
  const roundKey = updated.round || 'group_stage';

  const wasDone = prev.status === 'complete' && prev.winner_team_id;
  const nowDone = updated.status === 'complete' && updated.winner_team_id;

  if (wasDone && !nowDone) {
    await _reverseTeamStats({
      winner_id: prev.winner_team_id,
      loser_id: pickOpponent(updated, prev.winner_team_id),
      round: roundKey,
    });
  } else if (!wasDone && nowDone) {
    await _updateTeamStats({
      winner_id: updated.winner_team_id,
      loser_id: pickOpponent(updated, updated.winner_team_id),
      round: roundKey,
    });
  } else if (wasDone && nowDone && prev.winner_team_id && updated.winner_team_id
      && prev.winner_team_id !== updated.winner_team_id) {
    await _reverseTeamStats({
      winner_id: prev.winner_team_id,
      loser_id: pickOpponent(updated, prev.winner_team_id),
      round: roundKey,
    });
    await _updateTeamStats({
      winner_id: updated.winner_team_id,
      loser_id: pickOpponent(updated, updated.winner_team_id),
      round: roundKey,
    });
  }
}

async function applyFgcStandingsAfterRecompute(setId) {
  const out = await fgcSetService.recomputeFgcSetFromGames(setId);
  if (!out) return;
  const { set: updated, previous } = out;
  const prev = previous;
  const roundKey = updated.round || 'group_stage';

  const wasDone = prev.status === 'complete' && prev.winner_team_id;
  const nowDone = updated.status === 'complete' && updated.winner_team_id;

  if (wasDone && !nowDone) {
    await _reverseTeamStats({
      winner_id: prev.winner_team_id,
      loser_id: pickOpponent(updated, prev.winner_team_id),
      round: roundKey,
    });
  } else if (!wasDone && nowDone) {
    await _updateTeamStats({
      winner_id: updated.winner_team_id,
      loser_id: pickOpponent(updated, updated.winner_team_id),
      round: roundKey,
    });
  } else if (wasDone && nowDone && prev.winner_team_id && updated.winner_team_id
      && prev.winner_team_id !== updated.winner_team_id) {
    await _reverseTeamStats({
      winner_id: prev.winner_team_id,
      loser_id: pickOpponent(updated, prev.winner_team_id),
      round: roundKey,
    });
    await _updateTeamStats({
      winner_id: updated.winner_team_id,
      loser_id: pickOpponent(updated, updated.winner_team_id),
      round: roundKey,
    });
  }
}

// ── GET /api/matches ──────────────────────────────────────────────────────────
async function getAll(req, res) {
  try {
    let query = supabaseAdmin
      .from('matches')
      .select(`
        *,
        team_a:team_a_id ( id, name, tag ),
        team_b:team_b_id ( id, name, tag ),
        tournament:tournament_id ( id, name )
      `)
      .order('scheduled_at', { ascending: true });

    if (req.query.tournament_id) query = query.eq('tournament_id', req.query.tournament_id);
    if (req.query.round)         query = query.eq('round', req.query.round);
    if (req.query.status)        query = query.eq('status', req.query.status);
    if (req.query.bracket_type)  query = query.eq('bracket_type', req.query.bracket_type);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getById(req, res) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        team_a:team_a_id ( id, name, tag ),
        team_b:team_b_id ( id, name, tag )
      `)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Match not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── GET /api/matches/bracket/:tournamentId ───────────────────────────────────
async function getBracketView(req, res) {
  try {
    const { tournamentId } = req.params;
    const requestedType = req.query.bracket_type;

    let query = supabase
      .from('matches')
      .select(`
        id, tournament_id, round, round_number, match_order, bracket_type,
        status, scheduled_at, played_at, winner_id, next_match_id, next_match_slot,
        team_a_id, team_b_id, score_a, score_b,
        team_a:team_a_id ( id, name, tag ),
        team_b:team_b_id ( id, name, tag ),
        winner:winner_id ( id, name, tag )
      `)
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: true, nullsFirst: false })
      .order('match_order', { ascending: true, nullsFirst: false })
      .order('scheduled_at', { ascending: true, nullsFirst: false });

    if (requestedType) query = query.eq('bracket_type', requestedType);

    const { data, error } = await query;
    if (error) throw error;

    const rounds = {};
    for (const m of data || []) {
      const roundKey = m.round_number != null
        ? `round_${m.round_number}`
        : (m.round || 'unknown_round');
      if (!rounds[roundKey]) {
        rounds[roundKey] = {
          key: roundKey,
          label: m.round_number != null ? `Round ${m.round_number}` : (m.round || 'Unknown'),
          matches: [],
        };
      }
      rounds[roundKey].matches.push(m);
    }

    res.json({
      success: true,
      data: {
        tournament_id: tournamentId,
        bracket_type: requestedType || 'all',
        rounds: Object.values(rounds),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── GET /api/matches/updates ─────────────────────────────────────────────────
// Incremental payload for live UIs: fetch only rows updated since timestamp.
async function getIncrementalUpdates(req, res) {
  try {
    const { since, tournament_id, bracket_type, limit } = req.query;
    if (!since) {
      return res.status(400).json({ error: 'since query param (ISO timestamp) is required.' });
    }

    const sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) {
      return res.status(400).json({ error: 'Invalid since timestamp.' });
    }

    const safeLimit = Math.min(Math.max(parseInt(limit || '200', 10) || 200, 1), 1000);

    let query = supabase
      .from('matches')
      .select(`
        *,
        team_a:team_a_id ( id, name, tag ),
        team_b:team_b_id ( id, name, tag ),
        winner:winner_id ( id, name, tag ),
        tournament:tournament_id ( id, name )
      `)
      .gt('updated_at', sinceDate.toISOString())
      .order('updated_at', { ascending: true })
      .limit(safeLimit);

    if (tournament_id) query = query.eq('tournament_id', tournament_id);
    if (bracket_type) query = query.eq('bracket_type', bracket_type);

    let { data, error } = await query;
    if (error) {
      const msg = String(error.message || '');
      const missingUpdatedAt = /updated_at|column .*updated_at|matches_updated_at/i.test(msg);
      if (!missingUpdatedAt) throw error;

      // Backward-compatible fallback for schemas without matches.updated_at.
      let fallbackQuery = supabaseAdmin
        .from('matches')
        .select(`
          *,
          team_a:team_a_id ( id, name, tag ),
          team_b:team_b_id ( id, name, tag ),
          winner:winner_id ( id, name, tag ),
          tournament:tournament_id ( id, name )
        `)
        .order('scheduled_at', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

      if (tournament_id) fallbackQuery = fallbackQuery.eq('tournament_id', tournament_id);
      if (bracket_type) fallbackQuery = fallbackQuery.eq('bracket_type', bracket_type);

      const fallback = await fallbackQuery;
      if (fallback.error) throw fallback.error;
      data = fallback.data || [];
    }

    const nowIso = new Date().toISOString();
    const lastEventAt = (data && data.length && data[data.length - 1].updated_at) || nowIso;

    res.json({
      success: true,
      data: data || [],
      meta: {
        since: sinceDate.toISOString(),
        last_event_at: lastEventAt,
        server_time: nowIso,
        count: (data || []).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST /api/matches  (admin only) ──────────────────────────────────────────
async function create(req, res) {
  try {
    const {
      tournament_id,
      team_a_id,
      team_b_id,
      round,
      round_number,
      match_order,
      bracket_type,
      next_match_id,
      next_match_slot,
      map_name,
      game_mode,
      scheduled_at,
      status,
      series_id: bodySeriesId,
      create_series,
      fgc_set_id: bodyFgcSetId,
      create_fgc_set,
      map_number: bodyMapNumber,
      fgc_game_number: bodyFgcGameNumber,
      stats: bodyStats,
      cod_mode: _ignore,
      dispute_status,
      dispute_notes,
      dispute_proof_url,
      disputed_by_team_id,
    } = req.body;

    if (!tournament_id || !team_a_id) {
      return res.status(400).json({ error: 'tournament_id and team_a_id are required' });
    }

    let desiredStatus = status || 'scheduled';
    if (desiredStatus === 'upcoming') desiredStatus = 'scheduled';
    if (!['scheduled', 'live', 'completed'].includes(desiredStatus)) {
      return res.status(400).json({ error: 'status must be one of: scheduled, live, completed.' });
    }

    const tournamentRow = await getTournamentRow(tournament_id);
    const isFifa = tournamentLooksLikeFifa(tournamentRow);
    const isFgc = tournamentLooksLikeFgc(tournamentRow);
    const isRacing = tournamentLooksLikeRacing(tournamentRow);

    if (create_series && create_fgc_set) {
      return res.status(400).json({ error: 'Use either create_series (COD) or create_fgc_set (fighting), not both.' });
    }
    if (create_fgc_set && !isFgc) {
      return res.status(400).json({
        error: 'create_fgc_set is only for fighting-game tournaments (set fgc_config or MK/Tekken/SF-style title/mode).',
      });
    }
    if (create_series && isFgc) {
      return res.status(400).json({ error: 'COD match_series is not used for FGC tournaments — use create_fgc_set instead.' });
    }

    let seriesId = bodySeriesId || null;
    if (!seriesId && create_series && typeof create_series === 'object') {
      const s = await codSeriesService.createMatchSeries({
        tournament_id,
        team_a_id,
        team_b_id,
        best_of: create_series.best_of,
        round: create_series.round || round || 'group_stage',
      });
      seriesId = s.id;
    }

    let fgcSetId = bodyFgcSetId || null;
    let fgcSetRow = null;
    if (!fgcSetId && create_fgc_set && typeof create_fgc_set === 'object') {
      const s = await fgcSetService.createFgcSet({
        tournament_id,
        team_a_id,
        team_b_id,
        games_best_of: create_fgc_set.games_best_of,
        rounds_to_win_game: create_fgc_set.rounds_to_win_game,
        round: create_fgc_set.round || round || 'group_stage',
      });
      fgcSetId = s.id;
      fgcSetRow = s;
    } else if (fgcSetId) {
      fgcSetRow = await fgcSetService.getFgcSetById(fgcSetId);
    }

    const syntheticBody = {
      ...req.body,
      team_a_id,
      team_b_id,
      stats: bodyStats,
    };

    const hasNumericScores = req.body.score_a != null && req.body.score_b != null;
    const hasStatsPayload = bodyStats && typeof bodyStats === 'object' && Object.keys(bodyStats).length > 0;

    let outcome;
    if (isFifa) {
      outcome = computeFifaOutcome(syntheticBody, null, tournamentRow);
    } else if (isFgc) {
      outcome = computeFgcOutcome(syntheticBody, null, tournamentRow, fgcSetRow);
    } else if (isRacing) {
      outcome = computeRacingOutcome(syntheticBody, null, tournamentRow);
    } else {
      outcome = computeCodOutcome(syntheticBody, null);
    }

    let winner_id = null;
    let finalStatus = desiredStatus;

    if (desiredStatus === 'completed') {
      if (outcome.incomplete) {
        return res.status(400).json({
          error: isFifa
            ? 'Match result is incomplete (e.g. knockout tie — add stats.fifa extra_time/penalties or admin_winner_team_id).'
            : isFgc
              ? 'FGC game incomplete — enter round wins in score_a/score_b with a clear winner (first to rounds_to_win_game).'
              : isRacing
                ? 'Racing results incomplete — provide stats.racing.results with unique participant positions.'
              : 'Match result is incomplete.',
          detail: outcome.reason,
        });
      }
      if (isFifa) {
        if (!hasNumericScores) {
          return res.status(400).json({ error: 'Completed FIFA matches require score_a and score_b (goals).' });
        }
      } else if (isFgc) {
        if (!hasNumericScores) {
          return res.status(400).json({ error: 'Completed FGC games require score_a and score_b (rounds won this game).' });
        }
      } else if (isRacing) {
        if (!hasStatsPayload) {
          return res.status(400).json({ error: 'Completed racing results require stats.racing.results (ordered finish list).' });
        }
      } else if (!hasNumericScores && !hasStatsPayload) {
        return res.status(400).json({
          error: 'Completed matches require score_a & score_b and/or stats for COD resolution.',
        });
      }
      if (!outcome.winner_id && !outcome.is_draw) {
        return res.status(400).json({
          error: 'Could not determine a winner from scores/stats.',
          detail: outcome.reason,
        });
      }
      if (isFgc && (outcome.is_draw || !outcome.winner_id)) {
        return res.status(400).json({
          error: 'FGC games cannot end in a draw — adjust round scores.',
          detail: outcome.reason,
        });
      }
      winner_id = outcome.winner_id;
      finalStatus = 'completed';
    }

    let map_number = bodyMapNumber;
    if (seriesId && map_number == null) {
      const maps = await codSeriesService.listSeriesMaps(seriesId);
      map_number = maps.length + 1;
    }

    let fgc_game_number = bodyFgcGameNumber;
    if (fgcSetId && fgc_game_number == null) {
      const games = await fgcSetService.listFgcGames(fgcSetId);
      fgc_game_number = games.length + 1;
    }

    const counts_for_standings = !seriesId && !fgcSetId && !isFgc && !isRacing;

    const insertPayload = {
      tournament_id,
      team_a_id,
      team_b_id: team_b_id || null,
      round_number: round_number ?? null,
      match_order: match_order ?? null,
      bracket_type: bracket_type || 'upper',
      next_match_id: next_match_id || null,
      next_match_slot: next_match_slot || null,
      score_a: outcome.score_a,
      score_b: outcome.score_b,
      winner_id,
      round: round || 'group_stage',
      map_name: map_name || null,
      game_mode: game_mode || null,
      cod_mode: outcome.cod_mode,
      stats: outcome.stats,
      status: finalStatus,
      scheduled_at: scheduled_at || null,
      played_at: finalStatus === 'completed' ? new Date().toISOString() : null,
      submitted_by: req.user.id,
      series_id: seriesId,
      map_number: map_number || null,
      fgc_set_id: fgcSetId,
      fgc_game_number: fgc_game_number || null,
      counts_for_standings,
      dispute_status: dispute_status || null,
      dispute_notes: dispute_notes || null,
      dispute_proof_url: dispute_proof_url || null,
      disputed_by_team_id: disputed_by_team_id || null,
      dispute_opened_at: dispute_status === 'open' ? new Date().toISOString() : null,
      dispute_opened_by: dispute_status === 'open' ? req.user.id : null,
    };

    const { data: match, error: matchErr } = await supabaseAdmin
      .from('matches')
      .insert(insertPayload)
      .select()
      .single();

    if (matchErr) throw matchErr;

    const useCodGlobalStandings = !seriesId && !fgcSetId
      && !tournamentLooksLikeFifa(tournamentRow) && !tournamentLooksLikeFgc(tournamentRow) && !tournamentLooksLikeRacing(tournamentRow);
    if (finalStatus === 'completed' && winner_id && useCodGlobalStandings) {
      await _updateTeamStats({
        winner_id,
        loser_id: winner_id === team_a_id ? team_b_id : team_a_id,
        round: round || 'group_stage',
      });
    }

    if (seriesId) {
      await applySeriesStandingsAfterRecompute(seriesId);
    }
    if (fgcSetId) {
      await applyFgcStandingsAfterRecompute(fgcSetId);
    }
    await syncWinnerProgression({ beforeMatch: null, afterMatch: match });

    res.status(201).json({ success: true, data: match });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── PATCH /api/matches/:id  (admin only) ─────────────────────────────────────
async function update(req, res) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Match not found' });

    const merged = {
      ...existing,
      ...req.body,
      score_a: req.body.score_a !== undefined ? req.body.score_a : existing.score_a,
      score_b: req.body.score_b !== undefined ? req.body.score_b : existing.score_b,
      stats: {
        ...(existing.stats && typeof existing.stats === 'object' ? existing.stats : {}),
        ...(req.body.stats && typeof req.body.stats === 'object' ? req.body.stats : {}),
      },
    };

    const tournamentRow = await getTournamentRow(existing.tournament_id);
    const isFifa = tournamentLooksLikeFifa(tournamentRow);
    const isFgc = tournamentLooksLikeFgc(tournamentRow);
    const isRacing = tournamentLooksLikeRacing(tournamentRow);

    let fgcSetRow = null;
    if (existing.fgc_set_id) {
      fgcSetRow = await fgcSetService.getFgcSetById(existing.fgc_set_id);
    }

    let outcome;
    if (isFifa) {
      outcome = computeFifaOutcome(merged, existing, tournamentRow);
    } else if (isFgc) {
      outcome = computeFgcOutcome(merged, existing, tournamentRow, fgcSetRow);
    } else if (isRacing) {
      outcome = computeRacingOutcome(merged, existing, tournamentRow);
    } else {
      outcome = computeCodOutcome(merged, existing);
    }

    const hasNumericScores = merged.score_a != null && merged.score_b != null;
    const hasStatsPayload = merged.stats && Object.keys(merged.stats).length > 0;

    let newStatus = req.body.status !== undefined ? req.body.status : existing.status;
    if (newStatus === 'upcoming') newStatus = 'scheduled';
    const existingNorm = existing.status === 'upcoming' ? 'scheduled' : existing.status;
    if (!['scheduled', 'live', 'completed'].includes(newStatus)) {
      newStatus = existingNorm;
    }
    if (!['scheduled', 'live', 'completed'].includes(newStatus)) {
      newStatus = 'scheduled';
    }

    if (newStatus === 'completed' && !hasNumericScores && !hasStatsPayload
        && (existing.score_a == null || existing.score_b == null)) {
      return res.status(400).json({ error: 'Completed matches require score_a & score_b and/or stats.' });
    }

    if (newStatus === 'completed' && outcome.incomplete) {
      return res.status(400).json({
        error: isFifa
          ? 'Match result is incomplete (e.g. knockout tie — add stats.fifa extra_time/penalties or admin_winner_team_id).'
          : isFgc
            ? 'FGC game incomplete — enter round wins in score_a/score_b with a clear winner (first to rounds_to_win_game).'
            : isRacing
              ? 'Racing results incomplete — provide stats.racing.results with unique participant positions.'
            : 'Match result is incomplete.',
        detail: outcome.reason,
      });
    }

    if (newStatus === 'completed' && isFifa && !hasNumericScores) {
      return res.status(400).json({ error: 'Completed FIFA matches require score_a and score_b (goals).' });
    }

    if (newStatus === 'completed' && isFgc && !hasNumericScores) {
      return res.status(400).json({ error: 'Completed FGC games require score_a and score_b (rounds won this game).' });
    }

    if (newStatus === 'completed' && isRacing) {
      const statsIn = merged.stats && typeof merged.stats === 'object' ? merged.stats : {};
      const racing = statsIn.racing && typeof statsIn.racing === 'object' ? statsIn.racing : {};
      if (!Array.isArray(racing.results) || racing.results.length === 0) {
        return res.status(400).json({ error: 'Completed racing matches require stats.racing.results.' });
      }
    }

    if (newStatus === 'completed' && !outcome.winner_id && !outcome.is_draw) {
      return res.status(400).json({
        error: 'Could not determine a winner from scores/stats.',
        detail: outcome.reason,
      });
    }

    if (newStatus === 'completed' && isFgc && (outcome.is_draw || !outcome.winner_id)) {
      return res.status(400).json({
        error: 'FGC games cannot end in a draw — adjust round scores.',
        detail: outcome.reason,
      });
    }

    let winner_id = newStatus === 'completed' ? outcome.winner_id : null;

    if (newStatus === 'completed' && (hasNumericScores || hasStatsPayload)) {
      newStatus = 'completed';
    }

    const seriesId = existing.series_id;
    const dispute = getMatchDisputePatch({ existing, body: req.body, actorUserId: req.user.id });
    if (dispute.winnerOverride !== undefined && dispute.winnerOverride !== null) {
      winner_id = dispute.winnerOverride;
      newStatus = 'completed';
    }

    const { data: updated, error } = await supabaseAdmin
      .from('matches')
      .update({
        score_a: req.body.score_a !== undefined ? req.body.score_a : existing.score_a,
        score_b: req.body.score_b !== undefined ? req.body.score_b : existing.score_b,
        winner_id,
        map_name: req.body.map_name !== undefined ? req.body.map_name : existing.map_name,
        game_mode: req.body.game_mode !== undefined ? req.body.game_mode : existing.game_mode,
        cod_mode: outcome.cod_mode,
        stats: outcome.stats,
        round: req.body.round !== undefined ? req.body.round : existing.round,
        round_number: req.body.round_number !== undefined ? req.body.round_number : existing.round_number,
        match_order: req.body.match_order !== undefined ? req.body.match_order : existing.match_order,
        bracket_type: req.body.bracket_type !== undefined ? req.body.bracket_type : existing.bracket_type,
        next_match_id: req.body.next_match_id !== undefined ? req.body.next_match_id : existing.next_match_id,
        next_match_slot: req.body.next_match_slot !== undefined ? req.body.next_match_slot : existing.next_match_slot,
        scheduled_at: req.body.scheduled_at !== undefined ? req.body.scheduled_at : existing.scheduled_at,
        status: newStatus,
        played_at: newStatus === 'completed' ? new Date().toISOString() : null,
        ...dispute.patch,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    const useCodGlobalStandings = !seriesId && !existing.fgc_set_id
      && !tournamentLooksLikeFifa(tournamentRow) && !tournamentLooksLikeFgc(tournamentRow)
      && !tournamentLooksLikeRacing(tournamentRow);

    if (!seriesId && !existing.fgc_set_id && useCodGlobalStandings) {
      if (existing.status === 'completed' && newStatus !== 'completed' && existing.winner_id) {
        await _reverseTeamStats({
          winner_id: existing.winner_id,
          loser_id: existing.winner_id === existing.team_a_id ? existing.team_b_id : existing.team_a_id,
          round: existing.round,
        });
      } else if (existing.status === 'completed' && existing.winner_id && winner_id
          && existing.winner_id !== winner_id) {
        await _reverseTeamStats({
          winner_id: existing.winner_id,
          loser_id: existing.winner_id === existing.team_a_id ? existing.team_b_id : existing.team_a_id,
          round: existing.round,
        });
        if (winner_id) {
          await _updateTeamStats({
            winner_id,
            loser_id: winner_id === existing.team_a_id ? existing.team_b_id : existing.team_a_id,
            round: existing.round,
          });
        }
      } else if (newStatus === 'completed' && winner_id
          && (!existing.winner_id || existing.status !== 'completed')) {
        await _updateTeamStats({
          winner_id,
          loser_id: winner_id === existing.team_a_id ? existing.team_b_id : existing.team_a_id,
          round: existing.round,
        });
      }
    } else if (seriesId) {
      await applySeriesStandingsAfterRecompute(seriesId);
    } else if (existing.fgc_set_id) {
      await applyFgcStandingsAfterRecompute(existing.fgc_set_id);
    }
    await syncWinnerProgression({ beforeMatch: existing, afterMatch: updated });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function _updateTeamStats({ winner_id, loser_id, round }) {
  const points = POINTS_TABLE[round] || 2;

  if (winner_id) {
    const { data: winner } = await supabaseAdmin
      .from('teams')
      .select('wins, points')
      .eq('id', winner_id)
      .single();

    if (winner) {
      await supabaseAdmin
        .from('teams')
        .update({
          wins:   (winner.wins || 0) + 1,
          points: (winner.points || 0) + points,
        })
        .eq('id', winner_id);
    }
  }

  if (loser_id) {
    const { data: loser } = await supabaseAdmin
      .from('teams')
      .select('losses')
      .eq('id', loser_id)
      .single();

    if (loser) {
      await supabaseAdmin
        .from('teams')
        .update({ losses: (loser.losses || 0) + 1 })
        .eq('id', loser_id);
    }
  }
}

async function _reverseTeamStats({ winner_id, loser_id, round }) {
  const points = POINTS_TABLE[round] || 2;

  if (winner_id) {
    const { data: winner } = await supabaseAdmin
      .from('teams')
      .select('wins, points')
      .eq('id', winner_id)
      .single();

    if (winner) {
      await supabaseAdmin
        .from('teams')
        .update({
          wins:   Math.max(0, (winner.wins || 0) - 1),
          points: Math.max(0, (winner.points || 0) - points),
        })
        .eq('id', winner_id);
    }
  }

  if (loser_id) {
    const { data: loser } = await supabaseAdmin
      .from('teams')
      .select('losses')
      .eq('id', loser_id)
      .single();

    if (loser) {
      await supabaseAdmin
        .from('teams')
        .update({ losses: Math.max(0, (loser.losses || 0) - 1) })
        .eq('id', loser_id);
    }
  }
}

module.exports = { getAll, getById, getBracketView, getIncrementalUpdates, create, update };
