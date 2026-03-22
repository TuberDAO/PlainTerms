"use client";

import { useState, useCallback, useEffect, Suspense, useRef } from "react";
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
import { shouldUseLargeDocPipeline } from "@/lib/llm/large-doc-routing";
import {
  getPersonalContextHintLines,
  getPersonalContextPlaceholder,
} from "@/lib/analyze/personal-context-hints";

const GENERATE_STAGES = [
  { label: "Step 1 of 5: reading your document", pct: 8, durationMs: 1200 },
  { label: "Step 2 of 5: identifying key clauses", pct: 20, durationMs: 2000 },
  { label: "Step 3 of 5: reviewing contract terms", pct: 42, durationMs: 8000 },
  { label: "Step 4 of 5: reviewing each section in detail", pct: 66, durationMs: 12000 },
  { label: "Step 5 of 5: preparing your report", pct: 86, durationMs: 15000 },
  { label: "Finishing the final checks", pct: 93, durationMs: 4000 },
  { label: "Saving your report", pct: 96, durationMs: 6000 },
  { label: "Preparing your results", pct: 98, durationMs: 8000 },
] as const;

interface IngestSection {
  label: string;
  chunkIndices: number[];
}

interface IngestResult {
  ok: true;
  sourceType: "pdf" | "docx" | "text";
  title?: string;
  charCount: number;
  isTruncated: boolean;
  fingerprint: string;
  chunkCount: number;
  chunks: string[];
  sections?: IngestSection[];
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
  const [generateStage, setGenerateStage] = useState("");
  const [generatePct, setGeneratePct] = useState(0);
  const generateInflight = useRef(false);
  const generateStartedAt = useRef(0);
  const [generateElapsedSec, setGenerateElapsedSec] = useState(0);
  const [audienceChoice, setAudienceChoice] = useState("");
  const [audienceCustom, setAudienceCustom] = useState("");
  const [jurisdictionChoice, setJurisdictionChoice] = useState("");
  const [jurisdictionCustom, setJurisdictionCustom] = useState("");
  const [contractTypeChoice, setContractTypeChoice] = useState("");
  const [contractTypeCustom, setContractTypeCustom] = useState("");
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [personalContext, setPersonalContext] = useState("");
  const [allSectionsSelected, setAllSectionsSelected] = useState(true);
  const [sectionToggles, setSectionToggles] = useState<boolean[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!generating) return;
    const iv = setInterval(() => {
      setGenerateElapsedSec(Math.floor((Date.now() - generateStartedAt.current) / 1000));
    }, 3000);
    return () => clearInterval(iv);
  }, [generating]);

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

      if (result.sections) {
        setAllSectionsSelected(true);
        setSectionToggles(result.sections.map(() => true));
      }

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
            sections: result.sections,
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

  const startProgressSimulation = useCallback(() => {
    let stageIdx = 0;
    setGenerateStage(GENERATE_STAGES[0].label);
    setGeneratePct(GENERATE_STAGES[0].pct);

    const iv = setInterval(() => {
      stageIdx++;
      if (stageIdx < GENERATE_STAGES.length) {
        setGenerateStage(GENERATE_STAGES[stageIdx].label);
        setGeneratePct(GENERATE_STAGES[stageIdx].pct);
      } else {
        clearInterval(iv);
      }
    }, 6000);

    return iv;
  }, []);

  async function handleGenerateReport() {
    if (generateInflight.current) return;
    generateInflight.current = true;
    generateStartedAt.current = Date.now();
    setGenerateElapsedSec(0);
    setGenerating(true);
    setGenerateError(null);
    setError(null);
    setGeneratePct(0);
    setGenerateStage("Preparing document");

    const progressIv = startProgressSimulation();

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
        setGenerateError("No ingested document found. Please analyse a document first.");
        return;
      }

      setGenerateStage("Analysing contract");
      setGeneratePct(20);

      const payloadHasSections = payload.sections && payload.sections.length > 0;
      let selectedIndices: number[] | undefined;
      if (payloadHasSections) {
        if (payload.isTruncated) {
          selectedIndices = sectionToggles
            .map((on, i) => (on ? i : -1))
            .filter((i) => i >= 0);
          if (selectedIndices.length === 0) {
            setGenerateError("Please select at least one section to review.");
            return;
          }
        } else if (allSectionsSelected) {
          selectedIndices = payload.sections!.map((_: IngestSection, i: number) => i);
        } else {
          selectedIndices = sectionToggles
            .map((on, i) => (on ? i : -1))
            .filter((i) => i >= 0);
        }
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
          personalContext: personalContext.trim() || undefined,
          ...(payloadHasSections
            ? {
                sections: payload.sections,
                selectedSectionIndices: selectedIndices,
              }
            : {}),
        }),
      });

      let data: { ok?: boolean; error?: string; reportId?: string };
      try {
        data = await res.json();
      } catch {
        data = { ok: false, error: `Server returned ${res.status} with no body.` };
      }

      if (!res.ok || !data.ok) {
        if (data.reportId) {
          setGenerateStage("Opening report");
          setGeneratePct(100);
          router.push(`/report/${data.reportId}`);
          return;
        }
        const detail = data.error ?? "Report generation failed.";
        setGenerateError(detail);
        return;
      }

      setGenerateStage("Opening report");
      setGeneratePct(100);
      router.push(`/report/${data.reportId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setGenerateError(
        msg.includes("Failed to fetch")
          ? "Network error. Please check your connection and try again."
          : `Report generation failed: ${msg}`,
      );
    } finally {
      clearInterval(progressIv);
      generateInflight.current = false;
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

  const PERSONAL_CONTEXT_MAX = 1500;
  const MAX_SECTIONS_WHEN_TRUNCATED = 3;

  const isTruncatedDoc = ingestResult?.isTruncated === true;
  const hasSections = ingestResult?.sections && ingestResult.sections.length > 0;
  const ingestUsesLargePipeline =
    ingestResult != null &&
    shouldUseLargeDocPipeline(
      ingestResult.charCount,
      ingestResult.chunkCount,
    );

  const selectedSectionCount = allSectionsSelected
    ? (ingestResult?.sections?.length ?? 0)
    : sectionToggles.filter(Boolean).length;

  const totalAvailableSections = ingestResult?.sections?.length ?? 0;
  const effectiveMaxSections = Math.min(MAX_SECTIONS_WHEN_TRUNCATED, Math.max(totalAvailableSections - 1, 1));

  const truncatedAndAllSelected = isTruncatedDoc && allSectionsSelected;
  const truncatedTooManySections = isTruncatedDoc && !allSectionsSelected && selectedSectionCount > effectiveMaxSections;
  const truncatedAllManuallySelected = isTruncatedDoc && !allSectionsSelected && totalAvailableSections > 1 && selectedSectionCount >= totalAvailableSections;
  const truncatedNoSections = isTruncatedDoc && !allSectionsSelected && selectedSectionCount === 0;
  const truncatedBlocked = truncatedAndAllSelected || truncatedTooManySections || truncatedAllManuallySelected || truncatedNoSections;

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
            <label htmlFor="pt-contract-text" className="text-sm font-medium">Contract text</label>
            <textarea
              id="pt-contract-text"
              name="contractText"
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
                PDF or DOCX (max 10 MB)
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
                      {isTruncatedDoc
                        ? "Document imported, but it\u2019s very long."
                        : "Document imported and ready for your PlainTerms report."}
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

                {/* === Truncated document: gated section-selection flow === */}
                {isTruncatedDoc && (
                  <div className="mt-3 ml-6 rounded-lg border border-amber-200 bg-amber-50/60 p-4" data-testid="truncated-gate">
                    <p className="text-sm font-medium text-amber-900">
                      This document is very long. We cannot review all of it at once right now.
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-amber-800/80">
                      You can choose a few sections to review now, and come back for the others later.
                      For long policies, many people start with the main terms first.
                    </p>

                    {hasSections ? (
                      <fieldset className="mt-3">
                        <legend className="text-xs font-medium text-amber-900">
                          Choose up to {effectiveMaxSections} section{effectiveMaxSections !== 1 ? "s" : ""} to review now
                        </legend>
                        <div className="mt-2 space-y-1.5">
                          {ingestResult.sections!.map((sec, i) => (
                            <label
                              key={`trunc-sec-${sec.label}-${i}`}
                              className="flex items-center gap-2 text-xs text-amber-900/80"
                            >
                              <input
                                type="checkbox"
                                checked={!allSectionsSelected && (sectionToggles[i] ?? false)}
                                onChange={(e) => {
                                  if (allSectionsSelected) {
                                    setAllSectionsSelected(false);
                                    const fresh = ingestResult.sections!.map(() => false);
                                    fresh[i] = e.target.checked;
                                    setSectionToggles(fresh);
                                  } else {
                                    const next = [...sectionToggles];
                                    next[i] = e.target.checked;
                                    setSectionToggles(next);
                                  }
                                }}
                                className="h-3.5 w-3.5 rounded border-amber-300"
                              />
                              <span>{sec.label}</span>
                            </label>
                          ))}
                        </div>

                        {!allSectionsSelected && selectedSectionCount > 0 && selectedSectionCount <= effectiveMaxSections && !truncatedAllManuallySelected && (
                          <p className="mt-2 text-[11px] text-green-700">
                            {selectedSectionCount} section{selectedSectionCount !== 1 ? "s" : ""} selected.
                            Your report will cover these sections. You can review the others later.
                          </p>
                        )}
                        {(truncatedTooManySections || truncatedAllManuallySelected) && (
                          <p className="mt-2 text-[11px] text-amber-700">
                            {truncatedAllManuallySelected
                              ? "You cannot select all sections at once for a truncated document. Please leave at least one for a later review."
                              : `Please select up to ${effectiveMaxSections} section${effectiveMaxSections !== 1 ? "s" : ""} at a time. You can review the rest in a later run.`}
                          </p>
                        )}
                        {truncatedNoSections && !allSectionsSelected && (
                          <p className="mt-2 text-[11px] text-amber-700">
                            Select at least one section to continue.
                          </p>
                        )}
                      </fieldset>
                    ) : (
                      <p className="mt-2 text-xs text-amber-800/70">
                        No sections were detected in this document. Try uploading a shorter extract or a specific section of the policy.
                      </p>
                    )}

                    <p className="mt-3 text-[11px] text-amber-700/70" data-testid="review-later-hint">
                      You can review the other sections later by uploading the same document and selecting different sections.
                    </p>
                  </div>
                )}

                {/* Non-truncated long doc info */}
                {!isTruncatedDoc && ingestUsesLargePipeline && (
                  <p className="mt-1.5 pl-6 text-xs text-blue-600">
                    Large document detected. Multi-pass analysis will be used
                    for deeper coverage.
                  </p>
                )}

                {/* Non-truncated: normal "Next" prompt */}
                {!isTruncatedDoc && (
                  <p className="mt-1 pl-6 text-xs text-muted-foreground">
                    Next: Generate report.
                  </p>
                )}

                {/* Section selection for non-truncated large documents */}
                {!isTruncatedDoc && hasSections && (
                  <div className="mt-3 ml-6 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <fieldset>
                      <legend className="text-xs font-medium text-foreground">
                        Document sections
                      </legend>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        Choose which sections to analyse. All sections are included by default.
                      </p>
                      <label className="mt-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={allSectionsSelected}
                          onChange={(e) => {
                            setAllSectionsSelected(e.target.checked);
                            if (e.target.checked) {
                              setSectionToggles(
                                ingestResult.sections!.map(() => true),
                              );
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        <span className="font-medium">All sections</span>
                      </label>
                      <div className="mt-1.5 space-y-1 pl-5">
                        {ingestResult.sections!.map((sec, i) => (
                          <label
                            key={`sec-${sec.label}-${i}`}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <input
                              type="checkbox"
                              checked={
                                allSectionsSelected || (sectionToggles[i] ?? true)
                              }
                              disabled={allSectionsSelected}
                              onChange={(e) => {
                                const next = [...sectionToggles];
                                next[i] = e.target.checked;
                                setSectionToggles(next);
                              }}
                              className="h-3 w-3 rounded border-gray-300"
                            />
                            <span>{sec.label}</span>
                            <span className="text-muted-foreground/50">
                              ({sec.chunkIndices.length}{" "}
                              {sec.chunkIndices.length === 1 ? "chunk" : "chunks"})
                            </span>
                          </label>
                        ))}
                      </div>
                      {!allSectionsSelected && (
                        <p className="mt-2 text-[11px] text-amber-600">
                          The report will cover only the selected sections.
                        </p>
                      )}
                    </fieldset>
                  </div>
                )}

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
                    <label
                      htmlFor="pt-audience"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Who is this for? (optional)
                    </label>
                    <select
                      id="pt-audience"
                      name="audience"
                      value={audienceChoice}
                      onChange={(e) => {
                        setAudienceChoice(e.target.value);
                        if (e.target.value !== "other")
                          setAudienceCustom("");
                      }}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Skip (general analysis)</option>
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
                    <label
                      htmlFor="pt-jurisdiction"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Where does this contract apply? (optional)
                    </label>
                    <select
                      id="pt-jurisdiction"
                      name="jurisdiction"
                      value={jurisdictionChoice}
                      onChange={(e) => {
                        setJurisdictionChoice(e.target.value);
                        if (e.target.value !== "other")
                          setJurisdictionCustom("");
                      }}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Skip (auto-detect)</option>
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
                    <label
                      htmlFor="pt-contract-type"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      What type of contract is this? (optional)
                    </label>
                    <select
                      id="pt-contract-type"
                      name="contractType"
                      value={contractTypeChoice}
                      onChange={(e) => {
                        setContractTypeChoice(e.target.value);
                        if (e.target.value !== "other")
                          setContractTypeCustom("");
                      }}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Skip (auto-detect)</option>
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

                <div className="ml-6 mt-3">
                  <label
                    htmlFor="pt-personal-context"
                    className="block text-sm font-medium text-foreground"
                  >
                    Tell us about your situation (optional)
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Adding a few personal details helps us highlight the issues that matter most to you.
                    This stays private and is only used to tailor your report.
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/70">
                    For example, you could mention:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground/70" data-testid="personal-context-hints">
                    {getPersonalContextHintLines(contractTypeChoice).map(
                      (line) => (
                        <li key={line}>• {line}</li>
                      ),
                    )}
                  </ul>
                  <textarea
                    id="pt-personal-context"
                    name="personalContext"
                    value={personalContext}
                    onChange={(e) =>
                      setPersonalContext(e.target.value.slice(0, PERSONAL_CONTEXT_MAX))
                    }
                    placeholder={getPersonalContextPlaceholder(
                      contractTypeChoice,
                    )}
                    rows={4}
                    className="mt-2 block w-full resize-y rounded-md border bg-background px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={PERSONAL_CONTEXT_MAX}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground/50">
                      Short bullet points are fine. Best results: 200 to 800 characters. Max: {PERSONAL_CONTEXT_MAX.toLocaleString()}.
                    </p>
                    <p className="text-[11px] text-muted-foreground/50" data-testid="personal-context-counter">
                      {personalContext.length} / {PERSONAL_CONTEXT_MAX.toLocaleString()}
                    </p>
                  </div>
                </div>

                {generating ? (
                  <div className="mt-5 rounded-xl border border-green-200 bg-green-50/60 p-5" data-testid="progress-panel">
                    <p className="text-sm font-semibold text-green-900">
                      {generateStage}
                    </p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-green-100">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-[1200ms] ease-out"
                        style={{ width: `${generatePct}%` }}
                      />
                    </div>
                    <p className="mt-2.5 text-xs text-green-700/80" data-testid="progress-detail">
                      {generatePct < 30
                        ? ingestResult && ingestUsesLargePipeline
                          ? "Large documents take longer because we review each section in detail. Estimated time: about 6 to 10 minutes."
                          : "We're reading everything carefully. Most reports take 1 to 3 minutes."
                        : generatePct < 70
                          ? ingestResult && ingestUsesLargePipeline
                            ? "Still working on each section. Large documents usually take 6 to 10 minutes total."
                            : "Working through the details."
                          : generatePct < 95
                            ? ingestResult && ingestUsesLargePipeline
                              ? "Large documents can take a bit longer in the final step. Estimated time left: about 1 to 3 minutes."
                              : "Almost ready. Just finishing up."
                            : generateElapsedSec < 60
                              ? "Saving your report now."
                              : generateElapsedSec < 180
                                ? "Still saving. Large reports take a bit longer."
                                : generateElapsedSec < 360
                                  ? "Almost there. The review is still running."
                                  : "This is taking longer than usual, but the review is still running. Please wait."}
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-green-800/60" data-testid="anti-refresh-warning">
                      Please keep this tab open. Refreshing may restart the review.
                    </p>
                  </div>
                ) : (
                  <>
                    {generateError && (
                      <div
                        role="alert"
                        className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                      >
                        {generateError}
                      </div>
                    )}
                    <div className="mt-6 flex justify-center">
                      <Button
                        size="lg"
                        className="gap-2 rounded-lg px-8 font-semibold shadow-sm"
                        onClick={handleGenerateReport}
                        disabled={generating || truncatedBlocked}
                        data-testid="generate-button"
                      >
                        <FileText className="h-4 w-4" />
                        {isTruncatedDoc
                          ? `Review ${selectedSectionCount} selected section${selectedSectionCount !== 1 ? "s" : ""}`
                          : "Generate PlainTerms report"}
                      </Button>
                    </div>
                    {truncatedBlocked && !generating && (
                      <p className="mt-2 text-center text-xs text-amber-700" data-testid="truncated-blocked-hint">
                        {truncatedAndAllSelected
                          ? "Please choose specific sections above to continue."
                          : truncatedAllManuallySelected
                            ? "You cannot review all sections at once. Please deselect at least one."
                            : truncatedTooManySections
                              ? `Please select up to ${effectiveMaxSections} section${effectiveMaxSections !== 1 ? "s" : ""} at a time.`
                              : "Select at least one section to continue."}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row" data-testid="cta-row">
              {!ingestResult && (
                <>
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
                    {ingesting ? "Importing document..." : "Import and analyze"}
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
                </>
              )}
            </div>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Your report is saved for this session.{" "}
              <Link href="/account" className="font-medium text-primary hover:underline">Sign in</Link>{" "}
              to keep it permanently. Your original document text is not kept after analysis.
              This is not legal advice.
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
