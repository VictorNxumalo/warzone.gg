const { supabaseAdmin } = require('../config/supabase');
const { msUntilCooldownEnds } = require('../services/teamRosterGovernanceService');

async function getCaptainTeamId(userId) {
  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('captain_id', userId)
    .limit(1);
  return teams?.[0]?.id || null;
}

// POST /api/teams/mine/invites — captain invites a teamless player by email
async function createInviteMine(req, res, next) {
  try {
    const rawEmail = String(req.body?.invitee_email || '').trim().toLowerCase();
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ error: 'Valid invitee_email is required.' });
    }

    const teamId = await getCaptainTeamId(req.user.id);
    if (!teamId) {
      return res.status(403).json({ error: 'Only a team captain can send invites.' });
    }

    const { data: roster } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('team_id', teamId);
    if ((roster || []).length >= 6) {
      return res.status(409).json({ error: 'Team roster is full (6 players).' });
    }

    const { data: inviteeRows } = await supabaseAdmin
      .from('players')
      .select('id, team_id, user_id, email, ign, free_agent_since')
      .ilike('email', rawEmail);

    const invitee = (inviteeRows || []).find((p) => p.user_id && !p.team_id);
    if (!invitee) {
      return res.status(404).json({
        error:
          'No eligible player found with that email (they must have activated their account and left any previous team).',
      });
    }

    if (String(invitee.user_id) === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot invite yourself.' });
    }

    const msLeft = msUntilCooldownEnds(invitee.free_agent_since);
    if (msLeft > 0) {
      const hours = Math.ceil(msLeft / (60 * 60 * 1000));
      return res.status(409).json({
        error: `That player must wait ${hours} more hour(s) before joining another team (transfer cooldown).`,
        cooldown_ms_remaining: msLeft,
      });
    }

    const { data: existingPending } = await supabaseAdmin
      .from('team_invites')
      .select('id')
      .eq('team_id', teamId)
      .eq('invitee_player_id', invitee.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPending) {
      return res.status(409).json({ error: 'An invite is already pending for this player.' });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('team_invites')
      .insert({
        team_id: teamId,
        invitee_player_id: invitee.id,
        invited_by_user_id: req.user.id,
        status: 'pending',
      })
      .select('id, status, created_at, team_id, invitee_player_id')
      .single();

    if (error) {
      if (/team_invites/i.test(error.message || '') || /duplicate|unique/i.test(error.message || '')) {
        return res.status(409).json({ error: 'Invite already exists or conflicts with an existing pending invite.' });
      }
      return res.status(400).json({ error: error.message });
    }

    const { data: teamRow } = await supabaseAdmin
      .from('teams')
      .select('id, name, tag')
      .eq('id', teamId)
      .single();

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: invitee.user_id,
        type: 'team_invite_received',
        message: `You were invited to join ${teamRow?.name || 'a team'} (#${teamRow?.tag || '—'}).`,
        read: false,
      });
    } catch (_) {}

    res.status(201).json({
      success: true,
      data: {
        ...inserted,
        team: teamRow || null,
        invitee: { id: invitee.id, ign: invitee.ign, email: invitee.email },
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/teams/mine/invites/outgoing
async function listOutgoingInvitesMine(req, res, next) {
  try {
    const teamId = await getCaptainTeamId(req.user.id);
    if (!teamId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('team_invites')
      .select(
        `
        id, status, created_at, responded_at,
        invitee:players ( id, ign, email ),
        team:teams ( id, name, tag )
      `
      )
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      console.warn('[listOutgoingInvitesMine]', error.message);
      return res.status(200).json({ success: true, data: [] });
    }
    res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/teams/mine/invites/:inviteId — captain cancels pending invite
async function cancelInviteMine(req, res, next) {
  try {
    const inviteId = req.params.inviteId;
    const teamId = await getCaptainTeamId(req.user.id);
    if (!teamId) {
      return res.status(403).json({ error: 'Only a team captain can cancel invites.' });
    }

    const { data: inv } = await supabaseAdmin
      .from('team_invites')
      .select('id, team_id, status')
      .eq('id', inviteId)
      .maybeSingle();

    if (!inv || String(inv.team_id) !== String(teamId)) {
      return res.status(404).json({ error: 'Invite not found.' });
    }
    if (inv.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending invites can be cancelled.' });
    }

    const { error } = await supabaseAdmin
      .from('team_invites')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ success: true, message: 'Invite cancelled.' });
  } catch (err) {
    next(err);
  }
}

// ── Invitee (player) ───────────────────────────────────────────────────────────

async function getIncomingInvitesForPlayer(req, res, next) {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, player_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user?.player_id) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('team_invites')
      .select(
        `
        id, status, created_at,
        team:teams ( id, name, tag, region ),
        invited_by_user_id
      `
      )
      .eq('invitee_player_id', user.player_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      // Missing migration, embed/FK issues, or transient DB errors — never break Player profile.
      console.warn('[getIncomingInvitesForPlayer]', error.message);
      return res.status(200).json({ success: true, data: [] });
    }
    res.status(200).json({ success: true, data: rows || [] });
  } catch (err) {
    next(err);
  }
}

async function acceptInviteAsPlayer(req, res, next) {
  try {
    const inviteId = req.params.inviteId;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, player_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user?.player_id) {
      return res.status(400).json({ error: 'Your account is not linked to a player profile.' });
    }

    const { data: invite } = await supabaseAdmin
      .from('team_invites')
      .select('id, team_id, invitee_player_id, status')
      .eq('id', inviteId)
      .maybeSingle();

    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or already handled.' });
    }
    if (String(invite.invitee_player_id) !== String(user.player_id)) {
      return res.status(403).json({ error: 'This invite is not for your account.' });
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id, team_id, free_agent_since')
      .eq('id', user.player_id)
      .single();

    if (player?.team_id) {
      return res.status(409).json({ error: 'You are already on a team. Leave first.' });
    }

    const msLeft = msUntilCooldownEnds(player?.free_agent_since);
    if (msLeft > 0) {
      const hours = Math.ceil(msLeft / (60 * 60 * 1000));
      return res.status(409).json({
        error: `Transfer cooldown active — try again in about ${hours} hour(s).`,
        cooldown_ms_remaining: msLeft,
      });
    }

    const { data: roster } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('team_id', invite.team_id);
    if ((roster || []).length >= 6) {
      return res.status(409).json({ error: 'That team roster is now full.' });
    }

    const { data: claimedRows, error: upErr } = await supabaseAdmin
      .from('players')
      .update({
        team_id: invite.team_id,
        free_agent_since: null,
        is_substitute: false,
      })
      .eq('id', user.player_id)
      .is('team_id', null)
      .select('id')
      .limit(1);

    if (upErr) return res.status(400).json({ error: upErr.message });
    if (!claimedRows?.length) {
      return res.status(409).json({ error: 'You are already on a team. Leave first.' });
    }

    const { error: accErr } = await supabaseAdmin
      .from('team_invites')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('status', 'pending');
    if (accErr) return res.status(400).json({ error: accErr.message });

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, tag')
      .eq('id', invite.team_id)
      .single();

    res.status(200).json({
      success: true,
      message: `You joined ${team?.name || 'the team'}.`,
      data: { team },
    });
  } catch (err) {
    next(err);
  }
}

async function declineInviteAsPlayer(req, res, next) {
  try {
    const inviteId = req.params.inviteId;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('player_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user?.player_id) {
      return res.status(400).json({ error: 'Your account is not linked to a player profile.' });
    }

    const { data: invite } = await supabaseAdmin
      .from('team_invites')
      .select('id, invitee_player_id, status')
      .eq('id', inviteId)
      .maybeSingle();

    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or already handled.' });
    }
    if (String(invite.invitee_player_id) !== String(user.player_id)) {
      return res.status(403).json({ error: 'This invite is not for your account.' });
    }

    await supabaseAdmin
      .from('team_invites')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', inviteId);

    res.status(200).json({ success: true, message: 'Invite declined.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCaptainTeamId,
  createInviteMine,
  listOutgoingInvitesMine,
  cancelInviteMine,
  getIncomingInvitesForPlayer,
  acceptInviteAsPlayer,
  declineInviteAsPlayer,
};
