require('dotenv').config();

const os = require('os');
const express = require('express');
const cors    = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const errorHandler    = require('./middleware/errorHandler');
const { withResponseCache } = require('./middleware/responseCache');

const authRoutes         = require('./routes/auth');
const tournamentRoutes   = require('./routes/tournaments');
const teamRoutes         = require('./routes/teams');
const registrationRoutes = require('./routes/registrations');
const matchRoutes        = require('./routes/matches');
const matchSeriesRoutes  = require('./routes/matchSeries');
const leaderboardRoutes  = require('./routes/leaderboard');
const scheduleRoutes     = require('./routes/schedule');
const adminRoutes             = require('./routes/admin');
const announcementRoutes      = require('./routes/announcements');
const playerRoutes            = require('./routes/players');
const discoveryRoutes         = require('./routes/discovery');

const app = express();
app.set('trust proxy', 1);
const NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase();
const IS_PROD = NODE_ENV === 'production';

const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 10);
const PUBLIC_READ_RATE_LIMIT_WINDOW_MS = Number(process.env.PUBLIC_READ_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const PUBLIC_READ_RATE_LIMIT_MAX = Number(process.env.PUBLIC_READ_RATE_LIMIT_MAX || 600);
const WRITE_RATE_LIMIT_WINDOW_MS = Number(process.env.WRITE_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const WRITE_RATE_LIMIT_MAX = Number(process.env.WRITE_RATE_LIMIT_MAX || 120);
const ADMIN_RATE_LIMIT_WINDOW_MS = Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const ADMIN_RATE_LIMIT_MAX = Number(process.env.ADMIN_RATE_LIMIT_MAX || 60);
const PUBLIC_READ_CACHE_TTL_SECONDS = Number(process.env.PUBLIC_READ_CACHE_TTL_SECONDS || 30);
const PUBLIC_READ_CACHE_MAX_ENTRIES = Number(process.env.PUBLIC_READ_CACHE_MAX_ENTRIES || 500);

function securityLog(event, details = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };
  console.warn('[security]', JSON.stringify(payload));
}

function makeRateLimiter({
  windowMs,
  max,
  name,
  message,
  skipSuccessfulRequests = false,
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: message },
    handler(req, res) {
      securityLog('rate_limit_exceeded', {
        limiter: name,
        ip: req.ip,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      res.status(429).json({ error: message });
    },
  });
}

const authRateLimiter = makeRateLimiter({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  name: 'auth',
  message: 'Too many authentication attempts. Please try again later.',
  skipSuccessfulRequests: true,
});
const publicReadRateLimiter = makeRateLimiter({
  windowMs: PUBLIC_READ_RATE_LIMIT_WINDOW_MS,
  max: PUBLIC_READ_RATE_LIMIT_MAX,
  name: 'public-read',
  message: 'Too many read requests. Please try again shortly.',
});
const writeRateLimiter = makeRateLimiter({
  windowMs: WRITE_RATE_LIMIT_WINDOW_MS,
  max: WRITE_RATE_LIMIT_MAX,
  name: 'write',
  message: 'Too many write requests. Please slow down and try again later.',
});
const adminRateLimiter = makeRateLimiter({
  windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
  max: ADMIN_RATE_LIMIT_MAX,
  name: 'admin',
  message: 'Too many admin requests. Please try again later.',
});

function methodAwareRateLimiter(readLimiter, writeLimiter) {
  return (req, res, next) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (isRead) return readLimiter(req, res, next);
    return writeLimiter(req, res, next);
  };
}

const mixedRateLimiter = methodAwareRateLimiter(publicReadRateLimiter, writeRateLimiter);
const publicReadCache = withResponseCache({
  ttlSeconds: PUBLIC_READ_CACHE_TTL_SECONDS,
  maxEntries: PUBLIC_READ_CACHE_MAX_ENTRIES,
});

// ── CORS ────────────────────────────────────────────────────
const CORS_EXTRA = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [
  ...(!IS_PROD ? [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3333',
    'http://127.0.0.1:3333',
  ] : []),
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_PROD,
  ...CORS_EXTRA,
].filter(Boolean);

function isPrivateLanHostname(hostname) {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return false;
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

function isPrivateLanOrigin(origin) {
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return isPrivateLanHostname(u.hostname);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (!IS_PROD && isPrivateLanOrigin(origin)) return true;
  return false;
}

// ── SECURITY HEADERS ────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── ORIGIN GUARD ────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) return next();
  securityLog('blocked_origin', {
    ip: req.ip,
    method: req.method,
    path: req.originalUrl || req.url,
    origin,
  });
  return res.status(403).json({ error: 'Origin not allowed.' });
});

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── BODY PARSING ────────────────────────────────────────────
app.use(express.json());

// ── HEALTH CHECK ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'WARZONE.GG API is running',
    version: '1.0.0',
    routes: [
      'POST   /api/auth/register',
      'POST   /api/auth/login',
      'GET    /api/tournaments',
      'GET    /api/matches',
      'GET    /api/leaderboard',
      'GET    /api/schedule'
    ]
  });
});



// ── ROUTES ──────────────────────────────────────────────────
// ── ROUTES ──────────────────────────────────────────────────
app.use('/api/auth',          authRateLimiter, authRoutes);
app.use('/api/tournaments',   publicReadRateLimiter, publicReadCache, tournamentRoutes);
app.use('/api/teams',         mixedRateLimiter, teamRoutes);
app.use('/api/registrations', mixedRateLimiter, registrationRoutes);
app.use('/api/matches',       mixedRateLimiter, matchRoutes);
app.use('/api/match-series',  writeRateLimiter, matchSeriesRoutes);
app.use('/api/leaderboard',   publicReadRateLimiter, publicReadCache, leaderboardRoutes);
app.use('/api/schedule',      publicReadRateLimiter, publicReadCache, scheduleRoutes);
app.use('/api/admin',         adminRateLimiter, adminRoutes);
app.use('/api/players',       mixedRateLimiter, playerRoutes);
app.use('/api/discovery',     publicReadRateLimiter, discoveryRoutes);
app.use('/api',               publicReadRateLimiter, publicReadCache, announcementRoutes);
// ── 404 HANDLER ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── GLOBAL ERROR HANDLER ────────────────────────────────────
app.use(errorHandler);

// ── START SERVER ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const LISTEN_HOST = process.env.LISTEN_HOST || '0.0.0.0';
app.listen(PORT, LISTEN_HOST, () => {
  const lines = [`✓ WARZONE.GG API  http://127.0.0.1:${PORT}/`];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      lines.push(`  LAN API        http://${net.address}:${PORT}/`);
    }
  }
  lines.push('  (Point the static site at this host:port — see npm run dev:lan in repo root.)');
  console.log(lines.join('\n'));
});
