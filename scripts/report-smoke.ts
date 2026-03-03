/**
 * Smoke test for the report generation pipeline.
 *
 * Generates a tiny PDF, runs it through the ingest pipeline,
 * calls runReportAnalysis in mock mode, and validates the result
 * against the Zod schema.
 *
 * Usage: npm run report:smoke
 * Exit 0 on success, 1 on failure.
 */

process.env.PLAINTERMS_LLM_MODE = "mock";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { parsePdf, normalizeText } from "@/lib/ingest/parse";
import { chunkText } from "@/lib/ingest/chunk";
import { runReportAnalysis } from "@/lib/llm/openai";
import { ReportSchema } from "@/lib/llm/report-schema";
import { createHash } from "crypto";

const CONTRACT_TEXT = [
  "SERVICES AGREEMENT",
  "",
  "This agreement shall automatically renew for successive twelve-month periods",
  "unless the subscriber provides written notice of cancellation not fewer than",
  "sixty (60) days prior to the renewal date.",
  "",
  "In no event shall the Provider's aggregate liability exceed the total fees",
  "paid by the Subscriber during the twelve (12) months immediately preceding",
  "the claim.",
  "",
  "We may share your information with our affiliates and business partners for",
  "purposes including marketing, analytics, and service improvement.",
].join("\n");

async function main() {
  // 1. Generate a minimal PDF with contract-like text
  console.log("  [1/5] Generating test PDF...");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  let y = 750;
  for (const line of CONTRACT_TEXT.split("\n")) {
    page.drawText(line, { x: 50, y, size: 10, font });
    y -= 14;
  }
  const pdfBytes = await doc.save();

  // 2. Parse PDF through the ingest pipeline
  console.log("  [2/5] Parsing PDF via ingest pipeline...");
  const { text, meta } = await parsePdf(Buffer.from(pdfBytes));
  if (!text || text.trim().length === 0) {
    console.error("FAIL: parsePdf returned empty text");
    process.exit(1);
  }
  console.log(`        ${text.length} chars, ${meta?.pages ?? "?"} page(s)`);

  // 3. Normalize + chunk
  console.log("  [3/5] Normalizing and chunking...");
  const normalized = normalizeText(text);
  const { chunks, chunkCount } = chunkText(normalized);
  if (chunkCount === 0) {
    console.error("FAIL: chunkText returned 0 chunks");
    process.exit(1);
  }
  console.log(`        ${chunkCount} chunk(s), ${normalized.length} chars`);

  // 4. Run mock report analysis
  console.log("  [4/5] Running report analysis (mock mode)...");
  const fingerprint = createHash("sha256")
    .update(normalized, "utf8")
    .digest("hex");

  const report = await runReportAnalysis({
    title: "Test Services Agreement",
    chunks,
    chunkCount,
    fingerprint,
    sourceType: "pdf",
  });

  // 5. Validate against Zod schema
  console.log("  [5/5] Validating report against Zod schema...");
  ReportSchema.parse(report);

  if (!report.findings || report.findings.length === 0) {
    console.error("FAIL: report has no findings");
    process.exit(1);
  }
  if (!report.clauseCards || report.clauseCards.length === 0) {
    console.error("FAIL: report has no clauseCards");
    process.exit(1);
  }
  if (!report.actions?.recommendedQuestions?.length) {
    console.error("FAIL: report has no recommendedQuestions");
    process.exit(1);
  }
  if (!report.actions?.letterTemplates?.length) {
    console.error("FAIL: report has no letterTemplates");
    process.exit(1);
  }

  console.log(
    `PASS: report has ${report.findings.length} findings, ` +
      `${report.clauseCards.length} clause cards, ` +
      `score=${report.verdict.scoreOverall}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
