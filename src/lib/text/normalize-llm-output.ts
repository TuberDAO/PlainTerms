const MOJIBAKE: [RegExp, string][] = [
  [/\u00e2\u0080\u0099|â€™/g, "'"],
  [/\u00e2\u0080\u009c|â€œ/g, '"'],
  [/\u00e2\u0080\u009d|â€\u009d|â€�/g, '"'],
  [/\u00e2\u0080\u0093|â€"/g, "–"],
  [/\u00e2\u0080\u0094|â€"/g, "—"],
  [/\u00c2(?=[\u00a0-\u00bf])/g, ""],
  [/\u00c2\s/g, " "],
  [/\u00c2$/g, ""],
  [/Â(?=[\u00a0-\u00bf\s])/g, ""],
  [/Â$/gm, ""],
];

const SMART_PUNCT: [RegExp, string][] = [
  [/[\u2018\u2019\u201A\u201B]/g, "'"],
  [/[\u201C\u201D\u201E\u201F]/g, '"'],
  [/[\u2013]/g, "–"],
  [/[\u2014]/g, "—"],
  [/\u00A0/g, " "],
  [/\u2026/g, "..."],
];

/**
 * Clean common LLM output artifacts (mojibake, stray bytes, excessive whitespace)
 * without altering meaning or structure. Preserves paragraph breaks.
 */
export function normalizeLlmOutput(input: string): string {
  if (!input) return input;

  let s = input;

  for (const [re, rep] of MOJIBAKE) {
    s = s.replace(re, rep);
  }
  for (const [re, rep] of SMART_PUNCT) {
    s = s.replace(re, rep);
  }

  s = s.replace(/[^\S\n]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/^[^\S\n]+|[^\S\n]+$/gm, "");
  s = s.trim();

  return s;
}
