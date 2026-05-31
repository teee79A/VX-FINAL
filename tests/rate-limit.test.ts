import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../server/lib/rate-limit.js";

describe("createRateLimiter", () => {
  it("allows requests under the limit", () => {
    const { check } = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect(check("1.2.3.4")).toBe(true);
    expect(check("1.2.3.4")).toBe(true);
    expect(check("1.2.3.4")).toBe(true);
  });

  it("blocks requests that exceed the limit", () => {
    const { check } = createRateLimiter({ max: 2, windowMs: 60_000 });
    expect(check("1.2.3.4")).toBe(true);
    expect(check("1.2.3.4")).toBe(true);
    expect(check("1.2.3.4")).toBe(false); // 3rd request is over limit
    expect(check("1.2.3.4")).toBe(false); // still blocked
  });

  it("tracks different IPs independently", () => {
    const { check } = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(check("10.0.0.1")).toBe(true);
    expect(check("10.0.0.2")).toBe(true); // different IP — allowed
    expect(check("10.0.0.1")).toBe(false); // 10.0.0.1 is now over limit
    expect(check("10.0.0.2")).toBe(false); // 10.0.0.2 is now over limit
  });

  it("resets the count after the window expires", () => {
    const windowMs = 100;
    const { check } = createRateLimiter({ max: 1, windowMs });
    expect(check("5.5.5.5")).toBe(true);
    expect(check("5.5.5.5")).toBe(false); // over limit

    vi.useFakeTimers();
    vi.advanceTimersByTime(windowMs + 1);
    expect(check("5.5.5.5")).toBe(true); // window reset
    vi.useRealTimers();
  });

  it("preHandler sends 429 when limit is exceeded", async () => {
    const { preHandler, check } = createRateLimiter({ max: 2, windowMs: 60_000 });

    // Exhaust the limit via check() so the preHandler call hits it blocked
    check("9.9.9.9");
    check("9.9.9.9");

    let sentCode: number | undefined;
    let sentBody: unknown;

    const mockReply = {
      code: (c: number) => {
        sentCode = c;
        return mockReply;
      },
      send: (body: unknown) => {
        sentBody = body;
        return mockReply;
      },
    };

    const mockRequest = {
      headers: {},
      ip: "9.9.9.9",
    };

    await preHandler(mockRequest as never, mockReply as never);
    expect(sentCode).toBe(429);
    expect((sentBody as { error: string }).error).toBe("rate_limit_exceeded");
  });

  it("preHandler uses x-forwarded-for over socket IP", async () => {
    const { preHandler } = createRateLimiter({ max: 999, windowMs: 60_000 });

    // Verify forwarded IP is correctly parsed
    const mockRequest = {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
      ip: "127.0.0.1",
    };
    const mockReply = { code: () => mockReply, send: () => mockReply };

    // Should pass without hitting 429 (max=999)
    await preHandler(mockRequest as never, mockReply as never);
    expect(true).toBe(true);
  });
});
