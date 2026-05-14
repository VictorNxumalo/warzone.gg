const { supabaseAdmin } = require('../config/supabase');

async function getCaptainTeamAndPlayers(userId) {
  const { data: teams, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('id, captain_id')
    .eq('captain_id', userId)
    .limit(1);
  if (teamErr) throw teamErr;
  const team = teams?.[0];
  if (!team) return null;
  const { data: players, error: pErr } = await supabaseAdmin
    .from('players')
    .select('id, ign, role, is_substitute')
    .eq('team_id', team.id);
  if (pErr) throw pErr;
  return { team, players: players || [] };
}

/**
 * lineup: ordered array of player UUID strings — must be a permutation of all team player ids.
 */
function validateLineupPermutation(players, lineup) {
  if (!Array.isArray(lineup)) return 'lineup must be an array of player ids';
  const ids = new Set((players || []).map((p) => String(p.id)));
  if (ids.size === 0) return 'team has no players yet';
  if (lineup.length !== ids.size) return `lineup must include every squad member exactly once (${ids.size} players)`;
  const seen = new Set();
  for (const raw of lineup) {
    const id = String(raw || '').trim();
    if (!id || !ids.has(id)) return 'lineup contains an id that is not on this team';
    if (seen.has(id)) return 'duplicate player id in lineup';
    seen.add(id);
  }
  if (seen.size !== ids.size) return 'lineup must include every squad member';
  return null;
}

async function listMine(req, res, next) {
  try {
    const ctx = await getCaptainTeamAndPlayers(req.user.id);
    if (!ctx) {
      return res.status(200).json({ success: true, data: [] });
    }
    const { data: rows, error } = await supabaseAdmin
      .from('team_saved_rosters')
      .select('id, team_id, name, lineup, created_at, updated_at')
      .eq('team_id', ctx.team.id)
      .order('updated_at', { ascending: false });
    if (error) {
      if (String(error.message || '').includes('team_saved_rosters')) {
        return res.status(503).json({
          error:
            'Saved lineups are not available yet. Run warzongg-api/sql/team_saved_rosters.sql on Supabase.',
        });
      }
      return res.status(400).json({ error: error.message });
    }
    const enriched = (rows || []).map((r) => ({
      ...r,
      slots: mapLineupToPlayers(r.lineup, ctx.players),
    }));
    res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

function mapLineupToPlayers(lineup, players) {
  const byId = new Map((players || []).map((p) => [String(p.id), p]));
  const arr = Array.isArray(lineup) ? lineup : [];
  return arr.map((id, i) => {
    const p = byId.get(String(id));
    return {
      slot: i + 1,
      player_id: String(id),
      ign: p?.ign || '—',
      role: p?.role || null,
      is_substitute: !!p?.is_substitute,
    };
  });
}

async function createMine(req, res, next) {
  try {
    const ctx = await getCaptainTeamAndPlayers(req.user.id);
    if (!ctx) {
      return res.status(404).json({ error: 'No team found for your account.' });
    }
    const name = String(req.body?.name || '').trim();
    const lineup = req.body?.lineup;
    if (!name) return res.status(400).json({ error: 'name is required.' });
    const err = validateLineupPermutation(ctx.players, lineup);
    if (err) return res.status(400).json({ error: err });

    const { data: row, error } = await supabaseAdmin
      .from('team_saved_rosters')
      .insert({
        team_id: ctx.team.id,
        name,
        lineup,
      })
      .select('id, team_id, name, lineup, created_at, updated_at')
      .single();

    if (error) {
      if (String(error.message || '').includes('team_saved_rosters')) {
        return res.status(503).json({
          error:
            'Database migration required: run warzongg-api/sql/team_saved_rosters.sql on Supabase.',
        });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      success: true,
      data: { ...row, slots: mapLineupToPlayers(row.lineup, ctx.players) },
    });
  } catch (e) {
    next(e);
  }
}

async function updateMine(req, res, next) {
  try {
    const rosterId = req.params.rosterId;
    const ctx = await getCaptainTeamAndPlayers(req.user.id);
    if (!ctx) {
      return res.status(404).json({ error: 'No team found for your account.' });
    }
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('team_saved_rosters')
      .select('id, team_id, lineup')
      .eq('id', rosterId)
      .maybeSingle();
    if (exErr) return res.status(400).json({ error: exErr.message });
    if (!existing || String(existing.team_id) !== String(ctx.team.id)) {
      return res.status(404).json({ error: 'Saved lineup not found.' });
    }

    const updates = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name cannot be empty.' });
      updates.name = name;
    }
    if (req.body?.lineup !== undefined) {
      const err = validateLineupPermutation(ctx.players, req.body.lineup);
      if (err) return res.status(400).json({ error: err });
      updates.lineup = req.body.lineup;
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'Provide name and/or lineup to update.' });
    }
    updates.updated_at = new Date().toISOString();

    const { data: row, error } = await supabaseAdmin
      .from('team_saved_rosters')
      .update(updates)
      .eq('id', rosterId)
      .select('id, team_id, name, lineup, created_at, updated_at')
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({
      success: true,
      data: { ...row, slots: mapLineupToPlayers(row.lineup, ctx.players) },
    });
  } catch (e) {
    next(e);
  }
}

async function deleteMine(req, res, next) {
  try {
    const rosterId = req.params.rosterId;
    const ctx = await getCaptainTeamAndPlayers(req.user.id);
    if (!ctx) {
      return res.status(404).json({ error: 'No team found for your account.' });
    }
    const { data: existing } = await supabaseAdmin
      .from('team_saved_rosters')
      .select('id, team_id')
      .eq('id', rosterId)
      .maybeSingle();
    if (!existing || String(existing.team_id) !== String(ctx.team.id)) {
      return res.status(404).json({ error: 'Saved lineup not found.' });
    }

    const { error } = await supabaseAdmin.from('team_saved_rosters').delete().eq('id', rosterId);
    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ success: true, deleted: rosterId });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listMine,
  createMine,
  updateMine,
  deleteMine,
  getCaptainTeamAndPlayers,
  validateLineupPermutation,
};
