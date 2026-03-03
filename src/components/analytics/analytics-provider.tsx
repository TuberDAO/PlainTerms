"use client";

import { useEffect, type ReactNode } from "react";
import { captureUtmParams, track } from "@/lib/analytics/tracker";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    captureUtmParams();
    track("page_view");
  }, []);

  return <>{children}</>;
}
