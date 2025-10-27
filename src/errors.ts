/** Custom error types to improve DX. */
export class HTTPError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseText?: string,
  ) {
    super(message);
    this.name = 'HTTPError';
  }
}

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms`);
    this.name = 'TimeoutError';
  }
}
