import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export const runtime = "nodejs";
import {
  detectFileKind,
  parsePdf,
  parseDocx,
  normalizeText,
  type FileKind,
} from "@/lib/ingest/parse";
import { chunkText } from "@/lib/ingest/chunk";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_EXTRACTED_CHARS = 250_000;

interface IngestResponse {
  ok: true;
  sourceType: FileKind | "text";
  title?: string;
  charCount: number;
  isTruncated: boolean;
  fingerprint: string;
  chunkCount: number;
  chunks: string[];
}

function fingerprint(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  let rawText: string | null = null;
  let sourceType: FileKind | "text" = "text";
  let title: string | undefined;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return jsonError("Missing file field.", 400);
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return jsonError(
          `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.`,
          400,
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const headerBytes = new Uint8Array(arrayBuffer.slice(0, 8));

      const kind = detectFileKind(file.name, file.type, headerBytes);
      if (!kind) {
        return jsonError(
          "Unsupported file type. Please upload a PDF or DOCX.",
          400,
        );
      }

      sourceType = kind;
      title = file.name;

      if (kind === "pdf") {
        const result = await parsePdf(buffer);
        rawText = result.text;
      } else {
        const result = await parseDocx(buffer);
        rawText = result.text;
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json();

      if (!body.text || typeof body.text !== "string") {
        return jsonError("Missing text field.", 400);
      }

      rawText = body.text;
      sourceType = "text";
      title = typeof body.title === "string" ? body.title : undefined;
    } else {
      return jsonError(
        "Unsupported content type. Use multipart/form-data or application/json.",
        400,
      );
    }

    if (!rawText || rawText.trim().length === 0) {
      return jsonError("No text could be extracted from the document.", 400);
    }

    let normalized = normalizeText(rawText);

    let isTruncated = false;
    if (normalized.length > MAX_EXTRACTED_CHARS) {
      normalized = normalized.slice(0, MAX_EXTRACTED_CHARS);
      isTruncated = true;
    }

    const fp = fingerprint(normalized);
    const { chunks, chunkCount } = chunkText(normalized);

    console.log("[ingest]", {
      sourceType,
      charCount: normalized.length,
      chunkCount,
      fingerprintLast4: fp.slice(-4),
      isTruncated,
    });

    const response: IngestResponse = {
      ok: true,
      sourceType,
      title,
      charCount: normalized.length,
      isTruncated,
      fingerprint: fp,
      chunkCount,
      chunks,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[ingest] Parse failure:", (err as Error).message);
    return jsonError("Failed to process document. Please try a different file.", 500);
  }
}
