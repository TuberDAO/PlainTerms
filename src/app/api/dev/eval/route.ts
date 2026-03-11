import { NextRequest, NextResponse } from "next/server";
import { chunkText } from "@/lib/ingest/chunk";
import {
  runReportAnalysis,
  getMaxInputChars,
  type AnalysisInput,
  type AnalysisOptions,
  type OpenAIReasoningEffort,
  type OpenAIVerbosity,
} from "@/lib/llm/openai";
import { computeDiagnostic, type DiagnosticSummary } from "@/lib/eval/diagnostic";
import { resolveContractPolicy } from "@/lib/llm/contract-family-policy";
import {
  buildCompareSideOptions,
  toAnalysisOptions,
  buildSide,
  buildComparisonSummary,
  type CompareResponse,
} from "@/lib/eval/compare";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  Eval case definition                                               */
/* ------------------------------------------------------------------ */

interface EvalCase {
  id: string;
  title: string;
  audienceContext?: string;
  jurisdictionContext?: string;
  contractTypeHint?: string;
  text: string;
  expectedSignals: string[];
  forbiddenSignals: string[];
}

const CASES: EvalCase[] = [
  /* A  -  USA health insurance: network directory + surprise billing + PA */
  {
    id: "us-health-network",
    title: "USA health insurance  -  network directory / surprise billing / prior auth",
    audienceContext: "General consumer",
    jurisdictionContext: "United States",
    contractTypeHint: "Health insurance",
    text: `SECTION 4  -  PROVIDER NETWORK
The Company maintains a provider directory that is updated periodically. The inclusion of a provider in the directory does not guarantee that the provider is currently accepting new patients or is available at the time of your visit. Members are responsible for verifying network status prior to each visit. Out-of-network services are subject to a separate deductible of $5,000 and coinsurance of 40%.

SECTION 7  -  EMERGENCY SERVICES
Emergency services rendered by out-of-network providers at an in-network facility will be covered at the in-network benefit level, subject to the No Surprises Act where applicable. However, non-emergency services rendered by out-of-network providers at in-network facilities (including but not limited to anesthesiologists, radiologists, and pathologists) may result in balance billing to the member for amounts exceeding the plan's allowed amount.

SECTION 9  -  PRIOR AUTHORIZATION
Certain services require prior authorization. Failure to obtain prior authorization may result in denial of the claim or reduced benefits (member pays 50% coinsurance instead of 20%). The list of services requiring prior authorization is published separately and may be updated quarterly without individual notice. Prior authorization does not guarantee payment; all claims remain subject to medical necessity review at time of payment.`,
    expectedSignals: [
      "network directory",
      "out-of-network",
      "surprise billing",
      "balance billing",
      "prior authorization",
      "medical necessity",
    ],
    forbiddenSignals: [],
  },

  /* B  -  Skinny / non-ACA plan */
  {
    id: "us-skinny-plan",
    title: "Non-ACA 'skinny' plan  -  pre-existing exclusions, no MH/Rx",
    audienceContext: "General consumer",
    jurisdictionContext: "United States",
    contractTypeHint: "Health insurance",
    text: `COVERAGE LIMITATIONS
This plan is a limited-benefit indemnity plan and is NOT major medical insurance. This plan does not meet the requirements of the Affordable Care Act (ACA) minimum essential coverage.

PRE-EXISTING CONDITIONS: Any condition for which treatment, diagnosis, or medication was received within the 12-month period prior to the effective date of coverage is excluded from benefits for the first 12 months of continuous coverage.

EXCLUDED SERVICES: The following are not covered: (a) mental health and substance abuse treatment; (b) prescription medications except as specifically listed in the formulary appendix; (c) maternity and newborn care; (d) preventive and wellness services; (e) rehabilitative and habilitative services.

BENEFIT MAXIMUMS: Total benefits paid shall not exceed $250,000 per covered person per plan year. Daily hospital benefit limited to $1,000/day for a maximum of 30 days per plan year.`,
    expectedSignals: [
      "not ACA",
      "pre-existing",
      "mental health",
      "excluded",
      "benefit maximum",
      "limited",
    ],
    forbiddenSignals: [],
  },

  /* C  -  UK PMI: acute vs chronic */
  {
    id: "uk-pmi-chronic",
    title: "UK PMI  -  acute vs chronic definition, coverage stops",
    jurisdictionContext: "United Kingdom",
    contractTypeHint: "Health insurance",
    text: `DEFINITIONS
"Acute condition" means a disease, illness, or injury that is likely to respond quickly to treatment which aims to return you to the state of health you were in immediately before suffering the disease, illness, or injury, or which leads to your full recovery.

"Chronic condition" means a disease, illness, or injury that has one or more of the following characteristics: (a) it needs ongoing or long-term monitoring through consultations, examinations, check-ups, and/or tests; (b) it needs ongoing or long-term control or relief of symptoms; (c) it requires your rehabilitation or for you to be specially trained to cope with it; (d) it continues indefinitely; (e) it has no known cure; (f) it comes back or is likely to come back.

BENEFIT LIMITS FOR CHRONIC CONDITIONS
We will pay for eligible treatment of a chronic condition for a maximum period of 12 months from the date we first pay a benefit for that condition. After this 12-month period, no further benefits will be payable for that condition under this policy, and you will need to seek treatment through the NHS. Ongoing monitoring, maintenance medication, and management of chronic conditions beyond the 12-month period are excluded.`,
    expectedSignals: [
      "chronic",
      "acute",
      "12 month",
      "NHS",
      "coverage stops",
      "ongoing",
    ],
    forbiddenSignals: [],
  },

  /* D  -  AU private health: gap cover + restricted benefits */
  {
    id: "au-private-gap",
    title: "AU private health  -  gap cover + restricted vs excluded benefits",
    jurisdictionContext: "Australia",
    contractTypeHint: "Health insurance",
    text: `GAP COVER ARRANGEMENTS
Where your treating doctor or hospital has a gap cover agreement with us, we will pay the Medicare Benefits Schedule (MBS) fee plus a gap amount. Where there is no gap cover agreement, we will pay only the MBS fee and you are responsible for the difference (known as the "gap" or "out-of-pocket cost"). Gap amounts can vary significantly and are set by individual practitioners. We do not control or limit what practitioners charge above the MBS fee.

RESTRICTED BENEFITS
The following treatments are covered as "restricted" benefits, meaning you will receive a benefit equivalent to what would be paid if you were treated as a public patient in a shared room in a public hospital. Restricted benefits apply to: psychiatric treatment, rehabilitation, palliative care, and cardiac rehabilitation. If you choose to be treated privately for a restricted benefit, the out-of-pocket costs may be substantially higher.

EXCLUDED BENEFITS
The following are not covered under this policy: assisted reproductive services, weight loss surgery, insulin pumps, and joint replacements for persons under age 55.

WAITING PERIODS
A waiting period of 12 months applies for pre-existing conditions and psychiatric services. A 2-month waiting period applies for all other hospital treatments.`,
    expectedSignals: [
      "gap",
      "MBS",
      "out-of-pocket",
      "restricted",
      "excluded",
      "waiting period",
      "pre-existing",
    ],
    forbiddenSignals: [],
  },

  /* E  -  CA extended health: R&C cap + formulary */
  {
    id: "ca-extended-health",
    title: "CA extended health  -  reasonable & customary cap + formulary",
    jurisdictionContext: "Canada",
    contractTypeHint: "Health insurance",
    text: `ELIGIBLE EXPENSES  -  REASONABLE AND CUSTOMARY
Benefits are payable based on the reasonable and customary (R&C) charges for the service or supply in the geographic area where it is provided. If the actual charge exceeds the R&C amount as determined by the insurer, the excess is the responsibility of the plan member. The insurer determines R&C amounts based on surveys of charges made by providers of similar training and experience in the same geographic area. R&C schedules are reviewed annually but may not reflect current market rates.

PRESCRIPTION DRUGS
Coverage for prescription drugs is limited to medications listed on the plan formulary. The formulary is maintained by the plan administrator and is subject to change without notice. Brand-name medications are covered only when no generic equivalent is available. If a brand-name drug is dispensed when a generic equivalent exists, the plan will reimburse only the cost of the generic drug; the member pays the difference plus any applicable copay.

PARAMEDICAL PRACTITIONERS
Coverage for paramedical practitioners (physiotherapy, chiropractic, massage therapy, psychology, naturopathy) is limited to $500 per practitioner category per plan year. Referral from a physician may be required.`,
    expectedSignals: [
      "reasonable and customary",
      "formulary",
      "generic",
      "brand-name",
      "paramedical",
      "out-of-pocket",
    ],
    forbiddenSignals: [],
  },

  /* F  -  Home insurance: averaging / coinsurance underinsurance */
  {
    id: "home-averaging",
    title: "Home insurance  -  averaging / coinsurance underinsurance clause",
    jurisdictionContext: "United Kingdom",
    contractTypeHint: "Home insurance",
    text: `CONDITION OF AVERAGE (UNDERINSURANCE)
If at the time of any loss or damage the sum insured is less than the total replacement cost of the buildings or contents (as applicable), you will be considered your own insurer for the difference and will bear a proportionate share of the loss. This means the amount we pay will be reduced in the proportion that the sum insured bears to the total replacement cost.

EXAMPLE: If your contents are worth £50,000 but you have only insured them for £25,000 (50% of their value), and you suffer a loss of £10,000, we will only pay £5,000 (50% of the loss).

You are responsible for ensuring that the sums insured adequately reflect the full replacement value of your buildings and contents at all times during the period of insurance. We recommend that you review your sums insured annually.`,
    expectedSignals: [
      "averaging",
      "underinsurance",
      "proportionate",
      "replacement cost",
      "sum insured",
    ],
    forbiddenSignals: [],
  },

  /* G  -  Home insurance: roof ACV / depreciation */
  {
    id: "home-roof-acv",
    title: "Home insurance  -  roof ACV / depreciation schedule",
    jurisdictionContext: "United States",
    contractTypeHint: "Home insurance",
    text: `ROOF COVERAGE  -  ACTUAL CASH VALUE
Notwithstanding the replacement cost provisions of this policy, loss or damage to the roof covering (including but not limited to shingles, tiles, membrane, and associated materials) shall be settled on an actual cash value (ACV) basis. Actual cash value is determined as the replacement cost at the time of loss, less depreciation. Depreciation for roofing materials is calculated based on the age and expected useful life of the roof covering as follows:

  - Composition/asphalt shingles: 20-year expected life
  - Metal roofing: 40-year expected life
  - Tile roofing: 50-year expected life

A roof that is 15 years old with a 20-year expected life would be depreciated by 75%.

MATCHING OF MATERIALS AND FINISHES
If a covered loss damages a portion of a surface, finish, or material, we will repair or replace only the damaged portion. We are not responsible for matching the color, texture, or appearance of undamaged portions of the same surface, finish, or material (including but not limited to roofing, siding, flooring, countertops, or paint).`,
    expectedSignals: [
      "actual cash value",
      "depreciation",
      "roof",
      "matching",
      "ACV",
    ],
    forbiddenSignals: [],
  },

  /* H  -  Mobile phone: CPI+ escalator + device financing */
  {
    id: "mobile-cpi-escalator",
    title: "Mobile phone  -  CPI+ escalator + device financing early exit",
    jurisdictionContext: "United Kingdom",
    contractTypeHint: "Mobile phone plan",
    text: `ANNUAL PRICE ADJUSTMENTS
Your monthly charges will increase each April by the Consumer Price Index (CPI) rate published by the Office for National Statistics in January of that year, plus an additional 3.9 percentage points. For example, if CPI is 4%, your charges will increase by 7.9%. This increase applies to your airtime plan charges and is separate from any changes to your device plan payments. This price increase is part of your contract and does not give you the right to cancel without paying an early termination charge.

DEVICE PLAN  -  EARLY TERMINATION
If you cancel your device plan before the end of the agreed term (typically 24 or 36 months), you must pay the remaining balance of the device cost in full immediately. The device plan is a separate credit agreement regulated by the Consumer Credit Act 1974. Your remaining balance as of any date can be obtained by contacting us.

EXIT FEES  -  AIRTIME PLAN
If you cancel your airtime plan during the minimum term, you will be charged an early termination fee equal to the remaining monthly charges for the rest of the minimum term, less a discount we apply at our discretion (typically 1-3%).`,
    expectedSignals: [
      "CPI",
      "price increase",
      "escalator",
      "early termination",
      "device plan",
      "remaining balance",
    ],
    forbiddenSignals: [],
  },

  /* I  -  Gym membership: cancellation loopholes */
  {
    id: "gym-cancel-loophole",
    title: "Gym membership  -  certified mail / in-person cancellation",
    contractTypeHint: "Gym / subscription membership",
    text: `CANCELLATION POLICY
You may cancel your membership after the initial commitment period (12 months) by providing written notice. Cancellation notice must be delivered in one of the following ways ONLY: (a) in person at the club location where you enrolled, by completing a cancellation form and receiving a stamped confirmation copy; or (b) by certified mail, return receipt requested, addressed to our Membership Services department. Cancellation requests sent by regular mail, email, telephone, or through our website or app will not be accepted.

A cancellation processing fee of $49.99 applies. Cancellation becomes effective 30 days after receipt of valid notice; you will be responsible for all charges incurred during this 30-day period.

AUTOMATIC RENEWAL
After the initial 12-month commitment period, your membership will automatically renew on a month-to-month basis at the then-current monthly rate. The then-current rate may differ from your initial contracted rate. Annual maintenance fees of $59.99 are billed each January 1st and are non-refundable.`,
    expectedSignals: [
      "certified mail",
      "in person",
      "cancellation fee",
      "automatic renewal",
      "maintenance fee",
      "30 day",
    ],
    forbiddenSignals: [],
  },

  /* J  -  BNPL / store card: deferred interest */
  {
    id: "bnpl-deferred-interest",
    title: "BNPL / store card  -  deferred interest trap",
    contractTypeHint: "Consumer loan / BNPL / credit",
    text: `DEFERRED INTEREST PROMOTIONAL OFFER
If you make a qualifying purchase of $299 or more, no interest will be charged on that purchase if you pay the full promotional balance by the end of the promotional period (6, 12, or 24 months depending on the offer). If you do NOT pay the full promotional balance by the end of the promotional period, interest will be charged from the original purchase date at the standard annual percentage rate (APR) of 29.99%.

MINIMUM PAYMENTS
During the promotional period, you are required to make minimum monthly payments. Minimum payments are applied first to non-promotional balances, then to promotional balances. Making only minimum payments will NOT pay off the promotional balance by the end of the promotional period.

LATE PAYMENT
If a minimum payment is not received by the due date, the promotional offer may be forfeited, and interest will be charged from the original purchase date. A late payment fee of $41 will apply. Two consecutive late payments will result in a penalty APR of 31.99% applied to all balances.`,
    expectedSignals: [
      "deferred interest",
      "29.99%",
      "promotional",
      "original purchase date",
      "minimum payment",
      "penalty APR",
    ],
    forbiddenSignals: [],
  },

  /* K  -  Negative test: senior audience should NOT see maternity flags */
  {
    id: "us-health-senior-negative",
    title: "Negative test  -  senior audience should not flag maternity/pediatric",
    audienceContext: "Senior / retired",
    jurisdictionContext: "United States",
    contractTypeHint: "Health insurance",
    text: `SECTION 4  -  PROVIDER NETWORK
The Company maintains a provider directory that is updated periodically. Members are responsible for verifying network status prior to each visit. Out-of-network services are subject to a separate deductible of $5,000 and coinsurance of 40%.

SECTION 6  -  MATERNITY AND NEWBORN CARE
Maternity benefits include prenatal visits, labor and delivery, and postnatal care. Coverage for newborn nursery care is included for the first 48 hours following vaginal delivery and 96 hours following cesarean delivery. Pediatric dental and vision coverage is provided for dependents up to age 19.

SECTION 9  -  PRIOR AUTHORIZATION
Certain services require prior authorization. Failure to obtain prior authorization may result in denial of the claim or reduced benefits (member pays 50% coinsurance instead of 20%). The list of services requiring prior authorization is published separately and may be updated quarterly without individual notice.

SECTION 11  -  PRESCRIPTION DRUG FORMULARY
Tier 1 (Generic): $10 copay. Tier 2 (Preferred Brand): $40 copay. Tier 3 (Non-Preferred Brand): $80 copay. Tier 4 (Specialty): 30% coinsurance after deductible, maximum $250/prescription. Step therapy requirements apply to certain medications; you must try the preferred alternative before the non-preferred drug will be covered.`,
    expectedSignals: [
      "prior authorization",
      "out-of-network",
      "formulary",
      "step therapy",
    ],
    forbiddenSignals: [
      "maternity",
      "newborn",
      "pediatric",
      "prenatal",
      "labor and delivery",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Eval summary types                                                 */
/* ------------------------------------------------------------------ */

interface SignalMatch {
  signal: string;
  matchedPhrase: string;
}

/** Metadata about what context was included in the prompt. Safe to expose in dev. */
interface PromptMeta {
  audienceIncluded: boolean;
  jurisdictionIncluded: boolean;
  contractTypeIncluded: boolean;
  personalContextIncluded: boolean;
  questionIncluded: boolean;
  truncationNoteIncluded: boolean;
  adviceMode: string;
  negotiabilityClass: string;
}

interface CaseSummary {
  id: string;
  title: string;
  /** Compact quality diagnostic for this report. */
  diagnostic: DiagnosticSummary | null;
  /** Verdict headline and summary for quick scanning. */
  verdict: { headline: string; summary: string; severityOverall: string; scoreOverall: number } | null;
  /** Clause card labels in order — useful for seeing what topics were covered. */
  topClauseLabels: string[];
  /** Advice mode resolved from contract family / type hint. */
  adviceMode: string;
  /** Negotiability classification resolved from contract family / type hint. */
  negotiabilityClass: string;
  /** Kept for backward compatibility — same as diagnostic.findingsCount. */
  findingsCount: number;
  /** Kept for backward compatibility — same as diagnostic.clauseCardsCount. */
  clauseCardsCount: number;
  /** Kept for backward compatibility — same as diagnostic.letterTemplatesCount. */
  letterTemplatesCount: number;
  expectedHits: string[];
  forbiddenHits: string[];
  signalMatches: SignalMatch[];
  warnings: string[];
  topFindings: { severity: string; title: string; shortWhy: string }[];
  /** Only present when debug=true. */
  promptMeta?: PromptMeta;
  /** Only present when debug=true. Full generated report object. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullReport?: any;
  /** Present on POST results when the analysis included a user question. */
  userQuestion?: string | null;
  userAnswer?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Signal matching helpers                                            */
/* ------------------------------------------------------------------ */

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SYNONYM_MAP: Record<string, string[]> = {
  "coverage stops": [
    "coverage ceases",
    "benefits cease",
    "no further benefits",
    "will not be payable",
    "will not be paid",
    "stops paying",
    "coverage ends",
    "benefits end",
    "excluded after",
    "no longer covered",
  ],
  "surprise billing": [
    "balance billing",
    "unexpected bill",
    "surprise charge",
    "out of network charge",
  ],
  "not aca": [
    "not major medical",
    "does not meet aca",
    "does not meet the requirements of the affordable care act",
    "limited benefit",
    "not minimum essential",
  ],
  "benefit maximum": [
    "benefit limit",
    "annual maximum",
    "lifetime maximum",
    "cap on benefits",
    "maximum benefit",
    "shall not exceed",
  ],
  "out-of-pocket": [
    "out of pocket",
    "member pays the difference",
    "your responsibility",
    "gap amount",
  ],
  "escalator": [
    "price increase",
    "annual increase",
    "cpi plus",
    "cpi +",
    "charges will increase",
    "rate increase",
  ],
  "cancellation fee": [
    "processing fee",
    "early termination fee",
    "exit fee",
    "cancellation charge",
  ],
  "deferred interest": [
    "retroactive interest",
    "interest from the original",
    "interest charged from",
    "backdated interest",
  ],
  "averaging": [
    "condition of average",
    "underinsurance",
    "proportionate share",
    "your own insurer",
    "co insurance",
    "coinsurance clause",
  ],
};

function hasSignal(
  haystack: string,
  signal: string,
): { hit: boolean; matchedPhrase?: string } {
  const normSignal = normalizeForMatch(signal);
  if (haystack.includes(normSignal)) {
    return { hit: true, matchedPhrase: signal };
  }
  const synonyms = SYNONYM_MAP[normSignal] ?? SYNONYM_MAP[signal.toLowerCase()];
  if (synonyms) {
    for (const syn of synonyms) {
      const normSyn = normalizeForMatch(syn);
      if (haystack.includes(normSyn)) {
        return { hit: true, matchedPhrase: syn };
      }
    }
  }
  return { hit: false };
}

function buildContentHaystack(report: {
  verdict: { headline: string; summary: string };
  findings: { title: string; shortWhy: string }[];
  clauseCards: {
    originalTextExcerpt: string;
    atFirstGlance: string;
    whatItMeans: string;
    scenario: string;
  }[];
  actions: { letterTemplates: { title: string; body: string }[] };
}): string {
  const parts: string[] = [
    report.verdict.headline,
    report.verdict.summary,
  ];
  for (const f of report.findings) {
    parts.push(f.title, f.shortWhy);
  }
  for (const c of report.clauseCards) {
    parts.push(
      c.originalTextExcerpt,
      c.atFirstGlance,
      c.whatItMeans,
      c.scenario,
    );
  }
  for (const t of report.actions.letterTemplates) {
    parts.push(t.title, t.body);
  }
  return normalizeForMatch(parts.join(" "));
}

/* ------------------------------------------------------------------ */
/*  Compare-mode helpers                                               */
/* ------------------------------------------------------------------ */

/** Parse compare query params from a URLSearchParams object. */
const VALID_REASONING_EFFORTS: ReadonlySet<string> = new Set([
  "none", "low", "medium", "high", "xhigh",
]);

function parseReasoningEffort(raw: string | null): OpenAIReasoningEffort | undefined {
  if (!raw) return undefined;
  return VALID_REASONING_EFFORTS.has(raw) ? (raw as OpenAIReasoningEffort) : undefined;
}

const VALID_VERBOSITIES: ReadonlySet<string> = new Set(["low", "medium", "high"]);

function parseVerbosity(raw: string | null): OpenAIVerbosity | undefined {
  if (!raw) return undefined;
  return VALID_VERBOSITIES.has(raw) ? (raw as OpenAIVerbosity) : undefined;
}

function parseCompareParams(sp: URLSearchParams) {
  return {
    compare: sp.get("compare") === "1",
    anthropicModel: sp.get("anthropicModel") ?? undefined,
    openaiModel: sp.get("openaiModel") ?? undefined,
    anthropicMaxTokens: sp.has("anthropicMaxTokens")
      ? parseInt(sp.get("anthropicMaxTokens")!, 10) || undefined
      : undefined,
    openaiMaxTokens: sp.has("openaiMaxTokens")
      ? parseInt(sp.get("openaiMaxTokens")!, 10) || undefined
      : undefined,
    temperature: sp.has("temperature")
      ? parseFloat(sp.get("temperature")!) || undefined
      : undefined,
    openaiReasoningEffort: parseReasoningEffort(
      sp.get("openaiReasoningEffort"),
    ),
    openaiVerbosity: parseVerbosity(sp.get("openaiVerbosity")),
    openaiStructured: sp.get("openaiStructured") === "1",
    compareRetries: sp.has("compareRetries")
      ? parseInt(sp.get("compareRetries")!, 10)
      : undefined,
  };
}

/**
 * Run two analyses on the same AnalysisInput and return a CompareResponse.
 * Both sides share identical input, schema, and prompt stack.
 */
async function runCompare(
  input: AnalysisInput,
  compareParams: ReturnType<typeof parseCompareParams>,
  debug: boolean,
  inputId: string,
): Promise<CompareResponse> {
  const aOpts = buildCompareSideOptions("a", compareParams);
  const bOpts = buildCompareSideOptions("b", compareParams);

  const totalInputChars = input.chunks.reduce((s, c) => s + c.length, 0);

  // Run both sides concurrently for speed.
  const [aResult, bResult] = await Promise.allSettled([
    runReportAnalysis(input, toAnalysisOptions(aOpts)),
    runReportAnalysis(input, toAnalysisOptions(bOpts)),
  ]);

  const aReport = aResult.status === "fulfilled" ? aResult.value : null;
  const bReport = bResult.status === "fulfilled" ? bResult.value : null;
  const aError = aResult.status === "rejected"
    ? (aResult.reason instanceof Error ? aResult.reason.message : "Unknown error")
    : undefined;
  const bError = bResult.status === "rejected"
    ? (bResult.reason instanceof Error ? bResult.reason.message : "Unknown error")
    : undefined;

  const aTruncated = totalInputChars > getMaxInputChars("anthropic", aOpts.model);
  const bTruncated = totalInputChars > getMaxInputChars("openai", bOpts.model);

  const aDiag = aReport ? computeDiagnostic(aReport, { truncated: aTruncated }) : null;
  const bDiag = bReport ? computeDiagnostic(bReport, { truncated: bTruncated }) : null;

  const sideA = buildSide(aOpts, aReport, aDiag, aTruncated, debug, aError);
  const sideB = buildSide(bOpts, bReport, bDiag, bTruncated, debug, bError);

  console.log(
    `[eval:compare] id=${inputId} A=${aOpts.backend}/${aOpts.model} findings=${aReport?.findings.length ?? "err"}` +
    ` B=${bOpts.backend}/${bOpts.model} findings=${bReport?.findings.length ?? "err"}`,
  );

  return {
    ranAt: new Date().toISOString(),
    compareMode: true,
    inputId,
    sides: { a: sideA, b: sideB },
    summary: buildComparisonSummary(sideA, sideB),
  };
}

/* ------------------------------------------------------------------ */
/*  GET handler                                                        */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV !== "development"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = process.env.PLAINTERMS_EVAL_SECRET;
  if (secret) {
    const qs = request.nextUrl.searchParams.get("secret");
    if (qs !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const caseFilter = request.nextUrl.searchParams.get("case");
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "3", 10) || 3,
    CASES.length,
  );

  let selected: EvalCase[];
  if (caseFilter) {
    const ids = new Set(caseFilter.split(",").map((s) => s.trim()));
    selected = CASES.filter((c) => ids.has(c.id));
  } else {
    selected = CASES.slice(0, limit);
  }

  const qsBackend = request.nextUrl.searchParams.get("backend");
  const qsModel = request.nextUrl.searchParams.get("model");
  const qsMaxTokens = request.nextUrl.searchParams.get("maxTokens");
  const qsTemperature = request.nextUrl.searchParams.get("temperature");
  const qsRetries = request.nextUrl.searchParams.get("retries");
  const debug = request.nextUrl.searchParams.get("debug") === "true";
  const compareParams = parseCompareParams(request.nextUrl.searchParams);

  const evalBackend =
    qsBackend === "openai" || qsBackend === "anthropic"
      ? qsBackend
      : undefined;

  const evalOptions: AnalysisOptions = {
    ...(evalBackend ? { backend: evalBackend } : {}),
    model:
      qsModel ??
      (evalBackend === "anthropic" ? "claude-sonnet-4-6" : undefined),
    maxOutputTokens: qsMaxTokens
      ? parseInt(qsMaxTokens, 10)
      : evalBackend === "anthropic" ? 2500 : 1200,
    temperature: qsTemperature ? parseFloat(qsTemperature) : 0.2,
    maxRetries: qsRetries !== null ? parseInt(qsRetries, 10) : 0,
  };

  if (dryRun) {
    return NextResponse.json({
      ranAt: new Date().toISOString(),
      mode: "dryRun",
      totalCases: CASES.length,
      selectedCount: selected.length,
      evalOptions,
      cases: selected.map((c) => ({
        id: c.id,
        title: c.title,
        audienceContext: c.audienceContext,
        jurisdictionContext: c.jurisdictionContext,
        contractTypeHint: c.contractTypeHint,
        expectedSignals: c.expectedSignals,
        forbiddenSignals: c.forbiddenSignals,
        textLength: c.text.length,
      })),
    });
  }

  // ---- Compare mode: run both sides on each selected case ----
  if (compareParams.compare) {
    const compareResults = [];
    for (const evalCase of selected) {
      const { chunks, chunkCount } = chunkText(evalCase.text);
      const input: AnalysisInput = {
        chunks,
        chunkCount,
        fingerprint: crypto.createHash("sha256").update(evalCase.id).digest("hex"),
        sourceType: "text",
        audienceContext: evalCase.audienceContext,
        jurisdictionContext: evalCase.jurisdictionContext,
        contractTypeHint: evalCase.contractTypeHint,
      };
      const cmp = await runCompare(input, compareParams, debug, evalCase.id);
      compareResults.push({ id: evalCase.id, title: evalCase.title, ...cmp });
    }
    return NextResponse.json({
      ranAt: new Date().toISOString(),
      mode: "compare",
      selectedCount: compareResults.length,
      results: compareResults,
    });
  }

  const results: CaseSummary[] = [];

  for (const evalCase of selected) {
    const casePolicy = resolveContractPolicy(undefined, evalCase.contractTypeHint);
    try {
      const { chunks, chunkCount } = chunkText(evalCase.text);

      const input: AnalysisInput = {
        chunks,
        chunkCount,
        fingerprint: crypto
          .createHash("sha256")
          .update(evalCase.id)
          .digest("hex"),
        sourceType: "text",
        audienceContext: evalCase.audienceContext,
        jurisdictionContext: evalCase.jurisdictionContext,
        contractTypeHint: evalCase.contractTypeHint,
      };

      // Detect truncation using the same budget logic as runReportAnalysis.
      const resolvedBackend = evalOptions.backend ?? "openai";
      const resolvedModel = evalOptions.model;
      const totalInputChars = chunks.reduce((s, c) => s + c.length, 0);
      const truncated = totalInputChars > getMaxInputChars(resolvedBackend, resolvedModel);

      const report = await runReportAnalysis(input, evalOptions);
      const diagnostic = computeDiagnostic(report, { truncated });
      const haystack = buildContentHaystack(report);

      const expectedHits: string[] = [];
      const signalMatches: SignalMatch[] = [];
      const warnings: string[] = [];

      for (const s of evalCase.expectedSignals) {
        const result = hasSignal(haystack, s);
        if (result.hit) {
          expectedHits.push(s);
          signalMatches.push({ signal: s, matchedPhrase: result.matchedPhrase! });
        } else {
          warnings.push(`Missing expected signal: ${s}`);
        }
      }

      const forbiddenHits: string[] = [];
      for (const s of evalCase.forbiddenSignals) {
        const result = hasSignal(haystack, s);
        if (result.hit) {
          forbiddenHits.push(s);
          warnings.push(`Forbidden signal present: ${s}`);
        }
      }

      if (report.findings.length === 0) {
        warnings.push("No findings produced — report is empty");
      }
      const whys = report.findings.map((f) => f.shortWhy.toLowerCase().trim());
      const wCounts = new Map<string, number>();
      for (const w of whys) wCounts.set(w, (wCounts.get(w) ?? 0) + 1);
      if ([...wCounts.values()].some((n) => n >= 3)) {
        warnings.push("Findings appear repetitive");
      }

      const topFindings = report.findings.slice(0, 5).map((f) => ({
        severity: f.severity,
        title: f.title,
        shortWhy: f.shortWhy,
      }));

      const topClauseLabels = report.clauseCards
        .slice(0, 8)
        .map((c) => c.clauseLabel);

      const promptMeta: PromptMeta = {
        audienceIncluded: !!evalCase.audienceContext,
        jurisdictionIncluded: !!evalCase.jurisdictionContext,
        contractTypeIncluded: !!evalCase.contractTypeHint,
        personalContextIncluded: false,
        questionIncluded: false,
        truncationNoteIncluded: truncated,
        adviceMode: casePolicy.adviceMode,
        negotiabilityClass: casePolicy.negotiabilityClass,
      };

      const summary: CaseSummary = {
        id: evalCase.id,
        title: evalCase.title,
        diagnostic,
        verdict: {
          headline: report.verdict.headline,
          summary: report.verdict.summary,
          severityOverall: report.verdict.severityOverall,
          scoreOverall: report.verdict.scoreOverall,
        },
        topClauseLabels,
        adviceMode: casePolicy.adviceMode,
        negotiabilityClass: casePolicy.negotiabilityClass,
        findingsCount: report.findings.length,
        clauseCardsCount: report.clauseCards.length,
        letterTemplatesCount: report.actions.letterTemplates.length,
        expectedHits,
        forbiddenHits,
        signalMatches,
        warnings,
        topFindings,
        ...(debug ? { promptMeta, fullReport: report } : {}),
      };

      results.push(summary);

      console.log(
        `[eval] case=${evalCase.id} findings=${report.findings.length} clauseCards=${report.clauseCards.length} warnings=${warnings.length}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const debugMeta = (err as Record<string, unknown>)?.anthropicDebug;
      const errorWarnings = [`Error: ${msg}`];
      if (debugMeta) {
        errorWarnings.push(`Anthropic debug: ${JSON.stringify(debugMeta)}`);
      }
      results.push({
        id: evalCase.id,
        title: evalCase.title,
        diagnostic: null,
        verdict: null,
        topClauseLabels: [],
        adviceMode: casePolicy.adviceMode,
        negotiabilityClass: casePolicy.negotiabilityClass,
        findingsCount: 0,
        clauseCardsCount: 0,
        letterTemplatesCount: 0,
        expectedHits: [],
        forbiddenHits: [],
        signalMatches: [],
        warnings: errorWarnings,
        topFindings: [],
      });
      console.log(`[eval] case=${evalCase.id} error`);
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    evalOptions,
    selectedCount: results.length,
    results,
  });
}

/* ------------------------------------------------------------------ */
/*  POST handler — run a custom contract through the eval pipeline     */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV !== "development"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = process.env.PLAINTERMS_EVAL_SECRET;
  if (secret) {
    const qs = request.nextUrl.searchParams.get("secret");
    if (qs !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 200) {
    return NextResponse.json(
      { error: "text is required and must be at least 200 characters" },
      { status: 400 },
    );
  }

  const audienceContext =
    typeof body.audienceContext === "string"
      ? body.audienceContext.trim() || undefined
      : undefined;
  const jurisdictionContext =
    typeof body.jurisdictionContext === "string"
      ? body.jurisdictionContext.trim() || undefined
      : undefined;
  const contractTypeHint =
    typeof body.contractTypeHint === "string"
      ? body.contractTypeHint.trim() || undefined
      : undefined;
  const personalContext =
    typeof body.personalContext === "string"
      ? body.personalContext.trim().slice(0, 500) || undefined
      : undefined;
  const question =
    typeof body.question === "string"
      ? body.question.trim() || undefined
      : undefined;

  const effectiveAudience = audienceContext;

  const qsBackend = request.nextUrl.searchParams.get("backend");
  const qsModel = request.nextUrl.searchParams.get("model");
  const qsMaxTokens = request.nextUrl.searchParams.get("maxTokens");
  const qsTemperature = request.nextUrl.searchParams.get("temperature");
  const qsRetries = request.nextUrl.searchParams.get("retries");
  const debug = request.nextUrl.searchParams.get("debug") === "true";
  const postCompareParams = parseCompareParams(request.nextUrl.searchParams);

  const evalBackend =
    qsBackend === "openai" || qsBackend === "anthropic"
      ? qsBackend
      : undefined;

  const evalOptions: AnalysisOptions = {
    ...(evalBackend ? { backend: evalBackend } : {}),
    model:
      qsModel ??
      (evalBackend === "anthropic" ? "claude-sonnet-4-6" : undefined),
    maxOutputTokens: qsMaxTokens
      ? parseInt(qsMaxTokens, 10)
      : evalBackend === "anthropic" ? 2500 : 1200,
    temperature: qsTemperature ? parseFloat(qsTemperature) : 0.2,
    maxRetries: qsRetries !== null ? parseInt(qsRetries, 10) : 0,
  };

  // ---- Compare mode for POST ----
  if (postCompareParams.compare) {
    const { chunks, chunkCount } = chunkText(text);
    const fingerprint = crypto
      .createHash("sha256")
      .update("custom-compare-" + Date.now())
      .digest("hex");
    const input: AnalysisInput = {
      chunks,
      chunkCount,
      fingerprint,
      sourceType: "text",
      audienceContext,
      jurisdictionContext,
      contractTypeHint,
      personalContext,
      question,
    };
    const cmp = await runCompare(input, postCompareParams, debug, "custom");
    return NextResponse.json(cmp);
  }

  try {
    const { chunks, chunkCount } = chunkText(text);

    const input: AnalysisInput = {
      chunks,
      chunkCount,
      fingerprint: crypto
        .createHash("sha256")
        .update("custom-" + Date.now())
        .digest("hex"),
      sourceType: "text",
      audienceContext: effectiveAudience,
      jurisdictionContext,
      contractTypeHint,
      personalContext,
      question,
    };

    const resolvedBackend = evalOptions.backend ?? "openai";
    const resolvedModel = evalOptions.model;
    const totalInputChars = chunks.reduce((s, c) => s + c.length, 0);
    const truncated = totalInputChars > getMaxInputChars(resolvedBackend, resolvedModel);

    const report = await runReportAnalysis(input, evalOptions);
    const diagnostic = computeDiagnostic(report, { truncated });

    const topFindings = report.findings.slice(0, 5).map((f) => ({
      severity: f.severity,
      title: f.title,
      shortWhy: f.shortWhy,
    }));

    const topClauseLabels = report.clauseCards
      .slice(0, 8)
      .map((c) => c.clauseLabel);

    const warnings: string[] = [];
    if (report.findings.length === 0) {
      warnings.push("No findings produced — report is empty");
    }

    const postPolicy = resolveContractPolicy(undefined, contractTypeHint);
    const promptMeta: PromptMeta = {
      audienceIncluded: !!audienceContext,
      jurisdictionIncluded: !!jurisdictionContext,
      contractTypeIncluded: !!contractTypeHint,
      personalContextIncluded: !!personalContext,
      questionIncluded: !!question,
      truncationNoteIncluded: truncated,
      adviceMode: postPolicy.adviceMode,
      negotiabilityClass: postPolicy.negotiabilityClass,
    };

    const result: CaseSummary = {
      id: "custom",
      title: "custom",
      diagnostic,
      verdict: {
        headline: report.verdict.headline,
        summary: report.verdict.summary,
        severityOverall: report.verdict.severityOverall,
        scoreOverall: report.verdict.scoreOverall,
      },
      topClauseLabels,
      adviceMode: postPolicy.adviceMode,
      negotiabilityClass: postPolicy.negotiabilityClass,
      findingsCount: report.findings.length,
      clauseCardsCount: report.clauseCards.length,
      letterTemplatesCount: report.actions.letterTemplates.length,
      expectedHits: [],
      forbiddenHits: [],
      signalMatches: [],
      warnings,
      topFindings,
      userQuestion: report.userQuestion ?? null,
      userAnswer: report.userAnswer ?? null,
      ...(debug ? { promptMeta, fullReport: report } : {}),
    };

    console.log(
      `[eval] case=custom findings=${report.findings.length} clauseCards=${report.clauseCards.length}`,
    );

    return NextResponse.json({
      ranAt: new Date().toISOString(),
      evalOptions,
      selectedCount: 1,
      results: [result],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const debugMeta = (err as Record<string, unknown>)?.anthropicDebug;
    const errorWarnings = [`Error: ${msg}`];
    if (debugMeta) {
      errorWarnings.push(`Anthropic debug: ${JSON.stringify(debugMeta)}`);
    }
    return NextResponse.json({
      ranAt: new Date().toISOString(),
      evalOptions,
      selectedCount: 1,
      results: [
        {
          id: "custom",
          title: "custom",
          diagnostic: null,
          verdict: null,
          topClauseLabels: [],
          findingsCount: 0,
          clauseCardsCount: 0,
          letterTemplatesCount: 0,
          expectedHits: [],
          forbiddenHits: [],
          signalMatches: [],
          warnings: errorWarnings,
          topFindings: [],
        },
      ],
    });
  }
}
