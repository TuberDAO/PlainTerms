/**
 * Smoke test: generates a tiny PDF in-memory with pdf-lib,
 * parses it with unpdf (same lib used by parsePdf), and
 * asserts the extracted text contains a known marker string.
 *
 * Usage: node scripts/ingest-smoke.mjs
 * Exit 0 on success, 1 on failure.
 */

import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocumentProxy, extractText } from "unpdf";

const MARKER = "PlainTerms smoke test marker 2025";

async function main() {
  // 1. Generate a minimal PDF with known text
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 200]);
  page.drawText(MARKER, { x: 20, y: 100, size: 12, font });
  const pdfBytes = await doc.save();

  // 2. Parse with unpdf (mirrors what src/lib/ingest/parse.ts does)
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });

  // 3. Assert
  if (totalPages !== 1) {
    console.error(`FAIL: expected 1 page, got ${totalPages}`);
    process.exit(1);
  }

  if (!text.includes(MARKER)) {
    console.error(`FAIL: marker not found in extracted text`);
    console.error(`  extracted (first 200): ${text.slice(0, 200)}`);
    process.exit(1);
  }

  console.log(`PASS: extracted ${text.length} chars from ${totalPages} page(s)`);
  console.log(`  marker found in output`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
