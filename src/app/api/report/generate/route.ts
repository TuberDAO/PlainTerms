import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { runReportAnalysis } from "@/lib/llm/openai";
import { createReport } from "@/lib/reports";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Authentication required.", 401);
    }

    const body = await request.json();
    const { ingest, locale, audienceContext, jurisdictionContext, contractTypeHint } = body;

    if (
      !ingest ||
      !Array.isArray(ingest.chunks) ||
      ingest.chunks.length === 0 ||
      typeof ingest.fingerprint !== "string"
    ) {
      return jsonError("Invalid ingest payload.", 400);
    }

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
          typeof jurisdictionContext === "string" && jurisdictionContext.trim()
            ? jurisdictionContext.trim()
            : undefined,
        contractTypeHint:
          typeof contractTypeHint === "string" && contractTypeHint.trim()
            ? contractTypeHint.trim()
            : undefined,
        chunks: ingest.chunks,
        chunkCount: ingest.chunkCount ?? ingest.chunks.length,
        fingerprint: ingest.fingerprint,
        sourceType: ingest.sourceType ?? "text",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown LLM error";
      console.error("[generate] LLM failed:", msg);
      return jsonError(
        "Failed to generate report. Please try again.",
        500,
      );
    }

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
      console.error("[generate] DB insert failed:", result.error);
      return jsonError("Failed to save report. Please try again.", 500);
    }

    console.log("[generate]", {
      reportId: result.id,
      fingerprintLast4: ingest.fingerprint.slice(-4),
      charCount: ingest.charCount,
      sourceType: ingest.sourceType,
    });

    return NextResponse.json({ ok: true, reportId: result.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate] Unexpected:", msg);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
