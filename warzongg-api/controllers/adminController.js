const { supabase, supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────
// GET /api/admin/dashboard
// Admin only. Overview stats.
// ──────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    // Fetch counts in parallel
    const [
      { count: pendingCount },
      { count: tournamentsCount },
      { count: teamsCount },
      { data: recentRegistrations }
    ] = await Promise.all([
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }).in('status', ['open', 'live']),
      supabaseAdmin.from('teams').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('registrations')
        .select(`
          id, status, submitted_at,
          team:teams ( name, tag ),
          tournament:tournaments ( name, tag )
        `)
        .order('submitted_at', { ascending: false })
        .limit(5)
    ]);

    res.status(200).json({
      success: true,
      data: {
        pending_registrations: pendingCount || 0,
        active_tournaments: tournamentsCount || 0,
        total_teams: teamsCount || 0,
        recent_registrations: recentRegistrations || []
      }
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// GET /api/admin/teams
// Admin only. All teams with optional search.
// ──────────────────────────────────────────────
async function getTeams(req, res, next) {
  try {
    const { search, status } = req.query;

    let query = supabaseAdmin
      .from('teams')
      .select(`
        id, name, tag, region, wins, losses, points, earnings, created_at,
        captain:users ( id, username, whatsapp )
      `)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,tag.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ success: true, count: data.length, data });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// POST /api/admin/announcements
// Admin only. Publish a new announcement.
// Body: { title, body, type?, tournament_id? }
// ──────────────────────────────────────────────
async function createAnnouncement(req, res, next) {
  try {
    const { title, body, type, tournament_id } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required.' });
    }

    const validTypes = ['info', 'live', 'update', 'warning'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${validTypes.join(', ')}.`
      });
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        body,
        type: type || 'info',
        tournament_id: tournament_id || null,
        published_by: req.user.id
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({
      success: true,
      message: 'Announcement published successfully.',
      data
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// GET /api/admin/announcements
// Admin only. List all announcements.
// ──────────────────────────────────────────────
async function getAnnouncements(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        id, title, body, type, created_at,
        tournament:tournaments ( id, name, tag ),
        published_by_user:users ( id, username )
      `)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ success: true, count: data.length, data });

  } catch (err) {
    next(err);
  }
}


module.exports = { getDashboard, getTeams, createAnnouncement, getAnnouncements };
