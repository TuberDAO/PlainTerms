import { getFixtureReport } from "@/data/fixtures";
import { fetchReportById, isUUID } from "@/lib/reports";
import { createServerClient } from "@/lib/supabase/server";
import { ReportPageClient } from "@/components/report/report-page-client";
import type { Report } from "@/types/report";

export const dynamic = "force-dynamic";

interface ReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;

  let report: Report | null = null;

  if (isUUID(id)) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      report = await fetchReportById(id);
    }
  }

  if (!report) {
    report = getFixtureReport(id) ?? null;
  }

  return <ReportPageClient report={report} />;
}
