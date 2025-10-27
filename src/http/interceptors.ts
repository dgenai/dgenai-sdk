/**
 * Simple retry policy for idempotent methods (GET, HEAD).
 */
export async function withRetries<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = 100 * Math.pow(2, i); // 100ms, 200ms, 400ms
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
