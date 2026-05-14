const { supabaseAdmin } = require('../config/supabase');

async function linkCaptainToPlayerRow(teamId) {
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('captain_id')
    .eq('id', teamId)
    .single();
  if (!team?.captain_id) return;

  const { data: u } = await supabaseAdmin
    .from('users')
    .select('id, email, player_id')
    .eq('id', team.captain_id)
    .single();

  if (!u?.email || u.player_id) return;

  const em = String(u.email).trim().toLowerCase();
  const { data: p } = await supabaseAdmin
    .from('players')
    .select('id, user_id')
    .eq('team_id', teamId)
    .eq('email', em)
    .maybeSingle();

  if (!p?.id || p.user_id) return;

  await supabaseAdmin.from('users').update({ player_id: p.id }).eq('id', u.id);
  await supabaseAdmin.from('players').update({ user_id: u.id }).eq('id', p.id);
}

// ──────────────────────────────────────────────
// POST /api/registrations
// Authenticated. Register a team for a tournament.
// This is handled in teamsController.create —
// this controller handles admin-side operations.
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// GET /api/registrations
// Admin only. List all registrations with optional ?status= filter.
// ──────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const { status, tournament_id } = req.query;

    // Service role: anon client has no JWT, so RLS would hide rows from the admin UI.
    let query = supabaseAdmin
      .from('registrations')
      .select(`
        id, status, game_mode, device_type, notes,
        submitted_at, reviewed_at,
        tournament:tournaments ( id, name, tag ),
        team:teams ( id, name, tag, region ),
        reviewed_by_user:users ( id, username )
      `)
      .order('submitted_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (tournament_id) query = query.eq('tournament_id', tournament_id);

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ success: true, count: data.length, data });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// PATCH /api/registrations/:id/status
// Admin only. Approve or reject a registration.
// Body: { status: 'approved' | 'rejected', notes? }
// ──────────────────────────────────────────────
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // 1. Validate status value
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'status must be either "approved" or "rejected".'
      });
    }

    // 2. Find the registration
    const { data: registration } = await supabaseAdmin
      .from('registrations')
      .select('id, status, tournament_id, team_id')
      .eq('id', id)
      .single();

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    if (registration.status !== 'pending') {
      return res.status(409).json({
        error: `This registration has already been ${registration.status}.`
      });
    }

    // 3. Update the registration status
    const { data, error } = await supabaseAdmin
      .from('registrations')
      .update({
        status,
        notes: notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // 4. If approved, increment the tournament's registered_count
    if (status === 'approved') {
      const { data: tournament } = await supabaseAdmin
        .from('tournaments')
        .select('registered_count')
        .eq('id', registration.tournament_id)
        .single();

      await supabaseAdmin
        .from('tournaments')
        .update({ registered_count: (tournament.registered_count || 0) + 1 })
        .eq('id', registration.tournament_id);

      await linkCaptainToPlayerRow(registration.team_id);
    }

    res.status(200).json({
      success: true,
      message: `Registration ${status} successfully.`,
      data
    });

  } catch (err) {
    next(err);
  }
}


module.exports = { getAll, updateStatus };
