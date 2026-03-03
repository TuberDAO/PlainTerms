# PlainTerms

**Consumer contract analyser** — AI-powered plain-language breakdown of what the fine print really means.

> **Phase A (MVP foundation)** — Fixture-driven UI with full page structure, locale support, analytics scaffolding, and Supabase stubs. No real LLM calls yet.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase project URL and anon key (optional for dev)

# 3. (Optional) Apply database schema to Supabase
# Open supabase/schema.sql in Supabase SQL Editor and run it

# 4. Start dev server
npm run dev

# 5. Open http://localhost:3000
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript strict check (`tsc --noEmit`) |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm test` | Run Playwright smoke tests |

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | For email capture | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For email capture | Supabase anonymous key |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional | PostHog analytics key |
| `NEXT_PUBLIC_GA4_ID` | Optional | Google Analytics 4 ID |
| `NEXT_PUBLIC_HOTJAR_ID` | Optional | Hotjar site ID |
| `OPENAI_API_KEY` | Phase B | OpenAI API key (not used yet) |

The app runs fully without Supabase configured — email capture will log to console instead.

## Architecture Overview

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page (9 sections)
│   ├── insurance/          # Vertical: insurance & finance
│   ├── leases/             # Vertical: leases & tenancy (locale-aware)
│   ├── contracts/          # Vertical: consumer contracts
│   ├── examples/           # Example gallery with filters
│   ├── analyze/            # Contract input (paste/upload)
│   ├── report/[id]/        # Report viewer (fixture-driven)
│   ├── pricing/            # Pricing page (copy only)
│   ├── account/            # Auth stub
│   ├── history/            # Report history (empty state)
│   ├── privacy/            # Privacy policy
│   ├── terms/              # Terms of service
│   ├── disclaimer/         # Legal disclaimer
│   └── api/leads/          # Email capture API
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Navbar, Footer
│   ├── landing/            # Landing page sections
│   ├── clause/             # ClauseRevealCard (core conversion component)
│   ├── report/             # Report viewer components
│   ├── analytics/          # AnalyticsProvider, ConsentBanner
│   └── shared/             # CTAButton, SeverityBadge
├── lib/
│   ├── locale/             # Locale detection, terminology map, context
│   ├── analytics/          # Event tracking abstraction
│   ├── supabase/           # Supabase client
│   ├── llm/                # LLM provider interface (stub)
│   ├── taxonomy.ts         # Contract clause taxonomy
│   ├── budget.ts           # Free vs paid access constants
│   └── utils.ts            # cn() utility
├── types/
│   ├── report.ts           # Report, Finding, ClauseCard types
│   └── database.ts         # Supabase table types
├── data/
│   ├── fixtures/           # 3 realistic demo reports
│   └── hero-examples.ts    # Hero clause examples per vertical
├── middleware.ts            # Locale detection from headers
supabase/
└── schema.sql              # Database schema with RLS
tests/
└── smoke.spec.ts           # Playwright smoke tests
```

## Key Components

### ClauseRevealCard
The core conversion component. Toggle between "At first glance" (what most people assume) and "What it really means" (plain meaning + scenario + actions). Uses Framer Motion for smooth transitions.

### Locale System
- Middleware detects locale from `accept-language` and `x-vercel-ip-country` headers
- Persists in a `locale` cookie
- Terminology map adapts copy: "tenancy agreement" (GB) vs "lease agreement" (US) vs "rental agreement" (CA)
- Available via `useLocale()` hook in client components

### Analytics
- Lightweight wrapper supporting PostHog, GA4, and Hotjar via env vars
- Consent banner — analytics OFF by default until accepted
- UTM parameter capture and persistence
- Events: `page_view`, `cta_try_free_scan`, `example_flip_toggle`, `lead_captured`, `analysis_started`, `report_viewed`, `paywall_viewed`, `pricing_viewed`

### Report Viewer
- Fixture-driven (3 demo reports: insurance, lease, consumer contract)
- Preview mode: shows 2–3 findings, remainder blurred behind paywall CTA
- Full mode: all findings, clause cards with 5-section layout, actions, letter templates
- Export buttons stubbed (disabled with "Coming soon" tooltips)

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript (strict)
- **Styling**: Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Supabase (auth + database stubs)
- **Analytics**: PostHog / GA4 / Hotjar (optional, env-driven)
- **Testing**: Playwright
- **Quality**: ESLint + Prettier + strict TypeScript

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase/schema.sql`
3. Copy your project URL and anon key to `.env.local`

## What's Stubbed for Phase B

| Feature | Status | Notes |
|---------|--------|-------|
| LLM analysis engine | Interface defined | `src/lib/llm/provider.ts` — swap in real OpenAI calls |
| PDF/DOCX parsing | UI ready | File upload UI exists; needs server-side parsing |
| Stripe payments | Copy ready | Pricing page exists; needs Stripe integration |
| User auth | Form ready | Account page exists; needs Supabase auth wiring |
| Report history | Empty state ready | Needs auth + database storage |
| PDF export | Button stubbed | Disabled with tooltip |
| Share functionality | Button stubbed | Disabled with tooltip |
| PWA / mobile wrapper | Responsive ready | Add Capacitor configuration |
| Additional verticals | Taxonomy ready | Add fixture data and pages |

## Disclaimer

PlainTerms is not a law firm and does not provide legal advice. All analysis is for educational and informational purposes only.
