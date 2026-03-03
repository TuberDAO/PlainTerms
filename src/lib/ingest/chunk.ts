export interface ChunkOptions {
  maxChunkChars?: number;
  overlapChars?: number;
}

export interface ChunkResult {
  chunks: string[];
  chunkCount: number;
}

export function chunkText(
  text: string,
  opts?: ChunkOptions,
): ChunkResult {
  const max = opts?.maxChunkChars ?? 12_000;
  const overlap = opts?.overlapChars ?? 400;

  if (text.length <= max) {
    return { chunks: [text], chunkCount: 1 };
  }

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > max) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (const piece of hardSplit(para, max)) {
        chunks.push(piece);
      }
      continue;
    }

    const candidate = current ? current + "\n\n" + para : para;
    if (candidate.length <= max) {
      current = candidate;
    } else {
      chunks.push(current);
      const overlapText = current.slice(-overlap);
      current = overlapText + "\n\n" + para;
      if (current.length > max) {
        current = para;
      }
    }
  }

  if (current) {
    chunks.push(current);
  }

  return { chunks, chunkCount: chunks.length };
}

function hardSplit(text: string, max: number): string[] {
  const pieces: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + max, text.length);
    if (end < text.length) {
      const lastSentence = text.lastIndexOf(". ", end);
      if (lastSentence > offset + max * 0.5) {
        end = lastSentence + 1;
      }
    }
    pieces.push(text.slice(offset, end));
    offset = end;
  }
  return pieces;
}
