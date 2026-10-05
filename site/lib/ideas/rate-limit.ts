// Fixed-window, in-memory rate limits for the /api/ideas routes, the same
// approach as /api/projects. Each serverless instance keeps its own counts,
// so these are a speed bump; the database enforces the hard rules (5 ideas
// per user per 24 h, one vote and one report per user per idea).

export const HOUR_MS = 60 * 60 * 1000;

export interface RateLimiter {
  take(key: string, now?: number): boolean;
  remaining(key: string, now?: number): number;
}

const MAX_KEYS = 10_000;

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const prune = (now: number) => {
    if (buckets.size < MAX_KEYS) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  return {
    take(key, now = Date.now()) {
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        prune(now);
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
    remaining(key, now = Date.now()) {
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) return limit;
      return Math.max(0, limit - current.count);
    },
  };
}

/** Limits per the spec: 200 votes per hour per user. */
export const VOTES_PER_HOUR = 200;
export const SUBMITS_PER_HOUR = 10;
export const REPORTS_PER_HOUR = 30;
export const HIDES_PER_HOUR = 30;
export const LIST_PER_10_MIN = 300;

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
}
