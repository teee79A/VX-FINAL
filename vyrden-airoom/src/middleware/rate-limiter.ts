// Rate Limiter — 100 req/min per session
// vyrden.com — Session-based rate limiting

interface SessionLimit {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private limits: Map<string, SessionLimit> = new Map();
  private readonly maxRequests = 100;
  private readonly windowMs = 60 * 1000; // 1 minute

  check(sessionId: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let limit = this.limits.get(sessionId);

    // Create or reset if window expired
    if (!limit || now > limit.resetAt) {
      limit = {
        count: 0,
        resetAt: now + this.windowMs,
      };
      this.limits.set(sessionId, limit);
    }

    const allowed = limit.count < this.maxRequests;
    if (allowed) {
      limit.count++;
    }

    const remaining = Math.max(0, this.maxRequests - limit.count);
    const resetAt = limit.resetAt;

    return { allowed, remaining, resetAt };
  }

  clear(sessionId: string): void {
    this.limits.delete(sessionId);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, limit] of this.limits) {
      if (now > limit.resetAt + 60 * 1000) {
        this.limits.delete(sessionId);
      }
    }
  }

  getStats(sessionId: string): { count: number; limit: number; resetAt: number } | null {
    const limit = this.limits.get(sessionId);
    if (!limit) return null;
    return {
      count: limit.count,
      limit: this.maxRequests,
      resetAt: limit.resetAt,
    };
  }
}

export const rateLimiter = new RateLimiter();

// Periodic cleanup (every 5 minutes)
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);
