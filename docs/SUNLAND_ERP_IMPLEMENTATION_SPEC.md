# Sunland ERP Implementation Spec

**Document status:** Supersedes `SUNLAND_CRM_IMPLEMENTATION_SPEC.md` in scope, not in design.
**Version:** 2.0 (CRM → ERP scope expansion)
**Owner:** Dennis Munge
**Carries forward unchanged:** Terrain Identity design system, the built CEO/GM Executive Overview, the Entity Switcher, the Operations & Maintenance module, and all production UI primitives (Toast, Modal, Drawer, Confirm Dialog).

---

## 0. Document Control & Scope Shift

Sunland CRM began as a contact, listing, and pipeline tool for a real estate group. This document records its evolution into a **Real Estate Enterprise Resource Planning (ERP) system**: one platform that runs Finance, HR, Business Development, Front Office, and Executive oversight for all four Sunland divisions, instead of a system that just tracks contacts and deals.

Three decisions anchor everything below:

1. **Finance is the core engine, not a department.** Every other module either feeds Finance data (HR payroll hours, Line Manager mandate expenses, Front Office petty cash) or consumes Finance output (Executive reporting, approval thresholds). Finance is built first and built deepest.
2. **Every department gets its own dashboard.** There is no shared "staff view." Finance, HR, Line Managers, and Front Office each get a distinct landing dashboard scoped to their data, sitting beneath the existing CEO/GM Executive Overview rather than replacing it.
3. **Nothing moves money or changes a record of consequence without a defined approval path.** Where a process can be abused, delayed, or disputed, this spec names who signs off: Line Manager, Department Head, GM, or CEO.

What this document does **not** do: it does not touch the visual design, the entity-switching mechanism, or the Operations module that are already built. Those are treated as the reference implementation that every new module must match stylistically. See Section 2.

---

## 1. Tech Stack (unchanged)

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Database | PostgreSQL via Neon |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS v4 |
| Client state | Zustand |
| Server state / data fetching | TanStack Query |
| Animation | Framer Motion |
| Icons | Tabler Icons |
| Real-time | Pusher Channels |
| Caching | Upstash Redis |
| Forms & validation | React Hook Form + Zod |

No new framework-level dependencies are introduced by the ERP expansion. New libraries are limited to narrow, well-justified additions:

- `qrcode` (or `qrcode.react` for client-side rendering) for the Finance QR retrieval feature (Section 7.1.9).
- A PDF/Excel export library already evaluated for the CRM's reporting needs (reuse, do not re-evaluate).

---

## 2. Locked Foundations (Do Not Modify)

These exist, work, and are the visual and architectural contract every new ERP module must honor. They are described here for reference, not for revision.

### 2.1 Terrain Identity Design System

- **Sunland Yellow** `#f3df27` with navy text `#151936`, hover `#e6d220` — primary actions only.
- **Brand Dark** `#151936` — sidebar, active tabs, section headers, pagination, primary chart strokes. The legacy teal `#15464e` is retired; it must not reappear in any new module.
- **Semantic accents:** `emerald-500/20` + `emerald-300` for resolved/positive/on-track states; `rose-500/20` + `rose-300` for critical/overdue/in-deficit states. New modules introducing their own states (e.g. "Pending GM Approval") choose from this existing semantic palette rather than inventing new ones, with one allowed addition: an amber/`amber-500/20` + `amber-300` tone reserved specifically for "Awaiting Approval" states across Finance, HR, and BD, since the ERP expansion introduces approval queues that the original two-tone palette didn't need to express.
- **Typography:** `title-serif` (Cormorant Garamond, `font-normal`/300) for page and section titles; `font-mono` (JetBrains Mono) for every KES amount, date, ticket ID, mandate reference, and payroll reference. Body copy uses figtree. Font weights are capped at 500 across the entire product; `font-semibold` and `font-bold` are not used anywhere, including in new Finance and HR screens where the instinct to bold currency totals must be resisted in favor of size and color contrast instead.
- **Currency:** all KES values format through the existing `formatCompactKES()` in `src/lib/utils/format.ts`. No module computes its own currency string.

### 2.2 Entity Context

The Global Entity Context (`useUIStore`, `src/store/ui.ts`) already scopes the dashboard to one of the four divisions: Sunland Group (consolidated), Commercial, Residential, Valuers. Every new ERP table and query carries `entity_id`, and every new dashboard respects `activeEntityId` the same way the existing `DashboardOverview` does. Department dashboards do not get their own entity switcher; they read the same global one.

### 2.3 Component Architecture to Reuse, Not Recreate

- **Board layout pattern** (`UnifiedMarketBoard` / `operations-board.tsx`): unified header with title, subtitle, segmented filter pills, global search; an analytics tier of 3–4 KPI cards; a data tier of a table or grid below. Every new department dashboard is this same skeleton with different data.
- **Modal system:** size variants, scroll lock, scale-in animation, backdrop close. Used for every "create/log/request" action.
- **Drawer system:** right-side slide-in, sticky footer, scroll lock. Used for every "view full detail" action.
- **Confirm Dialog:** required for every destructive or financially consequential action (voiding a journal entry, rejecting a mandate, declining a leave request).
- **Toast system:** four tones, auto-dismiss with progress bar. Every CRUD action in every new module fires a toast. No silent success states.
- **State management discipline:** derived state during render, no `useEffect`-driven prop syncing, matching the pattern already established in `dashboard-overview.tsx`.
- **Pagination:** 5–8 rows per page on every data table, no exceptions, including the longer Finance ledgers.

New modules that deviate from this list are not "ERP-flavored," they're inconsistent. Section 12 (UI/UX Standards) restates this as a hard gate.

---

## 3. RBAC & Organizational Hierarchy

### 3.1 Hierarchy

```
CEO (Owner / Super Admin)
 └─ GM (second-in-command, cross-departmental sign-off)
     ├─ Finance Head
     │   ├─ Accountant / Finance Officer
     │   ├─ Rentals & Mandates Officer
     │   └─ Payroll Officer
     ├─ HR Head
     │   └─ HR Officer
     ├─ Line Manager (per division: Commercial / Residential / Valuers)
     │   └─ BD Agent
     ├─ Front Office Head
     │   ├─ Front Office Admin / Receptionist
     │   └─ Driver
     ├─ Operations Lead (existing, from the Maintenance module)
     │   └─ Field Technician / Contractor liaison
     └─ Valuer (Sunland Valuers Ltd staff)
```

Auditor / Compliance is a cross-cutting, read-only role (Section 3.3) rather than a line position.

### 3.2 Role Matrix

| Role | Finance | HR | BD / Line Mgr | Front Office | Operations | Approvals |
|---|---|---|---|---|---|---|
| CEO | Full | Full | Full | Full | Full | Final approver, all thresholds |
| GM | Full | Full | Full | Full | Full | Primary approver, all thresholds below CEO tier |
| Finance Head | Full | View payroll-linked data only | View | View | View costs | Approves Finance-internal items below GM threshold |
| Finance Officer | Edit (own queue) | None | None | None | None | None |
| Rentals & Mandates Officer | Edit (rentals, mandates) | None | View (landlord data) | None | None | None |
| Payroll Officer | Edit (payroll, remittances) | View (time logs) | None | None | None | None |
| HR Head | View (payroll summary) | Full | View | View | None | Approves leave, credentials, interview outcomes |
| HR Officer | None | Edit (own queue) | None | None | None | None |
| Line Manager | View (own mandates) | View (own team) | Full (own division) | Request only | None | Initiates, does not approve |
| BD Agent | None | View (own record) | Edit (own listings/leads) | None | None | None |
| Front Office Head | View (own petty cash) | None | View | Full | None | Approves vehicle/logistics requests below threshold |
| Front Office Admin | None | None | None | Edit (own queue) | None | None |
| Driver | None | None | None | View (own assignments) | None | None |
| Operations Lead | View (repair costs) | None | None | None | Full | Approves contractor spend below threshold |
| Valuer | None | View (own record) | View (valuation requests) | None | None | None |
| Auditor / Compliance | View (all, read-only) | View (all, read-only) | View (all, read-only) | View (all, read-only) | View (all, read-only) | None (observes only) |

This expands the existing 16-role matrix from the base CRM playbook to accommodate the new departments; it does not replace it. Existing roles (e.g. Sales Agent, Listing roles already defined for the CRM's Front Office of property listings) map onto BD Agent and Line Manager above rather than being duplicated.

### 3.3 Approval Engine (cross-cutting, new in this spec)

A generic, polymorphic approval system underlies every "needs sign-off" workflow described in Section 4 and Section 7, instead of bespoke approval logic per module:

```
approval_requests
  id, entity_id, request_type, related_table, related_id,
  requested_by (user_id), requested_at, amount (nullable),
  required_approver_role (GM | CEO | DEPT_HEAD),
  status (pending | approved | rejected | escalated),
  decided_by (user_id, nullable), decided_at (nullable),
  decision_notes (nullable), escalated_from (nullable, self-referential)
```

Every department dashboard that can generate an approval request surfaces a small "Awaiting Approval" widget pulling from this table, filtered to that department. The CEO and GM each get a unified **Approvals Queue** (Section 7.5.2) pulling across all departments. This is the single piece of net-new shared infrastructure the ERP expansion requires before any department module is meaningfully usable, so it sits in Phase 0 of the build plan (Section 13).

---

## 4. Cross-Department Workflows

These are the interconnections the CRM never needed and the ERP cannot work without. Each is implemented as: a trigger action in one module, a state change visible in another, and (where relevant) an `approval_requests` row.

### 4.1 Company Vehicle Request

Line Manager submits a vehicle request (purpose, date, destination) → Front Office checks fleet availability → if available and within standard use, Front Office assigns directly → if unavailable or the trip implies external hire cost, Front Office raises an `approval_requests` row to GM → GM approves/declines → Line Manager and Front Office are notified via Pusher and Toast.

### 4.2 Payroll → Finance Remittance

HR finalizes a payroll run from aggregated time logs → payroll run is pushed to Finance as a draft → Finance reviews net pay and statutory deduction totals (PAYE, NSSF, NHIF/SHIF, Affordable Housing Levy) → Finance raises an `approval_requests` row to GM for disbursement → on approval, Finance marks the run as disbursed and generates the remittance schedule for statutory bodies. CEO sees the total payroll cost on the Executive dashboard regardless of approval involvement.

### 4.3 Mandate Letter Flow

Line Manager negotiates terms with a landlord → drafts mandate terms in the BD module → Front Office formalizes the mandate letter (templated document, Section 7.4.4) → an `approval_requests` row is raised to GM (mandate value or unit count above a configurable threshold also requires CEO) → on approval, Finance activates the mandate record (Section 7.1.4) and rental collection tracking begins.

### 4.4 Property Mandate Expense Reimbursement

Line Manager logs a property-level petty cash expense (repairs, watchman wages, site costs) against a specific mandate → Finance reviews the expense against the mandate's collected-amount ledger → expenses under the configured threshold are deducted from the next landlord remittance automatically → expenses above threshold raise an `approval_requests` row to GM before being applied.

### 4.5 Promotion / Demotion

HR Head initiates a role change request → the employee's direct line (Line Manager or Department Head) endorses or contests it → GM approves → CEO approval is additionally required when the change crosses a department-head-level salary band or affects a Head-level role.

### 4.6 Banker's Cheque Verification

Front Office or Finance logs a received cheque as `deposited` → no ledger entry is created yet → on bank confirmation, Finance marks it `credited`, which is the only state that creates a journal entry → cheques that bounce are marked `returned` and trigger a debtor follow-up task instead of a ledger entry.

### 4.7 Default Approval Thresholds

These are starting defaults, intentionally configurable per entity in a settings table rather than hardcoded, since Sunland leadership may want to tune them after observing real volumes.

| Process | Auto-approve under | GM required | CEO required |
|---|---|---|---|
| Property petty cash expense | KES 5,000 | KES 5,000 – 50,000 | above KES 50,000 |
| Office petty cash expense | KES 10,000 | KES 10,000 – 50,000 | above KES 50,000 |
| Vehicle request (in-fleet) | n/a, Front Office discretion | external hire required | n/a |
| Mandate activation | n/a | always | above 10 units or KES 5M annualized collectible |
| Payroll disbursement | never | always | informational only |
| Promotion / demotion | never | non-Head roles | Head-level roles |
| Banker's cheque crediting | below KES 500,000 | above KES 500,000 (dual sign-off with Finance Head) | n/a |

---

## 5. Finance Module (the Core Engine)

Finance is built first, built deepest, and every other module is written to feed it clean data rather than duplicate its logic. This is the section the rest of the spec defers to whenever money is involved.

### 5.1 General Ledger & Chart of Accounts

Standard double-entry structure: `accounts` (chart of accounts: asset/liability/equity/revenue/expense, entity-scoped), `journal_entries` (header: date, reference, memo, entity_id), `journal_lines` (entry_id, account_id, debit, credit). Every other Finance subsystem below writes to this ledger rather than maintaining its own parallel total. This is the architectural decision that makes the balance sheet and cash flow statement derivable rather than separately maintained, and it is the single most important rule in this section: **no subsystem invents its own "balance"; every balance is a query over `journal_lines`.**

### 5.2 Balance Sheet & Cash Flow

- **Balance Sheet:** assets, liabilities, equity, derived from account balances at a point in time, entity-scoped and consolidatable to Sunland Group.
- **Cash Flow Statement:** profit before tax, tax provision, profit after tax, depreciation and amortization added back, net cash from operating / investing / financing activities, broken out by revenue stream (management fees, letting fees, lease fees, sales commissions, late fees, valuation fees).

**Critical accounting distinction, stated explicitly because it is easy to get wrong:** rent collected from tenants on a landlord's behalf is **not** Sunland revenue. It is a clearing liability owed to the landlord. Only the management fee, and any service fees billed on top of it, are Sunland revenue. The schema in 7.1.4 enforces this by posting collected rent to a landlord-payable liability account and posting only the fee portion to revenue.

### 5.3 Rental Management

Tracks, per unit per period: expected amount, collected amount, deficit (`expected − collected`), vacancy status, and defaulter status with aging buckets (current, 30/60/90+ days).

```
rental_ledger
  id, entity_id, unit_id, period (month/year),
  expected_amount, collected_amount,
  deficit (generated: expected_amount - collected_amount),
  status (current | vacant | partial | defaulted),
  days_in_arrears
```

A defaulters view surfaces tenants in arrears beyond a configurable threshold, feeding both the Finance dashboard and the relevant Line Manager's dashboard for follow-up, since collection is ultimately a relationship problem the Line Manager owns even though Finance tracks the numbers.

### 5.4 Property Management Mandates

Each landlord mandate is its own collection and fee record, separate from the rental ledger above because a mandate can cover multiple units and has its own fee and expense logic.

```
property_mandates
  id, entity_id, landlord_id, property_id,
  mandate_rate (default 0.10),
  start_date, status (draft | pending_approval | active | terminated)

mandate_collections
  id, mandate_id, period,
  collected_amount,
  management_fee (generated: collected_amount * mandate_rate),
  landlord_remittance (generated: collected_amount - management_fee - approved_expenses)

mandate_expenses
  id, mandate_id, period, category, amount,
  logged_by (user_id, typically Line Manager),
  approval_status (auto_approved | pending_gm | approved | rejected)
```

**The crucial business rule, restated as a build constraint:** the management fee is always `collected_amount * 0.10`, never `expected_amount * 0.10`. This must be enforced at the database level (a generated column, as shown above) rather than left to application-layer discipline, specifically because it is the rule most likely to be quietly violated by a future developer who doesn't know the business context.

### 5.5 Payroll, Accounts Payable & Receivable

- **Payroll:** `payroll_runs` and `payslips`, sourced from HR time logs (Section 6.5), computing PAYE, NSSF, NHIF/SHIF, and Affordable Housing Levy deductions per Kenyan statutory requirements, net pay, and a `statutory_remittances` table tracking what's owed to each body per run.
- **Accounts Payable:** `accounts_payable` for external creditors (contractors, suppliers), aging by due date.
- **Accounts Receivable:** `accounts_receivable` for external debtors (clients owing fees outside the rental ledger, e.g. a valuation client), aging by due date.

### 5.6 Banker's Cheque Verification

```
bankers_cheques
  id, entity_id, cheque_number, payer, amount,
  status (deposited | credited | returned),
  deposited_at, credited_at, returned_reason (nullable)
```

A journal entry is created only when status transitions to `credited`, per the workflow in Section 4.6.

### 5.7 Service Fee Resolutions

A configurable fee rules table rather than hardcoded fee logic per fee type, since Sunland's fee schedule will change over time and the build should not require a code deploy every time it does.

```
service_fee_rules
  id, entity_id, fee_type (late | lease | letting | sales_commission),
  calculation_method (flat | percentage),
  rate_or_amount, applies_to (entity reference, e.g. lease_id)

service_fee_charges
  id, rule_id, related_table, related_id, amount_charged, status
```

### 5.8 Commissions & WHT Compliance Tracking

Two distinct concerns, both real and both needed:

1. **Statutory compliance:** the Affordable Housing Levy (1.5% employer + 1.5% employee) flows through payroll (5.5) as a standard statutory remittance line, tracked per run.
2. **Agent Commissions & WHT:** Sunland acts as a private agency (property sales/letting, valuations, project management, feasibility studies). When deals close, agent commissions are calculated, and a statutory 10% Withholding Tax (WHT) is deducted and filed with the Kenya Revenue Authority (KRA). Tracking handles deal margins, agent shares, WHT retentions, and KRA submission validation.

### 5.9 Exportable Reports & QR Retrieval (Feasibility Assessment)

**Feasibility: straightforward, low risk.** Recommended approach:

- Every generated financial report (balance sheet snapshot, mandate statement, payroll summary) gets a stable `report_id` and a signed, time-limited verification token.
- A QR code is generated client-side (`qrcode.react`) encoding a URL of the form `/admin/finance/reports/verify/[token]`, embedded in the exported PDF.
- Scanning the QR opens an authenticated detail view of that exact report if the scanning user has Finance access, or a minimal "this document is authentic, generated on [date], reference [id]" confirmation if accessed outside the authenticated app, which covers the realistic use case of a bank or auditor verifying a printed statement without needing full system access.
- No new infrastructure is required beyond the QR library and a `report_exports` table (`id`, `entity_id`, `report_type`, `generated_by`, `generated_at`, `verification_token`, `expires_at`).

This is positioned as a Phase 3 feature (Section 13), after the underlying ledger, rental, and mandate data it reports on actually exists.

---

## 6. HR Module

### 6.1 Employee Records

`employees` extends the existing user/auth table with HR-specific fields rather than duplicating identity data: department, role, line manager, employment date, employment status.

### 6.2 Leave Management

`leave_types`, `leave_requests`, `leave_balances`. Approval chain: Line Manager / Department Head, escalating to HR Head for edge cases (e.g. negative balance requests).

### 6.3 Complaints & Grievances

`complaints`: confidential by default, visible only to HR Head and the complainant, with a separate escalation path to GM for complaints naming a Department Head, and to CEO for complaints naming the GM. This routing matters more than almost anything else in this spec for trust reasons, and it should not be implemented as a configurable RBAC rule that a Finance or BD developer could accidentally weaken; it is hardcoded routing logic, reviewed deliberately if it ever needs to change.

### 6.4 Credentials, Medical, Dependents, Insurance

- `employee_credentials`: licenses and certifications (driving license for Drivers, valuer license for Valuers) with expiry tracking and renewal alerts surfaced on the HR dashboard.
- `medical_records`: restricted to HR Head and the employee themselves; not visible to Line Managers even though Line Managers can see leave balances.
- `dependents`: next-of-kin and family data, feeding both medical/insurance and emergency contact use cases.
- `insurance_policies`: group medical/life cover, policy numbers, beneficiary linkage to `dependents`.

### 6.5 Interview Scheduling, Promotions & Demotions

`candidates`, `interview_schedules` (panel assignment, calendar integration). `role_change_requests` implements the promotion/demotion workflow from Section 4.5.

### 6.6 Time Tracking

Two distinct logging patterns under one table, distinguished by type rather than built as separate systems:

```
time_logs
  id, employee_id, entity_id, log_type (office | field),
  clock_in, clock_out,
  geo_lat (nullable, field only), geo_lng (nullable, field only)
```

Office staff clock in/out from the app. Field agents (BD Agents, Valuers, Operations technicians on site visits) log time with an optional geo-stamp at the point of check-in, kept optional rather than mandatory since not every device will reliably have location access and the system should not block a legitimate time entry over it.

### 6.7 Finance-Facing Reports

HR generates payroll-ready aggregated hours and a statutory remittance summary feeding Finance (Section 4.2 and 5.5) rather than Finance re-deriving hours from raw logs itself.

---

## 7. Line Managers / Business Development Module

### 7.1 Landlord Relationship Management

`landlords`, `landlord_properties`. Line Managers are the primary point of contact for landlords offering property management business to Sunland, so this is effectively a lightweight CRM scoped to one relationship type, sitting inside the broader ERP rather than as a separate product.

### 7.2 Listings & Sales Funnel

`leads`, `sales_funnel_stages` (lead → viewing → offer → sale/lease), linked to Finance for commission calculation on close (Section 5.7).

### 7.3 Property-Specific Petty Cash

`property_petty_cash` (a float per property or mandate) and `petty_cash_expenses` (repairs, watchman wages, site costs), feeding the mandate expense reimbursement workflow in Section 4.4.

### 7.4 Front Office Liaison

Vehicle requests (Section 4.1) and mandate letter drafting handoff (Section 4.3) are initiated from the Line Manager dashboard but executed in Front Office; the Line Manager dashboard shows status, not a duplicate of Front Office's queue.

### 7.5 Agent KPIs, Goals & Time Logs

`agent_kpis` (targets vs. actuals per BD Agent, rolled up to the Line Manager's dashboard), reusing `time_logs` (6.6) filtered to field-type entries for the relevant agents rather than maintaining a second time-tracking table.

---

## 8. Front Office / Office Admin Module

### 8.1 Logistics & Driver Tracking

`vehicles`, `drivers`, `vehicle_assignments`, `trip_logs` (mileage, fuel, destination), implementing the fulfillment side of the vehicle request workflow (Section 4.1).

### 8.2 Appointment Scheduling

`appointments`: viewings, client meetings, internal meetings, calendar-style view on the Front Office dashboard.

### 8.3 Office Petty Cash

`office_petty_cash` and `office_petty_cash_expenses`, kept as a distinct float from property-level petty cash (Section 7.3) since the two have different approval thresholds (Section 4.7) and different owners.

### 8.4 Paperwork Processing

`application_forms` (tenant/landlord intake), `offer_letters`, `mandate_letters`: templated documents generated from data already in the system (landlord/tenant/property records) rather than re-entered, with placeholders for signature capture or upload of a signed scan.

---

## 9. Executive Module (CEO & GM)

The existing Executive Overview dashboard is **not rebuilt**. It is extended with two new widgets that pull from the modules above.

### 9.1 Cross-Department Oversight Dashboard (extension, not replacement)

New KPI tiles added to the existing dashboard's analytics tier: collection rate (collected ÷ expected, company-wide), payroll cost trend, AP/AR aging summary, mandate count and total collectible value by division. These are additive cards using the existing `KPICard` component and existing entity-scoping; no new dashboard shell is built.

### 9.2 Unified Approvals Queue

A new page, `/admin/approvals`, visible only to CEO and GM, listing every pending `approval_requests` row across all departments, filterable by type and entity, using the same Board layout pattern (Section 2.3) as every other module in this spec. This is the one genuinely new Executive-facing surface; everything else in this section is an addition to what already exists.

### 9.3 Reports Center

Consolidated access to every exportable report across Finance, HR, BD, and Front Office, gated by the same RBAC matrix (Section 3.2), reusing the QR/export infrastructure built for Finance (Section 5.9) rather than building reporting twice.

---

## 10. Module Map / Routes

```
/admin                                   Executive Overview (existing, untouched)
/admin/approvals                         Unified Approvals Queue (new)

/admin/finance                           Finance dashboard
/admin/finance/ledger                    Journals & chart of accounts
/admin/finance/balance-sheet
/admin/finance/cash-flow
/admin/finance/rentals                   Rental ledger, defaulters, vacancies
/admin/finance/mandates                  Property management mandates
/admin/finance/mandates/[id]             Mandate detail (collections, expenses, remittances)
/admin/finance/payroll
/admin/finance/payables
/admin/finance/receivables
/admin/finance/cheques                   Banker's cheque verification
/admin/finance/fees                      Service fee rules & charges
/admin/finance/commissions               Commissions & WHT tracking
/admin/finance/reports                   Exportable reports + QR verification

/admin/hr                                HR dashboard
/admin/hr/employees
/admin/hr/leave
/admin/hr/complaints
/admin/hr/credentials
/admin/hr/medical                        Restricted (HR Head + self only)
/admin/hr/interviews
/admin/hr/promotions
/admin/hr/time-tracking

/admin/business-development              Line Manager / BD dashboard
/admin/business-development/landlords
/admin/business-development/listings
/admin/business-development/petty-cash
/admin/business-development/kpis

/admin/front-office                      Front Office dashboard
/admin/front-office/logistics
/admin/front-office/appointments
/admin/front-office/petty-cash
/admin/front-office/paperwork

/admin/maintenance                       Operations module (existing, untouched)
```

---

## 11. API Conventions

REST endpoints under `/api/[department]/[resource]`, mirroring the route map above. Every endpoint:

- Validates input with the same Zod schema used by the corresponding React Hook Form.
- Runs through role-gated middleware checking the RBAC matrix (Section 3.2) before touching the database.
- Returns a consistent envelope: `{ data, error, meta }`, matching the existing CRM API convention rather than introducing a new shape for ERP endpoints.
- Financially consequential writes (mandate activation, payroll disbursement, cheque crediting) check for an associated approved `approval_requests` row server-side, not just client-side, since client-side gating alone would let a direct API call bypass approval.

---

## 12. UI/UX Standards (Restated as a Build Gate)

Before any new department dashboard ships, it must pass this checklist, which is the Section 2 and Section 5 (Verification Checklist, Operations doc) standard generalized across all departments:

- [ ] Primary actions use `bg-[#f3df27]` / `text-[#151936]`, hover `#e6d220`.
- [ ] `#151936` is the only dark brand color used; `#15464e` does not appear.
- [ ] Page and section titles use `title-serif` / `font-normal`.
- [ ] All currency, dates, and reference IDs use `font-mono` and `formatCompactKES()`.
- [ ] No font weight above 500 anywhere on the page.
- [ ] The dashboard follows the Board layout: unified header, KPI tier, data tier.
- [ ] Creating a record opens a Modal; viewing a record's full detail opens a Drawer.
- [ ] Every CRUD action fires a Toast.
- [ ] Tables paginate at 5–8 rows.
- [ ] The page reads `activeEntityId` from the existing `useUIStore` and does not implement its own entity context.
- [ ] No `useEffect` is used to sync state from props; state is derived during render.

---

## 13. Implementation Sequence

Finance-first, with each phase unlocking the data the next phase depends on. No phase begins until the previous phase's checklist (Section 12, plus module-specific checks) passes.

| Phase | Scope | Why this order |
|---|---|---|
| 0 | Approval Engine (3.3), RBAC matrix expansion (3.2) | Every later phase needs somewhere to route a sign-off |
| 1 | Finance Core: Ledger, Chart of Accounts, Balance Sheet, Cash Flow (5.1–5.2) | Nothing else in Finance is derivable without this |
| 2 | Finance: Rental Management & Property Mandates (5.3–5.4) | The highest-value, most error-prone logic (10% rule) ships early and gets the most real-world testing time |
| 3 | Finance: Payroll, AP/AR, Cheques, Service Fees, Commissions & WHT, Reports/QR (5.5–5.9) | Depends on Phase 1's ledger; payroll specifically depends on Phase 4 |
| 4 | HR Core: employees, leave, time tracking (6.1–6.2, 6.6) | Feeds Finance payroll (5.5); built in parallel with late Phase 3 |
| 5 | HR Extended: complaints, credentials, medical, interviews, promotions (6.3–6.5) | Lower urgency, no other module blocks on it |
| 6 | Front Office: logistics, appointments, petty cash, paperwork (8.1–8.4) | Needed before Line Manager workflows that depend on it |
| 7 | Line Managers / BD: landlords, listings, petty cash, KPIs (7.1–7.5) | Depends on Front Office (vehicle requests, mandate letters) and Finance (mandate records) both existing |
| 8 | Executive extensions: oversight KPI tiles, Approvals Queue, Reports Center (9.1–9.3) | Additive only; depends on every department it surfaces having real data |
| 9 | Real-time wiring (Pusher channels per department), Redis caching for aggregate dashboards, QA pass | Polish phase, run against a system with real data flowing through it |

---

## 14. Open Questions for Sunland Leadership

These are flagged rather than assumed, since getting them wrong is expensive to unwind once data exists:

- Confirm the default approval thresholds in Section 4.7; they are reasonable defaults, not confirmed policy.
- Confirm whether landlord and tenant self-service portals are in scope for a later phase; this spec assumes internal-only access for now.
- Confirm standard commission percentages for agent divisions (Sales 3%, Lettings 10%, Valuations 2%, Feasibility Studies 5%) and the filing schedule of the statutory 10% WHT.
- Confirm whether Valuers Ltd needs its own fee schedule distinct from Commercial/Residential service fees, or shares the rules table in 5.7.
