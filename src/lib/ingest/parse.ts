import { createRequire } from "module";

export type FileKind = "pdf" | "docx";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b]; // PK

const esmRequire = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mammoth: any;

function getMammoth() {
  if (!_mammoth) _mammoth = esmRequire("mammoth");
  return _mammoth;
}

export function detectFileKind(
  fileName: string,
  _mime: string | null,
  headerBytes: Uint8Array,
): FileKind | null {
  if (
    headerBytes.length >= 5 &&
    headerBytes[0] === PDF_MAGIC[0] &&
    headerBytes[1] === PDF_MAGIC[1] &&
    headerBytes[2] === PDF_MAGIC[2] &&
    headerBytes[3] === PDF_MAGIC[3] &&
    headerBytes[4] === PDF_MAGIC[4]
  ) {
    return "pdf";
  }

  if (
    headerBytes.length >= 2 &&
    headerBytes[0] === ZIP_MAGIC[0] &&
    headerBytes[1] === ZIP_MAGIC[1] &&
    fileName.toLowerCase().endsWith(".docx")
  ) {
    return "docx";
  }

  return null;
}

const SUPPRESSED_WARN_RE =
  /^TT: undefined function|^Invalid CIDToGIDMap|^Unimplemented widget field type/;

export async function parsePdf(
  buffer: Buffer,
): Promise<{ text: string; meta?: { pages?: number } }> {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (SUPPRESSED_WARN_RE.test(String(args[0]))) return;
    originalWarn.apply(console, args);
  };

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return { text, meta: { pages: totalPages } };
  } finally {
    console.warn = originalWarn;
  }
}

export async function parseDocx(
  buffer: Buffer,
): Promise<{ text: string }> {
  const mammoth = getMammoth();
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value };
}

export function normalizeText(raw: string): string {
  return raw
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}
