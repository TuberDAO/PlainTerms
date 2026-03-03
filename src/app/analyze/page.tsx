"use client";

import { useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Upload, LogIn, X, Loader2, Eye } from "lucide-react";
import { track } from "@/lib/analytics/tracker";
import { useLocale } from "@/lib/locale/context";
import { createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

interface IngestResult {
  ok: true;
  sourceType: "pdf" | "docx" | "text";
  title?: string;
  charCount: number;
  isTruncated: boolean;
  fingerprint: string;
  chunkCount: number;
  chunks: string[];
}

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vertical = searchParams.get("vertical") ?? "insurance";
  const { locale } = useLocale();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setIngestResult(null);
    setError(null);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleIngest() {
    setIngesting(true);
    setError(null);
    setIngestResult(null);

    try {
      let res: Response;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/ingest", { method: "POST", body: formData });
      } else if (text.trim()) {
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, title: "Pasted text" }),
        });
      } else {
        setError("Please paste text or upload a file.");
        return;
      }

      if (!res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const data = await res.json();
          setError(data.error ?? "Ingestion failed. Please try again.");
        } else {
          setError(`Ingestion failed (${res.status}). Check server logs.`);
        }
        return;
      }

      const data = await res.json();

      if (!data.ok) {
        setError(data.error ?? "Ingestion failed. Please try again.");
        return;
      }

      const result = data as IngestResult;
      setIngestResult(result);

      try {
        sessionStorage.setItem(
          "pt:lastIngest",
          JSON.stringify({
            fingerprint: result.fingerprint,
            chunkCount: result.chunkCount,
            chunks: result.chunks,
            sourceType: result.sourceType,
            title: result.title,
            charCount: result.charCount,
            isTruncated: result.isTruncated,
          }),
        );
      } catch {
        // sessionStorage may be unavailable (private browsing quota)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Ingestion failed: ${msg}`);
    } finally {
      setIngesting(false);
    }
  }

  async function ensureSession(): Promise<boolean> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      setError("Supabase env vars missing.");
      return false;
    }

    const supabase = createBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData.session) return true;

    const { error: signInError } =
      await supabase.auth.signInAnonymously();

    if (signInError) {
      setError(`Guest sign-in failed: ${signInError.message}`);
      return false;
    }

    const { data: verifyData } = await supabase.auth.getSession();
    return !!verifyData.session;
  }

  async function handleGenerateReport() {
    setGenerating(true);
    setGenerateError(null);
    setError(null);

    try {
      const hasSession = await ensureSession();
      if (!hasSession) {
        setGenerateError("Sign-in required. Please try again.");
        return;
      }

      const payload = ingestResult ?? (() => {
        try {
          const raw = sessionStorage.getItem("pt:lastIngest");
          return raw ? (JSON.parse(raw) as IngestResult) : null;
        } catch {
          return null;
        }
      })();

      if (!payload) {
        setGenerateError("No ingested document found. Please analyze a document first.");
        return;
      }

      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingest: {
            fingerprint: payload.fingerprint,
            chunks: payload.chunks,
            chunkCount: payload.chunkCount,
            charCount: payload.charCount,
            isTruncated: payload.isTruncated,
            sourceType: payload.sourceType,
            title: payload.title,
          },
          locale,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setGenerateError(data.error ?? "Report generation failed.");
        return;
      }

      router.push(`/report/${data.reportId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setGenerateError(`Report generation failed: ${msg}`);
    } finally {
      setGenerating(false);
    }
  }

  function handleViewExample() {
    track("example_report_viewed", { vertical, locale });
    const demoId =
      vertical === "leases"
        ? "demo-lease"
        : vertical === "contracts"
          ? "demo-contract"
          : "demo-insurance";
    router.push(`/report/${demoId}`);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    handleFileSelect(dropped);
  }

  const hasInput = file !== null || text.trim().length > 0;

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Analyse your contract
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Paste your contract text below, or upload a PDF or DOCX file.
            We&apos;ll break it down in plain language.
          </p>
        </div>

        <Card className="mt-10 rounded-xl">
          <CardContent className="p-6 sm:p-8">
            {/* Text input */}
            <label className="text-sm font-medium">Contract text</label>
            <textarea
              className="mt-2 min-h-[200px] w-full rounded-lg border bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Paste your contract clause or full document here..."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setIngestResult(null);
              }}
            />

            {/* File upload zone */}
            <div
              className={`mt-5 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/20"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Drag and drop a PDF or DOCX here, or{" "}
                <label className="cursor-pointer font-medium text-primary hover:underline">
                  browse files
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  />
                </label>
              </p>
              <p className="text-xs text-muted-foreground">
                PDF or DOCX — max 10 MB
              </p>
            </div>

            {/* Selected file badge */}
            {file && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <span className="text-muted-foreground">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="ml-auto rounded p-0.5 hover:bg-muted-foreground/20"
                  aria-label="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {/* Ingest success panel */}
            {ingestResult && (
              <div className="mt-5 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Parsed {ingestResult.charCount.toLocaleString()} characters
                    &bull; {ingestResult.chunkCount} chunk
                    {ingestResult.chunkCount !== 1 && "s"}
                    {ingestResult.isTruncated && (
                      <span className="ml-1 text-amber-600">(truncated)</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIngestResult(null)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
                {ingestResult.chunks[0] && (
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    {ingestResult.chunks[0].slice(0, 300)}
                    {ingestResult.chunks[0].length > 300 && "..."}
                  </p>
                )}
                {generateError && (
                  <div
                    role="alert"
                    className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    {generateError}
                  </div>
                )}
                <Button
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={handleGenerateReport}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {generating ? "Generating..." : "Generate report"}
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="flex-1 gap-2 rounded-lg font-semibold shadow-sm"
                onClick={handleIngest}
                disabled={ingesting || !hasInput}
              >
                {ingesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {ingesting ? "Analyzing..." : "Analyze"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 gap-2 rounded-lg"
                onClick={handleViewExample}
              >
                <Eye className="h-4 w-4" />
                View example report
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1 gap-2 rounded-lg"
                asChild
              >
                <Link href="/account">
                  <LogIn className="h-4 w-4" />
                  Sign in to save
                </Link>
              </Button>
            </div>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Free preview included. Your text is processed in real-time and
              not stored. This is not legal advice.
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Not sure? Try one of our{" "}
            <Link
              href="/examples"
              className="font-medium text-primary hover:underline"
            >
              example analyses
            </Link>{" "}
            first.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeContent />
    </Suspense>
  );
}
