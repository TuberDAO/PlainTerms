"use client";

import { useState } from "react";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";

// Keep in sync with SIMPLIFY_MAX_INPUT_CHARS in src/lib/llm/simplify.ts.
// Inlined here to avoid importing a server-only module into the client bundle.
const MAX_INPUT_CHARS = 1500;

interface SimplifyBlockProps {
  /** The PlainTerms-generated text to simplify. Capped at SIMPLIFY_MAX_INPUT_CHARS. */
  text: string;
}

type Status = "idle" | "loading" | "done" | "error";

/**
 * A self-contained "Explain this more simply" button.
 *
 * - First click: calls /api/simplify and shows the result inline.
 * - Subsequent clicks: toggle the simplified text on/off without re-fetching.
 * - Caches the result in component state for the viewing session.
 */
export function SimplifyBlock({ text }: SimplifyBlockProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [simplified, setSimplified] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  async function handleClick() {
    if (status === "loading") return;

    // If we already have a result, just toggle visibility.
    if (status === "done") {
      setVisible((v) => !v);
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/simplify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, MAX_INPUT_CHARS),
        }),
      });
      const data: { simplified?: string; error?: string } = await res.json();
      if (!res.ok || !data.simplified) {
        throw new Error(data.error ?? "Simplification failed.");
      }
      setSimplified(data.simplified);
      setStatus("done");
      setVisible(true);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-3">
      {/* Primary action button — shown until result is loaded, then toggles */}
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        aria-expanded={status === "done" ? visible : undefined}
        aria-label={
          status === "done"
            ? visible
              ? "Hide simpler version"
              : "Show simpler version"
            : "Explain this in simpler terms"
        }
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary/60 transition-colors hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : status === "done" ? (
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-150 ${visible ? "" : "-rotate-90"}`}
          />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        {status === "loading"
          ? "Simplifying…"
          : status === "done"
            ? visible
              ? "Hide simpler version"
              : "Show simpler version"
            : "Explain this more simply"}
      </button>

      {/* Error state */}
      {status === "error" && (
        <p className="mt-1 px-2 text-xs text-destructive">
          Could not simplify — please try again.{" "}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => setStatus("idle")}
          >
            Retry
          </button>
        </p>
      )}

      {/* Simplified result */}
      {status === "done" && simplified && visible && (
        <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-500/70">
            Simpler version
          </p>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-foreground/80">
            {simplified}
          </p>
        </div>
      )}
    </div>
  );
}
