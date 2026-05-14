const { supabaseAdmin } = require('../config/supabase');
const { msUntilCooldownEnds } = require('../services/teamRosterGovernanceService');
const { getCaptainTeamId } = require('./teamInvitesController');

const ROSTER_CAP = 6;
const MAX_PENDING_JOIN_REQUESTS_PER_PLAYER = 5;

function tableMissing(err) {
  const m = String(err?.message || '');
  return /team_join_requests|does not exist|schema cache/i.test(m);
}

async function rosterCount(teamId) {
  const { data: roster } = await supabaseAdmin.from('players').select('id').eq('team_id', teamId);
  return (roster || []).length;
}

async function assignFreeAgentToTeam(playerId, teamId) {
  const { data: updatedRows, error: upErr } = await supabaseAdmin
    .from('players')
    .update({
      team_id: teamId,
      free_agent_since: null,
      is_substitute: false,
    })
    .eq('id', playerId)
    .is('team_id', null)
    .select('id')
    .limit(1);

  if (upErr) throw new Error(upErr.message);
  return !!updatedRows?.length;
}

// POST /api/players/me/team-join-requests { team_id }
async function createPlayerJoinRequest(req, res, next) {
  try {
    const teamId = req.body?.team_id;
    if (!teamId) return res.status(400).json({ error: 'team_id is required.' });

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, player_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user?.player_id) {
      return res.status(400).json({ error: 'Your account must be linked to a player profile.' });
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id, team_id, free_agent_since')
      .eq('id', user.player_id)
      .maybeSingle();

    if (!player) return res.status(404).json({ error: 'Player record not found.' });
    if (player.team_id) {
      return res.status(409).json({ error: 'You are already on a team. Leave before requesting to join another squad.' });
    }

    const msLeft = msUntilCooldownEnds(player.free_agent_since);
    if (msLeft > 0) {
      const hours = Math.ceil(msLeft / (60 * 60 * 1000));
      return res.status(409).json({
        error: `Transfer cooldown active — try again in about ${hours} hour(s).`,
        cooldown_ms_remaining: msLeft,
      });
    }

    const n = await rosterCount(teamId);
    if (n >= ROSTER_CAP) {
      return res.status(409).json({ error: 'That team roster is full.' });
    }

    const { data: pendingMineRows } = await supabaseAdmin
      .from('team_join_requests')
      .select('id')
      .eq('requester_player_id', player.id)
      .eq('status', 'pending');

    if ((pendingMineRows || []).length >= MAX_PENDING_JOIN_REQUESTS_PER_PLAYER) {
      return res.status(409).json({
        error: `You already have ${MAX_PENDING_JOIN_REQUESTS_PER_PLAYER} pending join requests. Cancel one before adding another.`,
      });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('team_join_requests')
      .insert({
        team_id: teamId,
        requester_player_id: player.id,
        status: 'pending',
      })
      .select('id, team_id, status, created_at')
      .single();

    if (error) {
      if (tableMissing(error)) {
        return res.status(503).json({
          error:
            'Join requests are not available until team_join_requests migration is applied (see warzongg-api/sql/team_join_requests.sql).',
        });
      }
      if (/duplicate|unique/i.test(error.message)) {
        return res.status(409).json({ error: 'You already have a pending request to this team.' });
      }
      return res.status(400).json({ error: error.message });
    }

    const { data: teamRow } = await supabaseAdmin
      .from('teams')
      .select('id, name, tag, captain_id')
      .eq('id', teamId)
      .maybeSingle();

    try {
      if (teamRow?.captain_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: teamRow.captain_id,
          type: 'team_join_request_received',
          message: `A player requested to join ${teamRow.name || 'your team'} (#${teamRow.tag || '—'}).`,
          read: false,
        });
      }
    } catch (_) {}

    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    next(err);
  }
}

// GET /api/players/me/team-join-requests
async function listMyJoinRequests(req, res, next) {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('player_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user?.player_id) return res.status(200).json({ success: true, data: [] });

    const { data: rows, error } = await supabaseAdmin
      .from('team_join_requests')
      .select(
        `
        id, status, created_at, responded_at,
        team:teams ( id, name, tag, region )
      `
      )
      .eq('requester_player_id', user.player_id)
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      if (tableMissing(error)) return res.status(200).json({ success: true, data: [] });
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ success: true, data: rows || [] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/players/me/team-join-requests/:joinRequestId
async function cancelMyJoinRequest(req, res, next) {
  try {
    const joinRequestId = req.params.joinRequestId;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('player_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user?.player_id) return res.status(400).json({ error: 'No player profile linked.' });

    const { data: jr } = await supabaseAdmin
      .from('team_join_requests')
      .select('id, requester_player_id, status')
      .eq('id', joinRequestId)
      .maybeSingle();

    if (!jr || String(jr.requester_player_id) !== String(user.player_id)) {
      return res.status(404).json({ error: 'Request not found.' });
    }
    if (jr.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending requests can be cancelled.' });
    }

    const { error } = await supabaseAdmin
      .from('team_join_requests')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', joinRequestId);

    if (error) {
      if (tableMissing(error)) return res.status(503).json({ error: 'Join requests table not available.' });
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ success: true, message: 'Request cancelled.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/teams/mine/join-requests/incoming
async function listCaptainIncomingJoinRequests(req, res, next) {
  try {
    const teamId = await getCaptainTeamId(req.user.id);
    if (!teamId) return res.status(403).json({ error: 'Only a team captain can view incoming join requests.' });

    const { data: rows, error } = await supabaseAdmin
      .from('team_join_requests')
      .select(
        `
        id, status, created_at,
        requester:players ( id, ign, email )
      `
      )
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      if (tableMissing(error)) return res.status(200).json({ success: true, data: [] });
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ success: true, data: rows || [] });
  } catch (err) {
    next(err);
  }
}

// POST /api/teams/mine/join-requests/:joinRequestId/accept
async function captainAcceptJoinRequest(req, res, next) {
  try {
    const joinRequestId = req.params.joinRequestId;
    const teamId = await getCaptainTeamId(req.user.id);
    if (!teamId) return res.status(403).json({ error: 'Only a team captain can accept join requests.' });

    const { data: jr } = await supabaseAdmin
      .from('team_join_requests')
      .select('id, team_id, requester_player_id, status')
      .eq('id', joinRequestId)
      .maybeSingle();

    if (!jr || jr.status !== 'pending') {
      return res.status(404).json({ error: 'Request not found or already handled.' });
    }
    if (String(jr.team_id) !== String(teamId)) {
      return res.status(403).json({ error: 'This request is not for your team.' });
    }

    const n = await rosterCount(teamId);
    if (n >= ROSTER_CAP) {
      return res.status(409).json({ error: 'Your roster is full.' });
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id, team_id, free_agent_since')
      .eq('id', jr.requester_player_id)
      .maybeSingle();

    if (!player?.id) return res.status(404).json({ error: 'Player not found.' });
    if (player.team_id) {
      return res.status(409).json({ error: 'That player already joined a team.' });
    }

    const msLeft = msUntilCooldownEnds(player.free_agent_since);
    if (msLeft > 0) {
      return res.status(409).json({ error: 'That player is still on transfer cooldown.' });
    }

    const claimed = await assignFreeAgentToTeam(player.id, teamId);
    if (!claimed) {
      return res.status(409).json({ error: 'That player already joined a team.' });
    }

    const { error: acceptErr } = await supabaseAdmin
      .from('team_join_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', joinRequestId)
      .eq('status', 'pending');
    if (acceptErr) return res.status(400).json({ error: acceptErr.message });

    const { data: team } = await supabaseAdmin.from('teams').select('id, name, tag').eq('id', teamId).single();

    res.status(200).json({
      success: true,
      message: `Player joined ${team?.name || 'your team'}.`,
      data: { team },
    });
  } catch (err) {
    if (tableMissing(err)) {
      return res.status(503).json({ error: 'Join requests table not available.' });
    }
    next(err);
  }
}

// POST /api/teams/mine/join-requests/:joinRequestId/decline
async function captainDeclineJoinRequest(req, res, next) {
  try {
    const joinRequestId = req.params.joinRequestId;
    const teamId = await getCaptainTeamId(req.user.id);
    if (!teamId) return res.status(403).json({ error: 'Only a team captain can decline join requests.' });

    const { data: jr } = await supabaseAdmin
      .from('team_join_requests')
      .select('id, team_id, status')
      .eq('id', joinRequestId)
      .maybeSingle();

    if (!jr || jr.status !== 'pending') {
      return res.status(404).json({ error: 'Request not found or already handled.' });
    }
    if (String(jr.team_id) !== String(teamId)) {
      return res.status(403).json({ error: 'This request is not for your team.' });
    }

    const { error } = await supabaseAdmin
      .from('team_join_requests')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', joinRequestId);

    if (error) {
      if (tableMissing(error)) return res.status(503).json({ error: 'Join requests table not available.' });
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ success: true, message: 'Request declined.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPlayerJoinRequest,
  listMyJoinRequests,
  cancelMyJoinRequest,
  listCaptainIncomingJoinRequests,
  captainAcceptJoinRequest,
  captainDeclineJoinRequest,
};
