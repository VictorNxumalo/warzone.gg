const { supabase, supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────
// POST /api/registrations — existing captain registers current team for another tournament
// Body: { register_existing_team: true, tournament_id, game_mode?, device_type? }
// ──────────────────────────────────────────────
async function loadSavedRostersForTeam(teamId) {
  const { data, error } = await supabaseAdmin
    .from('team_saved_rosters')
    .select('id, name, lineup, created_at, updated_at')
    .eq('team_id', teamId)
    .order('updated_at', { ascending: false });
  if (error) return [];
  return data || [];
}

/**
 * Many roster rows only have `users` linked by email; `players.user_id` is sometimes null.
 * Adds account_linked and resolved_user_id for captain UI and transfer eligibility.
 */
async function enrichTeamPlayersWithAccountLinks(players) {
  const list = players || [];
  const emails = [
    ...new Set(
      list
        .filter((p) => !p.user_id && p.email)
        .map((p) => String(p.email).trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  let byEmail = {};
  if (emails.length) {
    const lookups = await Promise.all(
      emails.map(async (em) => {
        const { data: u } = await supabaseAdmin
          .from('users')
          .select('id, email, player_id')
          .ilike('email', em)
          .maybeSingle();
        return u ? { key: em, user: u } : null;
      })
    );
    lookups.forEach((row) => {
      if (row) byEmail[row.key] = row.user;
    });
  }

  return list.map((p) => {
    const emailNorm = String(p.email || '').trim().toLowerCase();
    let resolved_user_id = p.user_id || null;
    let account_linked = !!p.user_id;

    if (!resolved_user_id && emailNorm && byEmail[emailNorm]) {
      const u = byEmail[emailNorm];
      if (!u.player_id || String(u.player_id) === String(p.id)) {
        resolved_user_id = u.id;
        account_linked = true;
      }
    }

    return {
      ...p,
      resolved_user_id: resolved_user_id || null,
      account_linked,
    };
  });
}

/**
 * Captaincy only changes `teams.captain_id`. The outgoing captain must stay linked to their
 * roster row as a normal member (users.player_id ↔ players.user_id on their slot).
 */
async function repairFormerCaptainRosterLink(teamId, formerCaptainUserId, newCaptainPlayerId) {
  const { data: fcUser } = await supabaseAdmin
    .from('users')
    .select('id, email, player_id')
    .eq('id', formerCaptainUserId)
    .maybeSingle();
  if (!fcUser) return;

  const emailNorm = String(fcUser.email || '').trim().toLowerCase();

  const { data: byUidRows } = await supabaseAdmin
    .from('players')
    .select('id, team_id, user_id, email')
    .eq('team_id', teamId)
    .eq('user_id', formerCaptainUserId)
    .limit(1);
  let slot = byUidRows?.[0];

  if (
    !slot &&
    fcUser.player_id &&
    String(fcUser.player_id) !== String(newCaptainPlayerId)
  ) {
    const { data: prRows } = await supabaseAdmin
      .from('players')
      .select('id, team_id, user_id, email')
      .eq('id', fcUser.player_id)
      .limit(1);
    const pr = prRows?.[0];
    if (pr && String(pr.team_id) === String(teamId)) slot = pr;
  }

  if (!slot && emailNorm) {
    const { data: roster } = await supabaseAdmin
      .from('players')
      .select('id, team_id, user_id, email')
      .eq('team_id', teamId);
    slot =
      (roster || []).find(
        (r) =>
          String(r.id) !== String(newCaptainPlayerId) &&
          String(r.email || '').trim().toLowerCase() === emailNorm
      ) || null;
  }

  // Last-resort deterministic recovery:
  // if stale links prevented direct/email match, choose a claimable roster slot (prefer IGL, then starter)
  // excluding the new captain row. This handles former-captain demotions where links drifted beforehand.
  if (!slot) {
    const { data: roster } = await supabaseAdmin
      .from('players')
      .select('id, team_id, user_id, email, role, is_substitute')
      .eq('team_id', teamId);

    const claimable = [];
    for (const r of roster || []) {
      if (String(r.id) === String(newCaptainPlayerId)) continue;
      if (!r.user_id) {
        claimable.push(r);
        continue;
      }
      const { data: holder } = await supabaseAdmin
        .from('users')
        .select('id, player_id')
        .eq('id', r.user_id)
        .maybeSingle();
      // If slot points to a missing/misaligned user link, it is reclaimable.
      if (!holder || String(holder.player_id || '') !== String(r.id)) {
        claimable.push(r);
      }
    }

    const igl = claimable.find((r) => String(r.role || '').toLowerCase() === 'igl');
    const starter = claimable.find((r) => !r.is_substitute);
    const pick = igl || starter || (claimable.length === 1 ? claimable[0] : null);
    if (pick) slot = pick;
  }

  if (!slot || String(slot.id) === String(newCaptainPlayerId)) return;

  if (slot.user_id && String(slot.user_id) !== String(formerCaptainUserId)) {
    const { data: holder } = await supabaseAdmin
      .from('users')
      .select('id, player_id')
      .eq('id', slot.user_id)
      .maybeSingle();
    if (holder && String(holder.player_id) === String(slot.id)) return;
  }

  await supabaseAdmin.from('players').update({ user_id: formerCaptainUserId }).eq('id', slot.id);
  await supabaseAdmin.from('users').update({ player_id: slot.id }).eq('id', formerCaptainUserId);
}

async function registerExistingTeamForTournament(req, res, next) {
  try {
    const { tournament_id, game_mode, device_type, saved_roster_id } = req.body;

    const { data: prof } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .maybeSingle();
    if (prof?.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot register for tournaments.' });
    }

    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, status, max_slots, registered_count, mode')
      .eq('id', tournament_id)
      .single();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }

    if (tournament.status !== 'open') {
      return res.status(409).json({
        error: `This tournament is not open for registration. Current status: ${tournament.status}.`,
      });
    }

    if (tournament.registered_count >= tournament.max_slots) {
      return res.status(409).json({ error: 'This tournament is full. No slots remaining.' });
    }

    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name, tag')
      .eq('captain_id', req.user.id)
      .limit(1);

    const myTeam = teams?.[0];
    if (!myTeam) {
      return res.status(404).json({
        error: 'No team found for your account. Use Register Your Team to create a squad first.',
      });
    }

    const { count: savedRosterCount, error: cntErr } = await supabaseAdmin
      .from('team_saved_rosters')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', myTeam.id);
    const rosterCount = cntErr ? 0 : savedRosterCount || 0;

    let resolvedSavedRosterId =
      saved_roster_id && String(saved_roster_id).trim() ? String(saved_roster_id).trim() : null;

    if (rosterCount > 0 && !resolvedSavedRosterId) {
      return res.status(400).json({
        error:
          'Select a saved tournament lineup. Create presets under My Team → Tournament lineups.',
      });
    }

    if (resolvedSavedRosterId) {
      const { data: sr } = await supabaseAdmin
        .from('team_saved_rosters')
        .select('id, team_id')
        .eq('id', resolvedSavedRosterId)
        .maybeSingle();
      if (!sr || String(sr.team_id) !== String(myTeam.id)) {
        return res.status(400).json({ error: 'Invalid saved lineup for this team.' });
      }
    }

    const { data: existingReg } = await supabaseAdmin
      .from('registrations')
      .select('id, status')
      .eq('team_id', myTeam.id)
      .eq('tournament_id', tournament_id)
      .maybeSingle();

    if (existingReg) {
      return res.status(200).json({
        success: true,
        message: 'Your team is already registered for this tournament.',
        team_id: myTeam.id,
        registration_id: existingReg.id,
        status: existingReg.status,
        alreadySubmitted: true,
      });
    }

    const gm = (game_mode && String(game_mode).trim()) || tournament.mode || 'ranked';
    const dt = (device_type && String(device_type).trim()) || 'android';

    const insertRow = {
      tournament_id,
      team_id: myTeam.id,
      game_mode: gm,
      device_type: dt,
      status: 'pending',
    };
    if (resolvedSavedRosterId) insertRow.saved_roster_id = resolvedSavedRosterId;

    const { data: registration, error: regError } = await supabaseAdmin
      .from('registrations')
      .insert(insertRow)
      .select()
      .single();

    if (regError) {
      return res.status(400).json({ error: regError.message });
    }

    res.status(201).json({
      success: true,
      message: 'Registration submitted. Awaiting admin approval.',
      team_id: myTeam.id,
      registration_id: registration.id,
      status: 'pending',
    });
  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
// POST /api/teams
// Authenticated. Creates team + players in one flow.
// Body: { name, tag, region, players[], whatsapp? }
// ──────────────────────────────────────────────
async function create(req, res, next) {
  try {
    const regExisting = req.body.register_existing_team;
    if (regExisting === true || regExisting === 'true') {
      return registerExistingTeamForTournament(req, res, next);
    }

    const {
      name, tag, region,
      players, whatsapp
    } = req.body;

    // 1. Validate required fields
    if (!name || !tag || !region || !players) {
      return res.status(400).json({
        error: 'Missing required fields: name, tag, region, players.'
      });
    }

    if (tag.length > 4) {
      return res.status(400).json({ error: 'Team tag must be 4 characters or less.' });
    }

    if (!Array.isArray(players) || players.length < 1) {
      return res.status(400).json({ error: 'At least 1 player is required.' });
    }

    if (players.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 players allowed (5 starters + 1 substitute).' });
    }

    // Validate each player has required fields
    for (const [i, player] of players.entries()) {
      if (!player.ign || !player.codm_uid || !player.role || !player.email) {
        return res.status(400).json({
          error: `Player ${i + 1} is missing required fields: ign, player_id, role, email.`
        });
      }
      const playerId = String(player.codm_uid || '').trim();
      // Must match DB constraint players_codm_uid_check (see sql/fix_players_codm_uid_check.sql)
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(playerId)) {
        return res.status(400).json({
          error: `Player ${i + 1} (${player.ign}): player ID must be 3–32 characters (letters, numbers, ".", "_", "-").`
        });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(player.email)) {
        return res.status(400).json({
          error: `Player ${i + 1} (${player.ign}): enter a valid email address.`
        });
      }
    }

    const tagU = String(tag).trim().toUpperCase();

    // Idempotent: double-submit / duplicate POST after success — same captain + tag already exists
    const { data: captainTeam } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('captain_id', req.user.id)
      .eq('tag', tagU)
      .maybeSingle();

    if (captainTeam) {
      const captainEmail = (req.user.email || '').trim().toLowerCase();
      if (captainEmail) {
        const { data: captainPlayer } = await supabaseAdmin
          .from('players')
          .select('id, user_id')
          .eq('team_id', captainTeam.id)
          .eq('email', captainEmail)
          .maybeSingle();
        if (captainPlayer && !captainPlayer.user_id) {
          await supabaseAdmin.from('users').update({ player_id: captainPlayer.id }).eq('id', req.user.id);
          await supabaseAdmin.from('players').update({ user_id: req.user.id }).eq('id', captainPlayer.id);
        }
      }
      return res.status(200).json({
        success: true,
        message: 'Your team already exists.',
        team_id: captainTeam.id,
        alreadySubmitted: true
      });
    }

    // 3. Check team name and tag are not already taken (by another captain)
    const { data: byName } = await supabaseAdmin
      .from('teams')
      .select('id, captain_id')
      .eq('name', name)
      .maybeSingle();
    const { data: byTag } = await supabaseAdmin
      .from('teams')
      .select('id, captain_id')
      .eq('tag', tagU)
      .maybeSingle();

    const conflict = byName || byTag;
    if (conflict) {
      if (conflict.captain_id === req.user.id) {
        return res.status(409).json({
          error:
            'This team name or tag is already on your account. If you just submitted, open My Team — or wait a moment and refresh. If registration failed part-way, contact support.'
        });
      }
      return res.status(409).json({ error: 'A team with that name or tag already exists.' });
    }

    // 5. Create the team (service role — anon client has no JWT, so RLS would block inserts)
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({
        name,
        tag: tag.toUpperCase(),
        region,
        captain_id: req.user.id
      })
      .select()
      .single();

    if (teamError) {
      return res.status(400).json({ error: teamError.message });
    }

    // 6. Create all player rows linked to the team
    const playerRows = players.map((p, index) => ({
      team_id: team.id,
      ign: p.ign,
      codm_uid: String(p.codm_uid || '').trim(),
      email: (p.email || '').trim().toLowerCase(),
      role: p.role,
      device: p.device || 'android',
      is_substitute: p.role === 'substitute' || index === 5
    }));

    const { error: playersError } = await supabaseAdmin
      .from('players')
      .insert(playerRows);

    if (playersError) {
      await supabaseAdmin.from('teams').delete().eq('id', team.id);
      let msg = playersError.message || 'Could not save roster.';
      if (/players_codm_uid_check|codm_uid_check/i.test(msg)) {
        msg =
          'A player ID does not match the database rules (length 3–32, allowed: letters, numbers, ".", "_", "-"). ' +
          'If your IDs look correct, run sql/fix_players_codm_uid_check.sql in Supabase SQL Editor to align the table constraint.';
      }
      return res.status(400).json({ error: msg });
    }

    // 7. Link captain account ↔ player row when IGL email matches auth email.
    const captainEmail = (req.user.email || '').trim().toLowerCase();
    if (captainEmail) {
      const { data: captainPlayer } = await supabaseAdmin
        .from('players')
        .select('id, user_id')
        .eq('team_id', team.id)
        .eq('email', captainEmail)
        .maybeSingle();

      if (captainPlayer && !captainPlayer.user_id) {
        await supabaseAdmin.from('users').update({ player_id: captainPlayer.id }).eq('id', req.user.id);
        await supabaseAdmin.from('players').update({ user_id: req.user.id }).eq('id', captainPlayer.id);
      }
    }

    // 8. Update captain's whatsapp if provided
    if (whatsapp) {
      await supabaseAdmin
        .from('users')
        .update({ whatsapp })
        .eq('id', req.user.id);
    }

    res.status(201).json({
      success: true,
      message: 'Team created successfully.',
      team_id: team.id
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// GET /api/teams/:id
// Public. Returns team profile with roster and stats.
// ──────────────────────────────────────────────
async function getById(req, res, next) {
  try {
    const { id } = req.params;

    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        *,
        captain:users ( id, username, whatsapp ),
        players ( id, ign, codm_uid, role, device, is_substitute, user_id )
      `)
      .eq('id', id)
      .single();

    if (error || !team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    // Also fetch this team's match history
    const { data: matches } = await supabase
      .from('matches')
      .select('id, round, score_a, score_b, winner_id, map_name, status, played_at, team_a_id, team_b_id')
      .or(`team_a_id.eq.${id},team_b_id.eq.${id}`)
      .order('played_at', { ascending: false })
      .limit(10);

    res.status(200).json({
      success: true,
      data: { ...team, match_history: matches || [] }
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// PATCH /api/teams/:id
// Authenticated. Captain updates their team info.
// ──────────────────────────────────────────────
async function update(req, res, next) {
  try {
    const { id } = req.params;

    // Confirm the requesting user is the captain
    const { data: team } = await supabase
      .from('teams')
      .select('id, captain_id')
      .eq('id', id)
      .single();

    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    if (team.captain_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the team captain can update this team.' });
    }

    const allowed = ['name', 'tag', 'region', 'logo_url'];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({
      success: true,
      message: 'Team updated successfully.',
      data
    });

  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
// GET /api/teams/mine
// Authenticated. Team if user is captain OR roster player (players.team_id).
// ──────────────────────────────────────────────
async function getMyTeam(req, res, next) {
  try {
    let team = null;
    let isCaptain = false;

    const { data: capTeams, error: capErr } = await supabaseAdmin
      .from('teams')
      .select('id, name, tag, region, wins, losses, points, earnings, captain_id')
      .eq('captain_id', req.user.id)
      .limit(1);

    if (capErr) return res.status(400).json({ error: capErr.message });

    team = capTeams?.[0] || null;
    if (team) {
      isCaptain = true;
    }

    if (!team) {
      let rosterTeamId = null;

      const { data: usr } = await supabaseAdmin
        .from('users')
        .select('player_id')
        .eq('id', req.user.id)
        .maybeSingle();

      if (usr?.player_id) {
        const { data: pl } = await supabaseAdmin
          .from('players')
          .select('team_id')
          .eq('id', usr.player_id)
          .maybeSingle();
        rosterTeamId = pl?.team_id || null;
      }

      if (!rosterTeamId) {
        const { data: byAuth } = await supabaseAdmin
          .from('players')
          .select('team_id')
          .eq('user_id', req.user.id)
          .limit(1);
        rosterTeamId = byAuth?.[0]?.team_id || null;
      }

      if (rosterTeamId) {
        const { data: tRow } = await supabaseAdmin
          .from('teams')
          .select('id, name, tag, region, wins, losses, points, earnings, captain_id')
          .eq('id', rosterTeamId)
          .maybeSingle();
        team = tRow || null;
      }
    }

    if (!team) {
      return res.status(200).json({
        success: true,
        data: {
          team: null,
          registration: null,
          matches: [],
          saved_rosters: [],
          is_captain: false,
        },
      });
    }

    const { data: captainProf } = await supabaseAdmin
      .from('users')
      .select('player_id')
      .eq('id', team.captain_id)
      .maybeSingle();
    team.captain_player_id = captainProf?.player_id ?? null;

    const { data: players } = await supabaseAdmin
      .from('players')
      .select('id, ign, codm_uid, role, device, is_substitute, user_id, email')
      .eq('team_id', team.id);

    team.players = await enrichTeamPlayersWithAccountLinks(players || []);

    const ROSTER_CAP = 6;
    const rosterCount = (team.players || []).length;
    const rosterSummary = {
      roster_count: rosterCount,
      roster_cap: ROSTER_CAP,
      roster_open_slots: Math.max(0, ROSTER_CAP - rosterCount),
      roster_complete: rosterCount === ROSTER_CAP,
      roster_policy_hint:
        rosterCount >= ROSTER_CAP
          ? null
          : 'Fewer than six players means open recruitment slots. Tournament registration typically checks a full roster at signup — leaving mid-season can leave gaps until you recruit via invites or join requests.',
    };

    const saved_rosters = isCaptain ? await loadSavedRostersForTeam(team.id) : [];

    const { data: registrations } = await supabaseAdmin
      .from('registrations')
      .select(`
        id, status, game_mode, device_type, notes,
        submitted_at, reviewed_at,
        tournament:tournaments ( id, name, start_date, prize_total, format, status )
      `)
      .eq('team_id', team.id)
      .order('submitted_at', { ascending: false })
      .limit(1);

    const registration = registrations?.[0] || null;

    if (registration && registration.status !== 'approved') {
      return res.status(200).json({
        success: true,
        data: {
          team: null,
          captain_team_id: team.id,
          registration,
          matches: [],
          saved_rosters: isCaptain ? saved_rosters : [],
          registration_pending: registration.status === 'pending',
          registration_rejected: registration.status === 'rejected',
          is_captain: isCaptain,
        },
      });
    }

    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select(`
        id, round, score_a, score_b, map_name, status,
        team_a_id, team_b_id,
        team_a:teams!team_a_id ( id, name ),
        team_b:teams!team_b_id ( id, name )
      `)
      .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
      .order('played_at', { ascending: false })
      .limit(6);

    res.status(200).json({
      success: true,
      data: {
        team,
        registration,
        matches: matches || [],
        saved_rosters,
        registration_pending: false,
        registration_rejected: false,
        is_captain: isCaptain,
        ...rosterSummary,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
// POST /api/teams/mine/transfer-captain
// Authenticated captain transfers leadership to another roster player (must have user account).
// Body: { new_captain_player_id }
// ──────────────────────────────────────────────
async function transferCaptainMine(req, res, next) {
  try {
    const newCaptainPlayerId = req.body?.new_captain_player_id;
    if (!newCaptainPlayerId) {
      return res.status(400).json({ error: 'new_captain_player_id is required.' });
    }

    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, captain_id, name')
      .eq('captain_id', req.user.id)
      .limit(1);

    const team = teams?.[0];
    if (!team) {
      return res.status(404).json({ error: 'You do not captain a team.' });
    }

    const { data: newCap } = await supabaseAdmin
      .from('players')
      .select('id, team_id, user_id, ign, email')
      .eq('id', newCaptainPlayerId)
      .maybeSingle();

    if (!newCap || String(newCap.team_id) !== String(team.id)) {
      return res.status(400).json({
        error: 'New captain must be a player on your team roster.',
      });
    }

    let targetUserId = newCap.user_id;

    if (!targetUserId) {
      const em = String(newCap.email || '').trim().toLowerCase();
      if (!em) {
        return res.status(400).json({
          error: 'New captain must have an email on their roster row matching their login account.',
        });
      }
      const { data: acc } = await supabaseAdmin
        .from('users')
        .select('id, player_id')
        .ilike('email', em)
        .maybeSingle();

      if (!acc) {
        return res.status(400).json({
          error:
            'No platform account found for that roster email. The teammate must register/log in with the same email as on the roster.',
        });
      }
      if (acc.player_id && String(acc.player_id) !== String(newCap.id)) {
        return res.status(400).json({
          error: 'That login is already linked to a different player profile.',
        });
      }

      await supabaseAdmin.from('players').update({ user_id: acc.id }).eq('id', newCap.id);
      if (!acc.player_id) {
        await supabaseAdmin.from('users').update({ player_id: newCap.id }).eq('id', acc.id);
      }
      targetUserId = acc.id;
    }

    if (String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ error: 'That player is already the captain.' });
    }

    const { error } = await supabaseAdmin
      .from('teams')
      .update({ captain_id: targetUserId })
      .eq('id', team.id);

    if (error) return res.status(400).json({ error: error.message });

    try {
      await repairFormerCaptainRosterLink(team.id, req.user.id, newCap.id);
    } catch (e) {
      console.warn('[transferCaptainMine] repairFormerCaptainRosterLink', e?.message || e);
    }

    res.status(200).json({
      success: true,
      message: `Captaincy transferred to ${newCap.ign || 'your teammate'}.`,
      data: { captain_user_id: targetUserId, team_id: team.id },
    });
  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
// GET /api/teams/mine/notifications
// Authenticated captain notifications for My Team page toasts.
// ──────────────────────────────────────────────
async function getMyTeamNotifications(req, res, next) {
  try {
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, captain_id')
      .eq('captain_id', req.user.id)
      .limit(1);

    const team = teams?.[0] || null;
    if (!team) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('id, type, message, read, created_at')
      .eq('user_id', req.user.id)
      .eq('type', 'team_member_left')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return res.status(200).json({ success: true, data: [] });

    res.status(200).json({ success: true, data: notifications || [] });
  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
// PATCH /api/teams/mine/notifications/read
// Mark captain notifications as read.
// ──────────────────────────────────────────────
async function markMyTeamNotificationsRead(req, res, next) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(200).json({ success: true, updated: 0 });
    }

    await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .in('id', ids);

    res.status(200).json({ success: true, updated: ids.length });
  } catch (err) {
    next(err);
  }
}
// ──────────────────────────────────────────────
// GET /api/teams/mine
// Authenticated. Returns the team captained by
// the current user, with roster and registration.
// ──────────────────────────────────────────────
async function getMine(req, res, next) {
  try {
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select(`
        id, name, tag, region, wins, losses, points, earnings,
        players ( id, ign, codm_uid, role, device, is_substitute )
      `)
      .eq('captain_id', req.user.id)
      .maybeSingle();

    if (teamErr) return res.status(400).json({ error: teamErr.message });
    if (!team)   return res.status(404).json({ error: 'No team found for this account.' });

    // Latest registration for this team
    const { data: registration } = await supabase
      .from('registrations')
      .select(`
        id, status, game_mode, device_type, notes,
        submitted_at, reviewed_at,
        tournament:tournaments ( id, name, start_date, prize_total, format, status )
      `)
      .eq('team_id', team.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Match history
    const { data: matches } = await supabase
      .from('matches')
      .select(`
        id, round, score_a, score_b, map_name, status,
        team_a_id, team_b_id,
        team_a:teams!team_a_id ( id, name ),
        team_b:teams!team_b_id ( id, name )
      `)
      .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
      .order('played_at', { ascending: false })
      .limit(6);

    res.status(200).json({
      success: true,
      data: {
        team,
        registration: registration || null,
        matches: matches || []
      }
    });

  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getById,
  update,
  getMyTeam,
  transferCaptainMine,
  getMyTeamNotifications,
  markMyTeamNotificationsRead
};
