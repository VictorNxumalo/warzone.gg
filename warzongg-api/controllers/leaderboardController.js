const { supabase } = require('../config/supabase');

// ──────────────────────────────────────────────
// GET /api/leaderboard
// Public. Teams ranked by points (descending).
// ──────────────────────────────────────────────
async function getLeaderboard(req, res, next) {
  try {
    const { tournament_id } = req.query;

    if (!tournament_id) {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id, name, tag, region, logo_url,
          wins, losses, points, earnings
        `)
        .order('points', { ascending: false })
        .order('wins', { ascending: false });

      if (error) return res.status(400).json({ error: error.message });

      const ranked = (data || []).map((team, index) => ({
        rank: index + 1,
        ...team,
        earnings_display: `R ${(team.earnings || 0).toLocaleString('en-ZA')}`
      }));

      return res.status(200).json({ success: true, count: ranked.length, data: ranked });
    }

    // Tournament-scoped leaderboard:
    // seed teams from registrations, then derive W/L/points from completed matches.
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select(`
        team:teams (
          id, name, tag, region, logo_url
        )
      `)
      .eq('tournament_id', tournament_id)
      .in('status', ['approved', 'pending']);

    if (regError) return res.status(400).json({ error: regError.message });

    const { data: tournamentMeta, error: tourErr } = await supabase
      .from('tournaments')
      .select('type, mode, racing_config')
      .eq('id', tournament_id)
      .single();
    if (tourErr) return res.status(400).json({ error: tourErr.message });

    const isFifa = `${tournamentMeta?.type || ''} ${tournamentMeta?.mode || ''}`.toLowerCase().includes('fifa');
    const isRacing = (
      (tournamentMeta?.racing_config && typeof tournamentMeta.racing_config === 'object'
        && Object.keys(tournamentMeta.racing_config).length > 0)
      || /forza|gran turismo|\bf1\b|formula|nascar|rally|motorsport|racing/.test(
        `${tournamentMeta?.type || ''} ${tournamentMeta?.mode || ''}`.toLowerCase()
      )
    );

    const teamMap = new Map();
    (registrations || []).forEach((r) => {
      const team = r.team;
      if (!team?.id) return;
      teamMap.set(team.id, {
        id: team.id,
        name: team.name,
        tag: team.tag,
        region: team.region,
        logo_url: team.logo_url,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        total_points: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        best_finish: null,
        races_counted: 0,
        earnings: 0
      });
    });

    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('team_a_id, team_b_id, score_a, score_b, status, counts_for_standings, series_id, round, stats')
      .eq('tournament_id', tournament_id)
      .eq('status', 'completed');

    if (matchError) return res.status(400).json({ error: matchError.message });

    (matches || []).forEach((m) => {
      if (isRacing) {
        const racing = m.stats && typeof m.stats === 'object' ? m.stats.racing : null;
        const results = racing && Array.isArray(racing.results) ? racing.results : null;
        if (!results || !results.length) return;
        for (const r of results) {
          const tid = String(r.participant_id || r.team_id || r.player_id || '');
          const tr = teamMap.get(tid);
          if (!tr) continue;
          const pts = Number(r.points || 0);
          const pos = Number(r.position);
          tr.points += pts;
          tr.total_points += pts;
          tr.races_counted += 1;
          if (pos === 1) tr.wins += 1;
          if (Number.isFinite(pos) && pos >= 1 && (tr.best_finish == null || pos < tr.best_finish)) {
            tr.best_finish = pos;
          }
        }
        return;
      }

      if (m.counts_for_standings === false) return;
      if (!m.team_a_id || !m.team_b_id) return;
      if (isFifa && m.round !== 'group_stage') return;
      const teamA = teamMap.get(m.team_a_id);
      const teamB = teamMap.get(m.team_b_id);
      if (!teamA || !teamB) return;
      if (m.score_a === null || m.score_b === null) return;

      const ga = Number(m.score_a);
      const gb = Number(m.score_b);
      teamA.goals_for += ga;
      teamA.goals_against += gb;
      teamB.goals_for += gb;
      teamB.goals_against += ga;

      if (m.score_a > m.score_b) {
        teamA.wins += 1;
        teamA.points += 3;
        teamB.losses += 1;
      } else if (m.score_b > m.score_a) {
        teamB.wins += 1;
        teamB.points += 3;
        teamA.losses += 1;
      } else {
        teamA.draws += 1;
        teamB.draws += 1;
        teamA.points += 1;
        teamB.points += 1;
      }
    });

    for (const t of teamMap.values()) {
      t.goal_difference = t.goals_for - t.goals_against;
    }

    const ranked = Array.from(teamMap.values())
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (isRacing) {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if ((a.best_finish || 999) !== (b.best_finish || 999)) {
            return (a.best_finish || 999) - (b.best_finish || 999);
          }
        }
        if (isFifa) {
          if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
          if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
        }
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.name.localeCompare(b.name);
      })
      .map((team, index) => ({
        rank: index + 1,
        ...team,
        earnings_display: `R ${(team.earnings || 0).toLocaleString('en-ZA')}`
      }));

    return res.status(200).json({
      success: true,
      count: ranked.length,
      data: ranked,
      meta: { tournament_id }
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// GET /api/schedule
// Public. Upcoming and recent matches grouped by date.
// ──────────────────────────────────────────────
async function getSchedule(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, round, score_a, score_b, map_name, game_mode,
        status, scheduled_at, played_at,
        tournament:tournaments ( id, name, tag ),
        team_a:teams!team_a_id ( id, name, tag, logo_url ),
        team_b:teams!team_b_id ( id, name, tag, logo_url ),
        winner:teams!winner_id ( id, name, tag )
      `)
      .in('status', ['scheduled', 'live', 'completed'])
      .order('scheduled_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    // Group matches by date
    const grouped = {};
    for (const match of data) {
      const dateKey = match.scheduled_at
        ? new Date(match.scheduled_at).toISOString().split('T')[0]
        : 'TBD';

      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(match);
    }

    // Convert to array sorted by date
    const schedule = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, matches]) => ({ date, matches }));

    res.status(200).json({ success: true, data: schedule });

  } catch (err) {
    next(err);
  }
}


module.exports = { getLeaderboard, getSchedule };
