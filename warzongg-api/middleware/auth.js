const { supabase, supabaseAdmin } = require('../config/supabase');

function isSupabaseConnectivityError(error) {
  if (!error) return false;
  const code = error.code || error.cause?.code;
  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('getaddrinfo')
  );
}

function readBearerToken(req) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

// Verifies the JWT token sent in the Authorization header.
// Attaches the user object to req.user if valid.
async function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  let user;
  let error;
  try {
    const result = await supabase.auth.getUser(token);
    user = result?.data?.user;
    error = result?.error;
  } catch (e) {
    if (isSupabaseConnectivityError(e)) {
      return res.status(503).json({
        error: 'Auth service temporarily unavailable. Please retry in a moment.'
      });
    }
    return next(e);
  }

  if (error) {
    if (isSupabaseConnectivityError(error)) {
      return res.status(503).json({
        error: 'Auth service temporarily unavailable. Please retry in a moment.'
      });
    }
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }

  req.user = user;
  next();
}

// Runs requireAuth first, then checks the user's role in the database.
// Only allows through users with role = 'admin'.
async function requireAdmin(req, res, next) {
  return requireAuth(req, res, async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', req.user.id)
        .single();

      if (error) {
        if (isSupabaseConnectivityError(error)) {
          return res.status(503).json({
            error: 'Authorization service temporarily unavailable. Please retry in a moment.'
          });
        }
        return res.status(403).json({ error: 'Access denied. Admin only.' });
      }
      if (data?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
      }

      return next();
    } catch (e) {
      if (isSupabaseConnectivityError(e)) {
        return res.status(503).json({
          error: 'Authorization service temporarily unavailable. Please retry in a moment.'
        });
      }
      return next(e);
    }
  });
}

module.exports = { requireAuth, requireAdmin };
