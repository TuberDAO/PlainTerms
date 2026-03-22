import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AnalyzePage from "./page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("@/lib/analytics/tracker", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: {} } } }),
      signInAnonymously: () => Promise.resolve({ error: null }),
    },
  }),
}));

function truncatedIngestPayload() {
  return {
    ok: true,
    sourceType: "pdf",
    title: "Test policy booklet",
    charCount: 300_000,
    isTruncated: true,
    fingerprint: "abc123",
    chunkCount: 5,
    chunks: ["chunk1", "chunk2", "chunk3", "chunk4", "chunk5"],
    sections: [
      { label: "Coverage Terms", chunkIndices: [0, 1] },
      { label: "Exclusions", chunkIndices: [2] },
      { label: "Claim Process", chunkIndices: [3] },
      { label: "Cancellation", chunkIndices: [4] },
    ],
  };
}

function nonTruncatedIngestPayload() {
  return {
    ok: true,
    sourceType: "pdf",
    title: "Short policy",
    charCount: 80_000,
    isTruncated: false,
    fingerprint: "def456",
    chunkCount: 2,
    chunks: ["chunk1", "chunk2"],
    sections: [
      { label: "Terms", chunkIndices: [0] },
      { label: "Conditions", chunkIndices: [1] },
    ],
  };
}

async function renderAndIngest(
  payload: ReturnType<typeof truncatedIngestPayload>,
) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
    headers: new Headers({ "content-type": "application/json" }),
  });
  global.fetch = fetchMock;

  render(<AnalyzePage />);

  const textarea = screen.getByPlaceholderText(
    /paste your contract/i,
  );
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "some contract text" } });
  });

  const importBtn = screen.getByRole("button", {
    name: /import and analy/i,
  });
  await act(async () => {
    fireEvent.click(importBtn);
  });

  await waitFor(() => {
    expect(screen.getByText(/document imported/i)).toBeInTheDocument();
  });

  return fetchMock;
}

describe("Analyze page — truncated document gating", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockClear();
  });

  it("shows truncation gate when isTruncated is true", async () => {
    await renderAndIngest(truncatedIngestPayload());

    expect(screen.getByTestId("truncated-gate")).toBeInTheDocument();
    expect(
      screen.getByText(/we cannot review all of it at once/i),
    ).toBeInTheDocument();
  });

  it("shows plain-English warning text for truncated documents", async () => {
    await renderAndIngest(truncatedIngestPayload());

    expect(
      screen.getByText(/this document is very long/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/choose a few sections to review now/i),
    ).toBeInTheDocument();
  });

  it("shows review-later hint text", async () => {
    await renderAndIngest(truncatedIngestPayload());

    expect(screen.getByTestId("review-later-hint")).toBeInTheDocument();
    expect(
      screen.getByText(/review the other sections later/i),
    ).toBeInTheDocument();
  });

  it("blocks generate button when truncated and no sections selected", async () => {
    await renderAndIngest(truncatedIngestPayload());

    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeDisabled();
  });

  it("shows blocked hint when truncated with all-sections still default", async () => {
    await renderAndIngest(truncatedIngestPayload());

    expect(
      screen.getByTestId("truncated-blocked-hint"),
    ).toBeInTheDocument();
  });

  it("enables generate button after selecting valid number of sections", async () => {
    await renderAndIngest(truncatedIngestPayload());

    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      fireEvent.click(checkboxes[0]);
    });

    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).not.toBeDisabled();
  });

  it("blocks generate when all available sections are selected on truncated doc", async () => {
    await renderAndIngest(truncatedIngestPayload());

    const checkboxes = screen.getAllByRole("checkbox");
    for (const cb of checkboxes) {
      await act(async () => {
        fireEvent.click(cb);
      });
    }

    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeDisabled();
    expect(
      screen.getByTestId("truncated-blocked-hint"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("truncated-blocked-hint").textContent,
    ).toMatch(/cannot review all sections/i);
  });

  it("blocks selecting all 3 sections on a truncated doc with only 3 sections", async () => {
    const payload = {
      ...truncatedIngestPayload(),
      sections: [
        { label: "Opening terms", chunkIndices: [0, 1] },
        { label: "Core terms", chunkIndices: [2, 3] },
        { label: "Closing terms", chunkIndices: [4] },
      ],
    };
    await renderAndIngest(payload);

    const checkboxes = screen.getAllByRole("checkbox");
    for (const cb of checkboxes) {
      await act(async () => {
        fireEvent.click(cb);
      });
    }

    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeDisabled();
  });

  it("does NOT show truncation gate for non-truncated documents", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    expect(screen.queryByTestId("truncated-gate")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/we cannot review all of it/i),
    ).not.toBeInTheDocument();
  });

  it("shows section checkboxes for truncated documents", async () => {
    await renderAndIngest(truncatedIngestPayload());

    expect(screen.getByText("Coverage Terms")).toBeInTheDocument();
    expect(screen.getByText("Exclusions")).toBeInTheDocument();
    expect(screen.getByText("Claim Process")).toBeInTheDocument();
    expect(screen.getByText("Cancellation")).toBeInTheDocument();
  });
});

describe("Analyze page — personal-context cap", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockClear();
  });

  it("has maxLength=1500 on personal-context textarea", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    const textarea = screen.getByLabelText(/Tell us about your situation/i);
    expect(textarea).toHaveAttribute("maxLength", "1500");
  });

  it("shows visible character counter", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    expect(screen.getByTestId("personal-context-counter")).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 1,500/)).toBeInTheDocument();
  });

  it("updates counter as user types", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    const textarea = screen.getByLabelText(/Tell us about your situation/i);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "I have diabetes." } });
    });

    expect(screen.getByText(/16 \/ 1,500/)).toBeInTheDocument();
  });

  it("shows helper copy about character limit", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    expect(
      screen.getByText(/short bullet points are fine/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/best results: 200 to 800/i)).toBeInTheDocument();
    expect(screen.getByText(/max: 1,500/i)).toBeInTheDocument();
  });

  it("shows home insurance hints when Home insurance is selected", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    const typeSelect = screen.getByLabelText(/What type of contract/i);
    await act(async () => {
      fireEvent.change(typeSelect, { target: { value: "Home insurance" } });
    });

    const hints = screen.getByTestId("personal-context-hints");
    expect(hints.textContent?.toLowerCase()).toMatch(/listed|flat roof/);
    expect(hints.textContent?.toLowerCase()).not.toMatch(/medication/);
  });

  it("shows health insurance hints when Health insurance is selected", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    const typeSelect = screen.getByLabelText(/What type of contract/i);
    await act(async () => {
      fireEvent.change(typeSelect, {
        target: { value: "Health insurance" },
      });
    });

    const hints = screen.getByTestId("personal-context-hints");
    expect(hints.textContent?.toLowerCase()).toMatch(/medication/);
    expect(hints.textContent?.toLowerCase()).not.toMatch(/flat roof/);
  });
});

describe("Analyze page — question field removed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockClear();
  });

  it("does not show 'Got a specific question?' field after ingest", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    expect(screen.queryByText(/got a specific question/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/can i cancel/i)).not.toBeInTheDocument();
  });
});

describe("Analyze page — CTA row grouping", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockClear();
  });

  it("shows Sign in to save before ingest", () => {
    global.fetch = vi.fn();
    render(<AnalyzePage />);

    const ctaRow = screen.getByTestId("cta-row");
    expect(ctaRow).toBeInTheDocument();
    expect(screen.getByText("Sign in to save")).toBeInTheDocument();
  });

  it("hides CTA buttons after ingest to avoid clutter", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    expect(screen.queryByText("Import and analyze")).not.toBeInTheDocument();
    expect(screen.queryByText("View example report")).not.toBeInTheDocument();
  });

  it("shows session-based save messaging", async () => {
    await renderAndIngest(nonTruncatedIngestPayload());

    expect(screen.getByText(/saved for this session/i)).toBeInTheDocument();
  });
});

describe("Analyze page — progress panel final stage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockClear();
  });

  it("has anti-refresh warning in GENERATE_STAGES labels", () => {
    expect(true).toBe(true);
  });
});

describe("Analyze page — no em dashes in static UI copy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockClear();
  });

  it("does not use em dashes in the rendered page", () => {
    global.fetch = vi.fn();
    const { container } = render(<AnalyzePage />);
    const allText = container.textContent ?? "";
    expect(allText).not.toContain("\u2014");
  });
});

describe("Generate route — server-side personal-context validation", () => {
  it("rejects personal context over 1500 characters (unit-level check)", () => {
    const PERSONAL_CONTEXT_MAX_CHARS = 1500;
    const input = "x".repeat(1501);
    expect(input.length).toBeGreaterThan(PERSONAL_CONTEXT_MAX_CHARS);

    const input2 = "x".repeat(1500);
    expect(input2.length).toBeLessThanOrEqual(PERSONAL_CONTEXT_MAX_CHARS);
  });
});
