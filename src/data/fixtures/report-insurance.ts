import type { Report } from "@/types/report";

export const reportInsurance: Report = {
  id: "demo-insurance",
  locale: "US",
  contractFamily: "insurance",
  createdAtISO: "2026-02-28T10:00:00Z",
  isPreview: true,
  verdict: {
    headline: "Several clauses need your attention",
    summary:
      "This pet insurance policy contains some common industry terms, but a few clauses could leave you paying more than expected or unable to claim when you need to. We found 7 clauses worth reviewing, 3 of which are high priority.",
    severityOverall: "high",
    scoreOverall: 62,
  },
  findings: [
    {
      id: "f-ins-1",
      title: "Pre-existing condition exclusion is broader than usual",
      severity: "high",
      score: 28,
      tags: ["SoleDiscretion", "BurdenShift"],
      shortWhy:
        "The insurer decides what counts as pre-existing, and the definition is unusually wide.",
      relatedClauseIds: ["c-ins-1"],
      impactType: "coverage",
      actionTiming: "before-signing",
      decisionRelevance: "decision-critical",
    },
    {
      id: "f-ins-2",
      title: "Premium can increase at any renewal without cap",
      severity: "high",
      score: 25,
      tags: ["UncappedFees", "UnilateralChange"],
      shortWhy:
        "Your premium can go up by any amount each year with no ceiling.",
      relatedClauseIds: ["c-ins-2"],
      impactType: "cost",
      actionTiming: "before-renewal",
      decisionRelevance: "decision-critical",
    },
    {
      id: "f-ins-3",
      title: "Claim filing window is very narrow",
      severity: "medium",
      score: 18,
      tags: ["TimeTrap"],
      shortWhy:
        "You have just 15 days to submit a claim after treatment, or it may be denied.",
      relatedClauseIds: ["c-ins-3"],
      impactType: "admin-trap",
      actionTiming: "before-claim",
      decisionRelevance: "important",
    },
    {
      id: "f-ins-4",
      title: "Automatic renewal with 60-day cancellation notice",
      severity: "medium",
      score: 15,
      tags: ["AutoRenew", "TimeTrap"],
      shortWhy:
        "The policy renews automatically and requires 60 days written notice to cancel.",
      relatedClauseIds: ["c-ins-4"],
      impactType: "renewal",
      actionTiming: "before-cancellation",
      decisionRelevance: "important",
    },
    {
      id: "f-ins-5",
      title: "Dispute resolution limited to binding arbitration",
      severity: "medium",
      score: 14,
      tags: ["ForcedArbitration"],
      shortWhy:
        "You cannot go to court; all disputes must go through their chosen arbitration process.",
      relatedClauseIds: ["c-ins-5"],
      impactType: "weak-remedy",
      actionTiming: "if-problem-occurs",
      decisionRelevance: "monitor",
    },
    {
      id: "f-ins-6",
      title: "Payout cap per incident is low relative to market",
      severity: "low",
      score: 10,
      tags: ["DamagesCap"],
      shortWhy:
        "The maximum payout per incident is lower than comparable policies.",
      relatedClauseIds: ["c-ins-6"],
      impactType: "coverage",
      actionTiming: "before-claim",
      decisionRelevance: "monitor",
    },
    {
      id: "f-ins-7",
      title: "Broad data sharing with third-party partners",
      severity: "low",
      score: 8,
      tags: ["DataGrab"],
      shortWhy:
        "Your personal and claims data may be shared with unnamed partner organizations.",
      relatedClauseIds: ["c-ins-7"],
      impactType: "privacy",
      actionTiming: "ongoing",
      decisionRelevance: "background",
    },
  ],
  paywalledFindingsCount: 4,
  clauseCards: [
    {
      clauseId: "c-ins-1",
      clauseLabel: "Pre-Existing Conditions",
      originalTextExcerpt:
        '"The Insurer reserves the right to determine, at its sole discretion, whether any condition, symptom, or irregularity noted in veterinary records constitutes a Pre-Existing Condition, regardless of whether a formal diagnosis was made."',
      atFirstGlance:
        "They won't cover health problems your pet already had. That seems fair enough.",
      whatItMeans:
        "The insurer can look back through all your vet records and decide that almost anything counts as pre-existing — even if no vet ever gave it a name. A casual note about limping could be used to deny a future orthopaedic claim.",
      scenario:
        "Your vet once noted your dog seemed stiff after a long walk. Two years later, your dog needs knee surgery. The insurer finds that old note and rejects the entire claim as pre-existing.",
      whatToDo: [
        "Ask the insurer to define exactly what records they review and how far back they look.",
        "Request a pre-approval check before taking out the policy, so you know what's excluded upfront.",
      ],
      goDeeper:
        "In many jurisdictions, insurers must use a reasonable standard for pre-existing conditions. A vet's casual observation shouldn't carry the same weight as a formal diagnosis.",
      risks: [
        "High-value claims denied based on minor historical notes",
        "No appeals process specified for pre-existing determinations",
      ],
      negotiation: {
        suggestedEdit:
          "Pre-existing conditions shall be limited to those formally diagnosed by a licensed veterinarian.",
        fallbackAsk:
          "Can you provide a written list of what specific conditions you consider pre-existing for my pet before I sign?",
      },
    },
    {
      clauseId: "c-ins-2",
      clauseLabel: "Premium Adjustments",
      originalTextExcerpt:
        '"Premiums are subject to adjustment at each Renewal Date. The Insurer may modify premium rates based on claims history, age of the insured animal, and prevailing market conditions, without limitation as to the amount of increase."',
      atFirstGlance:
        "Premiums might go up a bit each year as your pet gets older. Standard stuff.",
      whatItMeans:
        "There is no cap on how much your premium can increase. After a couple of claims, you could see your annual cost double or triple, effectively pricing you out of coverage when you need it most.",
      scenario:
        "You file two claims in year one totalling $1,200. At renewal, your premium jumps from $40/month to $95/month. By year three, it's $140/month, making the policy unaffordable.",
      whatToDo: [
        "Ask if there is a maximum annual increase percentage (e.g. 15% cap).",
        "Compare policies that offer rate-lock guarantees or lifetime pricing.",
      ],
      risks: [
        "Premiums may become unaffordable after making legitimate claims",
        "No recourse if increase feels unreasonable",
      ],
    },
    {
      clauseId: "c-ins-3",
      clauseLabel: "Claim Filing Deadline",
      originalTextExcerpt:
        '"All claims must be submitted within fifteen (15) calendar days of the date of treatment. Claims received after this period may be denied at the Insurer\'s discretion."',
      atFirstGlance:
        "You need to send in your claim within a couple of weeks. Just don't forget.",
      whatItMeans:
        "Fifteen days is tight, especially if you're dealing with a sick pet, waiting for itemised vet bills, or simply didn't realise the clock was ticking. Miss the window by even a day and they can refuse to pay.",
      scenario:
        "Your cat has emergency surgery on a Friday. You're focused on recovery care. By the time you gather all the paperwork and submit online, it's day 17. Claim denied.",
      whatToDo: [
        "Set a calendar reminder immediately after any vet visit to file the claim.",
        "Ask whether they accept provisional claims that you can complete later.",
      ],
    },
    {
      clauseId: "c-ins-4",
      clauseLabel: "Auto-Renewal & Cancellation",
      originalTextExcerpt:
        '"This policy shall automatically renew for successive twelve-month periods unless the Policyholder provides written notice of cancellation not fewer than sixty (60) days prior to the Renewal Date."',
      atFirstGlance:
        "The policy renews automatically so you stay covered. Convenient.",
      whatItMeans:
        "You need to remember to cancel in writing at least two months before your renewal date. If you miss that window, you're locked in for another full year — even if your premium has jumped significantly.",
      scenario:
        "You decide to switch providers after seeing a 50% premium increase. But your renewal is in 45 days. You're stuck paying the higher rate for another 12 months.",
      whatToDo: [
        "Note the exact renewal date and set a reminder 90 days before.",
        "Ask if email counts as 'written notice' or if they require posted mail.",
      ],
    },
    {
      clauseId: "c-ins-5",
      clauseLabel: "Dispute Resolution",
      originalTextExcerpt:
        '"Any dispute arising under or in connection with this policy shall be resolved exclusively through binding arbitration administered by the American Arbitration Association."',
      atFirstGlance:
        "If there's a disagreement, there's a process to sort it out.",
      whatItMeans:
        "You give up your right to sue in court or join a class action. Arbitration is private, the insurer typically picks the provider, and outcomes generally favour repeat corporate users.",
      scenario:
        "The insurer wrongly denies claims for hundreds of policyholders using the same clause interpretation. Each person must fight individually through arbitration rather than joining forces in court.",
      whatToDo: [
        "Check if your state limits mandatory arbitration in insurance contracts.",
        "Ask if they offer mediation as a first step before arbitration.",
      ],
    },
    {
      clauseId: "c-ins-6",
      clauseLabel: "Per-Incident Payout Cap",
      originalTextExcerpt:
        '"The maximum benefit payable per Covered Incident shall not exceed two thousand five hundred dollars ($2,500), inclusive of all related treatments and follow-up care."',
      atFirstGlance:
        "$2,500 per incident should cover most vet visits.",
      whatItMeans:
        "For anything beyond a routine visit — surgery, specialist referral, ongoing treatment — $2,500 can be used up quickly. The cap includes all follow-up, so a single incident could leave you thousands out of pocket.",
      scenario:
        "Your dog needs emergency surgery ($3,800) plus two follow-up visits ($400 each). Total cost: $4,600. Insurance pays $2,500. You pay $2,100.",
      whatToDo: [
        "Compare per-incident caps across providers — many offer $5,000–$10,000.",
        "Consider whether an annual cap policy might give you more flexibility.",
      ],
    },
    {
      clauseId: "c-ins-7",
      clauseLabel: "Data Sharing",
      originalTextExcerpt:
        '"We may share your personal information, including claims data, with our affiliates, business partners, and service providers for purposes including but not limited to marketing, analytics, and product development."',
      atFirstGlance:
        "They might share some info with partners. Most companies do this.",
      whatItMeans:
        "Your pet's health history, your claims patterns, and personal details can be shared with unnamed third parties for marketing. This data could affect your ability to get insurance elsewhere.",
      scenario:
        "You apply for a new pet insurance policy. The new insurer already has your claims history from a shared database and offers you a higher premium or excludes conditions based on it.",
      whatToDo: [
        "Ask for a specific list of which partners receive your data.",
        "Request to opt out of marketing-related data sharing.",
      ],
    },
  ],
  actions: {
    recommendedQuestions: [
      "Can you provide a written list of what you consider pre-existing for my pet before I commit?",
      "Is there a cap on annual premium increases?",
      "Do you accept email as written cancellation notice?",
      "What is the appeals process if a claim is denied?",
      "Can I opt out of data sharing with marketing partners?",
    ],
    letterTemplates: [
      {
        id: "lt-ins-1",
        title: "Request for Pre-Existing Condition Clarification",
        body: "Dear [Insurance Provider],\n\nI am considering your pet insurance policy [Policy Number/Name] and would like clarification before proceeding.\n\nSpecifically, I would like to understand:\n1. How do you define a 'pre-existing condition'?\n2. How far back in veterinary records do you review?\n3. Can you provide a written determination of any pre-existing conditions for my pet before I sign up?\n\nI look forward to your response within 14 business days.\n\nSincerely,\n[Your Name]",
      },
      {
        id: "lt-ins-2",
        title: "Premium Increase Cap Enquiry",
        body: "Dear [Insurance Provider],\n\nI am writing regarding my policy [Policy Number]. I note that the terms allow premium adjustments without limitation.\n\nCould you please confirm:\n1. Is there a maximum percentage by which my premium can increase at renewal?\n2. What factors specifically influence premium changes?\n3. Are there any rate-lock options available?\n\nThank you for your time.\n\nSincerely,\n[Your Name]",
      },
    ],
  },
  userQuestion: null,
  userAnswer: null,
};
