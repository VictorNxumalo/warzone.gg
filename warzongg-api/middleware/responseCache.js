function withResponseCache({ ttlSeconds = 30, maxEntries = 500 } = {}) {
  const store = new Map();
  const ttlMs = Math.max(1, Number(ttlSeconds) || 30) * 1000;
  const cap = Math.max(1, Number(maxEntries) || 500);

  return function responseCache(req, res, next) {
    if (req.method !== 'GET') return next();
    if (req.headers.authorization) return next();

    const key = req.originalUrl || req.url;
    const now = Date.now();
    const existing = store.get(key);
    if (existing && existing.expiresAt > now) {
      res.set('X-Cache', 'HIT');
      return res.status(existing.status).json(existing.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (store.size >= cap) {
          const firstKey = store.keys().next().value;
          if (firstKey) store.delete(firstKey);
        }
        store.set(key, {
          status: res.statusCode,
          body,
          expiresAt: now + ttlMs,
        });
        res.set('X-Cache', 'MISS');
      }
      return originalJson(body);
    };

    return next();
  };
}

module.exports = { withResponseCache };
