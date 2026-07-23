---
name: Project Workflow Fixes & Role Architecture
description: Captures common IDE errors to avoid across agent sessions and documents the client-finalized role architecture (Head of Strategy, Admin/CEO's Assistant, Senior Accountant, Internal Auditor) - see ADR 013 for the full decision record.
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
   - **CRITICAL: NEVER use `font-semibold` or `font-bold` under any circumstances.** These are strictly forbidden site-wide.
   - **`font-medium` inline is acceptable** for subtle weight variation where no semantic class maps precisely.
   - **NO INLINE TEXT SIZING**: Never use arbitrary Tailwind sizing classes like `text-ms`, `text-[15px]`, `text-[42px]`.
   - **USE SEMANTIC CSS** where a matching class exists in `globals.css`: `.headline-lg`, `.headline-md`, `.title-serif`, `.body-md`, `.body-sm`, `.label-caps`, `.text-heading-primary`, `.text-title-primary`, `.text-body-primary`, `.text-body-regular`, `.text-desc-secondary`, `.text-meta-muted`, `.text-meta-muted-strong`.
   - **NUMBERS USE MONO**: ALL numerals (KPIs, stats, prices) must utilize `.font-mono font-medium`, `.mono-data`, or `.mono-amount` rather than generic font rendering.

# Role Architecture (client-finalized, 2026 Q3 - full record in `docs/ARCHITECTURE_DECISIONS.md` ADR 013)

The business development and line management roles have been consolidated comprehensively into **Property Managers**. The two roles this file used to describe as "future sprint" placeholders are now specified by the client. Full roster:

| Role | Slug | Scope | Reports to |
|---|---|---|---|
| CEO | `ceo` | global | - |
| General Manager | `general_manager` | global | CEO |
| **Head of Strategy** | `head_of_strategy` | global | GM |
| Property Manager | `property_manager` | entity | Head of Strategy |
| Head of Finance | `finance_head` | global | GM |
| **Senior Accountant** | `finance_officer` (relabeled) | entity | Finance Head |
| **Internal Auditor** | `auditor_compliance` (relabeled) | global | GM |
| **Admin (CEO's Assistant)** | `admin_assistant` | global | CEO |
| Head of HR | `hr_head` | global | GM |
| Front Office Head | `front_office_head` | global | GM |
| Landlord / Tenant | `landlord` / `tenant` | self | - (external portal, not yet built) |

1. **Head of Strategy**
   - **Responsibility**: Department head over Property Managers, Line Managers, Sales, and Marketers - every commercial/BD-facing function reports through this one role, the same way Finance reports through Finance Head.
   - **Permissions**: full CRM + Properties + Scheduling + Operations oversight (`...keysFor("crm"|"properties"|"scheduling"|"operations")`), plus `identity.user.read`, `settings.entity.read`, `audit.log.read` - mirrors Finance Head's shape. Global scope (department heads are always global - ADR 012 point 3).
   - Sits *above* `property_manager` in the reporting chain; does not merge into it.

2. **Property Managers - confirmed dual scope**
   - Deal with **both** landlords (mandate side) and tenants (by extension, since landlords defer all property-management responsibility to Sunland).
   - Tenant complaints, rent arrears, and miscellaneous charges (see below) are now a Property Manager concern, not Front Office/Ops - the client wants PMs able to **"handle this all dynamically"**, one working surface per property/tenant rather than three siloed pages. No new permissions needed (`property_manager` already holds `...keysFor("properties")`); this is a routing/UI change, documented in `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`.

3. **Senior Accountant** - the `finance_officer` role, relabeled. Same permission scope; the client's job title for what the system already models as day-to-day ledger/transaction work. Proposed mapping, not yet confirmed by the client.

4. **Internal Auditor** - the `auditor_compliance` role, relabeled, **plus a new time-gated access rule**: finance dashboard access activates only 90 days after the role is granted (everything else `auditor_compliance` already holds - org-wide read - is immediate). This is the first time-conditional permission in the system. Recommended mechanism: a `grantedAt` timestamp on `user_roles`, checked inside `authorize()` only for `finance.*` keys when the grant's role is `auditor_compliance` - not a general "probation period" primitive, scoped narrowly to this one case. **Not yet implemented** - decision + mechanism recorded, build is next-sprint.

5. **Admin (CEO's Assistant)** - client left the exact permissions open ("we'll figure how to auth this based on all other roles"), so this is a **proposed** design pending confirmation:
   - **Granted**: `identity.user.read`, `settings.entity.read`, `audit.log.read`, `...keysFor("scheduling")`, `support.ticket.manage`, read-only CRM/Properties (`crm.contact.read`, `crm.lead.read`, `properties.property.read`, `properties.lease.read`, `properties.maintenance.read`) - enough to run the CEO's calendar, triage the support-ticket queue, and brief the CEO on anything.
   - **Excluded**: any `finance.*` (no approval authority), `hr.complaint.manage` (complaints stay confidentiality-gated to HR Head/GM/CEO per HR spec §6.4 - assisting the CEO doesn't extend to complaint content, including ones escalated to the CEO), `identity.role.write`/System Administration (CEO-exclusive, ADR 012).
   - Global scope, reports to CEO.

6. **Tenant/Landlord portal updates** (spec exists, portal not yet built): tenant complaints now route to the assigned Property Manager, not Front Office/Ops. New **Miscellaneous Charges** payment category - water, garbage - joins rent as a tenant-payable charge type. **Electricity is explicitly out of scope**, run on a prepaid token system entirely outside Sunland's ledger.

*Implemented (2026-07-10, ADR 014): `head_of_strategy` as a real catalog role (enum + `catalog.ts` permissions, no seed user yet) - became load-bearing for correct mandate-activation approval routing (a Property Manager or Head of Strategy always needs GM sign-off; a GM/CEO acting within their own authority self-approves, so nothing escalates above the CEO).*

*Still not yet implemented: `admin_assistant` as a real catalog role/seed user, the `grantedAt` time-gate mechanism, the Property Manager unified complaint/arrears/misc-charges view, and the misc-charges schema itself. This file plus ADR 013/014 are the design record for when that build happens.*

# UI/UX Hierarchy & Branding Patterns

To ensure consistent, premium executive-level design throughout the CRM, strictly follow these visual rules:

1. **Role vs. Status Badge Typography**:
   - Role names (e.g. "Sales", "Ops", "Legal") must carry a visually heavier weight (`text-sm font-medium text-slate-700`) than the adjacent status badges.
   - Status badges must be explicitly sized down (e.g. `text-xs`) to let the utility `.label-caps` render appropriately without overwhelming the primary label.

2. **Premium Emerald Branding**:
   - Do NOT use standard Tailwind `bg-emerald-500` or `bg-emerald-600` for primary action buttons or active states.
   - Use the `.bg-tertiary-gradient` class (defined in `globals.css`) for solid fill buttons.
   - For text or subtle backgrounds, use the explicit tertiary emerald css `.bg-tertiary-emerald`.

3. **Title Serif Constraints**:
   - The `.title-serif` class is reserved **exclusively** for high-level Section Headers (e.g., headers that sit directly on the page background, like "Market Insights & Portfolio" or "Revenue Trajectory").
   - Do NOT use `.title-serif` for internal card headers (e.g., inside white `bg-white rounded-[20px]` containers). Internal card headers should use sleek sans-serif typography (e.g., `text-lg font-medium text-slate-900` or `text-base font-medium text-slate-800`).

4. **Environment Variables & Database Setup**:
   - The production branch uses a separate Neon PostgreSQL database URL in `.env`. Ensure that development commands (like `npm run db:seed` or `drizzle-kit` tasks) explicitly load the correct local environment file (e.g., via `--env-file=.env.local` in `package.json`) to avoid connecting to the wrong database instance or falling back to defaults.
   - Do not overwrite or mutate `.env` directly with development credentials if it is configured for production. Rely on `.env.local` for local overrides and ensure both Next.js and TSX scripts respect it.

5. **Premium Card & Button Styling**:
   - **Cards**: Avoid bulky nested grey boxes and dark background top borders. Prefer sleek, modern floating cards using `bg-white border border-slate-100 rounded-[32px]` with soft, premium drop shadows like `shadow-[0_8px_30px_rgb(0,0,0,0.04)]` and hover transitions `hover:shadow-[0_16px_40px_rgb(0,0,0,0.06)]`.
   - **Buttons**: Do NOT use bulky full-width button blocks (e.g., `py-3 rounded-xl` full-width). Prefer elegant ghost pill buttons (e.g., `px-3 py-2 text-sm rounded-lg bg-slate-50`) that reveal the brand accent colors strictly upon hover.
   - **Whitespace**: Creatively utilize card whitespace using massive, faint background watermarks (`absolute -z-10 opacity-60`) or interactive avatar stacks (for metrics like Active Users).

6. **Typography Standardization (No Arbitrary Pixels)**:
   - **NEVER use custom pixel sizing classes** like `text-[15px]`, `text-[28px]`, or `text-[42px]`.
   - Strictly map all typography sizes to semantic Tailwind configurations: `text-xxs` (10px), `text-ms` (12px), `text-xs` (12px/13px), `text-sm`, `text-md`, `text-lg`.

7. **Media Optimization**:
   - Comprehensively remove standard HTML `<img>` tags. Always use the `next/image` `<Image />` component with properly optimized layouts for properties, avatars, and dashboards.

8. **Admin Operations & Components**:
   - Always wire destructive actions (e.g., delete row) to the custom Sunland `<ConfirmDialog>` component rather than native `window.confirm`.
   - Critical "Featured" or "Highlighted" tags should be modeled via explicit database boolean columns (e.g., `isFeatured`) to give admins granular control, rather than relying on automatic logic loops like price-sorting.

9. **Mobile-Responsive Tables**:
   - **CRITICAL**: Do NOT allow standard tables to overflow and force horizontal scrolling on mobile/tablet devices.
   - Implement a responsive split layout:
     - For small screens (using `block lg:hidden`), render rows as rich, structured, card-like blocks.
     - For large screens (using `hidden lg:block`), display the standard full-column table format.
   - Mobile card layouts must pack key metadata densely (e.g., image/initials, status badge, specs, price/rates, and actions) while respecting typography constraints.

10. **Responsive List Wrapping**:
    - **CRITICAL**: Some heavily wrapped components (e.g., the primary list tables in Properties, Leases, and Valuations boards) must discard their outer card shell on mobile viewports.
    - This allows inner items (which are converted to mobile cards per Rule 9) to float freely, preventing "double-boxing" and maximizing usable screen width on mobile devices.
    - Example Implementation: Instead of a hardcoded `bg-white p-8 shadow-sm`, utilize responsive classes to conditionally drop the wrapper: `bg-transparent lg:bg-white border-transparent lg:border-slate-100 p-0 lg:p-8 shadow-none lg:shadow-sm`.
    - **Note:** This does not apply to all components (e.g., individual KPI cards retain their shells), but is essential for heavily nested structural containers holding large collections.

11. **"Command Center" full-view detail page pattern** (established by the Properties module rebuild — `property-full-view-board.tsx` — see `docs/COMPREHENSIVE_REVAMP_WALKTHROUGH.md` §12 for the full writeup; use this as the template for every future module's detail page, e.g. the Leases "Mandate File" rebuild):
    - **Header**: sticky, light background (not the dark gradient used on some older full-view pages), breadcrumb, status pill, overflow `⋮` menu, one adaptive primary CTA that changes based on entity state (e.g. "Review Mandate" only when a decision is actually pending).
    - **Action-required band + rail queue card**: derive the list of "needs attention" items (pending approvals, arrears, critical issues, missing documents) from already-loaded data with **one shared helper**, then render that same derived list in both the top band and a compact context-rail card — never duplicate the derivation logic per surface.
    - **Tabbed workspace**: every tab panel and rail card shares one "Premium Card" shell — `bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]`, `gap-4` between sections, `p-6` card padding. A bespoke card treatment on one tab while the rest use the shared shell is a bug, not a style choice.
    - **Comprehensive activity log**: use `listAuditLog`'s `associatedGroups` filter (`src/lib/services/audit-log.ts`) to pull audit rows across the primary entity *and* every child/related entity in one query — audit rows are written against whichever entity actually changed, never a secondary "which parent record" column, so a single-entity `associatedType`/`associatedId` query alone will always under-report. Generate human-legible summaries with a small `describe*Update(changedKeys, before, after)` helper per service (see `describePropertyUpdate`/`describeMaintenanceUpdate` in `src/lib/services/properties.ts` / `maintenance.ts`) rather than a generic "Updated record" string.
    - **Modals**: every workflow modal a detail page opens (create/edit/decide/override/confirm) uses the shared `@/components/ui/modal` `Modal` primitive — title/description header, `label-caps` field labels, `h-10 rounded-lg border-slate-200` inputs, footer `flex justify-end gap-3 pt-4 border-t border-slate-200`. Bespoke `fixed inset-0` icon-badge-header modal shells are the old pattern and should not be reintroduced.

12. **"Mode switcher" board pattern** (established by the Leases Board rebuild — `leases-board.tsx` — see `docs/COMPREHENSIVE_REVAMP_WALKTHROUGH.md` §13): when a board page needs to represent two related-but-distinct entities (e.g. management mandates vs. individual tenant leases; ADR 014's landlord-primary reframe), add a `mode` state with a segmented-pill control rather than building a second page or discarding the existing view. Keep the KPI tier and hero card shells identical across modes and only swap their data/labels; keep the existing mode's table/filters/pagination/drawer logic completely untouched. **Load a detail-by-own-id service function** (e.g. `getMandateWithDetails`) rather than reusing a parent entity's "currently active child" field (`getPropertyWithDetails's embedded `mandate`) — the parent-scoped field only ever shows the in-flight record and silently drops historical/terminated ones when a detail page needs to show a *specific* record by id.

13. **Stateful workflow artifacts vs. write-once snapshots**: `report_exports` (`src/db/schema/documents.ts`) is a write-once QR-verified snapshot — correct for receipts, but wrong for anything with a real status lifecycle (pending/released/flagged, approved/rejected). For those, build a dedicated table with its own `status` column, but still **write a matching `report_exports` row at generation time** (same `verificationToken`) so the existing public `/fin/reports/verify/[token]` flow authenticates it without a second parallel verification mechanism — see `remittance_advices` / `src/lib/services/finance/remittances.ts`.

14. **Top Navigation & Dropdown Panels (Aesthetic Synchronization)**:
    - **CRITICAL**: All top navigation dropdowns (User Profile, Notifications, Quick Create, Calendar) MUST maintain a strictly unified aesthetic.
    - Do NOT use heavy dark-mode gradient cards, massive drop shadows, or disconnected colorful backgrounds for nested components. They break the premium, cohesive executive feel of the Top Bar.
    - **The Standard Pattern**: Use clean, crisp white panels (`bg-white`) with subtle borders (`border-slate-100/60` or `border-slate-200/70`), flat or subtly tinted headers, and meticulously synchronized nested item containers (e.g., icon boxes strictly using `bg-white border border-slate-100 text-slate-500 shadow-sm` to perfectly match the Quick Create item layouts).
    - Dropdown triggers should remain elegant and understated (e.g., `rounded-xl`, `hover:bg-slate-100/80` or subtle ghost styles) avoiding over-the-top micro-animations (like massive scaling or wild chevron rotations) that feel out of place in an enterprise suite.
