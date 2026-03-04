"use client";

import { useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Upload,
  LogIn,
  X,
  Loader2,
  Eye,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
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
  const [audienceChoice, setAudienceChoice] = useState("");
  const [audienceCustom, setAudienceCustom] = useState("");
  const [jurisdictionChoice, setJurisdictionChoice] = useState("");
  const [jurisdictionCustom, setJurisdictionCustom] = useState("");
  const [contractTypeChoice, setContractTypeChoice] = useState("");
  const [contractTypeCustom, setContractTypeCustom] = useState("");
  const [showTechDetails, setShowTechDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const audienceContext =
    audienceChoice === "other"
      ? audienceCustom.trim()
      : audienceChoice || undefined;

  const jurisdictionContext =
    jurisdictionChoice === "other"
      ? jurisdictionCustom.trim()
      : jurisdictionChoice || undefined;

  const contractTypeHint =
    contractTypeChoice === "other"
      ? contractTypeCustom.trim()
      : contractTypeChoice || undefined;

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
          audienceContext: audienceContext || undefined,
          jurisdictionContext: jurisdictionContext || undefined,
          contractTypeHint: contractTypeHint || undefined,
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
              <div className="mt-5 rounded-lg border border-border bg-muted/50 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium">
                      Document imported and ready for your PlainTerms
                      report.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIngestResult(null)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <p className="mt-1 pl-6 text-xs text-muted-foreground">
                  Next: Generate report.
                  {ingestResult.isTruncated && (
                    <span className="ml-1 text-amber-600">
                      (Document was truncated to fit processing limits.)
                    </span>
                  )}
                </p>

                {/* Collapsible technical details */}
                <button
                  type="button"
                  onClick={() => setShowTechDetails((v) => !v)}
                  className="mt-2 flex items-center gap-1 pl-6 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${showTechDetails ? "rotate-180" : ""}`}
                  />
                  View technical details
                </button>
                {showTechDetails && (
                  <div className="mt-1.5 rounded bg-muted/60 px-3 py-2 ml-6">
                    <p className="text-xs text-muted-foreground">
                      {ingestResult.charCount.toLocaleString()} characters
                      &bull; {ingestResult.chunkCount} chunk
                      {ingestResult.chunkCount !== 1 && "s"}
                      &bull; type: {ingestResult.sourceType}
                    </p>
                    {ingestResult.chunks[0] && (
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground/70">
                        {ingestResult.chunks[0].slice(0, 300)}
                        {ingestResult.chunks[0].length > 300 && "..."}
                      </p>
                    )}
                  </div>
                )}

                {/* Context selectors */}
                <div className="mt-4 space-y-3 pl-6">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Who is this for? (optional)
                    </label>
                    <select
                      value={audienceChoice}
                      onChange={(e) => {
                        setAudienceChoice(e.target.value);
                        if (e.target.value !== "other")
                          setAudienceCustom("");
                      }}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Skip — general analysis</option>
                      <option value="General consumer">
                        General consumer
                      </option>
                      <option value="Senior / retired">
                        Senior / retired
                      </option>
                      <option value="Family with kids">
                        Family with kids
                      </option>
                      <option value="Small business owner">
                        Small business owner
                      </option>
                      <option value="other">Other (free text)</option>
                    </select>
                    {audienceChoice === "other" && (
                      <input
                        type="text"
                        value={audienceCustom}
                        onChange={(e) => setAudienceCustom(e.target.value)}
                        placeholder="e.g. freelancer, student, landlord..."
                        className="mt-1.5 block w-full rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        maxLength={100}
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Where does this contract apply? (optional)
                    </label>
                    <select
                      value={jurisdictionChoice}
                      onChange={(e) => {
                        setJurisdictionChoice(e.target.value);
                        if (e.target.value !== "other")
                          setJurisdictionCustom("");
                      }}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Skip — auto-detect</option>
                      <option value="United Kingdom">
                        United Kingdom
                      </option>
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="European Union">
                        European Union
                      </option>
                      <option value="other">Other (free text)</option>
                    </select>
                    {jurisdictionChoice === "other" && (
                      <>
                        <input
                          type="text"
                          value={jurisdictionCustom}
                          onChange={(e) =>
                            setJurisdictionCustom(e.target.value)
                          }
                          placeholder="e.g., Singapore, New York, Germany"
                          className="mt-1.5 block w-full rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          maxLength={100}
                        />
                        <p className="mt-1 text-xs text-muted-foreground/60">
                          If you know the country (and state/province),
                          the report can be more accurate.
                        </p>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      What type of contract is this? (optional)
                    </label>
                    <select
                      value={contractTypeChoice}
                      onChange={(e) => {
                        setContractTypeChoice(e.target.value);
                        if (e.target.value !== "other")
                          setContractTypeCustom("");
                      }}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Skip — auto-detect</option>
                      <option value="Health insurance">
                        Health insurance
                      </option>
                      <option value="Home insurance">Home insurance</option>
                      <option value="Car insurance">Car insurance</option>
                      <option value="Travel insurance">
                        Travel insurance
                      </option>
                      <option value="Mobile phone plan">
                        Mobile phone plan
                      </option>
                      <option value="Consumer loan / BNPL / credit">
                        Consumer loan / BNPL / credit
                      </option>
                      <option value="Gym / subscription membership">
                        Gym / subscription membership
                      </option>
                      <option value="Commercial lease">
                        Commercial lease
                      </option>
                      <option value="Cyber insurance">
                        Cyber insurance
                      </option>
                      <option value="other">Other (free text)</option>
                    </select>
                    {contractTypeChoice === "other" && (
                      <input
                        type="text"
                        value={contractTypeCustom}
                        onChange={(e) =>
                          setContractTypeCustom(e.target.value)
                        }
                        placeholder="e.g., Solar PPA, Farm equipment lease"
                        className="mt-1.5 block w-full rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        maxLength={100}
                      />
                    )}
                  </div>
                </div>

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
                  className="mt-4 ml-6 gap-2"
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
              Your report is saved to your account. Your original document
              text is not stored. This is not legal advice.
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
