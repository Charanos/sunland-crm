---
name: sunland-erp-implementation
description: Staged build guide for implementing the Sunland ERP system (Finance, HR, Business Development, Front Office, Executive oversight) on top of the existing Sunland CRM codebase. Consult this skill before scaffolding any new ERP page, schema, API route, or workflow, and before touching anything that looks like the existing dashboard, entity switcher, or shared UI primitives. Defines what is locked, what order things get built in, the repeatable module construction pattern, and the financial-logic guardrails that must never be coded around.
---

# Sunland ERP Implementation Skill

This skill is the operating manual for building out `SUNLAND_ERP_IMPLEMENTATION_SPEC.md`. The spec is the source of truth for *what* to build (schemas, routes, RBAC, business rules). This skill is *how* to build it without breaking what already exists or drifting from the established patterns.

Read the spec section for whatever module you're about to build before writing code. This file tells you the order to build things in, the shape every module should take, and the lines not to cross.

## 1. What is locked, read-only, reference-only

Do not edit, refactor, or "improve" these. They are the finished reference implementation every new module is judged against:

- The CEO/GM Executive Overview dashboard (`dashboard-overview.tsx` and its KPI cards, revenue chart, listing board, market insights).
- The Entity Switcher (`entity-switch-overlay.tsx`, `useUIStore` in `src/store/ui.ts`, the `ENTITIES` registry).
- The Operations & Maintenance module (`operations-board.tsx`, `maintenance-ticket-drawer.tsx`, `log-ticket-modal.tsx`, `contractor-list.tsx`).
- Shared UI primitives: Toast system, Modal system, Drawer system, Confirm Dialog.
- `src/lib/utils/format.ts`, specifically `formatCompactKES()`.
- Color tokens, font stack, and the `title-serif` / `font-mono` conventions.

If a task seems to require changing one of these, stop and flag it instead of proceeding. Extending the Executive dashboard with new KPI tiles (spec Section 9.1) is allowed and expected; rebuilding its shell is not.

## 2. Design system cheat sheet (don't re-derive this, just use it)

### Colors & Typography

| Token | Value | Use |
|---|---|---|
| Primary action | `bg-[#f3df27]` `text-[#151936]` hover `bg-[#e6d220]` | Buttons that create/submit/confirm |
| Brand dark | `bg-[#151936]` / `text-[#151936]` / `border-[#151936]` | Sidebar, active tabs, headers, pagination, chart strokes |
| Resolved / positive | `bg-emerald-500/20 text-emerald-300` | Paid, resolved, on-track, approved |
| Critical / overdue | `bg-rose-500/20 text-rose-300` | Defaulted, overdue, rejected, critical |
| Awaiting approval | `bg-amber-500/20 text-amber-300` | Pending GM/CEO sign-off (new, ERP-only addition) |
| Titles | `title-serif`, `font-normal` (300) | Page and section headers only |
| Data | `font-mono` | Every KES amount, date, ticket ID, mandate reference |

### Stacking Order & Z-Index Tokens

| Token | Class | Value | Use |
|---|---|---|---|
| Sticky Header | `z-header` | `20` | Sticky top navigation bar (`TopNav`) |
| Aside Navigation | `z-nav` | `30` | Collapsible sidebar container (`SunlandNav`) |
| Chat Widget | `z-chat` | `40` | Global floating action chat widget FAB button |
| Overlay Screen | `z-overlay` | `950` | Fullscreen intermediate overlays |
| Modal Backdrop | `z-modal` | `999` | Global portal-rendered modal wrappers |
| Drawer Backdrop | `z-drawer` | `999` | Global portal-rendered drawer wrappers |
| Status Notification | `z-toast` | `1000` | Global auto-dismissing toast notifications |

**Layout Stacking Rules**:
- Sibling panels with transform animations (like `animate-fade-in-up` which applies translation) create local stacking contexts.
- To prevent lower row elements from overlaying preceding dropdown menus, the command header row hosting the action dropdown MUST be explicitly elevated with `relative z-10`.
- Hard rules: never `#15464e`. Never `font-semibold` or `font-bold` anywhere. Never invent a new semantic color when one of the four colors above already fits. Currency always goes through `formatCompactKES()`, never a local `toLocaleString()` or hand-rolled formatter.

## 3. Build order

Follow spec Section 13 exactly. Do not start a phase until the previous phase's module checklist (Section 5 below) is green.

```
Phase 0  Approval Engine + RBAC matrix expansion
Phase 1  Finance Core: Ledger, Chart of Accounts, Balance Sheet, Cash Flow
Phase 2  Finance: Rental Management + Property Mandates
Phase 3  Finance: Payroll, AP/AR, Cheques, Service Fees, Affordable Housing, Reports/QR
Phase 4  HR Core: employees, leave, time tracking
Phase 5  HR Extended: complaints, credentials, medical, interviews, promotions
Phase 6  Front Office: logistics, appointments, petty cash, paperwork
Phase 7  Line Managers / BD: landlords, listings, petty cash, KPIs
Phase 8  Executive extensions: KPI tiles, Approvals Queue, Reports Center
Phase 9  Real-time wiring, Redis caching, QA pass
```

Finance is ahead of HR and BD on purpose: it's named the core engine in the spec, and payroll/mandate logic in later phases depends on the ledger existing first. Don't reorder this to match whatever feels easiest to build next.

## 4. The repeatable module construction pattern

Every new department screen in this spec (rental ledger, leave management, vehicle logistics, whatever it is) follows the same nine-step scaffold. Don't invent a new shape per module.

1. **Schema first.** Add the Drizzle table(s) from the relevant spec section. If a value should never be hand-computed by application code (see Section 6 below), make it a generated column at the database level, not a calculation in a component.
2. **API route.** `/api/[department]/[resource]`, Zod-validated input, role-gated middleware checking the RBAC matrix (spec Section 3.2), consistent `{ data, error, meta }` envelope.
3. **Dashboard shell.** Board layout: unified header (title, subtitle, filter pills, search) → KPI tier (3–4 cards) → data tier (table or grid). Reuse the existing Board component, don't fork it.
4. **Form Modal.** For every "create/log/request" action. React Hook Form + Zod, same validation schema as step 2.
5. **Detail Drawer.** For every "view full record" action. Right-side slide-in, sticky footer for state-change actions.
6. **Toast wiring.** Every successful and failed CRUD action fires a toast. No silent success.
7. **Approval hook (if applicable).** If the action appears anywhere in spec Section 4 or 4.7, it writes an `approval_requests` row instead of completing immediately when it crosses a threshold. Check server-side, not just client-side.
8. **Real-time channel (Phase 9, or earlier if trivial).** Pusher event on state change, scoped to the relevant department channel.
9. **Verification pass.** Run the checklist in Section 5 before calling the module done.

If you're building something that doesn't fit this nine-step shape, it's probably not actually a new module, it's a sub-feature of one that already exists. Check before scaffolding a new dashboard.

## 5. Per-module verification checklist

Copy this into the PR/task notes for every module. All boxes checked before moving to the next phase.

- [ ] Primary actions are `bg-[#f3df27]` / `text-[#151936]`.
- [ ] `#151936` is the only dark brand color present.
- [ ] Titles use `title-serif` / `font-normal`; no weight above 500 anywhere on the page.
- [ ] All currency uses `formatCompactKES()`; all amounts, dates, and reference IDs use `font-mono`.
- [ ] Dashboard is Header → KPI tier → Data tier, nothing else.
- [ ] Create opens a Modal. View-detail opens a Drawer. Nothing opens a full-page navigation for what should be a Drawer.
- [ ] Every CRUD action fires a Toast.
- [ ] Tables paginate at 5–8 rows.
- [ ] Page reads `activeEntityId` from the existing `useUIStore`; no local entity state.
- [ ] No `useEffect` syncing state from props; state is derived during render. For form modals, reset state on mount by rendering the form inner content conditionally (`if (!open) return null`) and using a `useState` initializer.
- [ ] No `useEffect` mount checking setting state (`setMounted(true)`) to prevent cascading render warnings; use `useSyncExternalStore` for SSR/hydration state detection instead.
- [ ] No raw `any` initializers for form states; define strict TypeScript interfaces (e.g. `ContactFormData`).
- [ ] Next.js image optimization is enforced; use the optimized `<Image />` component instead of standard `<img>` tags.
- [ ] Dashboard header sections containing absolute dropdowns use `relative z-10` to stack cleanly on top of animated sibling sections.
- [ ] If money or a consequential record state changes, there's a server-side check for an approved `approval_requests` row where the spec requires one.

## 6. Financial logic guardrails (never code around these)

These rules exist because they're easy to get subtly wrong, and wrong here means wrong money for a real landlord or a real employee.

- **Management fee is `collected_amount * 0.10`, never `expected_amount * 0.10`.** Enforced as a generated column (spec 5.4), not application logic. If you find yourself writing `expected * rate` anywhere near a mandate, stop.
- **Rent collected from tenants is not Sunland revenue.** It posts to a landlord-payable liability account. Only the management fee and service fees post to revenue. Don't let a "simplify the journal entry" instinct collapse this distinction.
- **Banker's cheques only create a journal entry on `credited`, never on `deposited`.** A cheque sitting at `deposited` status has zero ledger impact by design.
- **No subsystem maintains its own running balance.** Every balance, anywhere in Finance, is a query over `journal_lines`. If a feature seems to need its own balance field that isn't derived, that's a sign the ledger integration is missing, not a sign you need a new field.
- **Complaints routing (HR) is hardcoded, not a configurable RBAC rule.** A complaint naming a Department Head escalates to GM; one naming the GM escalates to CEO. Don't let this collapse into the general RBAC matrix where it could be quietly weakened later.

## 7. File and folder conventions

Mirror the existing CRM structure; don't introduce a parallel convention for "ERP" code.

```
src/app/admin/[department]/page.tsx              dashboard
src/app/admin/[department]/[resource]/page.tsx    sub-views, where the spec calls for them
src/app/api/[department]/[resource]/route.ts      API routes
src/components/[department]/                      department-scoped components
src/lib/schema/[department].ts                     Drizzle table definitions
src/lib/validation/[department].ts                 Zod schemas, shared between form and API route
```

`[department]` matches the spec's module map (Section 10): `finance`, `hr`, `business-development`, `front-office`. Don't abbreviate or rename these once chosen, since routes, schema files, and the RBAC matrix all need to agree on the same name.

## 8. When to stop and ask instead of guessing

- Any approval threshold (spec Section 4.7) that isn't yet confirmed by Sunland leadership (spec Section 14). Build with the stated defaults, but flag them as defaults in code comments, don't silently treat them as final.
- Anything that would require touching a locked file (Section 1).
- Any place where the spec is ambiguous about whether a value is revenue or a pass-through liability. Get this wrong once and every downstream report is wrong.
- Scope creep: if a task starts pulling in a feature from a later phase to "do it properly while you're in there," finish the current phase's scope first and note the dependency instead.

## 9. Definition of done for the whole ERP build

Phase 9 is complete, and the build is done, when every department dashboard exists, every cross-department workflow in spec Section 4 produces the correct `approval_requests` behavior end to end, the Executive Approvals Queue shows real pending items from at least Finance and HR, and the verification checklist in Section 5 passes on every module without exception.
