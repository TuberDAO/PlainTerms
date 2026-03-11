import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { runReportAnalysis } from "@/lib/llm/openai";
import { createReport } from "@/lib/reports";

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

    log("input_validated", {
      chunkCount: ingest.chunks.length,
      charCount: ingest.charCount,
      sourceType: ingest.sourceType,
      fingerprintLast4: ingest.fingerprint.slice(-4),
    });

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
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown LLM error";
      log("llm_analysis_failed", {
        error: msg,
        ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
      });
      return jsonError("Failed to generate report. Please try again.", 500);
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
