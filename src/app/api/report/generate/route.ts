import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { runReportAnalysis, LARGE_DOC_THRESHOLD_CHARS } from "@/lib/llm/openai";
import { createReport } from "@/lib/reports";
import { checkDocumentRelevance } from "@/lib/llm/relevance-check";

let reqCounter = 0;
function nextRequestId(): string {
  reqCounter = (reqCounter + 1) % 1_000_000;
  return `gen-${Date.now()}-${reqCounter}`;
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}

function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function POST(request: NextRequest) {
  const rid = nextRequestId();
  const t0 = performance.now();
  const isDev = process.env.NODE_ENV === "development";

  const log = (stage: string, data?: Record<string, unknown>) =>
    console.log(`[generate] ${stage}`, { rid, ms: elapsed(t0), ...data });

  log("request_received");

  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      log("auth_failed");
      return jsonError("Authentication required.", 401);
    }

    const body = await request.json();
    const {
      ingest,
      locale,
      audienceContext,
      jurisdictionContext,
      contractTypeHint,
      personalContext,
      question,
      sections,
      selectedSectionIndices,
    } = body;

    if (
      !ingest ||
      !Array.isArray(ingest.chunks) ||
      ingest.chunks.length === 0 ||
      typeof ingest.fingerprint !== "string"
    ) {
      log("input_invalid");
      return jsonError("Invalid ingest payload.", 400);
    }

    const totalCharCount: number =
      typeof ingest.charCount === "number"
        ? ingest.charCount
        : ingest.chunks.reduce((s: number, c: string) => s + c.length, 0);
    const isLargeDoc = totalCharCount >= LARGE_DOC_THRESHOLD_CHARS;

    log("input_validated", {
      chunkCount: ingest.chunks.length,
      charCount: totalCharCount,
      sourceType: ingest.sourceType,
      fingerprintLast4: ingest.fingerprint.slice(-4),
      isLargeDoc,
    });

    if (isLargeDoc) {
      const relevance = checkDocumentRelevance(ingest.chunks);
      log("relevance_check", {
        relevant: relevance.relevant,
        confidence: relevance.confidence,
        distinctKeywords: relevance.distinctKeywordsFound,
      });
      if (!relevance.relevant) {
        return jsonError(
          "This file does not appear to be the kind of contract, policy, or legal terms document " +
            "PlainTerms is designed to analyse. If this is a contract document, try selecting a specific contract type.",
          422,
          { code: "NOT_RELEVANT" },
        );
      }
    }

    const parsedSections =
      Array.isArray(sections) ? sections : undefined;
    const parsedSelectedIndices =
      Array.isArray(selectedSectionIndices) ? selectedSectionIndices : undefined;

    log("llm_analysis_started");
    let report;
    try {
      report = await runReportAnalysis({
        locale: locale ?? undefined,
        title: ingest.title ?? undefined,
        audienceContext:
          typeof audienceContext === "string" && audienceContext.trim()
            ? audienceContext.trim()
            : undefined,
        jurisdictionContext:
          typeof jurisdictionContext === "string" &&
          jurisdictionContext.trim()
            ? jurisdictionContext.trim()
            : undefined,
        contractTypeHint:
          typeof contractTypeHint === "string" && contractTypeHint.trim()
            ? contractTypeHint.trim()
            : undefined,
        personalContext:
          typeof personalContext === "string" && personalContext.trim()
            ? personalContext.trim().slice(0, 500)
            : undefined,
        question:
          typeof question === "string" && question.trim()
            ? question.trim()
            : undefined,
        chunks: ingest.chunks,
        chunkCount: ingest.chunkCount ?? ingest.chunks.length,
        fingerprint: ingest.fingerprint,
        sourceType: ingest.sourceType ?? "text",
        sections: parsedSections,
        selectedSectionIndices: parsedSelectedIndices,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown LLM error";
      const code = (err as unknown as Record<string, unknown>)?.code;
      log("llm_analysis_failed", {
        error: msg,
        code: code ?? undefined,
        ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
      });

      if (code === "TRUNCATED_OUTPUT") {
        return jsonError(
          "This document produced a very large analysis that could not be completed in one pass. " +
          "Try selecting a specific contract type or reducing the document length.",
          500,
          { code: "TRUNCATED_OUTPUT" },
        );
      }

      return jsonError(
        "Failed to generate report. Please try again.",
        500,
        isDev ? { detail: msg } : undefined,
      );
    }

    log("llm_analysis_completed", {
      findings: report.findings.length,
      clauseCards: report.clauseCards.length,
    });

    log("report_persist_started");
    let reportId: string;
    try {
      const result = await createReport({
        owner_id: user.id,
        report_json: report,
        locale: locale ?? undefined,
        source_type: ingest.sourceType ?? "text",
        title: ingest.title ?? undefined,
        input_char_count: ingest.charCount ?? undefined,
        source_fingerprint: ingest.fingerprint,
      });

      if ("error" in result) {
        log("report_persist_failed", { error: result.error });
        return jsonError("Failed to save report. Please try again.", 500);
      }
      reportId = result.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown DB error";
      log("report_persist_failed", { error: msg });
      return jsonError("Failed to save report. Please try again.", 500);
    }

    log("report_persist_completed", { reportId });

    // Non-critical post-save work: analytics, cache invalidation, etc.
    // Failures here must NOT cause a 500 — the report is already saved.
    try {
      // placeholder for future post-save hooks
    } catch (postErr) {
      const msg =
        postErr instanceof Error ? postErr.message : "Unknown post-save error";
      log("post_save_warning", { error: msg });
    }

    log("response_sent", { reportId, totalMs: elapsed(t0) });

    return NextResponse.json({ ok: true, reportId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log("error_thrown", {
      error: msg,
      ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
    });
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
