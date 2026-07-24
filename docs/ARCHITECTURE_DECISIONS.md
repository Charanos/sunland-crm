# Architecture Decisions

This file records foundation decisions that future ERP work must preserve.

## ADR 001: ERP Spec Supersedes CRM Scope

`SUNLAND_ERP_IMPLEMENTATION_SPEC.md` is the single product and architecture source of truth. The retired CRM spec was removed because it contained obsolete routes, roles, build order, and module ownership.

The CEO/Admin dashboard prototype, Terrain Identity, entity switcher, operations module, and shared UI primitives remain locked reference implementations.

## ADR 002: Finance Is the Core Engine

Finance is not treated as a side dashboard. Ledger, chart of accounts, approval enforcement, rental management, mandates, payroll handoff, payables, receivables, and report verification are built before downstream department workflows rely on financial state.

No department owns an independent money balance. Balances are derived from ledger lines.

## ADR 003: Entity Scope Is Mandatory

ERP data is scoped to one of the Sunland entities:

- Sunland Group.
- Sunland Commercial.
- Sunland Residential.
- Sunland Valuers Ltd.

Every new ERP table carries `entity_id` unless it is purely global configuration. Existing CRM-era tables are being migrated toward this rule.

## ADR 004: Approval Engine Is Shared Infrastructure

Approval behavior is implemented through a generic `approval_requests` table. Departments do not create bespoke approval tables for payroll, petty cash, mandate activation, cheques, leave, or promotions.

Server-side approval checks are mandatory for consequential writes. Client-side gating is presentation only.

## ADR 005: Routes Are Department-Scoped Under `/admin` - ⚠️ SUPERSEDED by ADR 009

Canonical department routes live under `/admin`:

- `/admin/finance`
- `/admin/hr`
- `/admin/business-development`
- `/admin/front-office`
- `/admin/maintenance`
- `/admin/approvals`

Legacy short routes such as `/fin`, `/hr`, and `/ops` may remain only as temporary redirects and must not host new functionality.

## ADR 005.1: Next.js 16 Edge Proxy replacing Middleware
In Next.js 16.2+, the standard `middleware.ts` convention is deprecated in favor of `proxy.ts`. We adhere to this Edge Proxy convention, implementing the route guard logic inside [proxy.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/proxy.ts) and exporting a named `proxy` function to authorize incoming requests.

## ADR 006: Realtime Transport Naming

The ERP spec names Pusher Channels as the target realtime layer. The current codebase contains an Ably adapter from the earlier prototype. Until transport migration is scheduled, realtime access stays isolated behind `src/lib/realtime/*` so department code does not depend directly on a vendor SDK.

## ADR 007: Landing Page Redirection and Access Emulation Profiles - ⚠️ role list SUPERSEDED by ADR 013

To make local development, QA, and client review streamlined, the main landing page (`/`) redirects automatically to the secure `/login` route.
The login page contains an "Authorized Workspace Portals" switcher that emulates the six core client roles we are building out dashboards for:
1. CEO (`ceo` - Paul Amos)
2. General Manager (`general_manager` - Grace Mutua)
3. Head of Finance (`finance_head` - Dennis Munge)
4. Head of HR (`hr_head` - Cody Fisher)
5. Line Manager / Business Dev (`line_manager` - Jared Omondi)
6. Front Office Lead (`front_office_head` - Sharon Koech)

All emulated profiles are backed by real database users seeded in both `src/db/seed.ts` (CLI) and `src/app/api/auth/seed/route.ts` (API route) using the default password `sunland-demo` to preserve compatibility.

> **Superseded:** the six-role list above predates the client's finalized org structure. "Line Manager" no longer exists (folded into Property Manager mid-build); Head of Strategy, Admin (CEO's Assistant), Senior Accountant, and Internal Auditor are new. The mechanism this ADR describes (emulated login profiles backed by real seeded users) still stands - only the roster is stale. See ADR 013 for the current roster.

## ADR 008: Universal Self-Service Access Paths - ⚠️ SUPERSEDED by ADR 010
Common account modules (Profile, Settings, Security, Messages, Notifications) are hosted under the `/admin` path group but are whitelisted under `UNIVERSAL_PATHS` in [roles.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/lib/auth/roles.ts). This ensures that any authenticated employee (e.g. Finance Officer, HR Head) can manage their personal profiles, preferences, and communications without triggering role-based redirects to their department's dashboard roots.

> **Superseded:** hosting self-service under a single `/admin` group is the root cause of the "in `/fin` but Profile routes to `/admin/profile`" defect - it drops users out of their portal shell. Replaced by portal-local self-service (ADR 010). The original is kept for history.

---

## ADR 009: Independent Portal Route Groups - supersedes ADR 005
**Decision:** Every role's dashboard is an independent Next.js route group with its own root and shell: `/exec` (CEO/GM), `/fin`, `/hr`, `/bd`, `/front`, `/ops`, and the external `/landlord` and `/tenant`. No department's functionality lives under another portal's root. The former model of hosting departments under `/admin/*` (ADR 005) is retired; `/admin` becomes - at most - just the executive portal's own root, never a catch-all others nest under.

**Why:** the code had already diverged from ADR 005 (Finance was fully built as an independent `(fin)/fin` group, not at `/admin/finance`), leaving HR/BD/Front-Office stranded under `/admin`. This ADR ratifies the direction the code took and mandates finishing it for every role. Independence is of *route + shell*; the system stays unified through shared data, the ledger, and the approval/notification engines - not shared routes.

**Rationale & build detail:** `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md`.

---

## ADR 010: Portal-Local Self-Service - supersedes ADR 008
**Decision:** Profile, Settings, Security, Notifications, and Messages are rendered **within each portal's own shell**, from **shared components**, at portal-local routes (`/fin/profile`, `/hr/profile`, …). There is no global `/admin/profile`. `UNIVERSAL_PATHS` is removed; the self-service segments (`profile|settings|security|notifications|messages`) are simply permitted under any portal root the user can access. A `usePortalPrefix()` helper + `PortalContext` ensure shared components link within the active portal and never hardcode `/admin/*`.

**Why:** independence of route with unity of implementation - one `ProfilePage` component, rendered locally in every portal - fixes the cross-shell jump while avoiding duplicated code.

---

## ADR 011: Permission-Based, Two-Layer Authorization - extends ADR 004
**Decision:** Authorization is permission-based (`<module>.<resource>.<action>` keys in a `permissions`/`roles`/`role_permissions`/`user_roles` model), enforced at **two layers**: (1) an edge route guard (`proxy.ts`) that gates *which portals* a user may load, and (2) service-level `authorize(ctx, key)` that gates *which actions* a user may perform. Route-prefix gating alone (the current `roleAccess` map) is retired as the sole mechanism. The CEO super-admin holds every permission explicitly (seeded, data-driven - not a code-level bypass); the dev auth bypass no longer defaults to on.

**Why:** route gating cannot express "may view remittances but not approve them." Action-level checks inside the single service write path (ADR-002-adjacent) are the only place money-affecting authority can be enforced and audited.

**Rationale & build detail:** `docs/SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3, `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §5–6.

---

## ADR 012: CEO/System-Administration Is Real API Surface, Not Just a Data Model - extends ADR 011

**Decision:** Built ahead of P1, at the client's explicit direction to make CEO backend authority "the guide going forward." The permission model (ADR 011) is now backed by a full management surface: user CRUD (`/api/identity/users*`), role/permission CRUD (`/api/identity/roles*`, `/api/identity/permissions`), role-grant management (`/api/identity/users/[id]/roles`, `/api/identity/user-roles/[id]`), session listing/revocation (`/api/identity/sessions*`), entity settings/thresholds (`/api/settings`), and an audit-log explorer (`/api/audit`). Sessions are now genuinely revocable (a `sessions` row per login, checked on every `getCurrentUser()` call), not just a table sitting unused.

**Why:** a permission catalog that CEO holds every key of is oversight in name only until there's a real surface to exercise it through - grant/revoke roles, deactivate an account, kill a session, inspect the audit trail. This ADR makes that surface exist and pins down the rules future work must preserve:
1. **`isLastSuperAdmin()`** blocks deactivating or CEO-role-stripping the sole remaining active CEO. Checked inline in `updateUserAccess` and `revokeUserRole`, not layered on as an afterthought.
2. **System roles are immutable via the API.** All 16 real roles are `isSystem: true`; `seedPermissionCatalog()` fully replaces their `role_permissions` on every seed, so an API-side edit would silently vanish. Only custom (non-system) roles can be edited/deleted through the API.
3. **Department heads are global-scope, officers are entity-scope.** Caught live, not designed upfront: `finance_head`/`hr_head`/`front_office_head` must be `scopeType: "global"` (matching the seed data's own choice of `primaryEntityId = group` for heads vs. a specific entity for officers), or a department head scoped only to "Group" cannot act on a resource belonging to any other entity.
4. **No email service exists**, so `createUser` returns a one-time plaintext temporary password in its response rather than building a speculative invite/reset-token flow nothing else needs yet.

**Rationale & build detail:** `docs/SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3.4, `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §6.

---

## ADR 013: Client-Directed Role Model Update (2026 Q3) - extends ADR 011, updates ADR 007

**Decision:** The client supplied a finalized organizational role roster, replacing the six-role emulation set in ADR 007 and resolving the two placeholders `.agents/skills/workflow-fixes/SKILL.md` had left open ("Admin (CEO's Assistant)" and "Head of Strategy," previously deferred to "a future sprint"). That sprint is this ADR.

**The roster, in full:**

| Role | Slug | Scope | Reports to | Status |
|---|---|---|---|---|
| Chief Executive Officer | `ceo` | global | - | Unchanged |
| General Manager | `general_manager` | global | CEO | Unchanged |
| **Head of Strategy** | `head_of_strategy` | global | GM | **Implemented - see ADR 014** |
| Property Manager | `property_manager` | entity | Head of Strategy | Unchanged role, new reporting line |
| Head of Finance | `finance_head` | global | GM | Unchanged |
| **Senior Accountant** | `finance_officer` (relabeled) | entity | Finance Head | **Renamed**, same permission scope |
| **Internal Auditor** | `auditor_compliance` (relabeled) | global | GM (dotted line to CEO) | **Renamed** + **new time-gated access rule** |
| **Admin (CEO's Assistant)** | `admin_assistant` | global | CEO | **New** |
| Head of HR | `hr_head` | global | GM | Unchanged |
| Front Office Head | `front_office_head` | global | GM | Unchanged |
| Landlord | `landlord` | self | - | Unchanged (spec exists, not yet built - see tenant/landlord portal doc) |
| Tenant | `tenant` | self | - | Unchanged (spec exists, not yet built), **complaint routing changed** |

### 13.1 Head of Strategy - the BD/property-management department head

**Decision:** `head_of_strategy` is a new global-scope role sitting above everything the BD dashboard spec (`SUNLAND_BD_DASHBOARD_SPEC.md`) describes as "Line Manager" territory. Per the client: Head of Strategy owns **Property Managers, Line Managers, Sales, and Marketers** - i.e., every commercial/BD-facing function reports through this one department head, the same way Finance reports through Finance Head and HR through HR Head.

This is additive to, not a replacement for, the `property_manager` consolidation already in the codebase (`line_manager`/`bd_agent`/`bd_head`/`agent` were folded into `property_manager` earlier this build - see `src/lib/authz/catalog.ts`'s retired-alias comment). `head_of_strategy` sits *above* `property_manager` in the reporting chain; it does not merge into it.

**Permissions (implemented 2026-07-10 per ADR 014 §14.3, exactly as proposed here - mirrors `finance_head`'s oversight shape):**
```
...keysFor("crm")            // full pipeline/contact oversight, not just their own leads
...keysFor("properties")     // full property/lease/maintenance oversight
...keysFor("scheduling")
...keysFor("operations")     // Projects - Head of Strategy is exactly who runs cross-dept initiatives
identity.user.read           // sees their own reports (property managers, sales, marketers)
settings.entity.read
audit.log.read
```
Global scope (`scopeType: "global"`), matching the established rule that department heads are global while officers are entity-scoped (ADR 012 point 3) - a Head of Strategy overseeing property managers across Commercial *and* Residential cannot be scoped to one entity any more than Finance Head can.

### 13.2 Property Managers - explicit dual landlord + tenant scope

**Decision:** Property Managers are confirmed as the single point of contact for **both** landlords and tenants on any property under Sunland's management - not just the landlord-facing mandate relationship the role already had. Per the client: *landlords defer all responsibility for managing their properties to Sunland*, which makes the assigned Property Manager the de facto tenant-relationship owner too, by extension of that mandate.

**Concretely, this means:**
- Tenant complaints/maintenance requests route to the property's assigned Property Manager, not a generic Front Office/Ops queue (supersedes the routing described in `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md` §3.2/§6 - see that doc's updated version).
- Rent arrears visibility for a Property Manager's assigned properties is a first-class view, not something they have to cross into Finance to see.
- Miscellaneous tenant charges (new - see §13.5 below) are also a Property Manager concern.

The client's own framing was that Property Managers should be able to **"handle this all dynamically"** - one working surface per property/tenant, not three separate siloed pages for complaints, arrears, and misc charges. This is a UI/aggregation requirement for whenever the Property Manager portal is built (tenant/landlord portal doc §7 build sequence), not a new table - all three data sources (`maintenance_requests`, `rental_ledger`/lease arrears, and the new misc-charges table) already carry `propertyId`, so a "my properties, everything outstanding" view is a query, not a schema change.

No new permissions needed - `property_manager` already holds `...keysFor("properties")` (covers `properties.maintenance.*`) from the existing catalog; the change is in routing/visibility logic (who gets notified, whose queue it lands in), documented in the tenant/landlord portal spec update.

### 13.3 Finance: Senior Accountant + Internal Auditor

**Decision:** The client named two Finance-department staff roles: **Senior Accountant** and **Internal Auditor**. Mapped onto the existing schema rather than inventing parallel roles that duplicate what's already seeded:

- **Senior Accountant = `finance_officer`, relabeled.** The existing `finance_officer` role (entity-scoped, day-to-day transaction/ledger work) already matches the job description implied by "Senior Accountant" - general ledger entries, transaction recording, rentals/mandates support. No permission change; this is a display-name/title clarification (`name: "Finance Officer"` → `"Senior Accountant"` in `SYSTEM_ROLES`), flagged here as a proposed mapping for the client to confirm rather than assumed silently.
- **Internal Auditor = `auditor_compliance`, relabeled, plus a genuinely new access rule** (§13.4).

### 13.4 Internal Auditor's 90-day delayed finance access - a new authz primitive

**Decision:** An Internal Auditor **requires access to the finance dashboard only after 3 months** in the role. Read literally, this is a probation/trust period: the auditor role is granted immediately (they can start working - org-wide read access per `auditor_compliance`'s existing `allReadKeys()` grant), but the specific slice of that grant covering `finance.*` permissions activates only once 90 days have elapsed since the role was assigned.

**This is the first time-conditional permission in the system.** Nothing in the current `authorize()`/`can()`/`resolveActorPermissions()` chain (`src/lib/authz/{can,resolve}.ts`) has any concept of "granted, but not yet active." Two ways to build it, and the recommended one:

- **(Rejected) Delay the `user_roles` insert itself** - don't grant `auditor_compliance` until day 90. Simpler, but wrong: the client's intent is that the person *is* the Internal Auditor from day one (title, non-finance read access, presumably other duties) - only the finance slice is gated, not the whole role.
- **(Recommended) A `roleGrantedAt` timestamp on `user_roles`, checked inside `authorize()` for finance-module keys only.** Concretely: `user_roles` gains a `grantedAt` column (defaults to `now()`, already implicit via `createdAt` if `...timestamps` is already spread there - confirm and reuse rather than add a duplicate column). `authorize(ctx, key, entityId)` gets a narrow addition: if `key.startsWith("finance.")` and the resolved grant coming from an `auditor_compliance` role assignment is less than 90 days old, treat it as not-yet-granted (throw `ForbiddenError`) even though `can()` would otherwise return `true`. This keeps the general permission model untouched for every other role/module and scopes the new time-gate narrowly to the one case that needs it, rather than generalizing a "probation period" concept the rest of the system doesn't ask for yet.

**Not yet implemented** - this ADR records the decision and the mechanism; the `authorize()` change and the `user_roles.grantedAt` column are next-sprint work, tracked against this ADR.

### 13.5 Admin (CEO's Assistant) - proposed permission design

**Decision:** The client explicitly left this open - *"we'll figure how to auth this based on all other roles, this will be curated to aiding CEO activities"* - so what follows is a **proposed design**, not a client-dictated spec, flagged as such for confirmation before it's built.

Admin is framed as two things at once: partial HR function, and direct CEO support (scheduling, executive requests, triage). The proposed permission set reflects both halves without granting either full HR authority or financial approval authority - an assistant amplifies the CEO's reach, it doesn't inherit the CEO's sign-off power:

```
identity.user.read            // HR-adjacent: can see the org, not edit roles/access (that stays CEO-only)
settings.entity.read          // visibility into thresholds, no write
audit.log.read                // same oversight-adjacent read CEO/GM/Finance Head already get
...keysFor("scheduling")      // runs the CEO's calendar - this is the core "assistant" function
support.ticket.manage         // triages the "admin is the main support endpoint" queue on the CEO's behalf
crm.contact.read, crm.lead.read   // read-only visibility to brief the CEO, no pipeline editing
properties.property.read, properties.lease.read, properties.maintenance.read   // same, read-only briefing visibility
```

**Explicitly excluded:**
- `finance.*` (any) - no approval or transaction authority.
- `hr.complaint.manage` - complaints are confidentiality-gated to HR Head/GM/CEO by hardcoded routing (HR spec §6.4); Admin assisting the CEO does not extend to reading complaint content, including complaints escalated *to* the CEO.
- `operations.project.write` - Admin can see projects (read-only, via a future `operations.project.read` grant if the client wants visibility) but doesn't run them.
- `identity.role.write`, System Administration - CEO-exclusive per ADR 012, unchanged.

Scope: `global` (an assistant to the CEO isn't tied to one operating entity, matching every other department-head-tier role in this system).

### 13.6 Tenant/Landlord portal: complaint routing + miscellaneous charges

Covered in full in the updated `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`:
- Tenant complaints/maintenance requests now route to the property's assigned **Property Manager**, not a generic Front Office/Ops queue.
- A new **Miscellaneous Charges** category (water, garbage - **explicitly not electricity**, which runs on a prepaid token system entirely outside Sunland's ledger) joins rent as a tenant-payable charge type, handled by Property Managers.

### 13.7 What this ADR does *not* change

- The permission catalog's module structure (`<module>.<resource>.<action>`, ADR 011) - new roles are new grants of existing or narrowly-added keys, not a new authz model.
- `property_manager`'s existing entity-scoped permission set - Head of Strategy is a new role *above* it, not a rename of it.
- The tenant/landlord identity model (`users.contactId`, `isExternal`, `external_invitations`) - still not built; this ADR only changes who a tenant's complaint routes to once that portal exists.

**Supersedes:** ADR 007's six-role emulation list (CEO, GM, Finance Head, HR Head, Line Manager, Front Office Head) is stale - "Line Manager" no longer exists as a role (folded into Property Manager earlier this build), and the roster above is now the canonical set. ADR 007 is kept for history with a superseded marker rather than deleted, per this file's own convention.

**Rationale & build detail:** `.agents/skills/workflow-fixes/SKILL.md` (design notes, non-canonical scratch space), `docs/SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md` (complaint routing + misc charges), `docs/SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md` §8 (downstream data-flow model, added alongside this ADR).

---

## ADR 014: Mandate Letter Flow - Corrected Model, Role-Based Approval, Landlord Verification

**Context:** The Property Portfolio overhaul's WS3 workstream built a `property_mandates` anchor table and CEO-admin surfaces (property full-view rail card, create/terminate actions) against a simplified reading of the approval rule - "mandate activation always needs GM sign-off, CEO additionally above 10 units or KES 5M annualized" (Executive Dashboard spec §6.2) - treated as a flat rule applying to every mandate regardless of who creates it. The client clarified this is wrong on two counts: (1) the mandate letter is a real contract document produced partway through a multi-step landlord-onboarding flow, not just a status on an anchor row, and (2) the approval requirement depends on *who* is creating the mandate - a Property Manager or Head of Strategy always needs GM sign-off, but the CEO does not wait for anyone (nothing sits above the CEO to escalate to), and by the same logic a GM does not need GM sign-off from a *different* GM.

### 14.1 The real landlord-onboarding sequence

Per `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` §4.3, `SUNLAND_BD_DASHBOARD_SPEC.md` §8.1/§8.4, and `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md` §8.4 (all pre-existing, cross-referenced, and mutually consistent - this ADR did not invent this flow, it recovers it and reconciles it with the client's plain-language description):

```
Property Manager prospects a landlord (BD Landlords > Prospecting tab)
  stage: Initial Contact → Proposal Sent → Negotiating → Mandate Drafted
         ─────────────────┬──────────────
                  "Proposal Sent" is the informal offer - terms proposed
                  to the landlord before any contract is signed. There is
                  no separate tracked "Offer Letter" document for the
                  landlord side today (unlike the tenant/buyer-side Offer
                  Letters in Front Office Paperwork, which are generated
                  from a closed listing deal, BD spec 8.2) - it is a
                  Prospecting *stage*, not a document artifact, until the
                  BD Landlords page is actually built.
       ↓ (landlord accepts - "Mandate Drafted")
Property Manager submits a mandate letter draft request
  (BD Liaison & Requests page, routes to Front Office Paperwork queue)
       ↓
Front Office formalizes the Mandate Letter
  (templated document - the actual contract that seals the agreement,
   documents.type = 'mandate_letter', linked to the property + landlord
   contact; this is the artifact the client means by "mandate letter")
       ↓
Approval - see 14.2 below (GM always for PM/Head-of-Strategy-originated
  mandates, +CEO above threshold; CEO-originated mandates skip straight
  to active; a GM-originated mandate needing CEO sign-off skips GM's own
  and goes straight to CEO)
       ↓
Mandate activates - rental collection tracking begins
```

The `property_mandates` row is the *activation record* at the tail end of this sequence, not the whole sequence. Everything from Prospecting through Front Office formalization is BD/Front-Office departmental work that has **no built module yet** (`/admin/business-development/*` and `/admin/front-office/paperwork` do not exist in this codebase). Per the client's own instruction - build what's in scope, document the rest - this ADR draws the line explicitly at §14.4.

### 14.2 Role-based approval routing - the actual fix

**Decision:** The required approval tier is a function of *who is creating the mandate*, not a flat rule. Concretely, using each role's rank in the mandate-activation authority chain (`ceo` > `general_manager` > everyone else - `property_manager`, `head_of_strategy` (14.3), `rentals_mandates_officer`, or any other role holding the reused `properties.property.write` key):

- **CEO-originated:** no approval step at all. The mandate goes straight to `active` on creation, with an audit entry noting self-authorization. Nothing sits above the CEO in this system to approve on his behalf, and per the client, "everything stops at him."
- **GM-originated, within the GM tier** (≤10 units and ≤KES 5M annualized): same self-approval logic - a GM does not wait on another GM. Straight to `active`.
- **GM-originated, exceeding the CEO threshold** (>10 units or >KES 5M annualized): needs CEO approval only - not GM, since the GM *is* the requester. One `approval_requests` row, `requiredApproverRole = "ceo"`.
- **Everyone else (Property Manager, Head of Strategy, Rentals & Mandates Officer, ...):** always needs at least GM approval (mandate activation has no auto-approve tier for non-executive creators - Executive Dashboard spec §6.2's "always" column). One `approval_requests` row, `requiredApproverRole = "gm"`, or `"ceo"` if the unit/value threshold is additionally exceeded (GM's sign-off does not separately queue in that case - the CEO's approval is the higher bar and subsumes it, consistent with how every other threshold table in this system is a mutually-exclusive band, not a dual sign-off chain, except where a spec explicitly says "dual sign-off" - banker's cheques do, mandate activation does not).

This generalizes a pattern this codebase didn't have before ("does the actor's own authority already satisfy the approval this action would otherwise require") - scoped narrowly to mandate activation here per the client's explicit ask, not generalized into `authorize()`/`can()` itself. If other approval-gated flows (petty cash, cheques, vehicle requests) turn out to need the same self-approval-skip logic, that is a separate, later decision, not assumed by this ADR.

### 14.3 `head_of_strategy` - implementing what ADR 013 already decided

ADR 013 §13.1 specified `head_of_strategy` (global scope, reports to GM, owns Property Managers/Line Managers/Sales/Marketers) but it was never added to the `user_role` enum or `catalog.ts` - confirmed absent from both as of this ADR. Since the client's mandate-approval correction explicitly names this role ("we shall also do same for head of strategy"), implementing it is now load-bearing, not speculative. Implemented exactly as ADR 013 §13.1 specified: `...keysFor("crm")`, `...keysFor("properties")`, `...keysFor("scheduling")`, `...keysFor("operations")`, `identity.user.read`, `settings.entity.read`, `audit.log.read`, global scope. No other part of ADR 013 (Senior Accountant/Internal Auditor relabels, the 90-day finance-access gate, Admin/CEO's Assistant) is in scope here - those remain separately tracked against ADR 013 itself.

### 14.4 Landlord and property document verification

**Decision:** The CEO (or anyone with `properties.property.write`) can confirm a landlord's identity and review the documents backing a property/mandate directly from the property full-view page:

- `contacts` gains `idNumber` (text, nullable - national ID/passport number), `verifiedAt`/`verifiedById` (nullable - who confirmed this contact's identity and when). Generic to any contact, not landlord-specific, since the same verification concept applies to tenants and other counterparties later.
- The property full-view's Owner/Landlord rail card gets a "Confirm Landlord" action (gated the same as other write actions) that records/edits the ID number and sets `verifiedAt`/`verifiedById` in one step.
- Property documents (title deed, mandate letter, landlord ID) were already modelled (`documents.type` enum already had `mandate_letter`, `title_deed`, `identification` - this ADR adds `offer_letter` for vocabulary completeness) but two gaps existed: (a) `documents.type` was dropped when mapping to the frontend's `PropertyDocumentSummary`, so the full-view page couldn't distinguish a title deed from a mandate letter from anything else - fixed by threading `type` through; (b) landlord documents uploaded via the property form modal are saved scoped to `ownerContactId` only (no `propertyId` - deliberate, since one landlord's ID/title deed applies across all their properties), but `getPropertyWithDetails` only ever queried `documents` by `propertyId`, so those uploads were invisible on the full-view page they were meant to support. Fixed by additionally fetching the owner's documents.

This is intentionally *not* a KYC workflow with states, expiry, or re-verification reminders - it is a single confirm action, matching the size of what was actually asked for. A fuller compliance workflow is a later decision if the client asks for one.

**Addendum (2026-07-21, see ADR 015):** the owner-wide `documents` fallback described above (b) is correct and unchanged for identity/title-deed documents, but was also - unintentionally - being used to answer "does *this* property's mandate have a signed letter on file," which let one property's uploaded letter read as "attached" on every other property the same landlord owns. Mandate letters now also carry `propertyId` (in addition to `ownerContactId`) and every "is the mandate letter attached" check is scoped to it via `mandateLetterStatus()`/`findMandateLetterDocument()` (`src/components/sunland/mandate-constants.ts`). The owner-wide OR fallback in `getPropertyWithDetails` itself is untouched - it still correctly surfaces ID/title-deed documents landlord-wide.

### 14.5 What this ADR does not build - explicit deferral

Per the client's own framing ("if it is scope otherwise document it"), the following are real, specified, but **not built**, and not implied to be built by anything above:

- **BD Landlords page** (`/admin/business-development/landlords` - Directory, Mandate Status, Prospecting tabs) and **BD Liaison & Requests** (`/admin/business-development/liaison`) - `SUNLAND_BD_DASHBOARD_SPEC.md` §8.1/§8.4. No route, no schema beyond what `property_mandates`/`documents`/`contacts` already provide incidentally.
- **Front Office Paperwork module** (`/admin/front-office/paperwork` - Application Forms, Offer Letters, Mandate Letters tabs with their own Drafted→Sent→Signed/Returned→Filed lifecycle and cross-department Pusher events) - `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md` §8.4. Today, a mandate letter (or an offer letter, or a title deed) is just a row in the existing generic `documents` table with the right `type` - there is no dedicated formalization workflow, signature capture, or status ladder around it.
- **Prospecting stage tracking** (Initial Contact / Proposal Sent / Negotiating / Mandate Drafted) - no table exists for this; a mandate today either doesn't exist yet or exists as a `property_mandates` row starting at `pending_approval` (or `active` for self-approving creators). The pre-mandate courtship phase has no persisted record.
- **Finance's dedicated Mandates module** (`/fin/mandates`, `SUNLAND_FINANCE_DASHBOARD_SPEC.md`) remains the pre-existing mock board (unrelated to this ADR, already flagged as a follow-up rewire in the WS3 plan) - the CEO-admin property full-view is the practical interim surface for mandate creation/approval/termination until that page is rewired.

**Rationale & build detail:** `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` §4.3, `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` (mandate letter flow cross-module summary), `SUNLAND_EXECUTIVE_DASHBOARD_SPEC.md` §6.2 (approval threshold table), `SUNLAND_BD_DASHBOARD_SPEC.md` §8.1/§8.4, `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md` §8.4, ADR 013 §13.1 (Head of Strategy).

---

## ADR 015: Property Lifecycle Unification - Paperwork Completeness, Mandate Queue Hosted on CEO Admin, Real CRM Backend

**Context:** Client asked to step back and look at the full property lifecycle end to end - valuation → mandate → active management → sales/marketing → tenancy → remittances - and to reconcile the 132 already-seeded properties/57 mandates against the rule that a property isn't really under Sunland's management without a signed mandate letter on file. Per ADR 014 §14.5, the actual gap isn't "does a mandate exist" (most do) - it's that no mandate, seeded or created through the app, has ever been required to have a `documents.type = 'mandate_letter'` row matching its own property, and the one upload path that existed scoped letters to the landlord contact, not the property (see 14.4 addendum above). Client's follow-up direction on the resulting plan, given inline: (1) build a real mandate-letter paperwork queue **now**, hosted on CEO admin rather than waiting for the Front Office module ADR 014 §14.5 deferred - "we will replicate functionality to front office when building out their dashboard" once it exists; (2) build a **real backend** for the CRM/BD pipeline (`leads` table + `pipeline-board.tsx`, previously 100% mock with no API routes) - "the front end will be done shortly after," i.e. the visual redesign to match the BD dashboard spec is separately scoped, but the data layer underneath it should be real now; (3) fold in the pre-existing `listingType` vocabulary mismatch (`"Rent"/"Sale"` written by the live property form vs. the canonical `"sale"/"let"` every other read site checks) as in-scope for this pass rather than deferred.

### 15.1 Mandate-letter paperwork completeness is now a real, correctly-scoped, derived signal

No new column. `mandateLetterStatus(documents, propertyId)` (`src/components/sunland/mandate-constants.ts`) resolves `"verified" | "pending_upload"` from the existing `documents` table, scoped by `propertyId` (see 14.4 addendum). Surfaced on the mandate file, the property file, and the new paperwork queue (15.2). No mandate's `status` (`draft|pending_approval|active|terminated`) is gated on this - a mandate can still activate without a letter, exactly as before; this ADR makes the gap visible and correctly scoped, it does not (yet) enforce it. Enforcement is a future decision once Front Office genuinely owns the intake step.

### 15.2 Mandate paperwork queue, hosted on CEO admin (`/admin/mandates`)

**Decision:** partially reverses ADR 014 §14.5's Front Office Paperwork deferral, scoped narrowly: a real, API-backed list of every mandate (`listMandates`, `src/lib/services/mandates.ts`) with its activation status, its paperwork status (15.1), and its acquisition origin (15.3), replacing the fact that no `/admin/mandates` list page existed at all (only the `[id]` detail route did). Gated the same way every other mandate-mutating surface already is (`properties.property.write`) - not a new permission, and specifically **not** granted to `front_office_head`/`front_office_admin` yet, since those roles have no real dashboard to exercise it from today. Row actions reuse existing real mechanisms rather than inventing new ones: "Attach Letter" opens the existing `MandateLetterModal` (now correctly scoped, 14.4 addendum); a mandate `pending_approval` links out to the existing Approvals Queue (`/admin/approvals`) rather than duplicating `decideApprovalRequest`. The internal Draft Received → Formalizing → Sent for Approval → Signed/Active granularity `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md` §8.4 describes for the eventual dedicated module is deliberately not modelled here - `mandateStatus` + `mandateLetterStatus` together are sufficient resolution for a CEO-level queue. When Front Office's own dashboard is built, this page's component and service function are the intended starting point to replicate/relocate, not a throwaway.

### 15.3 Mandate origin classification - reconciling the 132 seeded properties honestly

**Decision:** rather than fabricate a valuation history for the 57 pre-existing mandates (impossible to do honestly - they were seeded directly, before the acquisition-pipeline `valuations` module existed), a mandate's origin is derived from whether any `valuations` row's `resultingMandateId` points at it. `getMandateWithDetails` now returns `originValuation: { id, valuationCode } | null`; `mandateOriginLabel()` renders it as "Acquisition Pipeline · VAL-..." (linked) or "Legacy / Direct Onboarding." This directly answers the client's reconciliation question: not by flagging existing mandates as "pending valuation" (which would misrepresent already-active management relationships as incomplete), but by being transparent about which mandates have a recorded acquisition trail and which predate it.

### 15.4 CRM/BD pipeline gets a real backend

**Decision:** `leads` (schema already real - `contactId`/`propertyId`/`assignedToId` FKs, `pipeline_stage` enum) gets a real service layer (`src/lib/services/leads.ts`), validation, and API routes (`/api/leads`, `/api/leads/[id]`), following the same `CallerContext`/`authorize`/`writeAudit` template as every other service this build (`mandates.ts`, `valuations.ts`), under the already-catalogued `crm.lead.read`/`crm.lead.write` permissions (previously defined but never exercised by any route). `pipeline-board.tsx` is wired to this real backend (real fetch replacing `INITIAL_LEADS`, real mutations replacing local-state-only stage changes) rather than rebuilt to match `SUNLAND_BD_DASHBOARD_SPEC.md`'s visual design - that redesign pass is explicitly separate, deferred work, per the client's own framing. Per ADR 013 §13.7/ADR 007's superseded note, `line_manager`/`bd_agent`/`bd_head`/`agent` are retired aliases folded into `property_manager` - the real assignee picker sources `property_manager` (and `head_of_strategy`) users, not the retired role slugs, even though `lead-form-modal.tsx`'s old mock UI used fictional "broker" names that suggested otherwise.

### 15.5 `listingType` vocabulary normalization

**Decision:** the canonical vocabulary is the lowercase `"sale" | "let"` already defined as `ListingType` (`src/components/sunland/property-constants.ts`) and already what every strict-equality behavioral branch in the property detail page checks. The live "New/Edit Property" form (`property-form-modal.tsx`) previously wrote Title-Case `"Rent"/"Sale"`, which matched none of those checks. Normalized to write the canonical values directly (not translated at read time), and the same fix applied to every other hardcoded non-canonical write site found this pass (`mandate-full-view-board.tsx`'s local rail-preview object, `signMandateFromValuation`'s property-creation call, and the three oldest hand-written seed properties). Kept as free text, not promoted to a Postgres enum - normalizing the vocabulary closes the real bug; changing the column type is a separate, larger, not-currently-warranted change.

**Rationale & build detail:** `docs/PROPERTY_LIFECYCLE_ARCHITECTURE.md` (full lifecycle map + future Front Office/CRM seams), ADR 014 (mandate letter flow this extends), `SUNLAND_BD_DASHBOARD_SPEC.md`, `SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md`.

---

## ADR 016: Mandates Folded Into Leases, Maintenance Board Precision Rebuild

**Context:** Two follow-up asks against the same Property Portfolio family. First, the standalone mandate paperwork queue ADR 015 §15.2 built at `/admin/mandates` duplicated functionality that belongs on `leases-board.tsx`'s existing "mandates" mode (the page is explicitly split between management mandates and tenant leases already) - client asked to fold it in and remove the separate route. Second, the Maintenance Board (built R1-R10, a functional-but-plain kanban+list hybrid) needed a precision rebuild against a Claude Design mockup (project "Property Command Center Overhaul", file "Maintenance Board.dc.html") to match the visual/interaction conventions already established on Properties/Leases/Valuations - GSAP stagger, real toasts, skeleton loaders, KPI icon-artwork watermarks, ring gauges, the richer activity-log convention - "production grade... precision and prowess," not an approximation.

### 16.1 Mandates queue folded into `leases-board.tsx`; standalone route removed

**Decision:** `listMandates` (ADR 015 §15.2) already unconditionally returns `paperworkStatus`/`originValuation` on every row - the fold-in was purely additive client-side surfacing on the existing mandates-mode table/grid/mobile-card renders (paperwork badge, origin label, a "Letter pending only" filter toggle, a 6th KPI tier cell, and the same Attach-Letter/Review row action the old queue board had), not a new fetch or service change. `src/components/sunland/mandates-queue-board.tsx` and `src/app/(app)/(ceo)/admin/mandates/page.tsx` are deleted; the nav-model `/admin/mandates` entry is removed. The real per-mandate detail route (`/admin/mandates/[id]`) is untouched - it was never part of the duplication, and is still linked from `leases-board.tsx` in six places.

### 16.2 Maintenance status/severity/category - a real migration, not a display alias

**Decision:** the Maintenance Board design models a materially richer domain than the R1-R10 build did, and the gap is closed with real Postgres enum changes, not UI-layer aliasing over the old values - aliasing here would recreate the exact vocabulary-drift bug already fixed twice this build (`listingType`, ADR 015 §15.5; mandate-letter scoping, ADR 014 addendum), since the new design's filter tabs, stepper, and row coloring all key directly off these values.

- **Status** (`maintenance_status`): `open|assigned|in_progress|resolved|closed` → `reported|awaiting_approval|scheduled|in_progress|done`. `reported` = new/unactioned; `awaiting_approval` is a real gate a cost-approval submission moves a request into and out of (16.4); `scheduled` means a real calendar visit exists (16.3), not "a contractor is assigned" (contractor assignment no longer implies a status change at all); `resolved`+`closed` collapse into the single terminal `done`.
- **Severity** (`maintenance_priority`, column name unchanged, UI label becomes "Severity"): `low|normal|high|critical` → `routine|urgent|critical`. `low`+`normal`→`routine`, `high`→`urgent`, `critical` unchanged.
- **Category** (new `maintenance_category`): `reactive|planned|compliance`, `NOT NULL DEFAULT 'reactive'`. All pre-existing catalog items are genuinely reactive tenant-reported repairs; the seed adds a handful of honestly-labeled `planned`/`compliance` entries (a quarterly generator preventive service; a fire-extinguisher and a lift-inspection compliance renewal, one with a real near-term `dueAt` so the Needs Attention band has real content) rather than reclassifying existing reactive rows.

Migration applied by hand-writing the drop/recreate SQL (`0026_maintenance_status_priority_category_calendar_link.sql`) rather than trusting `drizzle-kit generate`'s output blindly - the same precedent the valuation-stage repurpose (ADR 011-adjacent, migration `0022`) already established for enum-value changes. Confirmed during this pass that `drizzle-kit`'s own snapshot metadata (`meta/NNNN_snapshot.json`) does **not** get updated for enum-value changes even via `generate --custom` (verified both for this migration and retroactively for `0022`, which still carries stale `valuation_status`/`valuation_type` keys) - a standing, previously-unnoticed tooling limitation that does not affect correctness, since `db:migrate` executes the hand-written SQL directly against the live database and never re-diffs against the snapshot at migrate time. Existing `maintenance_requests` rows are cleared before the enum swap (demo data only, immediately regenerated by the next `db:seed`), matching the same reasoning `0022` used.

### 16.3 Real Scheduler integration

**Decision:** the design's "visits sync to the Scheduler" claim is made real, not aspirational copy: `calendar_events` gains a nullable `maintenance_request_id` FK (+ index). `scheduleMaintenanceVisit(ctx, requestId, {startsAt, endsAt, attendees?})` (`src/lib/services/maintenance.ts`) writes both the new `calendar_events` row and the `maintenance_requests.status → "scheduled"` flip inside one transaction, deliberately bypassing `scheduling.ts`'s own `createCalendarEvent`/`updateCalendarEvent` (each of which opens its own independent transaction) specifically to keep that atomicity - "closing the order closes the event" is achieved the same way: `updateMaintenanceRequest`'s generic status setter resolves the linked event's `outcome` to `"completed"` in the same transaction whenever status moves to `"done"`, and `deleteMaintenanceRequest` ("Cancel Order") unlinks and marks the linked event `"cancelled"` before deleting the parent row (required by the FK regardless - no `ON DELETE` cascade was configured). A first-time booking is only valid from `"reported"`; a request that already has a linked event goes through the same function's reschedule path (updates the existing row) rather than creating a second one.

### 16.4 Real cost-approval routing at request creation, not just at submission

**Decision:** `createMaintenanceRequest` now accepts an optional `estimatedCostKes` and routes it through the same `costApprovalTierFor` ladder `submitMaintenanceCostForApproval` (ADR 015-adjacent, R4) already used: an auto-tier estimate stamps `actualCostKes` immediately and the request opens at `"reported"`; a gm/ceo-tier estimate creates a real `approvalRequests` row and opens the request directly at `"awaiting_approval"`. `submitMaintenanceCostForApproval` itself gained a status guard - it only advances the gate from `"reported"`, so a cost bump submitted once a request is already `"scheduled"`/`"in_progress"` doesn't regress it backward. `decideApprovalRequest`'s existing `maintenance_requests` branch (R5) now reverts status from `"awaiting_approval"` back to `"reported"` on either an approve or a reject decision - the decision is what the request was waiting on, not a status of its own. `listMandates` additionally selects `maintenanceAuthorityKes` (previously only present in `getMandateWithDetails`), since the New Work Order modal's live routing-preview text needs a real per-property auto-approve ceiling, not a hardcoded one.

### 16.5 The mockup's "landlord portal" claim - kept the real mechanism, corrected the copy

**Decision:** the design's mid-cost-tier copy ("landlord approval captured via portal") has no real backing anywhere in this app - no tenant/landlord portal exists. Per this build's established anti-fabrication discipline (same resolution already applied to mandate origin, ADR 015 §15.3), the real, already-working GM-approval mechanism is kept unchanged and only the *displayed* copy is corrected, in both the New Work Order modal's routing-preview text and the work-order drawer's Cost & Approval note, to reference real GM sign-off with real settings-backed threshold values interpolated in - never the design's hardcoded "25k"/"100k".

### 16.6 Maintenance Board precision rebuild

**Decision:** `maintenance-board.tsx` and `report-issue-modal.tsx` were rebuilt against the Claude Design mockup with colors/copy lifted verbatim (not rounded to the nearest Tailwind palette step) into `maintenance-constants.ts`'s `STATUS_META`/`PRIORITY_META`/`CATEGORY_META`/`SLA_STATE_META` - deliberately distinct from the generic `Badge` component's tone palette, matching the mockup's own borderless `pill(bg, fg)` recipe. Reused existing app-wide conventions rather than inventing new ones: the `bg-tertiary-gradient` utility (already byte-identical to the design's KPI-strip gradient), the SLA ring-gauge SVG technique already used in `leases-board.tsx`/`properties-board.tsx`, and a new `WorkOrderRowsSkeleton` following `leases-board.tsx`'s own `ListRowsSkeleton` precedent (replacing a centered spinner with a content-shaped loading state). The design's per-request photo thumbnails are not reproduced (no real per-request image exists - an icon tile is used instead, consistent with this build's anti-fabrication discipline). `maintenance-full-view-board.tsx` (the secondary "open full file" page) picked up the `VitalTone`/`VITAL_TONE_BG`/`VITAL_TONE_BADGE_BG`/`VITAL_TONE_VALUE`/`VITAL_TONE_ARTWORK` quartet and icon-watermark technique from `lease-full-view-board.tsx`, `.gsap-stagger` on the vitals grid and rail (previously absent), and the richer search + tone-dot + relative-time-badge activity-log convention (also from `lease-full-view-board.tsx`), scoped down from that page's full search/filter/pagination treatment to just search + tone-dot/badge, appropriate to this page's shorter activity lists. `property-full-view-board.tsx`'s maintenance consumers (`PriorityPill`/`MaintenanceStatusPill`, the critical-count and open-maintenance filters) and `dashboard.ts`'s `openMaintenanceCount` were updated for the new vocabulary in the same pass.

**Rationale & build detail:** Claude Design MCP project "Property Command Center Overhaul", file "Maintenance Board.dc.html"; ADR 015 §15.1/§15.2 (mandate-letter scoping and paperwork queue this extends/folds in); `lease-full-view-board.tsx` (VitalTone quartet and activity-log source pattern); `leases-board.tsx`/`properties-board.tsx` (ring gauge and skeleton-loader source pattern).

## ADR 017: Sales Pipeline + Contacts CRM Precision Rebuilds - Real Deal Priority/Notes/Documents, Real Contact Touch-Logging, Real Viewing Scheduling

Following ADR 016's Maintenance Board precision rebuild, the client asked for the same treatment across the "Sales & CRM" family: the Sales Pipeline board first, then Contacts. Both pages already had *some* real backend (ADR 015 §15.4 for leads; the original CRM contact CRUD), but each had concrete fabrications the visual rebuild pass closed at the same time.

### 17.1 Sales Pipeline - `leads.priority`, real persisted notes, adjacency-guarded stage transitions

**Decision:** added `pipelineLeadPriority` enum (`low|medium|high`, default `medium`) as a real column on `leads` (the design's own 3-tier selector - deliberately not named "severity", which is maintenance's vocabulary per ADR 016 §16.2). Added a dedicated `lead_notes` table (`id, entityId, leadId, authorId, text, createdAt`) rather than upgrading the existing singular `leads.notes` column (which stays as-is - a different concept, the requirements summary captured at creation) - `lead_notes` is a real, timestamped, multi-entry interaction log the deal-peek drawer's Activity/Notes tabs merge into one sorted timeline. `documents.leadId` (nullable FK + index) mirrors the existing `propertyId`/`leaseId`/`valuationId` optional-scope pattern, giving leads a real Files tab reusing the app's existing title+type+URL upload mechanism (no binary-upload path exists anywhere in this codebase). `transitionLeadStage` gained a real `canMoveLeadStage(from, to)` server-side adjacency guard (mirrors valuations' `canMoveToStage` precedent) - only adjacent stages in `inquiry→qualification→viewing→offer→negotiation→closed_won` are allowed, except "Mark Lost", valid from any non-terminal stage (matching the design's own `canMove()`, which has no `closed_lost` branch at all).

**Anti-fabrication note:** the design's month-over-month analytics deltas (e.g. "14%") are illustrative and were not copied - real deltas are computed only where an honest prior-month baseline exists (closed-won value, win rate, avg days-to-close, all bucketed from real `closedAt` timestamps); point-in-time stage counts (active viewings, offers-in-play) show no delta at all rather than a fabricated one. The design's fake internal "Messages" chat-bubble tab was dropped entirely (no real two-way client-messaging channel exists) in favor of real `tel:`/`mailto:`/`https://wa.me/` deep-links using the contact's real phone/email.

Migration `0027_sales_pipeline_priority_lead_notes_documents_link.sql`.

### 17.2 Contacts CRM - real edit/delete, real touch-logging, real viewing scheduling, derived (not stored) status

**Decision:** `updateContact`/`deleteContact` were entirely missing from the service layer before this pass - `contacts-board.tsx`'s edit flow was a client-only no-op and delete/bulk-delete never called any API. Both are now real, with `deleteContact` blocking on real referencing rows (leads, landlord mandates, tenant leases, owned properties) via `ConflictError`, mirroring `deleteProperty`'s existing guard pattern, rather than surfacing a raw Postgres FK-violation.

`calendar_events` gained nullable `contactId`/`leadId` FK columns and a new `"viewing"` enum value (mirrors the existing `maintenanceRequestId` precedent, ADR 016 §16.3) - "Today's Viewings" and "this contact's next viewing" are now real relational queries instead of unlinkable free-text `attendees` entries. `logContactTouch(ctx, contactId, channel)` is a new function writing a real `activityLogs` row via the standing `writeAudit` choke point - this makes real what was previously only a hand-authored seed-data illustration (a static `crm.contact.call_logged` row with no live code path producing it). `getContactsCrmOverview(ctx)` is the one new aggregate backing the page's hero stats, hot-leads digest, follow-ups-due digest, today's viewings, and the Quick Connects touch feed - one server-side "fetch then reduce in JS" pass, no SQL groupBy, matching every other aggregate in this service layer.

Contact "status" (Active Client / Hot Prospect / Prospect / New Contact) is **derived at read time from real signals** (active lease/mandate → Active Client; open high-priority lead → Hot Prospect; any open lead → Prospect; else New Contact) - deliberately not a new stored column, avoiding a second status machine parallel to `leads.stage` that could drift out of sync with it (same reasoning as scheduling's existing `needsDisposition` computed flag).

**Fixed a live bug in the same pass:** the contact type picker used an 11-value fictional union (`property_owner`, `investor`, `developer`, `financial_institution`, `advocate`, `valuer`, `government_agency` don't exist in Postgres) against the real 7-value `contact_type` enum (`landlord|tenant|buyer|seller|contractor|company|other`) - selecting any of the fictional values would have thrown a raw DB enum-violation error. The frontend now uses the real enum exclusively (`contact-constants.ts`).

`contact-detail-drawer.tsx` (confirmed 100% mock - no fetch calls, notes typed into it vanished on refresh) was retired outright; the app's real full-profile experience is `contact-full-view-board.tsx` (`/admin/contacts/[id]`, already wired to `getContactProfile`), left untouched this pass. A new compact `contact-profile-peek.tsx` mini-drawer (the design's own bespoke pattern, distinct from the full-page view) handles quick peeks from a lead card or a Quick Connects row.

Migration `0028_contacts_crm_calendar_viewing_link.sql`.

### 17.3 Seed data - closing the same gap ADR 016 §16.2 already named for maintenance

**Decision:** the original pipeline seed left 5 of 8 leads with no `contactId` at all - harmless before this rebuild (the old board never joined to `contacts`), but `listLeads()` now inner-joins `contacts`, so a contact-less lead is invisible on the board, not just incomplete. Seed extended with 7 new real `buyer`/`seller`/`company`-type contacts (the seed previously only ever generated `landlord`/`tenant`/`contractor`), every lead given a real `contactId` plus priority/`nextActionAt` variety, 3 real `lead_notes` rows, 2 real lead-scoped `documents`, 2 real `type: "viewing"` calendar events (one today, one tomorrow, both linked to a real lead/contact), and 4 additional real `crm.contact.*_logged` touch rows across the new contacts for the Quick Connects feed to show genuine variety on first load. Also fixed a latent seed-cleanup bug found in the same pass: `lead_notes` was never cleared in Step 1's reverse-dependency-order delete sequence, which would throw a foreign-key violation the first time a reseed ran against a database that had any lead notes in it.

**Rationale & build detail:** Claude Design MCP project "Property Command Center Overhaul", files "Sales Pipeline.dc.html" and "Contacts CRM.dc.html"; ADR 016 §16.3 (the `calendarEvents.maintenanceRequestId` precedent §17.2's `contactId`/`leadId` FKs mirror); `deleteProperty` (`src/lib/services/properties.ts`, the delete-guard pattern `deleteContact` mirrors); `lead-detail-drawer.tsx`/`maintenance-board.tsx` (hero-bleed drawer and activity-log conventions reused for the deal-peek and contact profile-peek drawers).



## ADR 018: Account & System — Dual-Scope Console (Personal + Organization), Real-Time Notifications, Real TOTP 2FA

The client asked to build the "Account & System" pages from the Claude Design MCP. Reviewing the v2 design surfaced a real product gap the client confirmed: a CEO/super-admin needs to control **both** their own personal account **and** the whole organization from one surface, with a clean distinction. The re-generated `Account & System v3.dc.html` fills it with a **Personal / Organization scope switcher** (mirroring the Leases page's Mandate/Tenant toggle) driving two different section sets. This ADR records the rebuild to that model.

### 18.1 One dual-scope console (IA consolidation)

**Decision:** the four separate personal self-service routes (`/admin/messages`, `/settings`, `/notifications`, `/security`) **and** the standalone `/admin/system` System Administration page are consolidated into one component, `account-system-board.tsx`, at `/admin/account`, driven by `scope: "personal" | "org"` + a per-scope active section (deep-linkable via `?scope=&section=`). The five legacy routes become one-line `redirect()`s into the console (preserving nav entries, notification deep-links, and bookmarks); `system-admin-board.tsx` is **retired** (its three tabs — users/roles, thresholds, audit — are absorbed by the org scope's Directory & Roles, Access Policies, and System sections). `nav-model.ts` collapses the 4-item "Account & System" group to a single console entry and drops the Oversight "System Administration" link. Shared primitives live in `account-ui.tsx`; the six section components live in `account-sections.tsx`; client-safe role-tier/scope/section/category maps live in `account-constants.ts` (imported by both the UI and the service layer, the same cross-import pattern `lead-constants.ts` established). Personal sections: **Messages · Notifications · Preferences · Security**. Org sections: **Directory & Roles · Access Policies · System**.

### 18.2 Real backend the console needs (new schema + services)

**Decision — schema (migration `0029`):** `users.phone`, `users.passwordChangedAt` (real password-age signal), `users.totpSecret` + `users.totpEnabledAt` (real TOTP state); new `user_preferences` table (per-user display prefs — the user-scoped counterpart to the entity-scoped `settings` table) and new `notification_prefs` table (per-user, per-category in-app/email/SMS matrix). Org-wide defaults (currency/timezone/fiscal-year/remittance-day/legal-name/seat-cap) and access policies (2FA-enforce/SSO/IP-allowlist/device-trust/dual-remit/pwd-strength/session-timeout) reuse the existing entity-scoped `settings` KV — no migration.

**Decision — services:** `getUserPreferences`/`upsertUserPreferences`; `getNotificationPrefs`/`updateNotificationPrefs` with **`createNotification` now consulting the in-app pref** for known categories (real gating — a muted category is genuinely suppressed; `maintenance` is force-on; explicit `sendManualNotification` bypasses via `bypassPrefs`); `revokeAllOtherSessions`; a real self-service `changePassword` (verify current → rehash → stamp `passwordChangedAt` → revoke all other sessions, keeping the current device); real **TOTP** enroll/verify/disable via `otplib` v13's functional API (`generateSecret`/`generateURI`/`verify`) with `qrcode.react` rendering the QR client-side; `getSecurityOverview` (score + sessions + access log) with `computeSecurityScore` as a pure helper; `getDirectoryOverview` (per-role-tier counts + pending-never-signed-in members, fetch-then-reduce-in-JS); `getOrgPolicies`/`updateOrgPolicies` + `computeOrgSecurityScore`; `getIntegrationHealth` (config-derived); `getAccountConsolePulse` (the 4 real pulse cells per scope). **Login is now audited** (`setSession` writes an `auth.login` row + stamps `lastSignedInAt`), so the Security access log and org audit log are genuinely populated for auth events — they weren't before.

### 18.3 Real-time robustness (Ably) — closing the "publisher with no subscriber" gap

**Decision:** `createNotification` already published to `private-user-{userId}` but **nothing subscribed** — the nav bell and notifications page were fetch-once. The nav bell (`top-nav.tsx`) and the console's Notification inbox now subscribe via the existing `useAblyChannel` hook, so notifications land live. Messages carry their existing real `conversation-{id}` Ably publish/subscribe (reused, not forked — the console **embeds** the already-real, already-live `MessagesPageContent` rather than duplicating a battle-tested messaging implementation). Added real **Ably presence** (`getAblyToken` grants presence on `presence-entity-{entityId}`; a small `usePresence` hook) so the Directory's "Active now" dots and message online indicators are real, degrading honestly to last-active from real `sessions`/`lastSignedInAt` when Ably is unconfigured.

### 18.4 Confirmed scope decisions & honest deferrals

**Client-confirmed:** (1) **2FA** = real TOTP enrollment + verify + stored enabled-state feeding the real security score, but **no login-time enforcement** this pass (a bigger, riskier change to the core auth flow — deferred deliberately). (2) **Billing & Seats tab omitted** entirely (no billing system/Stripe/invoice records exist) — org scope ships Directory, Access Policies, System only; real seat usage still surfaces on the personal pulse (derived from real active-user count vs a `settings` seat cap). (3) **Route consolidation** = one console + legacy redirects + retire `system-admin-board.tsx`.

**Honest deferrals (anti-fabrication discipline, carried from ADR 015–017):** no SMS/email **delivery** provider exists — the routing matrix stores those preferences and labels them "delivery pending provider" rather than faking sends (same pattern as the M-Pesa paybill scaffold, ADR H4); integration health is **config-derived** and truthfully shows M-Pesa/email/SMS as "inactive" rather than a fabricated "healthy"; org-policy **enforcement** points beyond the already-real approval threshold, the notification **digest cron**, real backups/API-key management, and 2FA login enforcement are all flagged as future work, not faked.

**Rationale & build detail:** Claude Design MCP project "Property Command Center Overhaul", file "Account & System v3.dc.html"; ADR 016 §16.3 (`calendarEvents` FK precedent the presence/notification wiring parallels); `lead-constants.ts` (client-safe-constants-imported-by-service pattern `account-constants.ts` reuses); existing `messaging.ts`/`use-ably-channel.ts`/`notifications.ts` Ably infrastructure (reused, extended with presence + a real subscriber). Verified live end-to-end via a throwaway additive-only E2E script (8 checks: profile-phone, user-preferences round-trip, notification routing gate incl. force-on maintenance, password change, TOTP enroll→verify→disable, revoke-all, org-policy round-trip, directory/pulse/integration-health) plus a clean `tsc` and production build.

## ADR 019: Operations Scheduler, Projects Board & Messenger — Premium Rebuild + Grouped-Nav Restoration

Three surfaces were still "basic shells" (flat `KpiCard` rows, list/grid, one modal): the Events board, the Projects board, and the shared Messenger. This ADR records rebuilding them to the Claude Design MCP mockups — **`Portfolio Scheduler.dc.html`**, **`Projects Board.dc.html`**, and the Messages screen — at the production bar the Leases board set, plus a design-law pass over the Account & System console shipped in ADR 018.

### 19.1 The Account & System console's premium pass (and a nav correction)

**Decision:** the console's three files were normalized against the codebase's own design law (`.agents/AGENTS.md`, `.agents/skills/workflow-fixes/SKILL.md`): every `font-semibold` → `font-medium`, every arbitrary pixel size (`text-[15px]`, `text-[13.5px]`, `text-[11px]`, `text-[10.5px]`…) → a semantic class, `font-serif` → `.title-serif` via the shared `BoardHeader`, the bespoke `ModalShell` → the shared `Modal`, and `ConfirmDialog` gates added to revoke-session / sign-out-all / disable-2FA / deactivate-member. Content-shaped `SkeletonBlock` loaders replaced the remaining blank branches.

**Type-scale rule (now house style):** `text-sm` and `text-xs` are the workhorses. **`text-xxs` (10px) is reserved and used sparingly** — uppercase micro-badges, count chips inside pills, dark-tier stat captions, mono timestamp microcopy. It is never the default for body copy, card meta, list rows, or form labels. Converting an old `text-[10.5px]`/`text-[11px]` lands on `text-xs` unless dropping further is a deliberate density call.

**Nav correction:** ADR 018 collapsed the four-item "Account & System" group into a single "Console" entry and pulled System Administration out of Oversight. That broke uniformity with every other nav group, so the **grouped links are restored** (Messages · Notifications · Preferences · Security, plus System Administration back in Oversight). The routing constraint that forced the original collapse is real and is now solved properly: `getActiveNavItem` matches on `pathname.startsWith(href)` and **pathnames drop the query string**, so nav items pointing at `/admin/account?section=…` would all tie. Instead the five legacy routes are **real pages again** — each renders `AccountSystemBoard` with `startScope`/`startSection` rather than redirecting — and the console's URL-sync writes the *pretty route* for the active (scope, section) via a single canonical `consoleRouteFor`/`consoleStateForPath` map in `account-constants.ts`. Org sections without their own nav entry (`policies`, `system`) hang off `/admin/system?section=`.

### 19.2 One unified Operations Scheduler, with a real personal/org axis

**Decision:** the standalone Events board is retired and absorbed into a new `portfolio-scheduler-board.tsx` at **`/admin/scheduler`**, driven by `mode: events | projects` **and** `scope: personal | org`, both deep-linkable. The scope switcher is not decoration: `listCalendarEvents` already supported **`scope: "mine" | "all"`** (self-scoped needs no permission; org-wide is gated by `scheduling.event.read`), so Personal/Organization maps straight onto a real, already-authorized service axis — the same personal-vs-org distinction the console and the Leases mandate/tenant toggle established. `/admin/events` becomes a redirect; the nav Scheduling group is **Scheduler + Projects**.

The surface is real-derived throughout: the dark **Operations Pulse** hero (greeting, date, clickable stat chips, glass "Up next" card with a live countdown) is backed by a new `getSchedulerPulse(ctx, scope)` aggregate; the month grid and year planner plot real events and real project spans; the day agenda derives **overlap** from genuinely colliding event times; the rail's **This Week** bars, **Reminder queue** and **Recently notified** come from real events and real notifications.

### 19.3 Full-real backing for what the designs imply (migration `0030`)

The mockups showed project milestones, an "At Risk" kanban column, event criticality and per-event "Notify roles". None had DB backing. Rather than fake them, `0030` adds (all additive, nullable or defaulted):

- `projects` += `milestones` jsonb, `atRisk` bool, `startDate` date, `budgetKes` numeric, `linkedRecordType`/`linkedRecordId`.
- `calendar_events` += `isCritical` bool, `notifyRoleTiers` jsonb.
- `conversations` += `linkedRecordType`/`linkedRecordId`/`linkedRecordCode`, and `conversation_type` gains **`system`**; `conversation_participants` += `archivedAt`.

**Decision — "At Risk" is a flag, not a stage.** The kanban four columns are a *view* over `(status, atRisk)`, because an at-risk project is still genuinely in progress everywhere else in the system. `boardColumnFor`/`boardStateForColumn` in `scheduler-constants.ts` own that mapping, and a drag writes both fields together through `setProjectBoardState` (which also forces 100% progress on landing in Done, so a completed card cannot still read 40%). Milestones are indexed into the stored array via `toggleMilestone` — a milestone has no identity beyond its parent project, the same reasoning `properties.media` uses.

**Decision — "Notify roles" produces real notifications.** `notifyEventRoleTiers` resolves the selected presentation tiers to real users through `roleTierFor` (fetch-then-reduce in JS — the 24-value enum to 6-tier collapse cannot be a SQL predicate), then writes real `createNotification` rows, which already publish to Ably `private-user-{id}` and therefore land live on the nav bell and the console inbox. A recipient who has muted the category is genuinely suppressed and **not** counted as delivered.

### 19.4 Messenger rebuilt in place — and system threads that actually have a producer

**Decision (supersedes an ADR 018 call):** ADR 018 chose to *embed* `messages-page-content.tsx` rather than rebuild it. That surface is now rebuilt **in place**, so `/fin/messages` and every other portal inherits the upgrade rather than a fork: a two-pane card with an inbox (search, **All / Unread / People / System** filters, avatar-or-icon-tile rows, a "You:" prefix, category badge + mono record code, unread dot) and a thread pane (presence dot, `tel:` call, archive, **linked-record strip** with status pill and "Open record", date dividers, contextual **quick-reply chips**, composer).

The honesty rules that made ADR 018 drop the mockup "Ledger"/"Compliance Register" threads are satisfied rather than waived: system threads are now a real `conversation_type`, appended to by **real producers** — a released remittance (`finance/remittances.ts`) writes to the *Ledger* feed, a maintenance status move (`maintenance.ts`) writes to the *Maintenance Desk* feed — via a shared `appendSystemMessage`. `messages.senderId` is the acting user, not a synthetic system account: the column is `NOT NULL` and a real actor is more useful in an audit. Quick replies are derived from the linked record real type and post real messages; the call button is an honest `tel:` link off the real `users.phone` column (hidden when absent), not a telephony stack.

### 19.5 Honest deferrals

SMS delivery has no provider anywhere in the codebase — notify reports `smsPending` and the UI labels it "pending a provider" rather than reporting a send that never happened (the M-Pesa paybill precedent, ADR H4). There is still **no cron**, so the Reminder queue is honestly a *preview of events inside the next 24 hours*, not a queue of scheduled jobs; delivery happens when someone notifies. 2FA login enforcement remains deferred from ADR 018.

**Rationale & build detail:** Claude Design MCP project "Property Command Center Overhaul" (`Portfolio Scheduler.dc.html`, `Projects Board.dc.html`, Messages screen); `leases-board.tsx` (dark KPI tier + skeleton reference), `pipeline-board.tsx` (kanban drag-and-drop reference), new `scheduler-constants.ts` (shared board/event vocabulary, cross-imported by both boards). Verified by a clean `tsc` + `eslint` across every touched file and a throwaway additive-only E2E (21/21) covering milestone toggle, at-risk board-state, date/budget/linked-record writes, `notifyEventRoleTiers` against real users, personal-vs-org pulse, and the messaging system-feed / linked-record / archive / `lastMessageSenderId` paths.
