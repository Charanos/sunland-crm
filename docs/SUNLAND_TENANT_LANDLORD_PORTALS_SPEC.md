# Sunland ERP — Tenant & Landlord Portals (External-User Scope)

Date: 2026-06-29
Status: **New-scope specification.** No existing spec covers external users; this defines them. Companion to `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md`, `SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md` (statements derive from the ledger), and `SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` (portal-independence model).

> **Updated 2026-07-08 (ADR 013):** Two client-directed changes, applied throughout this doc: (1) tenant complaints/maintenance requests now route to the property's assigned **Property Manager**, not a generic Front Office/Ops queue — Property Managers are confirmed as the single point of contact for both landlords and tenants, since landlords defer all property-management responsibility to Sunland. (2) A new **Miscellaneous Charges** payment category (§3.2a) joins rent as a tenant-payable charge — water, garbage, and similar Sunland-billed items. **Electricity is explicitly excluded** — it runs on a prepaid token system entirely outside Sunland's ledger, never a `misc_charges` row.

> These two portals turn Sunland's ledger and property data into **self-service for the people whose money it is** — tenants (who pay) and landlords (whom Sunland pays). They must be strictly scoped: a tenant sees only their own lease/payments; a landlord sees only their own mandated properties and remittances. Everything they see is **derived from the same ledger the internal finance team uses** — never a separate copy.

---

## 1. Why this is a real identity gap today

- `contacts` hold `type: landlord | tenant`, but there is **no `users` linkage** — landlords/tenants cannot authenticate.
- `user_role` has **no `tenant` or `landlord`** value.
- There is no external-user provisioning, no external RBAC scope.

So this scope requires (a) an identity bridge from CRM contact → login user, and (b) row-level scoping so external users only ever touch their own data.

---

## 2. Identity model for external users

```
users
  + contactId uuid? → contacts.id     // links a login to the CRM contact (their landlord/tenant record)
  + isExternal boolean default false  // external users get an external portal, never an internal one

user_role  += "landlord", "tenant"

// Provisioning: internal staff invite a contact to the portal.
external_invitations
  id, contact_id, email, token (hashed), role(landlord|tenant),
  invited_by → users, expires_at, accepted_at?
```

Provisioning flow (reuses the approval/notification patterns):
1. Finance/Front-Office marks a landlord or tenant contact "invite to portal."
2. System creates an `external_invitations` row + emails an activation link (reuse whatever email transport the internal invite uses).
3. Contact sets a password → a `users` row is created with `contactId` set, `isExternal = true`, role `landlord`/`tenant`.
4. `proxy.ts` sends external users only to `/landlord` or `/tenant`; they can never resolve an internal portal (backend master §3.3).

**Row-level scope (the security spine):** every external query is filtered by the caller's `contactId`.
- Tenant: `WHERE lease.tenant_contact_id = :contactId` (and transitively their payments, complaints, notices).
- Landlord: `WHERE mandate.landlord_id = :contactId` (and transitively their properties, remittances, statements).
This is enforced in the service layer (a `scopeToContact()` helper analogous to `scopeEntityFilter`), never trusted from the client.

---

## 3. Tenant portal (`/tenant`)

Audience: a person renting a Sunland-managed unit. Read-mostly, with a few actions (pay, raise complaint, give notice).

### 3.1 Pages
| Page | Purpose | Data source |
|---|---|---|
| Overview | current balance, next rent due, active complaints, notices | rental_ledger + maintenance + transfer_notices, scoped to tenant |
| Payments | pay rent **and miscellaneous charges** (§3.2a); see receipt history + status | `tenant_payments` (rent) + `misc_charges` (water/garbage) → both post to ledger on confirmation |
| Statement | per-period expected/paid/arrears; downloadable | `rental_ledger` + `journal_lines` scoped to their lease |
| Lease & documents | lease terms, dates, deposit held, documents | `leases` (+ deposit from `2100 Tenant Security Deposits Held`) |
| Complaints / Maintenance | raise + track maintenance requests — **routes to their property's assigned Property Manager** | `maintenance_requests` (reuses existing table) |
| Transfer / move-out notice | give notice, track status | new `transfer_notices` |
| Profile/Settings/Security/Notifications | portal-local self-service | shared self-service components |

### 3.2 Key flows
- **Pay rent:** tenant initiates payment (M-Pesa/bank ref capture, or gateway later). A `tenant_payments` row is created `pending`; on confirmation (or reconciliation against a bank feed), the **rent-receipt posting recipe** (finance §5.1) runs, `rental_ledger.collected_amount` increments, arrears/status recompute, and the landlord's remittance-payable grows. **The tenant paying is the event that moves the whole ledger** — one write path, no parallel totals.
- **Raise complaint / maintenance:** creates a `maintenance_requests` row (status `open`), notifies the property's **assigned Property Manager** (updated 2026-07-08 — previously routed to a generic Front Office/Ops queue; Property Managers are the confirmed single point of contact for tenants, by extension of the landlord mandate). If the property has no assigned Property Manager, falls back to Head of Strategy (the department head above all Property Managers) rather than silently dropping the notification. Tenant tracks status changes; drawer shows the activity log.
- **Transfer/move-out notice:** creates a `transfer_notices` row (notice date, intended vacate date, reason, deposit-refund expectation); routes to Finance (deposit reconciliation) + the assigned Property Manager (inspection, re-letting — supersedes the prior generic "Ops + BD/Line-Manager" routing for the same reason as complaints above). Deposit refund is a ledger reversal/reclassification of `2100`, never an ad-hoc payment.

### 3.2a Miscellaneous Charges — water, garbage (new, 2026-07-08)

Rent is not the only thing Sunland bills a tenant for. Water and garbage collection are Sunland-billed, ledger-tracked charges, handled by the property's Property Manager exactly like rent — same payment flow, same ledger discipline, different charge type. **Electricity is deliberately excluded**: it runs on a prepaid token system the tenant buys directly, entirely outside Sunland's books, so it is never a `misc_charges` row and never appears on a Sunland statement.

```
misc_charges
  id, entity_id, lease_id, tenant_contact_id, property_id,
  charge_type(water | garbage | other), description,
  amount_kes, period(YYYY-MM),
  status(pending | paid | waived | overdue),
  raised_by → users (typically the assigned Property Manager),
  ...timestamps

misc_charge_payments
  id, misc_charge_id, amount_kes, method(mpesa|bank|cash|cheque),
  external_ref, status(pending | confirmed | reversed), confirmed_at,
  journal_entry_id?,   // set once posted to the ledger — same posting discipline as tenant_payments
  ...timestamps
```

**Flow:** a Property Manager (or an automated meter-reading import, later) raises a `misc_charges` row against a lease. The tenant sees it on their Payments page alongside rent, pays it the same way `tenant_payments` works, and on confirmation it posts to the ledger through the same single write path (`postJournalEntry()`, finance ledger doc §4) — never a parallel, uncounted balance. Property Managers see outstanding misc charges across their assigned properties as part of the "handle this all dynamically" unified view (ADR 013 §13.2) — the same working surface that shows complaints and rent arrears, not a fourth separate page.

```
transfer_notices
  id, entity_id, lease_id, tenant_contact_id,
  notice_type(move_out | transfer_unit), notice_date, intended_vacate_date,
  reason, deposit_action(refund | apply_to_arrears | partial),
  status(submitted | acknowledged | inspection | settled | closed),
  ...timestamps

tenant_payments
  id, entity_id, lease_id, tenant_contact_id, amount_kes, method(mpesa|bank|cash|cheque),
  external_ref, status(pending | confirmed | reversed), confirmed_at,
  journal_entry_id?,   // set once posted to the ledger
  ...timestamps
```

### 3.3 What a tenant must NOT see
Management fee, landlord identity/remittance, Sunland's P&L, any other tenant's data, any internal approval. Their statement shows *their* obligation and *their* payments only.

---

## 4. Landlord portal (`/landlord`)

Audience: a property owner whose units Sunland manages under a mandate. This is the portal that most directly builds trust, because it shows the landlord exactly what was collected, what was deducted, and what they're owed — from the same ledger Finance uses.

### 4.1 Pages
| Page | Purpose | Data source |
|---|---|---|
| Overview | portfolio value, this-period collected/fee/remittance, occupancy, arrears | mandate_collections + rental_ledger + journal_lines, scoped to landlord |
| Properties / Units | mandated properties, occupancy, current tenants (limited PII) | `properties` + `leases` under their mandates |
| Remittance statements | per-period: collected − fee − approved expenses = remittance; downloadable + QR-verifiable | `mandate_collections` (generated columns) + `journal_lines` dimensioned to `landlordId` |
| Expenses | rechargeable expenses deducted, with approval state + evidence | `mandate_expenses` |
| Mandate | mandate terms, rate, units, status, documents | `property_mandates` |
| Approvals | approve/query certain expenses above a threshold (optional, if the mandate delegates it) | `approval_requests` scoped to their mandate |
| Payments received | history of remittances paid out to them | `journal_lines` on `2000 Landlord Remittances Payable` |
| Profile/Settings/etc. | portal-local self-service | shared components |

### 4.2 Key flows
- **View remittance statement:** the landlord's core artifact. Derived: `collected_amount` (from mandate_collections) − `management_fee` (generated) − `approved_expenses` = `landlord_remittance` (generated). Every figure traces to `journal_lines`. Exportable with the §5.9 QR verification token so a bank/landlord can confirm authenticity.
- **Expense transparency:** each deduction shows category, amount, who logged it, approval state, and (ideally) an evidence attachment — this is the #1 source of landlord disputes, so making it transparent and auditable is high-value.
- **Optional expense approval:** if a mandate delegates approval of expenses over a threshold to the landlord, the landlord approves via the shared `approval_requests` engine (same rail as internal approvals).

### 4.3 What a landlord must NOT see
Other landlords' data, Sunland's group P&L, tenant PII beyond what's necessary (name/unit, not tenant financials unrelated to their property), internal staff data.

---

## 5. RBAC additions

New permissions (backend master §3.1 catalog):
```
tenant.payment.create        tenant.statement.view        tenant.complaint.create
tenant.notice.create         tenant.lease.view            tenant.misc_charge.pay   (new, 2026-07-08)
landlord.statement.view      landlord.expense.view        landlord.mandate.view
landlord.expense.approve     (only if mandate delegates)  landlord.property.view
```
Roles `tenant` and `landlord` are **scope_type `self`** — every permission is implicitly filtered to `contactId`. They hold no entity-wide permission and cannot switch entities.

**Property Manager side (ADR 013 §13.2):** no new permission keys — `property_manager` already holds `...keysFor("properties")`, which covers `properties.maintenance.*`. What changes is routing/notification logic (complaints and move-out notices land in the assigned PM's queue, not a generic Ops queue) and a new `misc_charges` read/write path, which rides the same `properties.maintenance.*` grant rather than inventing `properties.misc_charge.*` for a table this closely related to maintenance/tenancy management.

---

## 6. Interconnection (how these feed the internal system)

- A tenant payment (rent or a misc charge, §3.2a) → posts to the ledger → updates rental_ledger → grows landlord payable → appears in the landlord's next statement and the Finance rentals board and the Executive collection KPI. **One event, propagated by shared data**, not copied. See `SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md` §8.1 for the full downstream trace, worked example included.
- A tenant complaint → `maintenance_requests` → the property's **assigned Property Manager's queue** (updated 2026-07-08; previously Front Office/Ops) → resolution notifies the tenant.
- A move-out notice → Finance (deposit) + the assigned Property Manager (inspection, re-letting) — coordinate off one `transfer_notices` row via notifications/approvals.
- A landlord expense approval → same `approval_requests` engine as internal.

This is the payoff of the "independent portals, one ledger" model in the portal-architecture doc: adding external portals is mostly **new views + scoping**, not new financial logic — because the financial logic all lives in the shared ledger services.

---

## 7. Build sequence (Phase P7 of the master roadmap)

Prereq: ledger core (P1) + rentals/mandates (P2) must exist, because both portals are windows onto that data.
1. External identity: `users.contactId`/`isExternal`, `external_invitations`, `tenant`/`landlord` roles, provisioning flow, `scopeToContact()`.
2. Landlord portal first (it's read-mostly and derives directly from mandate/ledger data already built in P2) — highest trust value, lowest new-write risk.
3. Tenant portal: statements + complaints (read/existing tables) first; then `tenant_payments` + `transfer_notices` (new writes that touch the ledger).
4. Property Manager unified view (ADR 013 §13.2): complaints + arrears + `misc_charges` for their assigned properties in one working surface — this is what "handle this all dynamically" requires, and it's cheapest to build once the three underlying data sources above already exist.
5. `misc_charges`/`misc_charge_payments` (§3.2a) — same posting discipline as `tenant_payments`, built alongside or immediately after it since it reuses the identical confirm → post-to-ledger path.
6. Verify scoping with adversarial tests: a tenant cannot read another lease; a landlord cannot read another mandate; neither can reach an internal portal or call an internal service; a Property Manager cannot see complaints/charges for properties not assigned to them.

---

## 8. Definition of done

- [ ] External user can be provisioned from a CRM contact and log in only to their external portal.
- [ ] Every external query is `contactId`-scoped in the service; verified by negative tests.
- [ ] A landlord remittance statement equals `collected − fee − approved_expenses`, every figure tracing to `journal_lines`, and matches what Finance sees internally.
- [ ] A tenant payment posts through the single ledger write path and updates rental_ledger + landlord payable atomically.
- [ ] A tenant complaint/maintenance request notifies the property's assigned Property Manager, not a generic queue; falls back to Head of Strategy if no PM is assigned.
- [ ] A misc charge (water/garbage) follows the identical raise → pay → post-to-ledger flow as rent, with no electricity charge type ever representable in `misc_charges`.
- [ ] Property Managers have one unified view of complaints + arrears + misc charges for their assigned properties, not three separate pages.
- [ ] Move-out notice coordinates Finance/Ops/BD via one `transfer_notices` row + notifications.
- [ ] Portal-local self-service (no jump to an internal shell); Terrain Identity applied.
