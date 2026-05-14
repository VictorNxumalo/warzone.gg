const { supabase, supabaseAdmin } = require('../config/supabase');

// ──────────────────────────────────────────────
// POST /api/auth/register
// Body: { email, password, username, whatsapp? }
// ──────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { email, password, username, whatsapp } = req.body;

    // 1. Basic validation
    if (!email || !password || !username) {
      return res.status(400).json({
        error: 'email, password and username are all required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters.'
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        error: 'Username must be at least 3 characters.'
      });
    }

    // 2. Check if username is already taken
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'That username is already taken. Please choose another.'
      });
    }

    // 3. Create the auth user using the admin client so it is confirmed
    //    immediately — no email verification step required.
    //    The handle_new_user trigger will create the public.users row.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,          // ← skips email verification
      user_metadata: { username }   // ← picked up by the DB trigger
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already exists')) {
        return res.status(409).json({
          error: 'This email already exists in authentication. If you reset test data, clear Supabase Authentication users too, or use a different email.'
        });
      }
      return res.status(400).json({ error: error.message });
    }

    // 4. Update the public.users row with whatsapp if provided
    if (whatsapp && data.user) {
      await supabase
        .from('users')
        .update({ whatsapp })
        .eq('id', data.user.id);
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      user: {
        id:       data.user.id,
        email:    data.user.email,
        username
      }
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// ──────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // 1. Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 2. Fetch the full profile from public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, username, role, whatsapp, discord, created_at')
      .eq('id', data.user.id)
      .single();

    // Guard: if the profile row doesn't exist yet the account is broken
    if (profileError || !profile) {
      return res.status(404).json({
        error: 'User profile not found. Please contact support or re-register.'
      });
    }

    res.status(200).json({
      success: true,
      token: data.session.access_token,
      user: profile
    });

  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
// POST /api/auth/logout
// Requires: Authorization: Bearer <token>
// ──────────────────────────────────────────────
async function logout(req, res, next) {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });

  } catch (err) {
    next(err);
  }
}


// ──────────────────────────────────────────────
// GET /api/auth/me
// Requires: Authorization: Bearer <token>
// ──────────────────────────────────────────────
async function me(req, res, next) {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, username, role, whatsapp, discord, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.status(200).json({
      success: true,
      user: profile
    });

  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
// POST /api/auth/activate-player/check
// Body: { email }
// Returns whether this email matches a player row that can still be activated.
// ──────────────────────────────────────────────
function _normalizeEmbeddedTeam(embedded) {
  if (!embedded) return null;
  const row = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!row || row.id == null) return null;
  return { id: row.id, name: row.name, tag: row.tag };
}

function _normalizeRegTournament(t) {
  if (!t) return null;
  const row = Array.isArray(t) ? t[0] : t;
  if (!row) return null;
  return { name: row.name, tag: row.tag };
}

// ──────────────────────────────────────────────
async function checkPlayerActivation(req, res, next) {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Case-insensitive email match; embed team when PostgREST exposes the FK (fallback if embed fails).
    let rows;
    let playerErr;
    const withTeam = await supabaseAdmin
      .from('players')
      .select(`
        id, ign, email, user_id, team_id,
        team:teams ( id, name, tag )
      `)
      .ilike('email', email);
    if (withTeam.error) {
      const plain = await supabaseAdmin
        .from('players')
        .select('id, ign, email, user_id, team_id')
        .ilike('email', email);
      rows = plain.data;
      playerErr = plain.error;
    } else {
      rows = withTeam.data;
      playerErr = null;
    }

    if (playerErr) {
      return res.status(400).json({ error: playerErr.message });
    }
    if (!rows?.length) {
      return res.status(404).json({
        error: 'No player record found for that email. Ask your captain to use this exact address on the roster, or check for typos.'
      });
    }

    const unactivated = rows.filter((p) => !p.user_id);
    if (!unactivated.length) {
      return res.status(409).json({
        error: 'This roster slot already has an account. Sign in with your email and password.'
      });
    }

    const player = unactivated.find((p) => p.team_id) || unactivated[0];

    let team = _normalizeEmbeddedTeam(player.team);
    let teamId = player.team_id || team?.id || null;

    if (!team && teamId) {
      const { data: teamRow } = await supabaseAdmin
        .from('teams')
        .select('id, name, tag')
        .eq('id', teamId)
        .maybeSingle();
      if (teamRow) {
        team = { name: teamRow.name, tag: teamRow.tag };
      }
    }

    let registration = null;
    if (teamId) {
      const { data: regRows, error: regErr } = await supabaseAdmin
        .from('registrations')
        .select(`
          id, status, submitted_at,
          tournament:tournaments ( id, name, tag )
        `)
        .eq('team_id', teamId)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (regErr) {
        return res.status(400).json({ error: regErr.message });
      }

      const reg = regRows?.[0];
      if (reg) {
        registration = {
          status: reg.status,
          submitted_at: reg.submitted_at,
          tournament: _normalizeRegTournament(reg.tournament)
        };
      }
    }

    const teamPayload = team ? { name: team.name, tag: team.tag } : null;

    res.status(200).json({
      success: true,
      data: {
        ign: player.ign || null,
        team: teamPayload,
        registration
      }
    });
  } catch (err) {
    next(err);
  }
}

// Roster email scan: explicit flags, or email-only body (some proxies strip boolean `lookup`).
function _isRosterEmailLookup(req) {
  const b = req.body || {};
  if (b.lookup === true || b.lookup === 'true') return true;
  if (b.mode === 'lookup' || b.mode === 'check') return true;
  const email = String(b.email || '').trim();
  const user = String(b.username || '').trim();
  const pass = String(b.password || '');
  return email.length > 0 && user.length === 0 && pass.length === 0;
}

// ──────────────────────────────────────────────
// POST /api/auth/activate-player
// Body (lookup): { email, lookup: true } or { email, mode: 'check' } or email only
// Body (full):   { email, username, password }
// Creates account for a pre-registered player and links rows:
// players.user_id <-> users.player_id
// ──────────────────────────────────────────────
async function activatePlayer(req, res, next) {
  try {
    if (_isRosterEmailLookup(req)) {
      return checkPlayerActivation(req, res, next);
    }

    const email = (req.body.email || '').trim().toLowerCase();
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    if (existingUser) {
      return res.status(409).json({ error: 'That username is already taken. Please choose another.' });
    }

    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .select('id, ign, email, user_id')
      .eq('email', email)
      .single();

    if (playerErr || !player) {
      return res.status(404).json({ error: 'No player registration found for that email.' });
    }
    if (player.user_id) {
      return res.status(409).json({ error: 'This player account is already activated. Please log in.' });
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username }
    });

    if (createErr) {
      if (
        createErr.message.toLowerCase().includes('already registered') ||
        createErr.message.toLowerCase().includes('already exists')
      ) {
        return res.status(409).json({
          error: 'This email already exists in authentication. If you reset test data, clear Supabase Authentication users too, or use a different email.'
        });
      }
      return res.status(400).json({ error: createErr.message });
    }

    const userId = created.user?.id;
    if (!userId) return res.status(500).json({ error: 'Activation failed. Could not create user account.' });

    await supabaseAdmin
      .from('users')
      .update({ player_id: player.id, username })
      .eq('id', userId);

    await supabaseAdmin
      .from('players')
      .update({ user_id: userId })
      .eq('id', player.id);

    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (loginErr || !loginData?.session) {
      return res.status(500).json({ error: 'Account activated, but auto sign-in failed. Please log in manually.' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, username, role, whatsapp, discord, created_at, player_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Account activated, but profile loading failed.' });
    }

    res.status(201).json({
      success: true,
      message: `Welcome ${player.ign || username}, your player account is now active.`,
      token: loginData.session.access_token,
      user: profile
    });
  } catch (err) {
    next(err);
  }
}


module.exports = { register, login, logout, me, activatePlayer, checkPlayerActivation };
