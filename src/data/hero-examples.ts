import type { HeroExample } from "@/types/report";

export const heroExamples: HeroExample[] = [
  {
    vertical: "insurance",
    clauseLabel: "Pre-Existing Conditions",
    originalTextExcerpt:
      '"The Insurer reserves the right to determine, at its sole discretion, whether any condition constitutes a Pre-Existing Condition, regardless of whether a formal diagnosis was made."',
    atFirstGlance:
      "They won't cover health problems your pet already had. Seems reasonable.",
    whatItMeans:
      "The insurer can decide almost anything counts as pre-existing — even a casual vet note from years ago. A remark about stiffness could be used to deny a future surgery claim worth thousands.",
    scenario:
      "Your vet once noted your dog seemed stiff after a walk. Two years later, your dog needs knee surgery. Claim denied: pre-existing condition.",
    whatToDo: [
      "Ask for a written list of pre-existing conditions before signing.",
      "Request they limit the definition to formally diagnosed conditions.",
    ],
  },
  {
    vertical: "insurance",
    clauseLabel: "Premium Increases",
    originalTextExcerpt:
      '"Premiums are subject to adjustment at each Renewal Date based on claims history and market conditions, without limitation as to the amount of increase."',
    atFirstGlance:
      "Premiums might go up a bit each year. That's normal for insurance.",
    whatItMeans:
      "There's no cap on increases. After filing a couple of claims, your monthly cost could double or triple — pricing you out of coverage when your pet needs it most.",
    scenario:
      "You file two modest claims. At renewal, your premium jumps from $40/month to $95/month. By year three, it's $140/month.",
    whatToDo: [
      "Ask if there's a maximum annual increase percentage.",
      "Compare policies that offer rate-lock guarantees.",
    ],
  },
  {
    vertical: "leases",
    clauseLabel: "Entry Notice Period",
    originalTextExcerpt:
      '"The Landlord may enter the Property upon giving not less than four (4) hours\' notice for inspection, repair, or showing to prospective tenants."',
    atFirstGlance:
      "The landlord can come in for inspections with some notice. Fair enough.",
    whatItMeans:
      "Four hours is far less than the 24-hour minimum in most tenancy guidance. The landlord could text you at 9am and arrive at 1pm — even just to show the property to strangers.",
    scenario:
      "You get a text at 9am saying buyers are viewing at 1pm. You're working from home with no time to prepare.",
    whatToDo: [
      "Ask to amend the notice period to 24 hours minimum.",
      "Request that viewings require your agreement, not just notice.",
    ],
  },
  {
    vertical: "leases",
    clauseLabel: "Deposit Deductions",
    originalTextExcerpt:
      '"The Landlord may deduct from the Deposit amounts reasonably required to remedy damage beyond fair wear and tear, including but not limited to cleaning, redecoration, and replacement."',
    atFirstGlance:
      "They'll take deposit money if you damage the place. That's normal.",
    whatItMeans:
      "'Including but not limited to' means the deduction list is open-ended. Without a proper inventory, the landlord can claim normal ageing of carpets or paint as 'damage' and keep hundreds from your deposit.",
    scenario:
      "After three years, the landlord deducts £1,000 for carpet cleaning and repainting — items that were already worn when you moved in.",
    whatToDo: [
      "Insist on a detailed photographic inventory at check-in.",
      "Confirm the deposit is in a government-approved protection scheme.",
    ],
  },
  {
    vertical: "contracts",
    clauseLabel: "Auto-Renewal & Pricing",
    originalTextExcerpt:
      '"Your subscription will automatically renew at the then-current rate. It is your responsibility to review pricing before each renewal. Cancellation must be submitted 30 days before the next billing date."',
    atFirstGlance:
      "It renews automatically. Just cancel if you don't want it.",
    whatItMeans:
      "The price can increase at any time and they don't have to tell you. You're expected to check their pricing page yourself. Miss the 30-day window and you're charged at the new rate.",
    scenario:
      "You signed up at $9.99/month. Six months later, the price quietly rises to $14.99. You don't notice until it hits your credit card.",
    whatToDo: [
      "Set a calendar reminder 35 days before your billing date.",
      "Ask customer support about price-lock guarantees.",
    ],
  },
  {
    vertical: "contracts",
    clauseLabel: "Content Licence",
    originalTextExcerpt:
      '"By uploading content, you grant the Company a worldwide, royalty-free licence to use, reproduce, modify, and analyse such content for providing and improving the Service."',
    atFirstGlance:
      "They need some rights to your files so the service works. Standard.",
    whatItMeans:
      "'Modify and analyse' goes far beyond storage. 'Improving the Service' could mean using your documents to train AI models or extract business insights — without asking you again.",
    scenario:
      "You store confidential business proposals. The company uses content analysis to build a competing product feature, covered by this licence.",
    whatToDo: [
      "Check if there's an opt-out for content analysis and AI training.",
      "Consider encrypting sensitive files before uploading.",
    ],
  },
];
