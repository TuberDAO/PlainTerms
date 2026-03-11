import { NextRequest, NextResponse } from "next/server";
import { simplifyText, SIMPLIFY_MAX_INPUT_CHARS, getSimplifyModel } from "@/lib/llm/simplify";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = typeof body.text === "string" ? body.text.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  // Silently cap — the caller already trims, but enforce server-side too.
  const text = raw.slice(0, SIMPLIFY_MAX_INPUT_CHARS);
  const isDev = process.env.NODE_ENV === "development";

  try {
    const result = await simplifyText(text);

    // In development, include model and fidelity diagnostic so we can verify
    // which model ran and whether the invention-detection heuristic fired.
    const debug = isDev
      ? {
          _debug: {
            model: result.model,
            retried: result.retried,
            inventionIssues: result.inventionIssues,
            configuredModel: getSimplifyModel(),
          },
        }
      : {};

    return NextResponse.json({ simplified: result.simplified, ...debug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[simplify] route error:", msg);
    return NextResponse.json(
      { error: "Simplification failed. Please try again." },
      { status: 500 },
    );
  }
}
