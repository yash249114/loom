import { describe, it, expect } from "vitest";
import { withRetry, RetryableError } from "../../../src/core/retry.js";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const result = await withRetry(async () => "ok");
    expect(result).toBe("ok");
  });

  it("retries on 429 and eventually succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          const err: any = new Error("rate limited");
          err.status = 429;
          throw err;
        }
        return "success";
      },
      { baseDelayMs: 10 }
    );
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("retries on 500 server errors", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts === 1) {
          const err: any = new Error("server error");
          err.status = 500;
          throw err;
        }
        return "recovered";
      },
      { baseDelayMs: 10 }
    );
    expect(result).toBe("recovered");
    expect(attempts).toBe(2);
  });

  it("does NOT retry on 400 (non-retryable)", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          const err: any = new Error("bad request");
          err.status = 400;
          throw err;
        },
        { baseDelayMs: 10 }
      )
    ).rejects.toThrow("bad request");
    expect(attempts).toBe(1);
  });

  it("does NOT retry on 401 (unauthorized)", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          const err: any = new Error("unauthorized");
          err.status = 401;
          throw err;
        },
        { baseDelayMs: 10 }
      )
    ).rejects.toThrow("unauthorized");
    expect(attempts).toBe(1);
  });

  it("throws after max attempts exhausted", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          const err: any = new Error("still failing");
          err.status = 429;
          throw err;
        },
        { maxAttempts: 3, baseDelayMs: 10 }
      )
    ).rejects.toThrow("still failing");
    expect(attempts).toBe(3);
  });

  it("respects custom maxAttempts", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          const err: any = new Error("fail");
          err.status = 502;
          throw err;
        },
        { maxAttempts: 2, baseDelayMs: 10 }
      )
    ).rejects.toThrow("fail");
    expect(attempts).toBe(2);
  });

  it("uses exponential backoff between retries", async () => {
    const timestamps: number[] = [];
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          timestamps.push(Date.now());
          attempts++;
          const err: any = new Error("fail");
          err.status = 429;
          throw err;
        },
        { maxAttempts: 3, baseDelayMs: 50 }
      )
    ).rejects.toThrow();

    expect(attempts).toBe(3);
    // Second retry should take longer than first
    if (timestamps.length >= 3) {
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThanOrEqual(delay1 * 1.5);
    }
  });

  it("extracts status from error message pattern", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("OpenAI provider error 429: rate limited");
        },
        { maxAttempts: 2, baseDelayMs: 10 }
      )
    ).rejects.toThrow();
    // Should have retried because 429 was extracted from message
    expect(attempts).toBe(2);
  });

  it("respects Retry-After header via error property", async () => {
    let attempts = 0;
    const start = Date.now();

    await expect(
      withRetry(
        async () => {
          attempts++;
          const err: any = new Error("rate limited");
          err.status = 429;
          err.retryAfter = "0.05"; // 50ms in seconds
          throw err;
        },
        { maxAttempts: 2, baseDelayMs: 5000 }
      )
    ).rejects.toThrow();

    const elapsed = Date.now() - start;
    // Should have used Retry-After (50ms) instead of baseDelayMs (5000ms)
    expect(elapsed).toBeLessThan(2000);
    expect(attempts).toBe(2);
  });

  it("retries on all configured retryable statuses", async () => {
    for (const status of [429, 500, 502, 503, 504]) {
      let attempts = 0;
      const result = await withRetry(
        async () => {
          attempts++;
          if (attempts === 1) {
            const err: any = new Error(`error ${status}`);
            err.status = status;
            throw err;
          }
          return "ok";
        },
        { baseDelayMs: 10 }
      );
      expect(result).toBe("ok");
    }
  });
});

describe("RetryableError", () => {
  it("stores status code", () => {
    const err = new RetryableError(429, "rate limited");
    expect(err.status).toBe(429);
    expect(err.message).toBe("rate limited");
    expect(err.name).toBe("RetryableError");
  });
});
