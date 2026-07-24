# Comprehensive ERP Revamp Walkthrough

This document compiles and details all the implementations, aesthetic enhancements, routing updates, and database configurations completed since the last git commit. It serves as a verification source and guides the team through the newly introduced features.

---

## 1. Routing & Access Emulation Overhaul

### 1.1 Root Path Redirection
- **Route:** `/` (Main Landing Page)
- **Change:** Updated [page.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/app/page.tsx) to execute `redirect("/login")` rather than loading `/admin` directly. This establishes a clean security boundary for users.

### 1.2 Access Emulation Profiles
- **File:** [page.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/app/(auth)/login/page.tsx)
- **Change:** Configured the `EMULATION_PROFILES` array to display the six primary client roles:
  1. **CEO** (Paul Amos - `ceo` portal: `/admin`)
  2. **GM** (Grace Mutua - `general_manager` portal: `/admin`)
  3. **Finance** (Dennis Munge - `finance_head` portal: `/fin`)
  4. **HR** (Cody Fisher - `hr_head` portal: `/admin/hr`)
  5. **Line Manager / Business Dev** (Jared Omondi - `line_manager` portal: `/admin/pipeline`)
  6. **Front Office** (Sharon Koech - `front_office_head` portal: `/admin/front-office`)
- **Visuals:** Features monospaced initial blocks, clean outline cards, hover shadows, and smooth page transitions upon selection.

### 1.3 Unified Seeding Sync
- **Files:** [seed.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/db/seed.ts) and [route.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/app/api/auth/seed/route.ts)
- **Change:** Appended `line_manager` and `front_office_head` seeded accounts with standard `sunland-demo` password hashing.
- **Verification:** Both CLI-based seeds (`npm run db:seed`) and API-based seeds (POST to `/api/auth/seed`) now register all six users correctly, maintaining identical destructuring indices to ensure standard test pipelines function.

---

## 2. Complete Finance Hub Build-Out

The entire Finance Module structure was built out under `/fin` to support full double-entry ledger bookkeeping, lease mandates, ap/ar control, banker's cheques, and reports:
- **Ledger (`/fin/ledger`):** Supports manual balanced double-entry journal entries with dynamic client-side debit/credit balancing verification.
- **Rentals (`/fin/rentals`):** Direct rent payment posting and collection aging analysis.
- **Mandates (`/fin/mandates`):** Management of owner portfolios with deviation justifications if commission fees differ from 10%.
- **Payroll (`/fin/payroll`):** Handoff sheets for staff commissions, benefits, deductions, and banking allocations.
- **AP/AR (`/fin/ap-ar`):** Tracking of payables (vendor bills) and receivables (client invoices) with state transitions.
- **Cheques (`/fin/cheques`):** Banking deposit clearance dashboard enforcing policy thresholds (cheques above KES 500k route to approvals).
- **Fees (`/fin/fees`):** Valuation fees, tenant application costs, and service charges.
- **Reports (`/fin/reports`):** Auto-generated Trial Balance, Balance Sheet, and Cash Flow Statement layouts.

---

## 3. Visual & Interaction Revamp (Cheques & AP/AR Boards)

### 3.1 Premium Satin Hero Cards
- **Aesthetic:** Upgraded top header cards to a high-end dark metallic satin gradient (`bg-gradient-to-br from-[#070b19] via-[#0f172a] to-[#181534]`) with a thin glow border.
- **Micro-Animations:** Hovering over the active avatar stacks expands the item rail and shifts elements horizontally (`hover:translate-x-1 hover:scale-115`) using smooth cubic-bezier transitions.

### 3.2 Luxury Instrument Dashboard Panels
- **Aesthetic:** The right-side metrics widget displays like a luxury digital dial console.
- **Visuals:** Key balance figures have custom glow shadows, grid borders outline sub-metrics, and pulsing status breathing dots convey state activity.

### 3.3 Authentic Simulated Document Replicas
To increase user trust and make details drawers highly engaging:
1. **Banker's Cheque Replica:**
   - Features a guilloche watermark mesh pattern background.
   - Dotted handwriting alignment lines for *Clearing Bank*, *Payee*, and *KES Amount*.
   - Monospaced routing MICR numbers at the bottom (`⑈ 0098 ⑈  01109288211 ⑈  0123849920 ⑈`).
   - Slanted status ink watermarks (dashed green `CREDITED` or red `RETURNED` stamp).
2. **Vendor Bill Voucher:**
   - Features structured layout displaying vendor details, property allocation, item grids, and approval metadata.
3. **Customer Invoice Tax Card:**
   - Simulated tax invoice sheet displaying client information, line items, VAT summaries, and dynamic status stamps.

### 3.4 Sticky Drawer Action Bars
- **Usability:** Relocated action bars from the scrollable drawers to the native `<Drawer>` sticky `footer` layout.
- **Benefit:** Buttons are permanently pinned at the bottom of the viewport, letting activity timelines scroll independently.

### 3.5 Glassmorphic Input Controls
- **Visuals:** Frosted green summary blocks highlight the document's value at the top of modals.
- **Usability:** Form fields feature absolute-positioned inline icons (e.g., NCBA bank icon, calendars, currency markers) and smooth border transitions upon selection.

---

## 4. People & Statutory Dashboard Revamps

Dedicated, interactive dashboards were created for **Payroll** and **Affordable Housing** under `/fin/payroll` and `/fin/affordable-housing` to replace standard generic tables:

1. **Interactive Payroll Control (`/fin/payroll`):**
   - **Visuals:** Features a deep satin dark indigo gradient header with a glowing digital "Disbursement Console" displaying MTD net outlays.
   - **Runs tab:** Lists cycles. Detail drawer displays a simulated **Payroll Run Handoff Sheet** with department breakdowns and audit logs.
   - **Disbursement Approval Policy:** Create/draft actions are permitted for Line Officers, but the primary "Approve & Disburse" sign-off is restricted to GM and CEO roles.
   - **Payslips tab:** Searchable employee database. Click opens a simulated **Payslip Voucher** displaying basic earnings, deductions, and secure QR marks.
   - **Remittances tab:** Statutory returns control. The "Mark Remitted" modal requires typing payment references and bank accounts to settle obligations.

2. **Affordable Housing Control (`/fin/affordable-housing`):**
   - **Visuals:** Features a green/teal architectural blueprint header aggregates total contributions.
   - **Units tab:** Register units in projects. Registering under new schemes automatically triggers the CEO approval gate, setting status to `Pending` with an amber hold badge.
   - **Allocations tab:** Applicant list. Detail drawer renders the simulated **Eligibility Card** detailing national IDs and scores, with inline assign unit and reject triggers (rejections require notes).
   - **Levy tab:** Displays statutory 3.0% housing levy contributions calculated from payroll disbursements.

---

## 5. Finance Assurance Command Center Revamp

A non-generic, creative reports dashboard was created under `/fin/reports` to manage statements verification:

1. **Assurance Drafting Desk (`/fin/reports/generate`):**
   - Renders a split-screen control desk. Left side displays report type chips (Balance Sheet, Cash Flow, Trial Balance, Mandates, Payroll).
   - Right side features a high-tech **Live Compilation Console** printing progressive compile outputs and generating SHA-256 tokens.

2. **Audit Vault Archive (`/fin/reports/library`):**
   - Renders generated reports as visual folder dossiers in a grid instead of a table. Clicking open a folder card displays a statement preview and QR proof.

3. **Cryptographic Authenticator (`/fin/reports/verify`):**
   - Features a high-tech authenticator scanning terminal with scanning laser animations.
   - Verifying genuine hashes returns signed certified authenticity certificates detailing exactly signed values. Verifying dummy/invalid hashes flags a red integrity breach caution card.

---

## 6. Verification & Safety Gates

- **Type Safety:** Running `npm run typecheck` completes with **0 compilation errors**, confirming all React nodes and Tabler icons have correct TypeScript bindings.
- **Realtime / DB Integrity:** Submissions dynamically post records into the PostgreSQL schema, recalculating metric cards immediately on page reload.

---

## 7. Next.js 16 Proxy Migration & Universal Access Routes

### 7.1 Next.js 16 Edge Proxy Convention
- **File:** [proxy.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/proxy.ts)
- **Change:** Migrated from `middleware.ts` to `proxy.ts` to match the official Next.js 16 Edge Proxy specification. Renamed the exported function from `middleware` to `proxy`.
- **Reasoning:** In Next.js 16.2+, the `proxy.ts` Edge convention manages route guarding, inspecting cookies before dispatching to routes, avoiding build-time dynamic redirects.

### 7.2 Universal White-Listed Access Paths
- **File:** [roles.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/lib/auth/roles.ts)
- **Change:** Introduced `UNIVERSAL_PATHS` and `isUniversalPath()` validator. Whitelisted common account/personal modules:
  - `/admin/profile`
  - `/admin/settings`
  - `/admin/notifications`
  - `/admin/security`
  - `/admin/messages`
- **Behavior:** These routes bypass portal role enforcement. A Finance or HR head can access Settings or Profile directly under `/admin/*` without getting bounced back to their respective portal roots (`/fin` or `/admin/hr`).

---

## 8. Standalone Workspace Settings & Profile CRUD

### 8.1 Standalone Account Settings Portal
- **File:** [page.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/app/(app)/(ceo)/admin/settings/page.tsx)
- **Change:** Built out a rich workspace management system backed by client-side local persistence (rehydrates state synchronously during mount to prevent SSR mismatch).
- **Features:**
  - **Workspace:** Custom timezone selection, fiscal calendar start, regional country controls, and currency tags.
  - **Display:** Active theme switcher (Light / Dark / System), padding density selector, sidebar auto-collapse toggle, and accent hex-color picker.
  - **Notifications:** Segmented switches for digests, push notifications, cheques, lease alerts, and custom frequency periods.
  - **Data Actions:** Export user configurations as JSON files, trigger database cache purges, and reset system profiles.

### 8.2 Live Self-Service Profile CRUD
- **File:** [page.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/app/(app)/(ceo)/admin/profile/page.tsx)
- **Change:** Created a client-side database interface for staff profile edits.
- **Features:**
  - **Photo Upload:** Integrated drag-and-drop FileReader upload previewing image attachments instantly.
  - **Inline Editing:** Full interactive field inputs for contact numbers, emails, and departments displaying animated status spinners during mock network updates.
  - **Security Tab:** Password updates matching complex policy criteria (length, casing, special symbols) with visual strength indicators.
  - **Session Management:** Displays active access sessions (device, location, browser). Supports revoking single external logins or clearing inactive logins in bulk.

---

## 9. banker's Cheque Capture & Cryptographic QR Proofs

### 9.1 Verification QR Proof Upgrades
- **File:** [finance-qr-proof.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/components/finance/finance-qr-proof.tsx)
- **Change:** Upgraded static placeholder codes to functional QR generation using `qrcode.react`.
- **Payload:** Embeds JSON datasets containing standard tracking attributes (amount, date, payer, registry verify link).
- **Features:** Includes PNG downloads for storage and native sharing via the Web Share API.

### 9.2 Banker's Cheque Logging Wizard
- **File:** [cheques-clearance-board.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/components/finance/cheques-clearance-board.tsx)
- **Change:** Created a 3-step wizard in the Cheque Board for logging physical deposits:
  1. **Form Entry:** Captures check values, banks, clearing categories, and references.
  2. **Camera Capture:** Fires user webcam capture fields (`navigator.mediaDevices.getUserMedia`) with alternate file upload fallbacks to attach physical cheque images.
  3. **Verification Receipt:** Generates the secure scannable QR receipt displaying check assets side-by-side.
- **Impurity Safeguard:** Enforces React purity rules by calculating hashes at event-time, preserving stable states during page layouts.

---

## 10. Standalone Account Portals under Finance Route Scopes

### 10.1 Portal Routing Integrity
- **Routes Created:**
  - `/fin/profile`
  - `/fin/settings`
  - `/fin/notifications`
  - `/fin/messages`
  - `/fin/security`
- **Reusability:** Created modular shared views under `src/components/shared/*` which are rendered within both `/admin/*` and `/fin/*` route definitions. This keeps layout state local to the active portal and guarantees the URL prefix never forces a cross-portal redirect to `/admin`.
- **Whitelisted Permissions:** Expanded `UNIVERSAL_PATHS` inside [roles.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/lib/auth/roles.ts) to permit `/fin` prefixes as universal, allowing any authenticated employee in the Finance dashboard to access settings/notifications directly.

### 10.2 Dynamic Portal Prefix Navigation
- **Files Modified:** [top-nav.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/components/layout/top-nav.tsx), [sunland-nav.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/components/layout/sunland-nav.tsx), [mobile-nav.tsx](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/components/layout/mobile-nav.tsx)
- **Mechanism:** Inspects pathnames using `usePathname()`. Resolves links dynamically to `/fin` or `/admin` routes on-the-fly, ensuring the profile dropdown, header icons, and mobile drawer routes remain within the user's active portal boundary.

---

## 11. Elevated Visual Designs and Interactivity

### 11.1 Premium Satin Design Standard
- **Uniform Page Widths:** Raised maximum page width constraints to `max-w-[98rem]` across Settings, Profile, Notifications, Messages, and Security. This matches the exact dimensions of main dashboards, establishing architectural grid uniformity.
- **Design Tokens Integration:** Eliminated all ad-hoc inline text styling and font weights, replacing them with standardized design classes (`.headline-md`, `.text-label`, `.mono-data`, `label-caps`, `badge-pill`) to preserve theme consistency.

### 11.2 Premium Notifications Hub Revamp
- **Aesthetic:** Wrapped header details in deep satin gradient panels matching the commissions board.
- **Interactivity:**
  - **Unread Status:** Styled unread messages with custom left borders and subtle background highlights.
  - **Inspection Drawer:** Clicking a notification opens a custom details modal printing audit logs, transaction parameters, and metadata.
  - **Bulk Actions:** Standardized "Mark all read" and "Clear Read" actions displaying progress spinners during state operations.

### 11.3 Collaborative Messages Center Revamp
- **Layout:** Re-engineered DM & Channels into a professional split-pane chat console.
- **Features:** Grouped message logs by day badges, color-coded bubble states, read/delivery checkmarks, typing indicators, and mock database query auto-replies with push alert triggers.

### 11.4 Security & Key Management Revamp
- **MFA setup wizard:** Setup flow displaying a TOTP barcode setup using `qrcode.react`, secret key copy controls, and verification steps.
- **Security Logs:** Segmented risk indexes (Low / Medium / High) inside scrollable logs displaying IP logs and actors.

---

## 12. Properties Portfolio Module Overhaul (Command Center pattern)

The Properties module (board + detail page + every workflow modal it owns) was rebuilt end-to-end against the Claude Design "Property Command Center" spec and is now the **canonical reference pattern for full-view module pages** — the Leases module rebuild follows this same shape.

### 12.1 Properties Board
- Rebuilt KPI tier to the design's 4-cell spec, added grid/list view toggle with a real grid-card layout, real Property Manager data surfaced throughout (assignment, mini-cards, profile drawer), and owner-click triggers into `PropertyOwnerProfileDrawer`.

### 12.2 Property Details Page (`property-full-view-board.tsx`) — the reference full-view template
- **Sticky, light command header** with adaptive title, status pill, overflow menu, and an adaptive primary CTA (e.g. "Review Mandate" when a decision is pending).
- **Bento hero**: large clickable photo card (opens a lightbox) + a **Vitals card** (tone-adaptive 2×2 metrics, `VITAL_TONE_BG`/`VITAL_TONE_ARTWORK`/`VITAL_TONE_ICON`/`VITAL_TONE_BAR` tone map, `h-[140px]` cards) replacing flat metric rows.
- **Action-required band**: derives pending-mandate / arrears / critical-maintenance / missing-document items from already-loaded data via one shared `usePropertyActionItems`-style helper, rendered both in the band and as a rail "Needs your attention" queue card — one derivation, two surfaces, no drift.
- **Context rail**: Ownership card, Quick Facts, Latest Activity peek (3 most recent audit entries + "View all" → Activity tab), and an inline-decision Management Mandate card (Approve/Reject when pending+CEO-tier, "Decide Directly" override when pending+GM-tier and viewer is CEO).
- **Tabbed workspace** (Overview / Financials / Tenancy / Sales Pipeline / Maintenance / Activity), all sharing the one "Premium Card" shell: `bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]`, `gap-4` section spacing, `p-6` card padding. Overview's metric row reuses the same `MetricTile` component as Financials rather than a bespoke card variant — this is the standard to replicate, not per-tab one-offs.
- **Comprehensive, human-legible activity log**: `listPropertyActivity` (in `src/lib/services/properties.ts`) aggregates audit rows across the property itself *and* every mandate/lease/maintenance-request/document tied to it (`listAuditLog`'s new `associatedGroups` cross-entity filter — see §12.4), since audit rows are written against whichever entity actually changed, never a secondary "which property" column. Summaries are generated by small `describe*Update()` helpers that read the PATCH payload's changed-key list and produce real sentences ("Changed status from X to Y for {name}", "Assigned a contractor to...") rather than generic "Updated property details" text.

### 12.3 Modal shell unification
Every bespoke `fixed inset-0` icon-badge-header modal in the module (`mandate-form-modal.tsx`, `mandate-letter-modal.tsx`, `mandate-override-modal.tsx`, `assign-manager-modal.tsx`, `verify-contact-modal.tsx`, `report-issue-modal.tsx`, `lease-document-modal.tsx`) was migrated onto the shared `@/components/ui/modal` `Modal` primitive — title/description header, no bespoke close button, standard `label-caps` labels + `h-10 rounded-lg border-slate-200` inputs, footer `flex justify-end gap-3 pt-4 border-t border-slate-200`. This closes the last gap against `docs/COMPONENT_STANDARDS.md`'s "no local modal clones" rule and is the pattern every new form/confirmation modal should start from.

### 12.4 Backend: cross-entity audit trail
- `listAuditLog` (`src/lib/services/audit-log.ts`) gained an `associatedGroups?: Array<{type, ids[]}>` filter (OR-matches multiple entity types/ids in one query) and a `LEFT JOIN` to `users` for `actorName` — previously never populated anywhere in the codebase, a global gap affecting every audit-log consumer, not just Properties.
- `decideApprovalRequest` (`src/lib/services/finance/approvals.ts`) gained an additive `overrideNote` param so a CEO deciding directly on a GM-tier pending mandate is distinguishable in the audit trail and notifies the bypassed tier, without any new authorization logic (a CEO already passes `finance.approval.decide` regardless of tier).

**Takeaway for the next module (Leases):** reuse the Command Center shell wholesale — sticky header + bento hero + action band + Premium Card tabs + context rail with an activity peek — and reuse `listAuditLog`'s `associatedGroups` pattern for any "comprehensive activity log" requirement rather than re-deriving it per module.

---

## 13. Leases & Management Mandates Module (mandate-centric rebuild)

Following ADR 014's reframe — Sunland's real clients are landlords, not tenants — the Leases module now has a **mandate-centric register** as its default view, with the old per-tenant lease list preserved as a secondary mode. This is the first module to apply the §12 Command Center pattern to a *new* entity type (a mandate) rather than to Properties itself.

### 13.1 Leases Board (`leases-board.tsx`) — mode switcher
- New `mode: "mandates" | "leases"` state, default `"mandates"`, rendered as a segmented control (same pill-group pattern as the existing status filters). The **existing tenant-lease table/cards/filters/pagination/drawer were kept entirely intact** under the `"leases"` mode — no working code was discarded to build the mandate register.
- **Mandates mode** adds a Mandate Register (columns: Landlord, Property, Manager, Rate, Collection MTD, Remittance-pending pill, Status, row `...` menu), a mode-aware KPI tier (swaps the same 4-cell dark shell's content: Under Management / Expected Rent Roll / Collected MTD / Management Fee MTD instead of Total/Active/Mix/Rent Pool), and a mode-aware "Highlighted Recent" hero card (recently-activated mandates instead of recent leases).
- Row menu actions: Landlord Profile (reuses `PropertyOwnerProfileDrawer` via an on-demand `ownerContactId`-scoped fetch), Message Manager (deep-links to `/admin/messages`), Terminate (reuses the `ConfirmDialog` notes-slot pattern from §12).
- `mandate-form-modal.tsx` gained an optional-`propertyId` picker branch — copied verbatim from `report-issue-modal.tsx`'s "pre-scoped vs board-level picker" pattern — so the board's "New Mandate" action needed no new modal file.

### 13.2 Mandate File (`mandate-full-view-board.tsx`, route `/admin/mandates/[id]`) — Command Center applied to a mandate
Structured identically to `property-full-view-board.tsx`: command header (adaptive CTA — "Decide Directly" only for a CEO viewing a GM-pending mandate) + bento hero (property photo + tone-adaptive Vitals: fee rate, collected MTD, management fee MTD, remittance due) + action-required band (pending decision / remittance pending / arrears / missing mandate letter, one derivation feeding both the band and rail) + Premium Card tabs (Overview terms / Financials / Units & Tenants / Documents / Activity) + context rail (Landlord, Property Manager, Property link, Quick Facts).
- `getMandateWithDetails` (`src/lib/services/mandates.ts`) loads the mandate by its **own id** — not "whichever mandate is currently active on this property" (`getPropertyWithDetails`'s embedded `mandate` field, which misses terminated/historical mandates) — then reuses `getPropertyWithDetails` internally for the leases/documents/collections data that doesn't depend on which mandate is being viewed.
- Activity tab reuses the exact `associatedGroups` cross-entity pattern from §12.4, grouping `property_mandate` + this property's `lease` ids + this mandate's `remittance_advice` ids in one query (`/api/mandates/[id]/activity`).
- Units & Tenants tab reuses `LeaseDetailDrawer` unchanged (no new lease overlay), via the same `LeaseSummary → drawer-shape` adapter pattern established in `property-full-view-board.tsx`.

### 13.3 Remittances — new stateful entity, not a report_exports snapshot
- New `remittance_advices` table (`src/db/schema/finance.ts`): per-period `collectedKes`/`managementFeeKes`/`expensesKes`/`netRemittanceKes`, `status` (`pending`/`released`/`flagged`), its own `verificationToken`. Distinct from `report_exports` (write-once snapshot) because Release/Flag are real state transitions a snapshot can't hold — but **generation still writes a matching `report_exports` row** (same token, `reportType: "remittance_advice"`) so the existing `/fin/reports/verify/[token]` QR-verification flow authenticates it for free, no parallel verification mechanism.
- `src/lib/services/finance/remittances.ts`: `generateRemittanceAdvice` sums the mandate's property's `transactions` (rent/expense) for a caller-chosen period — the exact computation already built for `getPropertyWithDetails`'s `currentPeriod`, generalized from "this month" to any period. `decideRemittanceAdvice` (release/flag) is authorized via `finance.transaction.write`, the same tier as `recordTransaction` — **not** approval-gated, since the design shows Release as a direct PM/Finance action.
- `remittance-advice-panel.tsx`: a `Drawer`-based cheque-style breakdown card wrapping the existing `FinanceQrProof` component (no new QR component built) with Copy/Share/Authenticate + Release/Flag actions.

### 13.4 Scope boundaries (mirrors §12's approach)
- Hub nav's "Scheduler" tab (per the design file) stays "Maintenance" — a design-file inconsistency, not a real requirement, same reasoning as §12.
- No per-mandate chat FAB (design has one) — duplicates the existing global Messages module.
- No landlord/tenant portal status rail card — those portals are still stub `ModulePage` placeholders.

---

## 14. Top Navigation Bar & Global Dropdowns Revamp

A rigorous aesthetic synchronization was applied across the entire Top Navigation Bar to establish a pristine, minimalist, enterprise-grade look and feel.

### 14.1 Dropdown Menus (User Profile, Notifications, Quick Create, Calendar)
- **Aesthetic Synchronization:** All heavy dark-mode gradients, massive box shadows, and inconsistent background colors were completely purged.
- **Pristine White Pattern:** Every panel now uniformly employs a clean `bg-white` layout, utilizing subtle `border-slate-100/60` borders and `shadow-sm` or `shadow-md` drops, matching the Quick Create standard layout identically.
- **Icon Boxes:** Menu item icons strictly utilize a consistent `bg-white border border-slate-100 text-slate-500 shadow-sm` container pattern. Colorful backgrounds (indigo, emerald) were removed to maintain executive coherence.

### 14.2 Trigger Animations & Typography
- **Triggers:** Standardized all top-bar trigger elements (including the user pill) to feature elegant `hover:bg-slate-100/80` state transitions. Over-designed animations (such as 180-degree chevron spins and heavy scaling) were replaced with minimal, tactile `translate-y-px` interactions.
- **Role Badges:** Substituted arbitrary pixel-based sizing (e.g., `text-xxs`, `rounded-[14px]`) with strict semantic Tailwind sizes (`text-xs`, `rounded-xl`). Used the native `<Badge tone="neutral">` component within the user profile card to guarantee structural and typography consistency.

## 15. Operations Scheduler, Projects Board & Messenger (premium rebuild)

Three surfaces that were still basic shells — the Events board, the Projects board and the shared Messenger — were rebuilt to the Claude Design MCP mockups at the bar §13 set for Leases. Full decision record in **ADR 019**; the patterns worth reusing:

- **Unified mode + scope board.** `portfolio-scheduler-board.tsx` (`/admin/scheduler`) carries both a `mode` switcher (Events / Projects) *and* a Personal/Organization `scope` switcher. The scope switcher is only legitimate because the service already had a real axis to bind to (`listCalendarEvents` `scope: "mine" | "all"`, org-wide gated by `scheduling.event.read`). **Never add a scope toggle that filters client-side** — bind it to a real, authorized service parameter or leave it out.
- **A view over two columns, not a new enum value.** The Projects kanban shows Planned / In Progress / **At Risk** / Done, but "at risk" is a flag on work that is still in progress, so it lives beside `status` and the mapping is owned by `boardColumnFor`/`boardStateForColumn` in `scheduler-constants.ts`. A drag writes both fields in one audited service call. Reach for this whenever a board column is a *warning* rather than a *stage*.
- **Shared constants file per module pair.** `scheduler-constants.ts` is cross-imported by the Scheduler and the Projects Board (and its role tiers by the scheduling service), the same pattern as `mandate-constants.ts` / `maintenance-constants.ts` / `account-constants.ts`. Two boards that share a vocabulary must share the file, or they drift.
- **System feeds need a producer.** The Messenger's "System" filter is backed by a real `conversation_type`, appended to by the services that own the events (`finance/remittances.ts` → Ledger, `maintenance.ts` → Maintenance Desk) through a shared `appendSystemMessage`. If a designed feed has no producer, either wire one or drop the feed — do not seed it into existence.
- **Type-scale discipline.** `text-sm`/`text-xs` are the workhorses; `text-xxs` (10px) is reserved for genuine microtext only — uppercase micro-badges, count chips, dark-tier stat captions, mono timestamps, and values that must fit inside a 24px gantt bar. Descriptive sub-labels and body copy are never `text-xxs`.
- **Nav routing.** `getActiveNavItem` matches on pathname and query strings are dropped, so **every nav-visible section needs its own real route**. The Account & System group's four links each render the console at their section via `consoleRouteFor`/`consoleStateForPath` rather than redirecting into one query-string URL — see ADR 019 §19.1.
