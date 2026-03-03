# PlainTerms — Phase B Defaults (v0)

> Single source of truth for default values, naming conventions, and decision
> rationale. Update this doc when a default changes; keep the TypeScript
> constants in `src/lib/config/plainterms-defaults.ts` in sync.

---

## 1. Report schema version

| Key              | Value            |
| ---------------- | ---------------- |
| `schema_version` | `pt_report_v0`   |

Stored on the `reports` table row **and** optionally inside `report_json`.
Bump the version string when the `report_json` shape changes in a
backwards-incompatible way.

---

## 2. Severity rubric (v0)

All five levels. Tone: calm, factual, never alarmist.

| Level      | Definition                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| `info`     | Neutral observation. No risk, but worth noting for context.                |
| `low`      | Minor disadvantage; standard in most contracts of this type.               |
| `medium`   | Notable term that could cost you money or limit your options.              |
| `high`     | Significant risk. Could lead to unexpected cost, lock-in, or lost rights. |
| `critical` | Severe. Immediate financial or legal exposure if left unaddressed.         |

### Concrete examples

| #  | Example clause pattern                                      | Level      |
| -- | ----------------------------------------------------------- | ---------- |
| 1  | Contract is governed by the laws of [State/Country]         | `info`     |
| 2  | 30-day notice period to cancel                              | `low`      |
| 3  | Auto-renew with email-only notice 14 days before renewal    | `medium`   |
| 4  | Provider may increase fees with 30 days' written notice     | `medium`   |
| 5  | Tenant responsible for minor repairs up to a fixed cap      | `medium`   |
| 6  | Pre-existing condition exclusion window of 12+ months       | `high`     |
| 7  | Unilateral right to change terms without consent            | `high`     |
| 8  | Forced arbitration with provider-chosen arbitrator          | `high`     |
| 9  | Liability cap set far below realistic claim value           | `high`     |
| 10 | Automatic data-sharing with unnamed third parties           | `high`     |
| 11 | Early termination penalty exceeding remaining contract value| `critical` |
| 12 | Waiver of right to class action combined with damages cap   | `critical` |

### What triggers `high`

The clause creates **material financial risk or meaningful loss of rights**
that a reasonable consumer would not expect from the contract type. Examples:
large surprise fees, one-sided change-of-terms powers, forced arbitration.

### What triggers `critical`

The clause creates **immediate, severe exposure** — potential for outsized
financial loss or near-total waiver of consumer protections. Typically involves
a combination of aggressive terms (e.g. forced arbitration + damages cap +
class-action waiver).

---

## 3. Preview defaults

| Setting                      | Value | Notes                                           |
| ---------------------------- | ----- | ----------------------------------------------- |
| `preview_findings_count`     | 2     | First N findings shown in full to free users    |
| `preview_clause_cards_count` | 2     | Matches findings count for consistency           |

**Visible in preview:** verdict header, disclaimer, top N findings, top N
clause cards, export button stubs.

**Blurred / gated:** remaining findings, remaining clause cards, actions
section (questions to ask, letter templates).

> Note: `src/lib/budget.ts` currently has `PREVIEW_FINDINGS_LIMIT = 3`. The
> canonical default going forward is **2**. Migrate `budget.ts` to reference
> `PREVIEW_FINDINGS_COUNT` from the config module when ready.

---

## 4. Retention defaults

### Guest users (no auth session)

- **Current behaviour:** no server-side persistence. Report rendered from
  fixtures or in-memory only.
- **Future default (when guest persistence is added):** 24 hours, then
  hard-delete row + any associated data.
- Constant: `DEFAULT_GUEST_RETENTION_HOURS = 24` (not wired yet).

### Paid / authenticated users

- **Default retention:** 90 days from `created_at`.
- Configurable per-user or per-plan in a future entitlements update.
- Future feature: "Delete my report" button → immediate hard-delete.
- Constant: `DEFAULT_PAID_RETENTION_DAYS = 90`.

---

## 5. Analytics event naming rules

- All event names use **`snake_case`**.
- Prefix with the feature area where practical (e.g. `analyze_`, `report_`,
  `checkout_`).
- Include `locale` and `vertical` in event properties whenever available.
- Do not log PII (email, document text) in event properties.

### Canonical event list

#### Existing (shipped in Phase A)

| Event                              | Fired when                                    |
| ---------------------------------- | --------------------------------------------- |
| `page_view`                        | Any page loads                                |
| `cta_try_free_scan`                | Hero / mid-page / final CTA clicked           |
| `example_flip_toggle`              | Clause Reveal Card toggled on examples page   |
| `lead_captured`                    | Email submitted via /api/leads                |
| `analysis_started`                 | User submits contract for analysis            |
| `report_viewed`                    | Report page renders                           |
| `paywall_viewed`                   | Paywall block enters viewport                 |
| `pricing_viewed`                   | Pricing page loads                            |
| `see_difference_what_to_do_open`   | "What to do next" accordion expanded          |

#### Upcoming (Phase B+)

| Event                    | Fired when                                        |
| ------------------------ | ------------------------------------------------- |
| `analyze_cta_click`      | Any "analyse" CTA clicked (superset of try_free)  |
| `analyze_upload_start`   | File upload or paste begins                       |
| `analyze_parse_success`  | Document successfully parsed before LLM call      |
| `report_preview_view`    | Preview (free) report rendered                    |
| `report_paywall_view`    | Paywall block shown (alias of paywall_viewed)     |
| `checkout_start`         | User initiates payment flow                       |
| `checkout_success`       | Payment confirmed                                 |

---

## 6. Supported locales

`GB`, `US`, `CA`, `AU` — defined in `SUPPORTED_LOCALES`.

Locale affects terminology (e.g. "tenancy agreement" vs "lease agreement"),
spelling, and default currency display. See `src/lib/locale/terminology.ts`.
