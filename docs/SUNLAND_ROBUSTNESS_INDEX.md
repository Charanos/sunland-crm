# Sunland ERP — Robustness & Backend Build: Document Index

Date: 2026-06-29
Purpose: entry point for the backend-robustness effort. These documents were produced in an **audit + design session**; implementation happens in a separate session. They sit alongside — and where noted, supersede parts of — the existing product specs. Read them in the order below.

---

## The new documents (this effort)

| # | Document | What it is | Read when |
|---|---|---|---|
| 1 | **`SUNLAND_CURRENT_STATE_AUDIT.md`** | Evidence-based reality-vs-intent audit. What exists, what's mock/synthesized, a prioritized gap register (P0/P1/P2). The finance dashboard's read-time-simulation problem is the headline. | First — establishes the baseline. |
| 2 | **`SUNLAND_BACKEND_ARCHITECTURE_MASTER.md`** | The spine: principles, layered architecture, RBAC redesign, entity/consolidation, full module & data-model map, 8-phase roadmap, DoD, and Sunland↔Andishi cross-pollination notes. | Second — the plan. |
| 3 | **`SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md`** | The core engine, in depth: double-entry GL as system of record, COA, journal/lines, single balanced write path, posting recipes (rent/mandate/deposit/cheque/commission-WHT/payroll/fees), subledgers (mandates, rental ledger), periods, derived statements, migration off the flat `transactions` table, DoD. | Third — before touching money. |
| 4 | **`SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md`** | Independent-portal model + interconnection. Fixes the `/admin/profile` routing defect; permission-driven nav; two-layer authorization; CEO super-admin oversight model. Supersedes ADR 005/008. | When doing portals/RBAC. |
| 5 | **`SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`** | New scope: external identity (contact→user), tenant portal (pay/statement/complaint/transfer notice), landlord portal (remittance statements/expenses/mandate), row-level scoping, interconnection. | When adding external portals. |
| 6 | **`SUNLAND_PUBLIC_SITE_CMS_CRM_INTEGRATION.md`** | Out-of-primary-scope note: how to design the ERP so reworking sunland.co.ke (listings from ERP, inquiries→CRM leads, CMS, SEO) is a thin layer later, not a second system. | Design-for-it now; build later. |

## Existing documents these build on / reconcile with

- `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` — product source of truth. §5 (Finance) is excellent and directly operationalized by doc #3. Its **routing** (departments under `/admin/finance`) is reconciled by doc #4 / ADR 009.
- `SUNLAND_FINANCE_DASHBOARD_SPEC.md`, `SUNLAND_EXECUTIVE_DASHBOARD_SPEC.md`, `SUNLAND_HR_DASHBOARD_SPEC.md`, `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md`, `SUNLAND_BD_DASHBOARD_SPEC.md` — per-module functional specs (UI/UX + flows). Still valid for UI intent; their `/admin/finance`-style routes are superseded by the independent-portal model.
- `TERRAIN_IDENTITY_FOUNDATION.md`, `COMPONENT_STANDARDS.md` — design system. Unchanged, authoritative for visuals.
- `FINANCE_REVAMP_DESIGN_GUIDE.md` — finance UI/interaction/validation standards (balanced-ledger `.refine()`, approval thresholds, audit drawers). Its rules are now given backend teeth by docs #2/#3.
- `ARCHITECTURE_DECISIONS.md` — ADR log. New ADR 009/010/011 added; ADR 005/008 marked superseded (history preserved).

---

## The three findings that matter most

1. **Finance is a read-time simulation, not a ledger.** One flat `transactions` table; the double-entry ledger, chart of accounts, and history are fabricated per-request with hardcoded rules and a magic retained-earnings constant. → doc #1 §2, fixed by doc #3.
2. **Authorization gates routes, not actions; portals are half-independent.** Path-prefix RBAC, self-service hosted under `/admin` (the profile-routing bug), Finance independent but HR/BD/Front-Office not. → doc #1 §3–4, fixed by docs #2 §3 + #4.
3. **External users don't exist.** Landlords/tenants are CRM contacts with no login; the requested tenant/landlord portals are net-new. → doc #5.

---

## Guardrails carried from the Andishi engagement

- **`typecheck` + `lint` + `build` clean** after every change; nothing shipped otherwise.
- **No build/commit/push without explicit go-ahead.**
- **Supersede, don't delete** — keep the ADR/spec paper trail; mark old decisions superseded with a pointer.
- **Verify DB operations actually landed** — don't trust a CLI success message; query `information_schema` (learned the hard way on Andishi's `drizzle-kit push`).
- **Fix shared components at the source**, not per-page.
- **Money invariants belong in the database** (generated columns, balanced-posting service), not in application discipline.

---

## Status

- ✅ Audit + design documentation (this effort) — complete.
- ✅ **P0 Foundation — implemented (2026-07-08)**, in a later session: service layer, `authz` (permission catalog + `can`/`authorize`), domain errors, audit choke point, real revocable `sessions`, split schema + `relations.ts`, `settings` (seeded thresholds), permission catalog + CEO super-admin seeded. Verified live against Neon, not just typechecked. Detail: `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3–5, §7.
- ✅ **CEO / System Administration surface — implemented (2026-07-08)**, same session, built ahead of P1 at explicit client direction ("this is the guide going forward"): full user/role/permission/session management API, `isLastSuperAdmin` guard, settings CRUD, audit-log explorer. Detail: `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3.4, `SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §6, `ARCHITECTURE_DECISIONS.md` ADR 012.
- ⛔ P1 (ledger core) onward — not started. `npm run build`/commit/push intentionally not run during the above; the user is concurrently editing the frontend and asked backend work to stay out of its way until told otherwise.
