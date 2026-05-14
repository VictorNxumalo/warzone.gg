const { supabase } = require('../config/supabase');

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

// Verifies the JWT token sent in the Authorization header.
// Attaches the user object to req.user if valid.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split('Bearer ')[1];

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

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }

  req.user = user;
  next();
}

// Runs requireAuth first, then checks the user's role in the database.
// Only allows through users with role = 'admin'.
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || data?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    next();
  });
}

module.exports = { requireAuth, requireAdmin };
