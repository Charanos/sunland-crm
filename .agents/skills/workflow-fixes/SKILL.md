---
name: Project Workflow Fixes & Role Architecture
description: Captures common IDE errors to avoid across agent sessions and documents the client-finalized role architecture (Head of Strategy, Admin/CEO's Assistant, Senior Accountant, Internal Auditor) — see ADR 013 for the full decision record.
---

# Common Project Workflow Bugs & Fixes

When working within the Sunland CRM Next.js codebase, please adhere to these guidelines to avoid common IDE errors:

1. **React Hooks Strictness**:
   - Always explicitly import React hooks from `"react"`. Next.js/React does not auto-import `useEffect` globally.
   - **CRITICAL**: Never call `setState` directly (synchronously) inside a `useEffect` body as it causes cascading renders and triggers severe linter errors. If you must set state on mount, use a default value in `useState()`, or defer the state update (e.g., inside an async `fetch.then()`).
   *Error prevented*: `Cannot find name 'useEffect'.`, `Calling setState synchronously within an effect can trigger cascading renders.`

2. **Unused Imports & Variables**:
   Avoid importing UI components (e.g., `Modal`, `ConfirmDialog`, `Drawer`) unless actively rendering them.
   Avoid defining unused state variables or parameters. If a destructured state setter is unused, either omit it or prefix with `_` if convention allows.
   *Error prevented*: `'Modal' is defined but never used.`, `'error' is defined but never used.`

3. **Recharts Tooltip Payload Typing**:
   When implementing `CustomTooltip` for Recharts, do not use `payload?: any[]`. Instead, use a strict type like `payload?: Array<{ payload: ChartDataPoint }>` (where `ChartDataPoint` is your data interface) to satisfy TypeScript without triggering `any` lint errors.
   *Error prevented*: `Unexpected any. Specify a different type.`

4. **Typography Strictness**:
   - **CRITICAL: NEVER use `font-semibold` or `font-bold` under any circumstances.**
   - **NO INLINE TEXT SIZING OR WEIGHTS**: Never use Tailwind utility classes like `text-sm`, `text-3xl`, `font-bold`, `font-semibold`, `font-medium`, `font-normal` inline in components.
   - **USE SEMANTIC CSS**: Rely strictly on classes defined in `globals.css` such as `.headline-lg`, `.headline-md`, `.title-serif`, `.body-md`, `.body-sm`, `.label-caps`, `.text-heading-primary`, `.text-title-primary`, `.text-body-primary`, `.text-body-regular`, `.text-desc-secondary`, `.text-meta-muted`, `.text-meta-muted-strong`.
   - **NUMBERS USE MONO**: ALL numerals (KPIs, stats, prices) must utilize `.mono-stat`, `.mono-data`, or `.mono-amount` rather than generic font rendering.

# Role Architecture (client-finalized, 2026 Q3 — full record in `docs/ARCHITECTURE_DECISIONS.md` ADR 013)

The business development and line management roles have been consolidated comprehensively into **Property Managers**. The two roles this file used to describe as "future sprint" placeholders are now specified by the client. Full roster:

| Role | Slug | Scope | Reports to |
|---|---|---|---|
| CEO | `ceo` | global | — |
| General Manager | `general_manager` | global | CEO |
| **Head of Strategy** | `head_of_strategy` | global | GM |
| Property Manager | `property_manager` | entity | Head of Strategy |
| Head of Finance | `finance_head` | global | GM |
| **Senior Accountant** | `finance_officer` (relabeled) | entity | Finance Head |
| **Internal Auditor** | `auditor_compliance` (relabeled) | global | GM |
| **Admin (CEO's Assistant)** | `admin_assistant` | global | CEO |
| Head of HR | `hr_head` | global | GM |
| Front Office Head | `front_office_head` | global | GM |
| Landlord / Tenant | `landlord` / `tenant` | self | — (external portal, not yet built) |

1. **Head of Strategy**
   - **Responsibility**: Department head over Property Managers, Line Managers, Sales, and Marketers — every commercial/BD-facing function reports through this one role, the same way Finance reports through Finance Head.
   - **Permissions**: full CRM + Properties + Scheduling + Operations oversight (`...keysFor("crm"|"properties"|"scheduling"|"operations")`), plus `identity.user.read`, `settings.entity.read`, `audit.log.read` — mirrors Finance Head's shape. Global scope (department heads are always global — ADR 012 point 3).
   - Sits *above* `property_manager` in the reporting chain; does not merge into it.

2. **Property Managers — confirmed dual scope**
   - Deal with **both** landlords (mandate side) and tenants (by extension, since landlords defer all property-management responsibility to Sunland).
   - Tenant complaints, rent arrears, and miscellaneous charges (see below) are now a Property Manager concern, not Front Office/Ops — the client wants PMs able to **"handle this all dynamically"**, one working surface per property/tenant rather than three siloed pages. No new permissions needed (`property_manager` already holds `...keysFor("properties")`); this is a routing/UI change, documented in `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`.

3. **Senior Accountant** — the `finance_officer` role, relabeled. Same permission scope; the client's job title for what the system already models as day-to-day ledger/transaction work. Proposed mapping, not yet confirmed by the client.

4. **Internal Auditor** — the `auditor_compliance` role, relabeled, **plus a new time-gated access rule**: finance dashboard access activates only 90 days after the role is granted (everything else `auditor_compliance` already holds — org-wide read — is immediate). This is the first time-conditional permission in the system. Recommended mechanism: a `grantedAt` timestamp on `user_roles`, checked inside `authorize()` only for `finance.*` keys when the grant's role is `auditor_compliance` — not a general "probation period" primitive, scoped narrowly to this one case. **Not yet implemented** — decision + mechanism recorded, build is next-sprint.

5. **Admin (CEO's Assistant)** — client left the exact permissions open ("we'll figure how to auth this based on all other roles"), so this is a **proposed** design pending confirmation:
   - **Granted**: `identity.user.read`, `settings.entity.read`, `audit.log.read`, `...keysFor("scheduling")`, `support.ticket.manage`, read-only CRM/Properties (`crm.contact.read`, `crm.lead.read`, `properties.property.read`, `properties.lease.read`, `properties.maintenance.read`) — enough to run the CEO's calendar, triage the support-ticket queue, and brief the CEO on anything.
   - **Excluded**: any `finance.*` (no approval authority), `hr.complaint.manage` (complaints stay confidentiality-gated to HR Head/GM/CEO per HR spec §6.4 — assisting the CEO doesn't extend to complaint content, including ones escalated to the CEO), `identity.role.write`/System Administration (CEO-exclusive, ADR 012).
   - Global scope, reports to CEO.

6. **Tenant/Landlord portal updates** (spec exists, portal not yet built): tenant complaints now route to the assigned Property Manager, not Front Office/Ops. New **Miscellaneous Charges** payment category — water, garbage — joins rent as a tenant-payable charge type. **Electricity is explicitly out of scope**, run on a prepaid token system entirely outside Sunland's ledger.

*Not yet implemented: `head_of_strategy` and `admin_assistant` as real catalog roles/seed users, the `grantedAt` time-gate mechanism, the Property Manager unified complaint/arrears/misc-charges view, and the misc-charges schema itself. This file plus ADR 013 are the design record for when that build happens.*

# UI/UX Hierarchy & Branding Patterns

To ensure consistent, premium executive-level design throughout the CRM, strictly follow these visual rules:

1. **Role vs. Status Badge Typography**:
   - Role names (e.g. "Sales", "Ops", "Legal") must carry a visually heavier weight (`text-sm font-medium text-slate-700`) than the adjacent status badges.
   - Status badges must be explicitly sized down (e.g. `text-xs`) to let the utility `.label-caps` render appropriately without overwhelming the primary label.

2. **Premium Emerald Branding**:
   - Do NOT use standard Tailwind `bg-emerald-500` or `bg-emerald-600` for primary action buttons or active states.
   - Use the `.bg-tertiary-gradient` class (defined in `globals.css`) for solid fill buttons.
   - For text or subtle backgrounds, use the explicit tertiary emerald hex code: `#122a20` (e.g., `text-[#122a20]`, `bg-[#122a20]/10`).

3. **Title Serif Constraints**:
   - The `.title-serif` class is reserved **exclusively** for high-level Section Headers (e.g., headers that sit directly on the page background, like "Market Insights & Portfolio" or "Revenue Trajectory").
   - Do NOT use `.title-serif` for internal card headers (e.g., inside white `bg-white rounded-[20px]` containers). Internal card headers should use sleek sans-serif typography (e.g., `text-lg font-medium text-slate-900` or `text-base font-medium text-slate-800`).

4. **Environment Variables & Database Setup**:
   - The production branch uses a separate Neon PostgreSQL database URL in `.env`. Ensure that development commands (like `npm run db:seed` or `drizzle-kit` tasks) explicitly load the correct local environment file (e.g., via `--env-file=.env.local` in `package.json`) to avoid connecting to the wrong database instance or falling back to defaults.
   - Do not overwrite or mutate `.env` directly with development credentials if it is configured for production. Rely on `.env.local` for local overrides and ensure both Next.js and TSX scripts respect it.
