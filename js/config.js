// EVOLVE — frontend configuration (loaded before js/api.js)
// ─────────────────────────────────────────────────────────────────
// REST API: The static site calls your Express server (JWT + routes under /api/*).
// Set the production API host once: either replace WZ_DEFAULT_PROD_API below, or inject
//   <script>window.WZ_API_URL = 'https://your-api.onrender.com';</script>
// before this file in index.html (Netlify/Vercel env → build inject).
// CORS on the API must allow your Netlify/Vercel origin (FRONTEND_URL / FRONTEND_URL_PROD / CORS_ORIGINS).
// ─────────────────────────────────────────────────────────────────
// Supabase (optional): used only for Realtime on pages/bracket.html, not for REST.
// The anon key is designed for browser use with RLS; never add a service_role key here.
// You may override via inline script: window.WZ_SUPABASE_URL / window.WZ_SUPABASE_ANON_KEY
// ─────────────────────────────────────────────────────────────────

(function (global) {
  var WZ_DEFAULT_PROD_API = '';

  /** True when opened via RFC1918 LAN IP (phone on Wi‑Fi hitting http://192.168.x.x:3333/). */
  function isPrivateLanHost(hostname) {
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return false;
    return (
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  }

  var h = global.location && global.location.hostname;
  var local = h === 'localhost' || h === '127.0.0.1';
  if (!global.WZ_API_URL) {
    if (local) {
      global.WZ_API_URL = 'http://localhost:3000';
    } else if (isPrivateLanHost(h)) {
      var apiPort = global.WZ_API_PORT != null ? String(global.WZ_API_PORT) : '3000';
      global.WZ_API_URL = 'http://' + h + ':' + apiPort;
    } else {
      global.WZ_API_URL = WZ_DEFAULT_PROD_API;
    }
  }
  global.WZ_API_URL = String(global.WZ_API_URL || '').replace(/\/$/, '');
  if (!local && !isPrivateLanHost(h) && !global.WZ_API_URL) {
    throw new Error(
      'Missing production API URL. Set window.WZ_API_URL before loading js/config.js.'
    );
  }

  // Keep frontend free of hardcoded API keys. Inject these via deployment config
  // only when browser-side Supabase features are intentionally enabled.
  if (!global.WZ_SUPABASE_URL) global.WZ_SUPABASE_URL = '';
  if (!global.WZ_SUPABASE_ANON_KEY) global.WZ_SUPABASE_ANON_KEY = '';

  // Legacy names used by pages/bracket.html
  var SUPABASE_URL = global.WZ_SUPABASE_URL;
  var SUPABASE_ANON = global.WZ_SUPABASE_ANON_KEY;
  global.SUPABASE_URL = SUPABASE_URL;
  global.SUPABASE_ANON = SUPABASE_ANON;
})(typeof window !== 'undefined' ? window : this);
