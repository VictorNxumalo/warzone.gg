const { supabaseAdmin } = require('../config/supabase');
const {
  getTeamCompetitionLock,
  FREE_AGENT_COOLDOWN_MS,
  msUntilCooldownEnds,
} = require('../services/teamRosterGovernanceService');

function _deriveMatchOutcome(match, teamId) {
  const isTeamA = match.team_a_id === teamId;
  const myScore = isTeamA ? match.score_a : match.score_b;
  const oppScore = isTeamA ? match.score_b : match.score_a;
  if (myScore === null || myScore === undefined || oppScore === null || oppScore === undefined) {
    return null;
  }
  return myScore > oppScore ? 'win' : 'loss';
}

function _normEmail(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

/**
 * Same squad discovery as GET /api/teams/mine, plus a single-team hint when the user is only
 * identifiable by roster email (My Team’s enrich logic can show them on the squad before DB links exist).
 */
async function getRosterTeamIdForUser(userId, emailNorm) {
  const { data: capTeams } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('captain_id', userId)
    .limit(1);
  if (capTeams?.[0]?.id) return capTeams[0].id;

  const { data: usrRows } = await supabaseAdmin
    .from('users')
    .select('player_id')
    .eq('id', userId)
    .limit(1);
  const usr = usrRows?.[0];
  if (usr?.player_id) {
    const { data: plRows } = await supabaseAdmin
      .from('players')
      .select('team_id')
      .eq('id', usr.player_id)
      .limit(1);
    if (plRows?.[0]?.team_id) return plRows[0].team_id;
  }

  const { data: byAuth } = await supabaseAdmin
    .from('players')
    .select('team_id')
    .eq('user_id', userId)
    .limit(1);
  if (byAuth?.[0]?.team_id) return byAuth[0].team_id;

  if (emailNorm) {
    const { data: hits } = await supabaseAdmin
      .from('players')
      .select('team_id, email')
      .ilike('email', emailNorm);
    const exact = (hits || []).filter(
      (h) => _normEmail(h.email) === emailNorm && h.team_id
    );
    const teamIds = [...new Set(exact.map((h) => h.team_id))];
    if (teamIds.length === 1) return teamIds[0];
  }

  return null;
}

/**
 * Links / resolves the players row using the same rules as enrichTeamPlayersWithAccountLinks on My Team.
 */
async function resolvePlayerOnTeamRoster(teamId, user, selectCols, emailNorm) {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('id, email, player_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!u) return null;
  const em = emailNorm || _normEmail(u.email);

  if (u.player_id) {
    const { data: curRows } = await supabaseAdmin
      .from('players')
      .select('team_id')
      .eq('id', u.player_id)
      .limit(1);
    const curTeam = curRows?.[0]?.team_id;
    if (!curTeam || String(curTeam) !== String(teamId)) {
      await supabaseAdmin.from('users').update({ player_id: null }).eq('id', u.id);
      u.player_id = null;
      user.player_id = null;
    }
  }

  const { data: roster } = await supabaseAdmin
    .from('players')
    .select(`${selectCols}, user_id, email`)
    .eq('team_id', teamId);

  const direct = (roster || []).find((p) => p.user_id && String(p.user_id) === String(u.id));
  if (direct) {
    await supabaseAdmin.from('users').update({ player_id: direct.id }).eq('id', u.id);
    user.player_id = direct.id;
    const { data: p } = await supabaseAdmin.from('players').select(selectCols).eq('id', direct.id).maybeSingle();
    return p || null;
  }

  for (const r of roster || []) {
    const rowEm = _normEmail(r.email);
    if (rowEm !== em) continue;

    const eligible = !u.player_id || String(u.player_id) === String(r.id);
    if (!eligible) continue;

    if (r.user_id && String(r.user_id) !== String(u.id)) {
      const { data: holder } = await supabaseAdmin
        .from('users')
        .select('id, player_id')
        .eq('id', r.user_id)
        .maybeSingle();
      if (holder && String(holder.player_id) === String(r.id)) continue;
    }

    await supabaseAdmin.from('players').update({ user_id: u.id }).eq('id', r.id);
    await supabaseAdmin.from('users').update({ player_id: r.id }).eq('id', u.id);
    user.player_id = r.id;
    const { data: p } = await supabaseAdmin.from('players').select(selectCols).eq('id', r.id).maybeSingle();
    return p || null;
  }

  return null;
}

/**
 * Keeps users.player_id and players.user_id in sync when one side was never written
 * (common for captains with roster email typos, or legacy rows). Aligns /api/players/me
 * with /api/teams/mine which resolves the team via captain_id alone.
 */
async function syncUserPlayerLink(req, user) {
  const userId = user.id;

  const authEmail = String(req.user?.email || '').trim().toLowerCase();
  const profileEmail = String(user.email || authEmail || '').trim().toLowerCase();

  // Validate stored users.player_id (fixes stale IDs and rows tied to another account).
  // Former captains used to hit the blind "return early" path even when this pointed at the wrong row.
  if (user.player_id) {
    const { data: owned } = await supabaseAdmin
      .from('players')
      .select('id, user_id')
      .eq('id', user.player_id)
      .maybeSingle();
    if (!owned) {
      await supabaseAdmin.from('users').update({ player_id: null }).eq('id', userId);
      user.player_id = null;
    } else if (owned.user_id && String(owned.user_id) !== String(userId)) {
      await supabaseAdmin.from('users').update({ player_id: null }).eq('id', userId);
      user.player_id = null;
    } else {
      if (!owned.user_id) {
        await supabaseAdmin.from('players').update({ user_id: userId }).eq('id', owned.id);
      }
      await supabaseAdmin.from('users').update({ player_id: owned.id }).eq('id', userId);
      return user;
    }
  }

  async function claimPlayerRow(playerId) {
    const { data: row } = await supabaseAdmin
      .from('players')
      .select('id, user_id')
      .eq('id', playerId)
      .maybeSingle();
    if (!row) return false;
    if (row.user_id && row.user_id !== userId) return false;

    await supabaseAdmin.from('users').update({ player_id: playerId }).eq('id', userId);
    await supabaseAdmin.from('players').update({ user_id: userId }).eq('id', playerId);
    user.player_id = playerId;
    return true;
  }

  const { data: byUserId } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (byUserId?.[0]?.id && (await claimPlayerRow(byUserId[0].id))) return user;

  if (profileEmail) {
    const { data: sameEmail } = await supabaseAdmin
      .from('players')
      .select('id, user_id, email')
      .ilike('email', profileEmail);
    const rows = (sameEmail || []).filter((r) => _normEmail(r.email) === profileEmail);
    const unclaimed = rows.find((r) => !r.user_id);
    if (unclaimed && (await claimPlayerRow(unclaimed.id))) return user;
    const alreadyMine = rows.find((r) => String(r.user_id) === String(userId));
    if (alreadyMine && !user.player_id) {
      await supabaseAdmin.from('users').update({ player_id: alreadyMine.id }).eq('id', userId);
      user.player_id = alreadyMine.id;
      return user;
    }
  }

  const { data: capTeams } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('captain_id', userId)
    .limit(1);
  const capTeamId = capTeams?.[0]?.id;
  if (capTeamId) {
    const { data: roster } = await supabaseAdmin
      .from('players')
      .select('id, user_id, role, is_substitute')
      .eq('team_id', capTeamId)
      .order('is_substitute', { ascending: true });

    const iglFree = (roster || []).find(
      (p) => !p.user_id && String(p.role || '').toLowerCase() === 'igl'
    );
    const starterFree = (roster || []).find((p) => !p.user_id && !p.is_substitute);

    const pick = iglFree || starterFree;
    if (pick && (await claimPlayerRow(pick.id))) return user;
  }

  return user;
}

/**
 * Resolves the players row for /api/players/me: repairs stale users.player_id,
 * finds by players.user_id or roster email (case-insensitive). Never throws for missing row.
 */
async function fetchPlayerRowForProfile(req, user) {
  const selectCols = 'id, ign, role, device, is_substitute, team_id, free_agent_since';

  await syncUserPlayerLink(req, user);

  if (user.player_id) {
    const { data: p } = await supabaseAdmin.from('players').select(selectCols).eq('id', user.player_id).maybeSingle();
    if (p) return p;
    await supabaseAdmin.from('users').update({ player_id: null }).eq('id', user.id);
    user.player_id = null;
  }

  // Use limit(1): multiple rows with the same user_id breaks .maybeSingle() (PGRST116) and yields null.
  const { data: byAuthRows } = await supabaseAdmin
    .from('players')
    .select(selectCols)
    .eq('user_id', user.id)
    .limit(1);
  const byAuth = byAuthRows?.[0];
  if (byAuth) {
    await supabaseAdmin.from('users').update({ player_id: byAuth.id }).eq('id', user.id);
    user.player_id = byAuth.id;
    return byAuth;
  }

  const em = _normEmail(req.user?.email || user.email);
  if (em) {
    const { data: rows } = await supabaseAdmin
      .from('players')
      .select(`${selectCols}, user_id, email`)
      .ilike('email', em);
    const row = (rows || []).find((r) => {
      if (_normEmail(r.email) !== em) return false;
      return !r.user_id || String(r.user_id) === String(user.id);
    });
    if (row) {
      if (!row.user_id) {
        await supabaseAdmin.from('players').update({ user_id: user.id }).eq('id', row.id);
      }
      await supabaseAdmin.from('users').update({ player_id: row.id }).eq('id', user.id);
      user.player_id = row.id;
      const { data: p } = await supabaseAdmin.from('players').select(selectCols).eq('id', row.id).maybeSingle();
      if (p) return p;
    }
  }

  await syncUserPlayerLink(req, user);
  if (user.player_id) {
    const { data: p } = await supabaseAdmin.from('players').select(selectCols).eq('id', user.player_id).maybeSingle();
    if (p) return p;
  }

  const emailNorm = _normEmail(user.email || req.user?.email);
  const teamId = await getRosterTeamIdForUser(user.id, emailNorm);
  if (teamId) {
    const linked = await resolvePlayerOnTeamRoster(teamId, user, selectCols, emailNorm);
    if (linked) return linked;
  }

  return null;
}

async function getMyProfile(req, res, next) {
  try {
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, username, player_id, email')
      .eq('id', req.user.id)
      .single();

    if (userErr || !user) return res.status(404).json({ error: 'User profile not found.' });

    const player = await fetchPlayerRowForProfile(req, user);

    if (!player) {
      // Captain may not be linked to players row yet (email mismatch); still gate on registration status.
      const { data: capTeams } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('captain_id', user.id)
        .limit(1);
      const capTeam = capTeams?.[0];
      if (capTeam) {
        const { data: regRows } = await supabaseAdmin
          .from('registrations')
          .select(`
            id, status,
            tournament:tournaments ( id, name )
          `)
          .eq('team_id', capTeam.id)
          .order('submitted_at', { ascending: false })
          .limit(1);
        const latestReg = regRows?.[0];
        if (latestReg && latestReg.status !== 'approved') {
          return res.status(200).json({
            success: true,
            data: {
              user: { id: user.id, username: user.username },
              player: null,
              team: null,
              stats: { wins: 0, losses: 0, matches_played: 0 },
              awaiting_registration_approval: true,
              registration_status: latestReg.status,
              registration: latestReg
            }
          });
        }
      }
      return res.status(200).json({
        success: true,
        data: {
          user: { id: user.id, username: user.username },
          player: null,
          team: null,
          stats: { wins: 0, losses: 0, matches_played: 0 }
        }
      });
    }

    let team = null;
    let wins = 0;
    let losses = 0;

    if (player.team_id) {
      const { data: regRows } = await supabaseAdmin
        .from('registrations')
        .select(`
          id, status,
          tournament:tournaments ( id, name )
        `)
        .eq('team_id', player.team_id)
        .order('submitted_at', { ascending: false })
        .limit(1);

      const latestReg = regRows?.[0];
      if (latestReg && latestReg.status !== 'approved') {
        return res.status(200).json({
          success: true,
          data: {
            user: { id: user.id, username: user.username },
            player: null,
            team: null,
            stats: { wins: 0, losses: 0, matches_played: 0 },
            awaiting_registration_approval: true,
            registration_status: latestReg.status,
            registration: latestReg
          }
        });
      }

      const { data: teamData } = await supabaseAdmin
        .from('teams')
        .select('id, name, tag, region, captain_id')
        .eq('id', player.team_id)
        .single();

      team = teamData || null;

      const { data: matches } = await supabaseAdmin
        .from('matches')
        .select('id, team_a_id, team_b_id, score_a, score_b, status')
        .or(`team_a_id.eq.${player.team_id},team_b_id.eq.${player.team_id}`);

      for (const match of matches || []) {
        const isCompleted = match.status === 'completed' ||
          (match.score_a !== null && match.score_a !== undefined && match.score_b !== null && match.score_b !== undefined);
        if (!isCompleted) continue;
        const outcome = _deriveMatchOutcome(match, player.team_id);
        if (outcome === 'win') wins += 1;
        if (outcome === 'loss') losses += 1;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        user: { id: user.id, username: user.username },
        player: {
          id: player.id,
          ign: player.ign,
          role: player.role,
          device: player.device,
          is_substitute: player.is_substitute,
          free_agent_since: player.free_agent_since || null,
          join_cooldown_ms_remaining: msUntilCooldownEnds(player.free_agent_since),
        },
        team,
        stats: {
          wins,
          losses,
          matches_played: wins + losses
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

async function buildLeaveEligibility(user, player, team) {
  const result = {
    can_leave: false,
    reasons: [],
    code: null,
    is_captain: false,
    competition_lock: null,
    cooldown_hours_after_leave: Math.ceil(FREE_AGENT_COOLDOWN_MS / (60 * 60 * 1000)),
  };

  if (!player?.team_id || !team) {
    result.reasons.push('You are not on a team.');
    result.code = 'NO_TEAM';
    return result;
  }

  result.is_captain = team.captain_id === user.id;
  if (result.is_captain) {
    result.reasons.push('Captains cannot leave until captaincy is transferred to another roster player with an activated account.');
    result.code = 'CAPTAIN_TRANSFER_REQUIRED';
    return result;
  }

  const lock = await getTeamCompetitionLock(team.id);
  if (lock) {
    result.competition_lock = lock;
    result.reasons.push(lock.message);
    result.code = lock.code;
    return result;
  }

  const { data: roster } = await supabaseAdmin
    .from('players')
    .select('id, role, is_substitute')
    .eq('team_id', team.id);

  const rosterSize = (roster || []).length;
  const ROSTER_CAP = 6;
  if (rosterSize <= 1) {
    result.reasons.push('You are the last member. The final member cannot leave the team.');
    result.code = 'LAST_MEMBER';
    return result;
  }

  const remainingStarters = (roster || []).filter((p) => p.id !== player.id && !p.is_substitute);
  if (remainingStarters.length === 0) {
    const subToPromote = (roster || []).find((p) => p.id !== player.id && p.is_substitute);
    if (!subToPromote) {
      result.reasons.push('Cannot leave: the team would have no active starter left.');
      result.code = 'NO_STARTER_AFTER_LEAVE';
      return result;
    }
  }

  result.can_leave = true;
  result.roster_size_before_leave = rosterSize;
  result.roster_size_after_leave = rosterSize - 1;
  result.roster_cap = ROSTER_CAP;
  result.squad_below_full_after_leave = rosterSize - 1 < ROSTER_CAP;
  /**
   * Six-player squads are the lineup standard for registration — not a permanent lock on leaving.
   * Leaving may temporarily leave holes; recruitment brings the roster back before new tournaments.
   */
  result.leave_policy_note = result.squad_below_full_after_leave
    ? `After you leave, your squad will have ${rosterSize - 1} of ${ROSTER_CAP} players until they recruit. Tournament signup usually requires a full roster at entry time — not every hour of the season.`
    : null;
  return result;
}

async function getLeaveEligibility(req, res, next) {
  try {
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, username, player_id, email')
      .eq('id', req.user.id)
      .single();

    if (userErr || !user) return res.status(404).json({ error: 'User profile not found.' });
    await syncUserPlayerLink(req, user);
    if (!user.player_id) {
      return res.status(200).json({
        success: true,
        data: {
          can_leave: false,
          reasons: ['Your account is not linked to a player profile.'],
          code: 'NO_PLAYER_LINK',
          is_captain: false,
          competition_lock: null,
          cooldown_hours_after_leave: Math.ceil(FREE_AGENT_COOLDOWN_MS / (60 * 60 * 1000)),
        },
      });
    }

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id, ign, role, is_substitute, team_id')
      .eq('id', user.player_id)
      .single();

    if (!player?.team_id) {
      return res.status(200).json({
        success: true,
        data: {
          can_leave: false,
          reasons: ['You are not currently part of a team.'],
          code: 'NO_TEAM',
          is_captain: false,
          competition_lock: null,
          cooldown_hours_after_leave: Math.ceil(FREE_AGENT_COOLDOWN_MS / (60 * 60 * 1000)),
        },
      });
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', player.team_id)
      .single();

    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const data = await buildLeaveEligibility(user, player, team);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function leaveMyTeam(req, res, next) {
  try {
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, username, player_id, email')
      .eq('id', req.user.id)
      .single();

    if (userErr || !user) return res.status(404).json({ error: 'User profile not found.' });
    await syncUserPlayerLink(req, user);
    if (!user.player_id) return res.status(400).json({ error: 'Your account is not linked to a player profile.' });

    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .select('id, ign, role, is_substitute, team_id')
      .eq('id', user.player_id)
      .single();

    if (playerErr || !player) return res.status(404).json({ error: 'Player record not found.' });
    if (!player.team_id) return res.status(400).json({ error: 'You are not currently part of a team.' });

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', player.team_id)
      .single();

    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const eligibility = await buildLeaveEligibility(user, player, team);
    if (!eligibility.can_leave) {
      const primary = eligibility.reasons[0] || 'You cannot leave the team right now.';
      return res.status(409).json({
        error: primary,
        code: eligibility.code,
        competition_lock: eligibility.competition_lock || undefined,
      });
    }

    const { data: roster } = await supabaseAdmin
      .from('players')
      .select('id, role, is_substitute')
      .eq('team_id', team.id);

    const remainingStarters = (roster || []).filter((p) => p.id !== player.id && !p.is_substitute);
    if (remainingStarters.length === 0) {
      const subToPromote = (roster || []).find((p) => p.id !== player.id && p.is_substitute);
      if (subToPromote) {
        await supabaseAdmin
          .from('players')
          .update({ is_substitute: false })
          .eq('id', subToPromote.id);
      }
    }

    const nowIso = new Date().toISOString();
    // Do not overwrite role on leave: some DBs have stricter players_role_check variants
    // that reject synthetic labels like "player".
    const leavePayload = { team_id: null, is_substitute: false, free_agent_since: nowIso };
    let { error: leaveErr } = await supabaseAdmin.from('players').update(leavePayload).eq('id', player.id);
    if (leaveErr && /free_agent_since|schema cache|column/i.test(String(leaveErr.message))) {
      delete leavePayload.free_agent_since;
      leaveErr = (await supabaseAdmin.from('players').update(leavePayload).eq('id', player.id)).error;
    }

    if (leaveErr) {
      const msg = String(leaveErr.message || '');
      if (/team_id.*not null|not-null constraint.*team_id|null value in column .team_id/i.test(msg)) {
        return res.status(400).json({
          error:
            'Cannot clear squad membership: the database still requires players.team_id to be set. Apply the migration `warzongg-api/sql/players_team_id_nullable_for_free_agents.sql` in Supabase (ALTER COLUMN team_id DROP NOT NULL), then try again.',
          code: 'PLAYERS_TEAM_ID_NOT_NULLABLE',
        });
      }
      if (/players_role_check|check constraint.*players_role_check|violates check constraint.*role/i.test(msg)) {
        return res.status(400).json({
          error:
            'Could not update team leave state because the database role constraint rejected the requested role value. The API now preserves your existing role during leave; retry the action.',
          code: 'PLAYERS_ROLE_CHECK_CONSTRAINT',
        });
      }
      return res.status(400).json({ error: msg });
    }

    try {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: team.captain_id,
          type: 'team_member_left',
          message: `${player.ign || user.username} left your team (${team.name}).`,
          read: false
        });
    } catch (_) {
      // Notifications table may not exist in all environments yet.
    }

    res.status(200).json({
      success: true,
      message: 'You have successfully left the team.',
      free_agent_cooldown_hours: Math.ceil(FREE_AGENT_COOLDOWN_MS / (60 * 60 * 1000)),
    });
  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
// GET /api/players/me/participations
// Authenticated. Approved tournament registrations for teams the user belongs to (captain or roster).
// ──────────────────────────────────────────────
async function getMyParticipations(req, res, next) {
  try {
    const userId = req.user.id;
    const teamIds = new Set();

    const { data: asCaptain } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('captain_id', userId);

    (asCaptain || []).forEach((t) => teamIds.add(t.id));

    const { data: usr } = await supabaseAdmin
      .from('users')
      .select('player_id')
      .eq('id', userId)
      .maybeSingle();

    if (usr?.player_id) {
      const { data: pl } = await supabaseAdmin
        .from('players')
        .select('team_id')
        .eq('id', usr.player_id)
        .maybeSingle();
      if (pl?.team_id) teamIds.add(pl.team_id);
    }

    const { data: rosterByAuth } = await supabaseAdmin
      .from('players')
      .select('team_id')
      .eq('user_id', userId);
    (rosterByAuth || []).forEach((p) => {
      if (p.team_id) teamIds.add(p.team_id);
    });

    if (!teamIds.size) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data: regs, error } = await supabaseAdmin
      .from('registrations')
      .select(`
        id, status, game_mode, tournament_id, submitted_at,
        tournament:tournaments ( id, name, tag, status, start_date ),
        team:teams ( id, name, tag )
      `)
      .eq('status', 'approved')
      .in('team_id', [...teamIds]);

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ success: true, data: regs || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyProfile,
  getMyParticipations,
  leaveMyTeam,
  getLeaveEligibility,
};
