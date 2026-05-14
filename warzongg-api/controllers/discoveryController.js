const { supabaseAdmin } = require('../config/supabase');
const { msUntilCooldownEnds } = require('../services/teamRosterGovernanceService');
const { getCaptainTeamId } = require('./teamInvitesController');

const ROSTER_CAP = 6;

// GET /api/discovery/teams-recruiting?q=&limit=
// Authenticated. Lists squads with fewer than ROSTER_CAP players (never shows full teams).
async function listTeamsRecruiting(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 80);

    const { data: teams, error } = await supabaseAdmin
      .from('teams')
      .select('id, name, tag, region, captain_id')
      .order('name')
      .limit(250);

    if (error) return res.status(400).json({ error: error.message });

    const ids = (teams || []).map((t) => t.id);
    if (!ids.length) return res.status(200).json({ success: true, data: [] });

    const { data: plist } = await supabaseAdmin.from('players').select('team_id').in('team_id', ids);

    const countMap = {};
    (plist || []).forEach((p) => {
      if (!p.team_id) return;
      countMap[p.team_id] = (countMap[p.team_id] || 0) + 1;
    });

    let list = (teams || [])
      .map((t) => {
        const n = countMap[t.id] || 0;
        return {
          id: t.id,
          name: t.name,
          tag: t.tag,
          region: t.region,
          roster_count: n,
          roster_open_slots: Math.max(0, ROSTER_CAP - n),
          recruiting: n < ROSTER_CAP,
        };
      })
      .filter((t) => t.roster_count < ROSTER_CAP);

    if (q) {
      list = list.filter(
        (t) =>
          String(t.name || '').toLowerCase().includes(q) ||
          String(t.tag || '').toLowerCase().includes(q)
      );
    }

    res.status(200).json({ success: true, data: list.slice(0, limit) });
  } catch (err) {
    next(err);
  }
}

// GET /api/discovery/free-agents?q=&limit=
// Captain only. Teamless activated players past transfer cooldown (captains still invite by email or extend UI later).
async function listFreeAgents(req, res, next) {
  try {
    const captainTeamId = await getCaptainTeamId(req.user.id);
    if (!captainTeamId) {
      return res.status(403).json({ error: 'Only a team captain can browse teamless players.' });
    }

    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 80);

    const { data: rows, error } = await supabaseAdmin
      .from('players')
      .select('id, ign, email, user_id, team_id, free_agent_since')
      .is('team_id', null)
      .not('user_id', 'is', null)
      .limit(400);

    if (error) return res.status(400).json({ error: error.message });

    let list = (rows || []).filter((p) => msUntilCooldownEnds(p.free_agent_since) <= 0);

    if (q) {
      list = list.filter((p) => {
        const ig = String(p.ign || '').toLowerCase();
        const em = String(p.email || '').toLowerCase();
        return ig.includes(q) || em.includes(q);
      });
    }

    const safe = list.slice(0, limit).map((p) => ({
      player_id: p.id,
      ign: p.ign,
      must_invite_with_email:
        'Use My Team → Invite with the exact email on their roster row (same flow as today).',
    }));

    res.status(200).json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTeamsRecruiting,
  listFreeAgents,
};
