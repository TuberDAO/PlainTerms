import type { Report } from "@/types/report";

export const reportLease: Report = {
  id: "demo-lease",
  locale: "GB",
  contractFamily: "leases",
  createdAtISO: "2026-02-27T14:30:00Z",
  isPreview: true,
  verdict: {
    headline: "Some clauses tip the balance in the landlord's favour",
    summary:
      "This residential tenancy agreement is mostly standard, but several clauses give the landlord unusual power over fees, access, and deposit deductions. We found 6 areas to review, 2 of which are high priority.",
    severityOverall: "medium",
    scoreOverall: 55,
  },
  findings: [
    {
      id: "f-lea-1",
      title: "Landlord can enter with just 4 hours' notice",
      severity: "high",
      score: 24,
      tags: ["SoleDiscretion"],
      shortWhy:
        "The required notice period is well below the standard 24 hours, giving the landlord wide access rights.",
      relatedClauseIds: ["c-lea-1"],
    },
    {
      id: "f-lea-2",
      title: "Vague deposit deduction criteria",
      severity: "high",
      score: 22,
      tags: ["SoleDiscretion", "BurdenShift"],
      shortWhy:
        "The landlord can deduct from your deposit for 'damage beyond fair wear and tear' without defining what that means.",
      relatedClauseIds: ["c-lea-2"],
    },
    {
      id: "f-lea-3",
      title: "Early termination fee equals remaining rent",
      severity: "medium",
      score: 18,
      tags: ["PenaltyDisguise", "EscapeHatch"],
      shortWhy:
        "Breaking the lease early means paying all remaining months' rent in full.",
      relatedClauseIds: ["c-lea-3"],
    },
    {
      id: "f-lea-4",
      title: "Rent review clause allows unlimited increases",
      severity: "medium",
      score: 16,
      tags: ["UncappedFees", "UnilateralChange"],
      shortWhy:
        "After the fixed term, rent can be increased by any amount with just one month's notice.",
      relatedClauseIds: ["c-lea-4"],
    },
    {
      id: "f-lea-5",
      title: "Broad tenant repair obligations",
      severity: "low",
      score: 10,
      tags: ["BurdenShift"],
      shortWhy:
        "You may be responsible for repairs that would typically fall to the landlord.",
      relatedClauseIds: ["c-lea-5"],
    },
    {
      id: "f-lea-6",
      title: "No explicit pest control responsibility",
      severity: "low",
      score: 8,
      tags: ["SilentWaiver"],
      shortWhy:
        "The agreement is silent on who handles pest issues, which usually defaults to the tenant.",
      relatedClauseIds: ["c-lea-6"],
    },
  ],
  paywalledFindingsCount: 3,
  clauseCards: [
    {
      clauseId: "c-lea-1",
      clauseLabel: "Landlord Access Rights",
      originalTextExcerpt:
        '"The Landlord or their appointed agent may enter the Property upon giving not less than four (4) hours\' notice for the purposes of inspection, repair, or showing to prospective tenants or buyers."',
      atFirstGlance:
        "The landlord can come in for inspections and repairs. They'll give you some notice.",
      whatItMeans:
        "Four hours is far less than the 24-hour minimum recommended by most tenancy guidance. This could mean the landlord turns up the same afternoon they text you, even for non-urgent reasons like showing the property.",
      scenario:
        "You get a text at 9am saying the landlord is bringing potential buyers at 1pm. You're working from home in your pyjamas with no time to prepare.",
      whatToDo: [
        "Ask to amend the notice period to 24 hours minimum, in line with standard practice.",
        "Request that viewings are limited to reasonable hours and require your agreement.",
      ],
      risks: [
        "Frequent unannounced-feeling visits disrupting your daily life",
        "Potential for landlord to use access clause for pressure tactics",
      ],
    },
    {
      clauseId: "c-lea-2",
      clauseLabel: "Deposit Deductions",
      originalTextExcerpt:
        '"The Landlord may deduct from the Deposit such amounts as are reasonably required to remedy any damage to the Property beyond fair wear and tear, including but not limited to cleaning, redecoration, and replacement of fixtures."',
      atFirstGlance:
        "They'll take money from your deposit if you damage the place. Normal.",
      whatItMeans:
        "The phrase 'including but not limited to' means the list of deductible items is open-ended. Without a detailed inventory and check-in report, the landlord could claim almost anything as damage — even normal ageing of carpets or paint.",
      scenario:
        "After three years, the landlord deducts £400 for 'carpet cleaning' and £600 for 'repainting' from your deposit. The carpet was already worn when you moved in, but there's no check-in report to prove it.",
      whatToDo: [
        "Insist on a detailed, signed, photographic inventory at check-in.",
        "Confirm the deposit is protected in a government-approved scheme.",
      ],
      negotiation: {
        suggestedEdit:
          "Deductions shall be limited to items documented as damaged beyond fair wear and tear, evidenced by comparison with the check-in inventory.",
        fallbackAsk:
          "Can we agree to a joint check-in and check-out inspection with photos?",
      },
    },
    {
      clauseId: "c-lea-3",
      clauseLabel: "Early Termination",
      originalTextExcerpt:
        '"Should the Tenant wish to terminate this Agreement prior to the expiry of the fixed term, the Tenant shall be liable to pay the remaining rent due for the unexpired portion of the term."',
      atFirstGlance:
        "If you leave early, you'll have to pay a fee. Makes sense.",
      whatItMeans:
        "This isn't a fee — it's all the remaining rent. If you're 3 months into a 12-month tenancy, you'd owe 9 months of rent. That could be thousands of pounds with no reduction even if the landlord re-lets the property quickly.",
      scenario:
        "You need to relocate for work 6 months into a 12-month tenancy. You owe £6,000 in remaining rent, even though the landlord finds a new tenant within two weeks.",
      whatToDo: [
        "Negotiate a break clause (e.g. either party can end with 2 months' notice after month 6).",
        "Ask if the landlord will agree to a reasonable re-letting fee instead (typically 1-2 months' rent).",
      ],
    },
    {
      clauseId: "c-lea-4",
      clauseLabel: "Rent Review",
      originalTextExcerpt:
        '"Following the expiry of the initial fixed term, the Landlord may review the Rent payable and increase it by giving the Tenant not less than one (1) month\'s written notice."',
      atFirstGlance:
        "Rent might go up after the fixed term ends. Pretty standard.",
      whatItMeans:
        "There's no cap on how much rent can increase, and one month's notice gives you very little time to find alternative housing if the increase is unaffordable.",
      scenario:
        "Your rent of £1,200/month jumps to £1,600 after the fixed term. You have just 30 days to either accept, negotiate, or find a new place to live.",
      whatToDo: [
        "Ask for a clause limiting increases to a fixed percentage or CPI inflation.",
        "Negotiate for at least 2 months' notice of any rent increase.",
      ],
    },
    {
      clauseId: "c-lea-5",
      clauseLabel: "Tenant Repair Obligations",
      originalTextExcerpt:
        '"The Tenant shall keep the interior of the Property in good repair and condition and shall be responsible for all minor repairs and maintenance including plumbing, electrical fixtures, and appliances."',
      atFirstGlance:
        "You're responsible for keeping the place tidy and handling small fixes.",
      whatItMeans:
        "Plumbing and electrical work are not 'minor repairs' — they can be expensive and in many cases are legally the landlord's responsibility. This clause tries to shift significant maintenance costs onto you.",
      scenario:
        "A pipe bursts under the kitchen sink. The landlord points to this clause and says plumbing is your responsibility. The repair costs £350.",
      whatToDo: [
        "Ask to limit tenant repairs to genuinely minor items (light bulbs, tap washers).",
        "Check local tenancy law — in many jurisdictions, structural and utility repairs are the landlord's duty regardless of what the contract says.",
      ],
    },
    {
      clauseId: "c-lea-6",
      clauseLabel: "Pest Control",
      originalTextExcerpt:
        '"[No clause addressing pest control responsibility is present in this agreement.]"',
      atFirstGlance:
        "Nothing about pests. Probably not an issue.",
      whatItMeans:
        "When a tenancy agreement is silent on pest control, disputes often default against the tenant. If mice or insects appear, you could end up paying for treatment yourself — even if the infestation predates your tenancy.",
      scenario:
        "Mice appear in winter through gaps in the building structure. Because the agreement doesn't say whose problem it is, the landlord claims it's yours. Treatment costs £200-£500.",
      whatToDo: [
        "Ask for a clause making the landlord responsible for pest control related to building structure issues.",
        "Note any signs of pest activity in your check-in inventory.",
      ],
    },
  ],
  actions: {
    recommendedQuestions: [
      "Will you extend the notice period for access to 24 hours?",
      "Is the deposit registered with a protection scheme? Which one?",
      "Can we add a break clause after the first 6 months?",
      "What is the maximum rent increase I could face after the fixed term?",
      "Who is responsible for plumbing and electrical repairs?",
    ],
    letterTemplates: [
      {
        id: "lt-lea-1",
        title: "Request to Amend Access Notice Period",
        body: "Dear [Landlord/Agent],\n\nThank you for providing the tenancy agreement for [Property Address]. Before signing, I would like to discuss the access provisions.\n\nThe current clause allows entry with 4 hours' notice. I would appreciate this being amended to 24 hours' minimum notice, which aligns with standard guidance from housing authorities.\n\nI am happy to be flexible for genuine emergencies.\n\nKind regards,\n[Your Name]",
      },
      {
        id: "lt-lea-2",
        title: "Request for Break Clause",
        body: "Dear [Landlord/Agent],\n\nRegarding the proposed tenancy at [Property Address], I notice the agreement does not include a break clause.\n\nWould you consider adding a mutual break clause allowing either party to end the tenancy with 2 months' notice after the first 6 months? This provides certainty for both sides while allowing flexibility.\n\nI look forward to discussing this.\n\nKind regards,\n[Your Name]",
      },
    ],
  },
};
