export interface DocumentSection {
  label: string;
  chunkIndices: number[];
}

const KNOWN_HEADINGS: string[] = [
  "definitions",
  "interpretation",
  "coverage",
  "benefits",
  "cover",
  "what is covered",
  "what is not covered",
  "exclusions",
  "limitations",
  "exceptions",
  "general exclusions",
  "claims",
  "how to claim",
  "appeals",
  "grievances",
  "complaints",
  "dispute resolution",
  "disputes",
  "arbitration",
  "mediation",
  "fees",
  "charges",
  "costs",
  "pricing",
  "premiums",
  "payment",
  "billing",
  "renewal",
  "cancellation",
  "termination",
  "cooling off",
  "withdrawal",
  "privacy",
  "data protection",
  "data",
  "confidentiality",
  "indemnity",
  "indemnification",
  "liability",
  "limitation of liability",
  "warranties",
  "representations",
  "general provisions",
  "general terms",
  "miscellaneous",
  "notices",
  "governing law",
  "jurisdiction",
  "entire agreement",
  "amendments",
  "assignment",
  "force majeure",
  "severability",
  "schedule",
  "schedules",
  "appendix",
  "appendices",
  "annex",
  "annexure",
  "eligibility",
  "enrolment",
  "enrollment",
  "waiting period",
  "pre-existing conditions",
  "network",
  "providers",
  "out of network",
  "deductible",
  "co-payment",
  "co-insurance",
  "out of pocket",
  "summary of benefits",
  "plan details",
  "your rights",
  "your obligations",
  "our rights",
  "service levels",
  "service description",
  "acceptable use",
  "fair use",
  "intellectual property",
  "non-compete",
  "non-solicitation",
  "term and termination",
  "duration",
  "commencement",
];

const KNOWN_SET = new Set(KNOWN_HEADINGS.map((h) => h.toLowerCase()));

const NUMBERED_HEADING_RE =
  /^(?:section|article|part|chapter|schedule|appendix|annex)\s+\d+/i;

const ROMAN_HEADING_RE =
  /^(?:section|article|part)\s+(?:I{1,3}|IV|VI{0,3}|IX|X{1,3})\b/i;

const NUMBERED_DOT_RE = /^\d{1,3}\.\s+[A-Z]/;

function isAllCapsHeading(line: string): boolean {
  const words = line.trim().split(/\s+/);
  if (words.length < 2 || words.length > 14) return false;
  if (/[.!?]$/.test(line.trim())) return false;
  const upper = line.replace(/[\s\d.:;,\-–—()/]/g, "");
  if (upper.length < 4) return false;
  return upper === upper.toUpperCase() && /[A-Z]/.test(upper);
}

function isKnownHeading(line: string): boolean {
  const cleaned = line
    .trim()
    .replace(/^[\d.]+\s*/, "")
    .replace(/[:\-–—]+$/, "")
    .trim()
    .toLowerCase();
  if (KNOWN_SET.has(cleaned)) return true;
  for (const known of KNOWN_SET) {
    if (cleaned.startsWith(known) && cleaned.length < known.length + 20)
      return true;
  }
  return false;
}

function isNumberedHeading(line: string): boolean {
  const trimmed = line.trim();
  return (
    NUMBERED_HEADING_RE.test(trimmed) || ROMAN_HEADING_RE.test(trimmed)
  );
}

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;
  if (isNumberedHeading(trimmed)) return true;
  if (isKnownHeading(trimmed)) return true;
  if (isAllCapsHeading(trimmed)) return true;
  if (NUMBERED_DOT_RE.test(trimmed) && trimmed.length < 80) return true;
  return false;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

function cleanLabel(raw: string): string {
  let label = raw
    .trim()
    .replace(/^[\d.]+\s*/, "")
    .replace(/[:\-–—]+$/, "")
    .trim();

  if (label === label.toUpperCase() && label.length > 3) {
    label = titleCase(label);
  }
  if (label.length > 60) {
    label = label.slice(0, 57) + "...";
  }
  return label || "Untitled section";
}

interface HeadingHit {
  chunkIndex: number;
  lineIndex: number;
  raw: string;
  label: string;
}

/**
 * Detect document sections from chunk text using heading heuristics.
 * Returns at least 2 sections for any multi-chunk document, falling back
 * to position-based grouping when headings are sparse.
 */
export function detectSections(chunks: string[]): DocumentSection[] {
  if (chunks.length <= 1) {
    return [{ label: "Full document", chunkIndices: [0] }];
  }

  const hits: HeadingHit[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    const lines = chunks[ci].split("\n");
    for (let li = 0; li < Math.min(lines.length, 8); li++) {
      if (isLikelyHeading(lines[li])) {
        hits.push({
          chunkIndex: ci,
          lineIndex: li,
          raw: lines[li],
          label: cleanLabel(lines[li]),
        });
        break;
      }
    }
  }

  if (hits.length >= 2) {
    return buildSectionsFromHits(hits, chunks.length);
  }

  return mergeTinySections(buildFallbackSections(chunks.length));
}

function buildSectionsFromHits(
  hits: HeadingHit[],
  totalChunks: number,
): DocumentSection[] {
  const sections: DocumentSection[] = [];

  if (hits[0].chunkIndex > 0) {
    const preChunks: number[] = [];
    for (let i = 0; i < hits[0].chunkIndex; i++) preChunks.push(i);
    sections.push({ label: "Preamble / introduction", chunkIndices: preChunks });
  }

  for (let h = 0; h < hits.length; h++) {
    const startChunk = hits[h].chunkIndex;
    const endChunk = h + 1 < hits.length ? hits[h + 1].chunkIndex : totalChunks;
    const indices: number[] = [];
    for (let i = startChunk; i < endChunk; i++) indices.push(i);
    sections.push({ label: hits[h].label, chunkIndices: indices });
  }

  return sections;
}

function buildFallbackSections(totalChunks: number): DocumentSection[] {
  const q1 = Math.max(1, Math.round(totalChunks * 0.25));
  const q3 = Math.max(q1 + 1, Math.round(totalChunks * 0.75));

  const sections: DocumentSection[] = [];

  const opening: number[] = [];
  for (let i = 0; i < q1; i++) opening.push(i);
  sections.push({ label: "Opening terms", chunkIndices: opening });

  const core: number[] = [];
  for (let i = q1; i < q3; i++) core.push(i);
  if (core.length > 0) {
    sections.push({ label: "Core terms", chunkIndices: core });
  }

  const closing: number[] = [];
  for (let i = q3; i < totalChunks; i++) closing.push(i);
  if (closing.length > 0) {
    sections.push({
      label: "Closing terms and schedules",
      chunkIndices: closing,
    });
  }

  return sections;
}

function mergeTinySections(sections: DocumentSection[]): DocumentSection[] {
  if (sections.length <= 2) return sections;

  const merged: DocumentSection[] = [];
  for (const section of sections) {
    if (
      section.chunkIndices.length === 0 &&
      merged.length > 0
    ) {
      continue;
    }

    if (
      section.chunkIndices.length === 1 &&
      merged.length > 0 &&
      merged[merged.length - 1].chunkIndices.length === 1
    ) {
      merged[merged.length - 1].label +=
        " / " + section.label;
      merged[merged.length - 1].chunkIndices.push(
        ...section.chunkIndices,
      );
    } else {
      merged.push({ ...section, chunkIndices: [...section.chunkIndices] });
    }
  }

  return merged;
}
