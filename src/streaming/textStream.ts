import type { TextChunkHandler } from '../types/api.types.js';
import { HTTPError } from '../errors.js';

/**
 * Consume a streaming text response and invoke a callback per decoded chunk.
 * Works with text/event-stream or chunked plaintext.
 */
export async function readTextStream(res: Response, onChunk: TextChunkHandler): Promise<void> {
  if (!res.ok || !res.body) {
    throw new HTTPError(`Streaming HTTP ${res.status}`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) await onChunk(text);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* iterateTextStream(res: Response): AsyncGenerator<string, void, unknown> {
  if (!res.ok || !res.body) {
    throw new HTTPError(`Streaming HTTP ${res.status}`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      const text = decoder.decode(value, { stream: true });
      if (text) yield text;
    }
  } finally {
    reader.releaseLock();
  }
}
