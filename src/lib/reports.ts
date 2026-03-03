import { createServerClient } from "@/lib/supabase/server";
import { REPORT_SCHEMA_VERSION } from "@/lib/config/plainterms-defaults";
import type { Report } from "@/types/report";
import type { Json } from "@/types/database";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export interface CreateReportInput {
  owner_id: string;
  report_json: Report;
  locale?: string;
  source_type?: string;
  title?: string;
  input_char_count?: number;
  source_fingerprint?: string;
}

export async function createReport(
  input: CreateReportInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("reports")
    .insert({
      owner_id: input.owner_id,
      schema_version: REPORT_SCHEMA_VERSION,
      report_json: input.report_json as unknown as Json,
      locale: input.locale ?? null,
      source_type: input.source_type ?? null,
      title: input.title ?? null,
      input_char_count: input.input_char_count ?? null,
      source_fingerprint: input.source_fingerprint ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[reports] insert failed:", error.code, error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function fetchReportById(
  id: string
): Promise<Report | null> {
  if (!isUUID(id)) return null;

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("reports")
    .select("report_json, status")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return data.report_json as unknown as Report;
}
