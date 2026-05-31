import type {
  FastifyReply,
  FastifyRequest,
  RouteGenericInterface,
} from "fastify";

export interface RateLimiterOptions {
  max?: number;
  windowMs?: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

function clientIpFromRequest(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  }

  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const max = options.max ?? 100;
  const windowMs = options.windowMs ?? 60_000;
  const store = new Map<string, WindowEntry>();

  function check(ip: string): boolean {
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now - entry.windowStart >= windowMs) {
      store.set(ip, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= max) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  async function preHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const ip = clientIpFromRequest(request);

    if (!check(ip)) {
      void reply.code(429).send({
        error: "rate_limit_exceeded",
        message: "Too many requests — slow down.",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }
  }

  function reset(): void {
    store.clear();
  }

  return {
    check,
    preHandler,
    reset,
  };
}

const defaultLimiter = createRateLimiter();

export const rateLimitPreHandler = defaultLimiter.preHandler;

export function withRateLimit<T extends RouteGenericInterface>(
  handler: (request: FastifyRequest<T>, reply: FastifyReply) => Promise<unknown> | unknown,
): (request: FastifyRequest<T>, reply: FastifyReply) => Promise<unknown> {
  return async (request: FastifyRequest<T>, reply: FastifyReply): Promise<unknown> => {
    await rateLimitPreHandler(request, reply);

    if (reply.sent) {
      return undefined;
    }

    return handler(request, reply);
  };
}
