/**
 * Shared rules for when to use the chunked (large-doc) analysis pipeline.
 * Kept in a small module so client UI can import it without pulling LLM clients.
 */

export const LARGE_DOC_THRESHOLD_CHARS = 150_000;
/** Prefer chunked analysis below the hard char cap to avoid monolithic timeouts. */
export const LARGE_DOC_NEAR_THRESHOLD_CHARS = 135_000;
/** With many chunks and substantial size, monolithic analysis often times out. */
export const LARGE_DOC_HIGH_CHUNK_COUNT = 10;
export const LARGE_DOC_MIN_CHARS_FOR_CHUNK_RULE = 100_000;

export function shouldUseLargeDocPipeline(
  totalDocChars: number,
  chunkCount: number,
): boolean {
  if (totalDocChars >= LARGE_DOC_THRESHOLD_CHARS) return true;
  if (totalDocChars >= LARGE_DOC_NEAR_THRESHOLD_CHARS) return true;
  if (
    chunkCount >= LARGE_DOC_HIGH_CHUNK_COUNT &&
    totalDocChars >= LARGE_DOC_MIN_CHARS_FOR_CHUNK_RULE
  ) {
    return true;
  }
  return false;
}
