// ─────────────────────────────────────────────────────────────────────────────
// REPLACE the auth section of your existing js/api.js with this block.
// The key change: authLogin now saves the token to localStorage via saveSession()
// so the session persists across page navigations.
// ─────────────────────────────────────────────────────────────────────────────

// Base URL is set in js/config.js (window.WZ_API_URL). Override with an inline script before config.js in production.
const API_URL = (function () {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  var u = window.WZ_API_URL;
  if (u && String(u).trim()) return String(u).replace(/\/$/, '');
  var h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
  throw new Error(
    'Missing API URL configuration. Set window.WZ_API_URL before loading js/api.js.'
  );
})();

async function _jsonSafe(res) {
  try {
    return await res.json();
  } catch (_) {
    return {};
  }
}

function _apiError(data, fallback) {
  return new Error(data?.error || data?.message || fallback);
}
// ── Auth ──────────────────────────────────────────────────────────────────────

async function authLogin(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Login failed');

  // data.token  = JWT
  // data.user   = { id, email, username, role }
  const { token, user } = data;
  saveSession(token, user);   // <-- persists to localStorage via nav.js
  return user;
}

async function authRegister(email, password, username, whatsapp) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username, whatsapp })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Registration failed');
  return data;
}

async function checkPlayerActivationEmail(email) {
  // Same URL as full activation. `mode` + email-only fallback on server if `lookup` is dropped by a proxy.
  const res = await fetch(`${API_URL}/api/auth/activate-player`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, lookup: true, mode: 'check' })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Lookup failed');
  return data.data || {};
}

async function activatePlayerAccount(email, username, password) {
  const res = await fetch(`${API_URL}/api/auth/activate-player`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Activation failed');
  const { token, user } = data;
  if (token && user) saveSession(token, user);
  return user;
}

async function authLogout() {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (_) {}
  }
  clearSession();   // wipes localStorage
}

// ── Helper: attach token to any request ───────────────────────────────────────
function _authHeaders() {
  const token = getToken();
  return token
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

// ── Tournaments ───────────────────────────────────────────────────────────────

async function getTournaments(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/tournaments${query ? '?' + query : ''}`);
  if (!res.ok) throw new Error('Failed to load tournaments');
  const data = await res.json();
  return data.data || data;
}

async function getTournament(id) {
  const res = await fetch(`${API_URL}/api/tournaments/${id}`);
  if (!res.ok) throw new Error('Tournament not found');
  const data = await res.json();
  return data.data || data;
}

async function getMyTournamentParticipations() {
  const res = await fetch(`${API_URL}/api/players/me/participations`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load tournament participations');
  return Array.isArray(data.data) ? data.data : [];
}

async function getTournamentApprovedTeams(tournamentId) {
  const res = await fetch(`${API_URL}/api/tournaments/${tournamentId}/approved-teams`);
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load teams');
  return Array.isArray(data.data) ? data.data : [];
}

async function createTournament(payload) {
  const res = await fetch(`${API_URL}/api/tournaments`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to create tournament');
  return data.data || data;
}

async function updateTournament(id, payload) {
  const res = await fetch(`${API_URL}/api/tournaments/${id}`, {
    method: 'PATCH',
    headers: _authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to update tournament');
  return data.data || data;
}

// ── Teams & registrations ─────────────────────────────────────────────────────

async function registerTeam(payload) {
  const res = await fetch(`${API_URL}/api/registrations`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Registration failed');
  return data.data || data;
}

/** Captain: register your existing team for an open tournament (from Tournaments page). */
async function registerExistingTeamForTournament({ tournament_id, game_mode, device_type, saved_roster_id }) {
  const res = await fetch(`${API_URL}/api/registrations`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({
      register_existing_team: true,
      tournament_id,
      ...(game_mode ? { game_mode } : {}),
      ...(device_type ? { device_type } : {}),
      ...(saved_roster_id ? { saved_roster_id } : {}),
    }),
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Registration failed');
  return data;
}

async function getTeam(id) {
  const res = await fetch(`${API_URL}/api/teams/${id}`);
  if (!res.ok) throw new Error('Team not found');
  const data = await res.json();
  return data.data || data;
}

async function getMyTeam() {
  const res = await fetch(`${API_URL}/api/teams/mine`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load your team');
  return data.data;
}

/** Captain: saved tournament lineups (ordered player ids). */
async function getTeamSavedRosters() {
  const res = await fetch(`${API_URL}/api/teams/mine/saved-rosters`, { headers: _authHeaders() });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load saved lineups');
  return data.data || [];
}

async function createTeamSavedRoster({ name, lineup }) {
  const res = await fetch(`${API_URL}/api/teams/mine/saved-rosters`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ name, lineup })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to save lineup');
  return data.data;
}

async function updateTeamSavedRoster(rosterId, { name, lineup }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (lineup !== undefined) body.lineup = lineup;
  const res = await fetch(`${API_URL}/api/teams/mine/saved-rosters/${encodeURIComponent(rosterId)}`, {
    method: 'PATCH',
    headers: _authHeaders(),
    body: JSON.stringify(body)
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to update lineup');
  return data.data;
}

async function deleteTeamSavedRoster(rosterId) {
  const res = await fetch(`${API_URL}/api/teams/mine/saved-rosters/${encodeURIComponent(rosterId)}`, {
    method: 'DELETE',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to delete lineup');
  return data;
}

async function getMyPlayerProfile() {
  const res = await fetch(`${API_URL}/api/players/me`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load your player profile');
  return data.data;
}

async function leaveMyTeam() {
  const res = await fetch(`${API_URL}/api/players/me/leave-team`, {
    method: 'POST',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to leave team');
  return data;
}

async function getLeaveEligibility() {
  const res = await fetch(`${API_URL}/api/players/me/leave-eligibility`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load leave eligibility');
  return data.data;
}

async function transferCaptainMine(newCaptainPlayerId) {
  const res = await fetch(`${API_URL}/api/teams/mine/transfer-captain`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ new_captain_player_id: newCaptainPlayerId })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Transfer failed');
  return data;
}

async function sendTeamInvite(inviteeEmail) {
  const res = await fetch(`${API_URL}/api/teams/mine/invites`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ invitee_email: inviteeEmail })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Could not send invite');
  return data.data;
}

async function getOutgoingTeamInvites() {
  const res = await fetch(`${API_URL}/api/teams/mine/invites/outgoing`, {
    headers: _authHeaders()
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok) return [];
  return data.data || [];
}

async function cancelTeamInvite(inviteId) {
  const res = await fetch(`${API_URL}/api/teams/mine/invites/${encodeURIComponent(inviteId)}`, {
    method: 'DELETE',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Could not cancel invite');
  return data;
}

async function getIncomingTeamInvites() {
  const res = await fetch(`${API_URL}/api/players/me/team-invites`, {
    headers: _authHeaders()
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  // Avoid breaking Player profile if invites API or DB migration is unavailable.
  if (!res.ok) return [];
  return data.data || [];
}

async function acceptTeamInvite(inviteId) {
  const res = await fetch(`${API_URL}/api/players/me/team-invites/${encodeURIComponent(inviteId)}/accept`, {
    method: 'POST',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Could not accept invite');
  return data;
}

async function declineTeamInvite(inviteId) {
  const res = await fetch(`${API_URL}/api/players/me/team-invites/${encodeURIComponent(inviteId)}/decline`, {
    method: 'POST',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Could not decline invite');
  return data;
}

async function getTeamsRecruiting(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/discovery/teams-recruiting${q ? '?' + q : ''}`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load teams');
  return data.data || [];
}

async function getFreeAgentsForCaptain(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/discovery/free-agents${q ? '?' + q : ''}`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load players');
  return data.data || [];
}

async function createTeamJoinRequest(teamId) {
  const res = await fetch(`${API_URL}/api/players/me/team-join-requests`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ team_id: teamId })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Could not send join request');
  return data.data;
}

async function getMyTeamJoinRequests() {
  const res = await fetch(`${API_URL}/api/players/me/team-join-requests`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load requests');
  return data.data || [];
}

async function cancelTeamJoinRequest(joinRequestId) {
  const res = await fetch(`${API_URL}/api/players/me/team-join-requests/${encodeURIComponent(joinRequestId)}`, {
    method: 'DELETE',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Could not cancel request');
  return data;
}

async function getCaptainIncomingJoinRequests() {
  const res = await fetch(`${API_URL}/api/teams/mine/join-requests/incoming`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load join requests');
  return data.data || [];
}

async function acceptTeamJoinRequest(joinRequestId) {
  const res = await fetch(`${API_URL}/api/teams/mine/join-requests/${encodeURIComponent(joinRequestId)}/accept`, {
    method: 'POST',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Could not accept');
  return data;
}

async function declineTeamJoinRequest(joinRequestId) {
  const res = await fetch(`${API_URL}/api/teams/mine/join-requests/${encodeURIComponent(joinRequestId)}/decline`, {
    method: 'POST',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Could not decline');
  return data;
}

async function getMyTeamNotifications() {
  const res = await fetch(`${API_URL}/api/teams/mine/notifications`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load notifications');
  return data.data || [];
}

async function markMyTeamNotificationsRead(ids = []) {
  const res = await fetch(`${API_URL}/api/teams/mine/notifications/read`, {
    method: 'PATCH',
    headers: _authHeaders(),
    body: JSON.stringify({ ids })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to update notifications');
  return data;
}

async function getRegistrationAccessState() {
  const user = getCurrentUser();
  if (!user) return { allowed: true };

  if (user.role === 'admin') {
    return {
      allowed: false,
      reason: 'Admins cannot register teams because admin accounts are non-participating.'
    };
  }

  // Team check: users can belong to only one team at a time.
  try {
    const teamRes = await fetch(`${API_URL}/api/teams/mine`, { headers: _authHeaders() });
    if (teamRes.ok) {
      const payload = await teamRes.json();
      const d = payload?.data;
      if (d?.team?.id) {
        return {
          allowed: false,
          variant: 'has_team',
          shortReason: 'You are already in a team. Browse tournaments to enter events.',
          reason: 'You already belong to a team. Team creation is limited to one team per user account.',
          redirectTo: 'tournaments_open',
        };
      }
      if (d?.registration_pending || d?.registration?.status === 'pending') {
        return {
          allowed: false,
          shortReason: 'You already have a pending registration. Browse tournaments while you wait.',
          reason: 'You already have a registration awaiting admin approval.',
          redirectTo: 'tournaments_open',
        };
      }
    }
  } catch (_) {}

  // Linked player / roster: block new team registration if already attached to a team.
  // If activated but not attached, allow with an explicit UX hint to choose path.
  try {
    const profileRes = await fetch(`${API_URL}/api/players/me`, { headers: _authHeaders() });
    if (profileRes.ok) {
      const payload = await profileRes.json();
      const d = payload?.data;
      if (d?.awaiting_registration_approval) {
        return {
          allowed: false,
          reason:
            'You already belong to a squad whose tournament signup is awaiting admin approval. You cannot register a new team until that is resolved.'
        };
      }
      const captainId = d?.team?.captain_id;
      const isSquadMember =
        d?.player &&
        d?.team?.id &&
        captainId != null &&
        String(captainId) !== String(user.id);
      if (isSquadMember) {
        return {
          allowed: false,
          variant: 'team_member',
          shortReason:
            'You are already in a team. Ask your captain to enter tournaments for your squad.',
          reason:
            'Tournament entries are submitted by your team captain, not individual players. This registration page is for creating brand-new teams only.',
          redirectTo: 'tournaments_open',
        };
      }
      if (d?.player && d?.team?.id) {
        return {
          allowed: false,
          variant: 'has_team',
          shortReason: 'You are already in a team. Browse tournaments to enter events.',
          reason: 'You cannot register a new team while you are already part of a team.',
          redirectTo: 'tournaments_open',
        };
      }
      if (d?.team) {
        return {
          allowed: false,
          variant: 'has_team',
          shortReason: 'You are already in a team. Browse tournaments to enter events.',
          reason: 'You cannot register a new team while you are already part of a team.',
          redirectTo: 'tournaments_open',
        };
      }
      if (d?.player && !d?.team?.id) {
        return {
          allowed: true,
          registerMode: 'new_team',
          profileType: 'activated_player_no_team',
        };
      }
    }
  } catch (_) {}

  return { allowed: true, registerMode: 'new_team' };
}

async function getRegistrations(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/registrations${query ? '?' + query : ''}`, {
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load registrations');
  return data.data || data;
}

async function updateRegistrationStatus(id, status, notes = '') {
  const res = await fetch(`${API_URL}/api/registrations/${id}/status`, {
    method: 'PATCH',
    headers: _authHeaders(),
    body: JSON.stringify({ status, notes })
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to update registration');
  return data.data || data;
}
// ── Matches ───────────────────────────────────────────────────────────────────

async function getMatches(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/matches${query ? '?' + query : ''}`);
  if (!res.ok) throw new Error('Failed to load matches');
  const data = await res.json();
  return data.data || data;
}

async function getMatchUpdates(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/matches/updates${query ? '?' + query : ''}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to load match updates');
  return data;
}

async function submitMatch(payload) {
  const res = await fetch(`${API_URL}/api/matches`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await _jsonSafe(res);
  if (!res.ok) {
    const hint = data.field ? ` (${data.field})` : '';
    throw new Error((data.error || 'Failed to submit match') + hint);
  }
  return data.data || data;
}

async function updateMatch(id, payload) {
  const res = await fetch(`${API_URL}/api/matches/${id}`, {
    method: 'PATCH',
    headers: _authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await _jsonSafe(res);
  if (!res.ok) {
    const hint = data.field ? ` (${data.field})` : '';
    throw new Error((data.error || 'Failed to update match') + hint);
  }
  return data.data || data;
}

// ── Leaderboard & schedule ────────────────────────────────────────────────────

async function getLeaderboard(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/leaderboard${query ? '?' + query : ''}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Failed to load leaderboard');
  return data.data || data;
}

async function getSchedule() {
  const res = await fetch(`${API_URL}/api/schedule`);
  if (!res.ok) throw new Error('Failed to load schedule');
  const data = await res.json();
  return data.data || data;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

async function getAdminDashboard() {
  const res = await fetch(`${API_URL}/api/admin/dashboard`, { headers: _authHeaders() });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load dashboard');
  return data.data || data;
}

async function publishAnnouncement(payload) {
  const res = await fetch(`${API_URL}/api/admin/announcements`, {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to publish');
  return data.data || data;
}

async function getAnnouncements() {
  const res = await fetch(`${API_URL}/api/admin/announcements`, { headers: _authHeaders() });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to load announcements');
  return data.data || data;
}

async function deleteAnnouncementById(id) {
  const res = await fetch(`${API_URL}/api/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: _authHeaders()
  });
  const data = await _jsonSafe(res);
  if (!res.ok) throw _apiError(data, 'Failed to delete announcement');
  return data.data || data;
}

async function getPublicAnnouncements() {
  // Public endpoint — no auth required
  const res = await fetch(`${API_URL}/api/announcements`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || data;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function centsToRand(value) {
  if (value === null || value === undefined || value === '') return 'R —';
  const amount = Number(value);
  if (Number.isNaN(amount)) return 'R —';
  return 'R ' + amount.toLocaleString('en-ZA', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  });
}