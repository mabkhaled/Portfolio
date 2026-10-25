// shortcut: per-instance memory, so limits reset when Vercel starts a new instance; move to a KV store if abused.
/** Sliding-window limiter: returns true once an IP exceeds `max` calls within `windowMs`. */
export function createLimiter({ max, windowMs }) {
  const hits = new Map();
  return (ip, now = Date.now()) => {
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear(); // keep memory bounded
    return recent.length > max;
  };
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}
