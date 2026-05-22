// ─────────────────────────────────────────────────────────────────────────────
// js/nav.js  —  EVOLVE shared navigation
// Handles: nav injection, auth-state display, session persistence
// ─────────────────────────────────────────────────────────────────────────────

// ── Session storage helpers ───────────────────────────────────────────────────
const SESSION_KEY = 'wz_session';

function saveSession(token, user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getToken() {
  return loadSession()?.token || null;
}

function getCurrentUser() {
  return loadSession()?.user || null;
}

function setCurrentUser(user, token) {
  const existing = loadSession();
  const tok = token || existing?.token || '';
  saveSession(tok, user);
  applyNavAuthState();
}

function clearCurrentUser() {
  clearSession();
  applyNavAuthState();
}

// ── Path helper ───────────────────────────────────────────────────────────────
function _pathPrefix() {
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path === '/' || !path.includes('/pages/')) {
    return '';
  }
  return '../';
}

function _ensureSiteFavicon() {
  const p = _pathPrefix();
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;

  function upsertLink(selector, relValue, href, typeValue, sizesValue) {
    let link = head.querySelector(selector);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', relValue);
      head.appendChild(link);
    }
    link.setAttribute('href', href);
    if (typeValue) link.setAttribute('type', typeValue);
    if (sizesValue) link.setAttribute('sizes', sizesValue);
    return link;
  }

  upsertLink('link[rel="icon"][sizes="32x32"]', 'icon', `${p}assets/favicon-32x32.png`, 'image/png', '32x32');
  upsertLink('link[rel="icon"][sizes="16x16"]', 'icon', `${p}assets/favicon-16x16.png`, 'image/png', '16x16');
  upsertLink('link[rel="shortcut icon"]', 'shortcut icon', `${p}assets/favicon.ico`, 'image/x-icon');
  upsertLink('link[rel="apple-touch-icon"]', 'apple-touch-icon', `${p}assets/favicon-180x180.png`, 'image/png', '180x180');
}

_ensureSiteFavicon();

// ── Nav injection ─────────────────────────────────────────────────────────────
function injectNav(activePageFile) {
  const p   = _pathPrefix();
  const nav = document.createElement('nav');
  nav.className = 'wz-nav-shell sticky top-0 z-40';
  nav.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 lg:px-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 min-h-14 py-2 lg:py-2">
      <a href="${p}index.html" class="font-head text-lg sm:text-xl font-black tracking-widest text-[#e8c14a] uppercase flex items-center gap-2 shrink-0">
        <img
          src="${p}assets/Evolve WebApp Logo.png"
          data-wz-logo-default="${p}assets/Evolve WebApp Logo.png"
          data-wz-logo-light="${p}assets/Evolve WebApp Logo.png"
          alt="Evolve logo"
          class="wz-brand-logo-nav"
        />
        <span class="inline">EVOLVE</span>
        <span class="font-head font-black wz-nav-tagline tracking-widest uppercase hidden sm:inline">ESPORTS</span>
      </a>

      <!-- Desktop: clustered pill rail (readable, grouped, wraps gracefully) -->
      <nav id="nav-links" class="wz-nav-desktop hidden lg:flex flex-1 min-w-0 order-3 lg:order-none basis-full lg:basis-auto justify-center" aria-label="Primary navigation">
        <div class="wz-nav-rail">
          <div class="wz-nav-cluster">
            ${_navPill('index.html', `${p}index.html`, 'Home', activePageFile)}
          </div>
          <div class="wz-nav-cluster">
            ${_navPill('register.html', `${p}pages/register.html`, 'Register', activePageFile)}
            ${_navPill('platform-guide.html', `${p}pages/platform-guide.html`, 'Guide', activePageFile)}
            ${_navPill('rules.html', `${p}pages/rules.html`, 'Rules', activePageFile)}
          </div>
          <div class="wz-nav-cluster">
            <details class="wz-nav-group">
              <summary class="wz-nav-group-trigger ${_isCompetitionActive(activePageFile) ? 'wz-nav-group-trigger--active' : ''}" aria-label="Open competition pages">
                Compete
                <span class="wz-nav-group-caret" aria-hidden="true">▾</span>
              </summary>
              <div class="wz-nav-group-menu">
                ${_navPill('tournaments.html', `${p}pages/tournaments.html`, 'Tournaments', activePageFile)}
                ${_navPill('bracket.html', `${p}pages/bracket.html`, 'Bracket', activePageFile)}
                ${_navPill('leaderboard.html', `${p}pages/leaderboard.html`, 'Leaderboard', activePageFile)}
                ${_navPill('schedule.html', `${p}pages/schedule.html`, 'Schedule', activePageFile)}
              </div>
            </details>
          </div>
          <div id="nav-myteam-item" class="wz-nav-cluster hidden">
            ${_navPill('team-profile.html', `${p}pages/team-profile.html?mine=1`, 'Team', activePageFile, undefined, 'wz-nav-team-link')}
          </div>
          <div id="nav-player-item" class="wz-nav-cluster hidden">
            ${_navPill('player-profile.html', `${p}pages/player-profile.html`, 'Player', activePageFile)}
          </div>
          <div id="nav-find-squad-item" class="wz-nav-cluster hidden">
            ${_navPill('find-squad.html', `${p}pages/find-squad.html`, 'Find squad', activePageFile)}
          </div>
          <div id="nav-admin-item" class="wz-nav-cluster hidden">
            ${_navPill('admin.html', `${p}pages/admin.html`, 'Admin', activePageFile, 'danger')}
          </div>
        </div>
      </nav>

      <!-- Right side: utilities panel (keeps noisy controls out of primary nav) -->
      <div class="flex items-center gap-1.5 lg:gap-2 shrink-0 ml-auto lg:ml-0">
        <details id="nav-utility-panel" class="wz-utility">
          <summary class="wz-utility-trigger" aria-label="Open quick controls">
            Quick
            <span class="wz-utility-caret" aria-hidden="true">▾</span>
          </summary>
          <div class="wz-utility-menu">
            <div id="nav-admin-indicator" class="hidden wz-utility-admin">Admin session active</div>
            <div class="font-mono text-[10px] text-[var(--wz-muted)] tracking-wide px-1">
              Contact: <a href="mailto:evolveesports666@gmail.com" class="wz-link-accent normal-case tracking-normal">evolveesports666@gmail.com</a>
            </div>
            <a href="https://www.facebook.com/share/18moeVqQgW/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" class="wz-utility-link">Facebook · Evolve Esports</a>
            <a href="https://www.instagram.com/evolveesports_?igsh=bGh2azFscmI2dm15&utm_source=qr" target="_blank" rel="noopener noreferrer" class="wz-utility-link">Instagram · @evolveesports_</a>
            <a href="${p}pages/activate.html" id="nav-activate-link" class="wz-utility-link">Are you a player? Activate your account</a>
            <button type="button" onclick="openModal('login-modal')" id="nav-login-btn" class="wz-utility-link wz-utility-link--button">Login</button>
            <a href="${p}pages/register.html" id="nav-signup-btn" class="wz-utility-link">Sign Up</a>
            <div id="nav-user-block" class="hidden flex-col gap-2">
              <span id="nav-username" class="font-mono text-[11px] text-[var(--accent)] tracking-wider"></span>
              <button type="button" onclick="_handleNavLogout()" class="wz-utility-link wz-utility-link--button">Logout</button>
            </div>
            <button type="button" data-wz-theme-toggle onclick="wzToggleTheme()" class="wz-utility-theme-btn" title="Toggle theme" aria-label="Toggle light or dark theme">
              <svg class="wz-theme-icon-sun w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
              <svg class="wz-theme-icon-moon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
              <span>Theme</span>
            </button>
          </div>
        </details>
        <button onclick="toggleMobileMenu()" type="button" class="lg:hidden text-[var(--wz-text-secondary)] p-2 rounded-md hover:bg-[var(--wz-surface2)]" aria-expanded="false" aria-controls="mobile-menu" id="nav-menu-toggle">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile / tablet: drawer-style menu with grouped sections -->
    <div id="mobile-menu" class="wz-mobile-menu hidden lg:hidden border-t border-[var(--wz-border)] px-4 sm:px-5 pb-5 max-h-[min(72vh,560px)] overflow-y-auto overscroll-contain">
      <div class="wz-mobile-nav-inner pt-4 pb-1" id="mobile-nav-links">
        <div class="wz-mobile-section">
          <div class="wz-mobile-section-title">Start</div>
          <a href="${p}index.html" class="wz-mobile-link">Home</a>
        </div>
        <div class="wz-mobile-section">
          <div class="wz-mobile-section-title">Compete</div>
          <div class="wz-mobile-link-grid">
            <a href="${p}pages/tournaments.html" class="wz-mobile-link wz-mobile-link--tile">Tournaments</a>
            <a href="${p}pages/bracket.html" class="wz-mobile-link wz-mobile-link--tile">Bracket</a>
            <a href="${p}pages/leaderboard.html" class="wz-mobile-link wz-mobile-link--tile">Leaderboard</a>
            <a href="${p}pages/schedule.html" class="wz-mobile-link wz-mobile-link--tile">Schedule</a>
          </div>
        </div>
        <div class="wz-mobile-section">
          <div class="wz-mobile-section-title">Join</div>
          <div class="wz-mobile-link-grid">
            <a href="${p}pages/register.html" class="wz-mobile-link wz-mobile-link--tile">Register</a>
            <a href="${p}pages/platform-guide.html" class="wz-mobile-link wz-mobile-link--tile">Guide</a>
            <a href="${p}pages/rules.html" class="wz-mobile-link wz-mobile-link--tile">Rules</a>
          </div>
        </div>
        <div class="wz-mobile-section hidden" id="mobile-signedin-section">
          <div class="wz-mobile-section-title">Your squad</div>
          <div class="wz-mobile-link-grid">
            <a href="${p}pages/team-profile.html?mine=1" id="mobile-myteam-link" class="hidden wz-mobile-link wz-mobile-link--tile">Team</a>
            <a href="${p}pages/player-profile.html" id="mobile-player-link" class="hidden wz-mobile-link wz-mobile-link--tile">Player</a>
            <a href="${p}pages/find-squad.html" id="mobile-find-squad-link" class="hidden wz-mobile-link wz-mobile-link--tile">Find squad</a>
            <a href="${p}pages/admin.html" id="mobile-admin-link" class="hidden wz-mobile-link wz-mobile-link--tile wz-mobile-link--danger">Admin</a>
          </div>
        </div>
        <div id="mobile-auth-guest" class="wz-mobile-section wz-mobile-section--footer border-t border-[var(--wz-border)] pt-4 mt-2">
          <a href="mailto:evolveesports666@gmail.com" class="wz-mobile-link">Email: evolveesports666@gmail.com</a>
          <a href="https://www.facebook.com/share/18moeVqQgW/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" class="wz-mobile-link">Facebook: Evolve Esports</a>
          <a href="https://www.instagram.com/evolveesports_?igsh=bGh2azFscmI2dm15&utm_source=qr" target="_blank" rel="noopener noreferrer" class="wz-mobile-link">Instagram: @evolveesports_</a>
          <a href="${p}pages/activate.html" class="wz-mobile-link">Activate player account</a>
          <button type="button" onclick="openModal('login-modal')" class="wz-mobile-link wz-mobile-link--button">Login</button>
        </div>
        <div id="mobile-auth-user" class="hidden wz-mobile-section wz-mobile-section--footer border-t border-[var(--wz-border)] pt-4 mt-2">
          <a href="mailto:evolveesports666@gmail.com" class="wz-mobile-link">Email: evolveesports666@gmail.com</a>
          <a href="https://www.facebook.com/share/18moeVqQgW/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" class="wz-mobile-link">Facebook: Evolve Esports</a>
          <a href="https://www.instagram.com/evolveesports_?igsh=bGh2azFscmI2dm15&utm_source=qr" target="_blank" rel="noopener noreferrer" class="wz-mobile-link">Instagram: @evolveesports_</a>
          <div id="mobile-username" class="font-mono text-xs text-[var(--accent)] py-2 tracking-wider"></div>
          <button type="button" onclick="_handleNavLogout()" class="wz-mobile-link wz-mobile-link--button">Logout</button>
        </div>
      </div>
    </div>`;

  document.body.insertBefore(nav, document.body.firstChild);

  // Inject login modal for pages that don't have it in their HTML
  if (!document.getElementById('login-modal')) {
    const prefix  = _pathPrefix();
    const modalEl = document.createElement('div');
    modalEl.id        = 'login-modal';
    modalEl.className = 'modal-overlay hidden fixed inset-0 z-50 items-center justify-center';
    modalEl.innerHTML = `
      <div class="bg-[var(--wz-surface)] border border-[var(--wz-border-input)] border-t-2 border-t-[#e8c14a] rounded p-7 w-[400px] max-w-[95vw]">
        <h3 class="font-head text-xl font-black tracking-widest uppercase text-[#e8c14a] mb-5">Login to EVOLVE</h3>
        <div class="flex flex-col gap-4 mb-5">
          <div><label class="wz-label">Email</label><input type="email" id="modal-email" class="wz-input" placeholder="your@email.com"/></div>
          <div><label class="wz-label">Password</label><input type="password" id="modal-password" class="wz-input" placeholder="••••••••" onkeydown="if(event.key==='Enter')handleModalLogin()"/></div>
        </div>
        <div id="modal-login-error" class="hidden mb-3 font-mono text-[11px] text-red-400 text-center"></div>
        <div class="flex gap-3">
          <button onclick="handleModalLogin()" class="btn-primary flex-1">Login</button>
          <button onclick="closeModal('login-modal')" class="btn-ghost">Cancel</button>
        </div>
        <p class="font-mono text-[10px] text-[var(--wz-muted)] text-center mt-4 tracking-wider">
          New here? <a href="${prefix}pages/register.html" class="wz-link-accent">Register your team</a>
        </p>
      </div>`;
    document.body.appendChild(modalEl);
  }

  injectGlobalRouteLoader();

  applyNavAuthState();
  _bindRegisterAccessGuard();
  if (typeof wzSyncThemeUI === 'function') wzSyncThemeUI();
  if (typeof wzSyncThemeLogos === 'function') wzSyncThemeLogos();
}

/** Full-screen logo transition — shared with js/main.js (`wzShowRouteLoader` / click delegation). */
function injectGlobalRouteLoader() {
  if (document.getElementById('wz-route-loader')) return;
  const p = _pathPrefix();
  const el = document.createElement('div');
  el.id = 'wz-route-loader';
  el.className = 'wz-route-loader';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="wz-route-loader-inner">' +
    '<div class="wz-route-loader-ring" aria-hidden="true"></div>' +
    '<img src="' +
    p +
    'assets/Evolve WebApp Logo.png" alt="" class="wz-route-loader-logo"/>' +
    '</div>';
  document.body.appendChild(el);
}

// ── Desktop nav pill ───────────────────────────────────────────────────────────
function _navPill(pageFile, href, label, activeFile, variant, linkId) {
  const active =
    activeFile === pageFile ||
    (pageFile === 'rules.html' &&
      activeFile &&
      (activeFile === 'rules.html' || String(activeFile).startsWith('rules-')));
  const danger = variant === 'danger';
  let cls = 'wz-nav-pill';
  if (danger) cls += ' wz-nav-pill--danger';
  if (active) cls += ' wz-nav-pill--active';
  const aria = active ? ' aria-current="page"' : '';
  const idAttr = linkId ? ` id="${linkId}"` : '';
  return `<a href="${href}"${idAttr} class="${cls}"${aria}>${label}</a>`;
}

function _isCompetitionActive(activeFile) {
  return ['tournaments.html', 'bracket.html', 'leaderboard.html', 'schedule.html'].includes(activeFile);
}

function _wzNavApiBase() {
  if (typeof window === 'undefined') return '';
  var u = window.WZ_API_URL;
  if (u && String(u).trim()) return String(u).replace(/\/$/, '');
  var h = window.location && window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
  return '';
}

function _setTeamNavLabels(label) {
  var desktop = document.getElementById('wz-nav-team-link');
  var mobile = document.getElementById('mobile-myteam-link');
  if (desktop) desktop.textContent = label;
  if (mobile) mobile.textContent = label;
}

let _navAuthStateVersion = 0;

async function _refreshTeamNavLabel(versionToken) {
  if (versionToken !== _navAuthStateVersion) return;
  var user = getCurrentUser();
  if (!user || user.role === 'admin') {
    if (versionToken !== _navAuthStateVersion) return;
    _setTeamNavLabels('Team');
    return;
  }
  var base = _wzNavApiBase();
  if (!base) return;
  var token = getToken();
  if (!token) return;
  try {
    var res = await fetch(base + '/api/teams/mine', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (versionToken !== _navAuthStateVersion) return;
    if (!res.ok) return;
    var payload = await res.json();
    if (versionToken !== _navAuthStateVersion) return;
    var d = payload && payload.data;
    var isCaptain = !!(d && (d.team || d.captain_team_id));
    _setTeamNavLabels(isCaptain ? 'My Team' : 'Team');
  } catch (_) {}
}

/** Hide “Find squad” while user is tied to a squad (including pending registration). */
async function _refreshFindSquadNavVisibility(versionToken) {
  if (versionToken !== _navAuthStateVersion) return;
  var user = getCurrentUser();
  var findSquadItem = document.getElementById('nav-find-squad-item');
  var mobileFindSquad = document.getElementById('mobile-find-squad-link');
  if (!findSquadItem && !mobileFindSquad) return;

  if (!user || user.role === 'admin') {
    findSquadItem?.classList.add('hidden');
    mobileFindSquad?.classList.add('hidden');
    return;
  }

  var base = _wzNavApiBase();
  if (!base) return;
  var token = getToken();
  if (!token) return;

  try {
    var res = await fetch(base + '/api/teams/mine', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (versionToken !== _navAuthStateVersion) return;
    if (!res.ok) return;
    var payload = await res.json();
    if (versionToken !== _navAuthStateVersion) return;
    var d = payload && payload.data;
    var onSquad = !!(
      d &&
      ((d.team && d.team.id) ||
        d.captain_team_id ||
        d.registration_pending ||
        d.registration_rejected)
    );
    findSquadItem?.classList.toggle('hidden', onSquad);
    mobileFindSquad?.classList.toggle('hidden', onSquad);
  } catch (_) {}
}

// ── Apply auth state to nav ───────────────────────────────────────────────────
function applyNavAuthState() {
  const versionToken = ++_navAuthStateVersion;
  const user = getCurrentUser();

  const mobileSignedSection = document.getElementById('mobile-signedin-section');

  const loginBtn     = document.getElementById('nav-login-btn');
  const signupBtn    = document.getElementById('nav-signup-btn');
  const userBlock    = document.getElementById('nav-user-block');
  const usernameEl   = document.getElementById('nav-username');
  const adminBadge   = document.getElementById('nav-admin-indicator');
  const adminItem    = document.getElementById('nav-admin-item');
  const mobileAdmin  = document.getElementById('mobile-admin-link');
  const activateLink = document.getElementById('nav-activate-link');
  const mobileGuest  = document.getElementById('mobile-auth-guest');
  const mobileUser   = document.getElementById('mobile-auth-user');
  const mobileUname  = document.getElementById('mobile-username');
  const myteamItem   = document.getElementById('nav-myteam-item');
  const mobileMyteam = document.getElementById('mobile-myteam-link');
  const playerItem   = document.getElementById('nav-player-item');
  const mobilePlayer = document.getElementById('mobile-player-link');
  const findSquadItem = document.getElementById('nav-find-squad-item');
  const mobileFindSquad = document.getElementById('mobile-find-squad-link');

  if (user) {
    mobileSignedSection?.classList.remove('hidden');
    // ── Signed in ─────────────────────────────────────────
    if (loginBtn)  loginBtn.style.display  = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (activateLink) activateLink.style.display = 'none';

    if (userBlock) {
      userBlock.classList.remove('hidden');
      userBlock.classList.add('flex');
    }
    if (usernameEl) {
      usernameEl.textContent = `● ${user.username}`;
    }
    if (adminBadge) adminBadge.classList.toggle('hidden', user.role !== 'admin');

    mobileGuest?.classList.add('hidden');
    if (mobileUser)  mobileUser.classList.remove('hidden');
    if (mobileUname) mobileUname.textContent = `● ${user.username}`;

    // My Team — all signed-in users
    myteamItem?.classList.remove('hidden');
    mobileMyteam?.classList.remove('hidden');
    playerItem?.classList.remove('hidden');
    mobilePlayer?.classList.remove('hidden');
    findSquadItem?.classList.add('hidden');
    mobileFindSquad?.classList.add('hidden');

    // Admin — admins only
    if (user.role === 'admin') {
      adminItem?.classList.remove('hidden');
      mobileAdmin?.classList.remove('hidden');
    } else {
      adminItem?.classList.add('hidden');
      mobileAdmin?.classList.add('hidden');
    }

    _refreshTeamNavLabel(versionToken);
    _refreshFindSquadNavVisibility(versionToken);

  } else {
    mobileSignedSection?.classList.add('hidden');
    // ── Signed out ────────────────────────────────────────
    if (loginBtn)  loginBtn.style.display  = '';
    if (signupBtn) signupBtn.style.display = '';
    if (activateLink) activateLink.style.display = '';

    if (userBlock) {
      userBlock.classList.add('hidden');
      userBlock.classList.remove('flex');
    }
    adminBadge?.classList.add('hidden');

    mobileGuest?.classList.remove('hidden');
    mobileUser?.classList.add('hidden');

    // Hide My Team and Admin from guests
    myteamItem?.classList.add('hidden');
    mobileMyteam?.classList.add('hidden');
    playerItem?.classList.add('hidden');
    mobilePlayer?.classList.add('hidden');
    findSquadItem?.classList.add('hidden');
    mobileFindSquad?.classList.add('hidden');
    adminItem?.classList.add('hidden');
    mobileAdmin?.classList.add('hidden');
    _setTeamNavLabels('Team');
  }
}

// ── Modal login handler ───────────────────────────────────────────────────────
async function handleModalLogin() {
  const email = document.getElementById('modal-email').value.trim();
  const pass  = document.getElementById('modal-password').value;
  const errEl = document.getElementById('modal-login-error');
  errEl.classList.add('hidden');
  if (!email || !pass) { showToast('Enter email and password', 'error'); return; }
  try {
    const user = await authLogin(email, pass);
    setCurrentUser(user);
    closeModal('login-modal');
    applyNavAuthState();
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
      overlay.remove();
      if (typeof _pendingAuthCallback === 'function') {
        _pendingAuthCallback();
        _pendingAuthCallback = null;
      }
    }
    showToast(`Welcome back, ${user.username} ✓`);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

// ── Auth guard ────────────────────────────────────────────────────────────────
let _pendingAuthCallback = null;

function requireSignIn(callback, pageLabel) {
  const user = getCurrentUser();
  if (user) { callback(); return; }

  _pendingAuthCallback = callback;

  const overlay = document.createElement('div');
  overlay.id        = 'auth-overlay';
  overlay.className = 'fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-[color-mix(in_srgb,var(--wz-page)_95%,transparent)]';
  overlay.innerHTML = `
    <div class="font-mono text-[10px] text-[#e8c14a] tracking-widest uppercase blink">● EVOLVE</div>
    <h2 class="font-head text-4xl font-black tracking-widest uppercase text-[var(--wz-text)]">Sign In Required</h2>
    <p class="font-body text-sm text-[var(--wz-text-secondary)] text-center max-w-sm">
      You need an account to access ${pageLabel}.<br/>
          New here? <a href="${_pathPrefix()}pages/register.html" class="wz-link-accent">Create an account</a>.
    </p>
    <button onclick="openModal('login-modal')" class="btn-primary px-8 py-3 text-base">Sign In to Continue &#8594;</button>`;
  document.body.appendChild(overlay);
}

// ── Logout handler ────────────────────────────────────────────────────────────
async function _handleNavLogout() {
  try {
    if (typeof authLogout === 'function') await authLogout();
  } catch (_) {}
  clearCurrentUser();
  showToast('Signed out');
  const protectedPages = ['admin.html', 'my-team.html', 'player-profile.html'];
  if (protectedPages.some(p => window.location.pathname.includes(p))) {
    window.location.href = _pathPrefix() + 'index.html';
  }
}

// ── Mobile menu toggle ────────────────────────────────────────────────────────
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const btn = document.getElementById('nav-menu-toggle');
  const utility = document.getElementById('nav-utility-panel');
  if (!menu) return;
  if (utility) utility.open = false;
  menu.classList.toggle('hidden');
  const isOpen = !menu.classList.contains('hidden');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

let _registerGuardBound = false;
function _bindRegisterAccessGuard() {
  if (_registerGuardBound) return;
  _registerGuardBound = true;

  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a[href*="register.html"]');
    if (!link) return;

    const user = getCurrentUser();
    if (!user) return;
    if (window.location.pathname.includes('/pages/register.html')) return;
    if (typeof getRegistrationAccessState !== 'function') return;

    event.preventDefault();
    const state = await getRegistrationAccessState();
    if (!state.allowed) {
      showToast(state.shortReason || state.reason, 'error');
      return;
    }
    window.location.href = link.href;
  });
}