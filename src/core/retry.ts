/**
 * Retry with exponential backoff for transient HTTP errors.
 * Designed for free-tier rate limits (429) and server errors (5xx).
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  retryableStatuses?: number[];
}

export class RetryableError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Execute an async function with retry logic.
 *
 * On retryable errors (429, 5xx by default), waits with exponential backoff
 * and retries. Respects `Retry-After` header when available via RetryableError.
 *
 * @param fn - The async function to execute
 * @param opts - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 1000,
    retryableStatuses = [429, 500, 502, 503, 504],
  } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status =
        err?.status ?? err?.response?.status ?? extractStatusFromMessage(err);
      const isRetryable =
        typeof status === "number" && retryableStatuses.includes(status);
      const isLast = attempt === maxAttempts;

      if (!isRetryable || isLast) throw err;

      // Use Retry-After header if available, otherwise exponential backoff
      const retryAfter = extractRetryAfter(err);
      const delay = retryAfter ?? baseDelayMs * Math.pow(2, attempt - 1);

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("withRetry: unreachable");
}

/**
 * Try to extract an HTTP status code from an error message like
 * "OpenAI provider error 429: ..."
 */
function extractStatusFromMessage(err: any): number | undefined {
  const msg = err?.message ?? "";
  const match = msg.match(/error\s+(\d{3})/i);
  if (match) return parseInt(match[1], 10);
  return undefined;
}

/**
 * Try to extract a Retry-After value (in ms) from an error.
 * Some providers include this as a property or in the error body.
 */
function extractRetryAfter(err: any): number | undefined {
  const raw = err?.retryAfter ?? err?.headers?.["retry-after"];
  if (!raw) return undefined;

  // Could be seconds (integer) or HTTP date
  const n = Number(raw);
  if (!isNaN(n) && n > 0) {
    return n * 1000; // seconds to ms
  }

  return undefined;
}
