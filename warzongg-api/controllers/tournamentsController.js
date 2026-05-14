const { supabase, supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────
// GET /api/tournaments
// Public. Supports ?status= and ?type= filters
// ──────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const { status, type } = req.query;

    let query = supabase
      .from('tournaments')
      .select(`
        id, name, tag, mode, type, status, format, region, game_rule_profile,
        start_date, reg_deadline, max_slots, registered_count,
        prize_total, entry_fee, prize_1st, prize_2nd, prize_3rd, prize_mvp,
        created_at
      `)
      .order('start_date', { ascending: true });

    // Apply optional filters
    if (status) query = query.eq('status', status);
    if (type)   query = query.eq('type', type);

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ success: true, count: data.length, data });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// GET /api/tournaments/:id
// Public. Returns full tournament detail with winner team.
// ──────────────────────────────────────────────
async function getById(req, res, next) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        winner_team:teams ( id, name, tag, logo_url ),
        created_by_user:users ( id, username )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }

    res.status(200).json({ success: true, data });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// GET /api/tournaments/:id/approved-teams
// Public. Teams with an approved registration for this tournament (for brackets / participant hub).
// ──────────────────────────────────────────────
async function getApprovedTeams(req, res, next) {
  try {
    const { id } = req.params;

    const { data: regs, error } = await supabaseAdmin
      .from('registrations')
      .select(`
        id, game_mode, device_type, submitted_at,
        team:teams ( id, name, tag, region )
      `)
      .eq('tournament_id', id)
      .eq('status', 'approved')
      .order('submitted_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    const rows = [];
    const seen = new Set();
    (regs || []).forEach((r) => {
      const t = r.team;
      if (t?.id && !seen.has(t.id)) {
        seen.add(t.id);
        rows.push({
          registration_id: r.id,
          game_mode: r.game_mode,
          device_type: r.device_type,
          team: t
        });
      }
    });

    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// POST /api/tournaments
// Admin only.
// ──────────────────────────────────────────────
async function create(req, res, next) {
  try {
    const {
      name, tag, mode, type, format, region,
      start_date, reg_deadline, max_slots,
      prize_total, entry_fee,
      prize_1st, prize_2nd, prize_3rd, prize_mvp,
      description, game_rule_profile
    } = req.body;

    // Validation
    if (!name || !tag || !mode || !type || !format || !start_date || !reg_deadline || !max_slots || !prize_total) {
      return res.status(400).json({
        error: 'Missing required fields: name, tag, mode, type, format, start_date, reg_deadline, max_slots, prize_total.'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .insert({
        name, tag, mode, type, format,
        region: region || 'ZA',
        start_date, reg_deadline,
        max_slots: parseInt(max_slots),
        prize_total: parseInt(prize_total),
        entry_fee: parseInt(entry_fee) || 0,
        prize_1st: parseInt(prize_1st) || 0,
        prize_2nd: parseInt(prize_2nd) || 0,
        prize_3rd: parseInt(prize_3rd) || 0,
        prize_mvp: parseInt(prize_mvp) || 0,
        description: description || null,
        game_rule_profile: game_rule_profile && typeof game_rule_profile === 'object' ? game_rule_profile : {},
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully.',
      data
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// PATCH /api/tournaments/:id
// Admin only. Update any tournament field.
// ──────────────────────────────────────────────
async function update(req, res, next) {
  try {
    const { id } = req.params;

    // Only allow known fields to be updated
    const allowed = [
      'name', 'tag', 'mode', 'type', 'status', 'format', 'region',
      'start_date', 'reg_deadline', 'max_slots',
      'prize_total', 'entry_fee', 'prize_1st', 'prize_2nd', 'prize_3rd', 'prize_mvp',
      'description', 'winner_team_id', 'game_rule_profile'
    ];

    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Convenience: allow PATCH with raw game rule profile object, e.g.
    // { "engine": "cod", "feature_flags": { "new_bracket_ui": false } }
    // by mapping it to updates.game_rule_profile when no known top-level field is present.
    if (Object.keys(updates).length === 0) {
      const maybeRuleProfile = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : null;
      if (maybeRuleProfile && (maybeRuleProfile.engine !== undefined || maybeRuleProfile.feature_flags !== undefined)) {
        updates.game_rule_profile = maybeRuleProfile;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message || 'Tournament update failed.' });
    }
    if (!data) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Tournament updated successfully.',
      data
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// DELETE /api/tournaments/:id
// Admin only. Cascades to matches + registrations.
// ──────────────────────────────────────────────
async function remove(req, res, next) {
  try {
    const { id } = req.params;

    // Confirm tournament exists first
    const { data: existing } = await supabaseAdmin
      .from('tournaments')
      .select('id, name')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }

    const { error } = await supabaseAdmin
      .from('tournaments')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({
      success: true,
      message: `Tournament "${existing.name}" deleted successfully.`
    });

  } catch (err) {
    next(err);
  }
}


module.exports = { getAll, getById, getApprovedTeams, create, update, remove };
