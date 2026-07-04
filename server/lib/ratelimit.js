export function createUnlockLimiter({ max = 5, windowMs = 60000, now = () => Date.now() } = {}) {
  const buckets = new Map();

  function bucket(key) {
    const current = now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= current) {
      const next = { count: 0, resetAt: current + windowMs };
      buckets.set(key, next);
      return next;
    }
    return existing;
  }

  function check(key) {
    const current = bucket(key);
    if (current.count >= max) {
      return { allowed: false, retryAfterMs: Math.max(0, current.resetAt - now()) };
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  function fail(key) {
    bucket(key).count += 1;
  }

  function reset(key) {
    buckets.delete(key);
  }

  return { check, fail, reset };
}
