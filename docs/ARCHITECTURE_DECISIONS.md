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

## ADR 005: Routes Are Department-Scoped Under `/admin` — ⚠️ SUPERSEDED by ADR 009

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

## ADR 007: Landing Page Redirection and Access Emulation Profiles — ⚠️ role list SUPERSEDED by ADR 013

To make local development, QA, and client review streamlined, the main landing page (`/`) redirects automatically to the secure `/login` route.
The login page contains an "Authorized Workspace Portals" switcher that emulates the six core client roles we are building out dashboards for:
1. CEO (`ceo` - Paul Amos)
2. General Manager (`general_manager` - Grace Mutua)
3. Head of Finance (`finance_head` - Dennis Munge)
4. Head of HR (`hr_head` - Cody Fisher)
5. Line Manager / Business Dev (`line_manager` - Jared Omondi)
6. Front Office Lead (`front_office_head` - Sharon Koech)

All emulated profiles are backed by real database users seeded in both `src/db/seed.ts` (CLI) and `src/app/api/auth/seed/route.ts` (API route) using the default password `sunland-demo` to preserve compatibility.

> **Superseded:** the six-role list above predates the client's finalized org structure. "Line Manager" no longer exists (folded into Property Manager mid-build); Head of Strategy, Admin (CEO's Assistant), Senior Accountant, and Internal Auditor are new. The mechanism this ADR describes (emulated login profiles backed by real seeded users) still stands — only the roster is stale. See ADR 013 for the current roster.

## ADR 008: Universal Self-Service Access Paths — ⚠️ SUPERSEDED by ADR 010
Common account modules (Profile, Settings, Security, Messages, Notifications) are hosted under the `/admin` path group but are whitelisted under `UNIVERSAL_PATHS` in [roles.ts](file:///c:/Users/user/OneDrive/Documents/Sunland/sunland-crm/src/lib/auth/roles.ts). This ensures that any authenticated employee (e.g. Finance Officer, HR Head) can manage their personal profiles, preferences, and communications without triggering role-based redirects to their department's dashboard roots.

> **Superseded:** hosting self-service under a single `/admin` group is the root cause of the "in `/fin` but Profile routes to `/admin/profile`" defect — it drops users out of their portal shell. Replaced by portal-local self-service (ADR 010). The original is kept for history.

---

## ADR 009: Independent Portal Route Groups — supersedes ADR 005
**Decision:** Every role's dashboard is an independent Next.js route group with its own root and shell: `/exec` (CEO/GM), `/fin`, `/hr`, `/bd`, `/front`, `/ops`, and the external `/landlord` and `/tenant`. No department's functionality lives under another portal's root. The former model of hosting departments under `/admin/*` (ADR 005) is retired; `/admin` becomes — at most — just the executive portal's own root, never a catch-all others nest under.

**Why:** the code had already diverged from ADR 005 (Finance was fully built as an independent `(fin)/fin` group, not at `/admin/finance`), leaving HR/BD/Front-Office stranded under `/admin`. This ADR ratifies the direction the code took and mandates finishing it for every role. Independence is of *route + shell*; the system stays unified through shared data, the ledger, and the approval/notification engines — not shared routes.

**Rationale & build detail:** `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md`.

---

## ADR 010: Portal-Local Self-Service — supersedes ADR 008
**Decision:** Profile, Settings, Security, Notifications, and Messages are rendered **within each portal's own shell**, from **shared components**, at portal-local routes (`/fin/profile`, `/hr/profile`, …). There is no global `/admin/profile`. `UNIVERSAL_PATHS` is removed; the self-service segments (`profile|settings|security|notifications|messages`) are simply permitted under any portal root the user can access. A `usePortalPrefix()` helper + `PortalContext` ensure shared components link within the active portal and never hardcode `/admin/*`.

**Why:** independence of route with unity of implementation — one `ProfilePage` component, rendered locally in every portal — fixes the cross-shell jump while avoiding duplicated code.

---

## ADR 011: Permission-Based, Two-Layer Authorization — extends ADR 004
**Decision:** Authorization is permission-based (`<module>.<resource>.<action>` keys in a `permissions`/`roles`/`role_permissions`/`user_roles` model), enforced at **two layers**: (1) an edge route guard (`proxy.ts`) that gates *which portals* a user may load, and (2) service-level `authorize(ctx, key)` that gates *which actions* a user may perform. Route-prefix gating alone (the current `roleAccess` map) is retired as the sole mechanism. The CEO super-admin holds every permission explicitly (seeded, data-driven — not a code-level bypass); the dev auth bypass no longer defaults to on.

**Why:** route gating cannot express "may view remittances but not approve them." Action-level checks inside the single service write path (ADR-002-adjacent) are the only place money-affecting authority can be enforced and audited.

**Rationale & build detail:** `docs/SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3, `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §5–6.

---

## ADR 012: CEO/System-Administration Is Real API Surface, Not Just a Data Model — extends ADR 011

**Decision:** Built ahead of P1, at the client's explicit direction to make CEO backend authority "the guide going forward." The permission model (ADR 011) is now backed by a full management surface: user CRUD (`/api/identity/users*`), role/permission CRUD (`/api/identity/roles*`, `/api/identity/permissions`), role-grant management (`/api/identity/users/[id]/roles`, `/api/identity/user-roles/[id]`), session listing/revocation (`/api/identity/sessions*`), entity settings/thresholds (`/api/settings`), and an audit-log explorer (`/api/audit`). Sessions are now genuinely revocable (a `sessions` row per login, checked on every `getCurrentUser()` call), not just a table sitting unused.

**Why:** a permission catalog that CEO holds every key of is oversight in name only until there's a real surface to exercise it through — grant/revoke roles, deactivate an account, kill a session, inspect the audit trail. This ADR makes that surface exist and pins down the rules future work must preserve:
1. **`isLastSuperAdmin()`** blocks deactivating or CEO-role-stripping the sole remaining active CEO. Checked inline in `updateUserAccess` and `revokeUserRole`, not layered on as an afterthought.
2. **System roles are immutable via the API.** All 16 real roles are `isSystem: true`; `seedPermissionCatalog()` fully replaces their `role_permissions` on every seed, so an API-side edit would silently vanish. Only custom (non-system) roles can be edited/deleted through the API.
3. **Department heads are global-scope, officers are entity-scope.** Caught live, not designed upfront: `finance_head`/`hr_head`/`front_office_head` must be `scopeType: "global"` (matching the seed data's own choice of `primaryEntityId = group` for heads vs. a specific entity for officers), or a department head scoped only to "Group" cannot act on a resource belonging to any other entity.
4. **No email service exists**, so `createUser` returns a one-time plaintext temporary password in its response rather than building a speculative invite/reset-token flow nothing else needs yet.

**Rationale & build detail:** `docs/SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` §3.4, `docs/SUNLAND_DASHBOARD_PORTAL_ARCHITECTURE.md` §6.

---

## ADR 013: Client-Directed Role Model Update (2026 Q3) — extends ADR 011, updates ADR 007

**Decision:** The client supplied a finalized organizational role roster, replacing the six-role emulation set in ADR 007 and resolving the two placeholders `.agents/skills/workflow-fixes/SKILL.md` had left open ("Admin (CEO's Assistant)" and "Head of Strategy," previously deferred to "a future sprint"). That sprint is this ADR.

**The roster, in full:**

| Role | Slug | Scope | Reports to | Status |
|---|---|---|---|---|
| Chief Executive Officer | `ceo` | global | — | Unchanged |
| General Manager | `general_manager` | global | CEO | Unchanged |
| **Head of Strategy** | `head_of_strategy` | global | GM | **New** |
| Property Manager | `property_manager` | entity | Head of Strategy | Unchanged role, new reporting line |
| Head of Finance | `finance_head` | global | GM | Unchanged |
| **Senior Accountant** | `finance_officer` (relabeled) | entity | Finance Head | **Renamed**, same permission scope |
| **Internal Auditor** | `auditor_compliance` (relabeled) | global | GM (dotted line to CEO) | **Renamed** + **new time-gated access rule** |
| **Admin (CEO's Assistant)** | `admin_assistant` | global | CEO | **New** |
| Head of HR | `hr_head` | global | GM | Unchanged |
| Front Office Head | `front_office_head` | global | GM | Unchanged |
| Landlord | `landlord` | self | — | Unchanged (spec exists, not yet built — see tenant/landlord portal doc) |
| Tenant | `tenant` | self | — | Unchanged (spec exists, not yet built), **complaint routing changed** |

### 13.1 Head of Strategy — the BD/property-management department head

**Decision:** `head_of_strategy` is a new global-scope role sitting above everything the BD dashboard spec (`SUNLAND_BD_DASHBOARD_SPEC.md`) describes as "Line Manager" territory. Per the client: Head of Strategy owns **Property Managers, Line Managers, Sales, and Marketers** — i.e., every commercial/BD-facing function reports through this one department head, the same way Finance reports through Finance Head and HR through HR Head.

This is additive to, not a replacement for, the `property_manager` consolidation already in the codebase (`line_manager`/`bd_agent`/`bd_head`/`agent` were folded into `property_manager` earlier this build — see `src/lib/authz/catalog.ts`'s retired-alias comment). `head_of_strategy` sits *above* `property_manager` in the reporting chain; it does not merge into it.

**Permissions (proposed, mirrors `finance_head`'s oversight shape):**
```
...keysFor("crm")            // full pipeline/contact oversight, not just their own leads
...keysFor("properties")     // full property/lease/maintenance oversight
...keysFor("scheduling")
...keysFor("operations")     // Projects — Head of Strategy is exactly who runs cross-dept initiatives
identity.user.read           // sees their own reports (property managers, sales, marketers)
settings.entity.read
audit.log.read
```
Global scope (`scopeType: "global"`), matching the established rule that department heads are global while officers are entity-scoped (ADR 012 point 3) — a Head of Strategy overseeing property managers across Commercial *and* Residential cannot be scoped to one entity any more than Finance Head can.

### 13.2 Property Managers — explicit dual landlord + tenant scope

**Decision:** Property Managers are confirmed as the single point of contact for **both** landlords and tenants on any property under Sunland's management — not just the landlord-facing mandate relationship the role already had. Per the client: *landlords defer all responsibility for managing their properties to Sunland*, which makes the assigned Property Manager the de facto tenant-relationship owner too, by extension of that mandate.

**Concretely, this means:**
- Tenant complaints/maintenance requests route to the property's assigned Property Manager, not a generic Front Office/Ops queue (supersedes the routing described in `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md` §3.2/§6 — see that doc's updated version).
- Rent arrears visibility for a Property Manager's assigned properties is a first-class view, not something they have to cross into Finance to see.
- Miscellaneous tenant charges (new — see §13.5 below) are also a Property Manager concern.

The client's own framing was that Property Managers should be able to **"handle this all dynamically"** — one working surface per property/tenant, not three separate siloed pages for complaints, arrears, and misc charges. This is a UI/aggregation requirement for whenever the Property Manager portal is built (tenant/landlord portal doc §7 build sequence), not a new table — all three data sources (`maintenance_requests`, `rental_ledger`/lease arrears, and the new misc-charges table) already carry `propertyId`, so a "my properties, everything outstanding" view is a query, not a schema change.

No new permissions needed — `property_manager` already holds `...keysFor("properties")` (covers `properties.maintenance.*`) from the existing catalog; the change is in routing/visibility logic (who gets notified, whose queue it lands in), documented in the tenant/landlord portal spec update.

### 13.3 Finance: Senior Accountant + Internal Auditor

**Decision:** The client named two Finance-department staff roles: **Senior Accountant** and **Internal Auditor**. Mapped onto the existing schema rather than inventing parallel roles that duplicate what's already seeded:

- **Senior Accountant = `finance_officer`, relabeled.** The existing `finance_officer` role (entity-scoped, day-to-day transaction/ledger work) already matches the job description implied by "Senior Accountant" — general ledger entries, transaction recording, rentals/mandates support. No permission change; this is a display-name/title clarification (`name: "Finance Officer"` → `"Senior Accountant"` in `SYSTEM_ROLES`), flagged here as a proposed mapping for the client to confirm rather than assumed silently.
- **Internal Auditor = `auditor_compliance`, relabeled, plus a genuinely new access rule** (§13.4).

### 13.4 Internal Auditor's 90-day delayed finance access — a new authz primitive

**Decision:** An Internal Auditor **requires access to the finance dashboard only after 3 months** in the role. Read literally, this is a probation/trust period: the auditor role is granted immediately (they can start working — org-wide read access per `auditor_compliance`'s existing `allReadKeys()` grant), but the specific slice of that grant covering `finance.*` permissions activates only once 90 days have elapsed since the role was assigned.

**This is the first time-conditional permission in the system.** Nothing in the current `authorize()`/`can()`/`resolveActorPermissions()` chain (`src/lib/authz/{can,resolve}.ts`) has any concept of "granted, but not yet active." Two ways to build it, and the recommended one:

- **(Rejected) Delay the `user_roles` insert itself** — don't grant `auditor_compliance` until day 90. Simpler, but wrong: the client's intent is that the person *is* the Internal Auditor from day one (title, non-finance read access, presumably other duties) — only the finance slice is gated, not the whole role.
- **(Recommended) A `roleGrantedAt` timestamp on `user_roles`, checked inside `authorize()` for finance-module keys only.** Concretely: `user_roles` gains a `grantedAt` column (defaults to `now()`, already implicit via `createdAt` if `...timestamps` is already spread there — confirm and reuse rather than add a duplicate column). `authorize(ctx, key, entityId)` gets a narrow addition: if `key.startsWith("finance.")` and the resolved grant coming from an `auditor_compliance` role assignment is less than 90 days old, treat it as not-yet-granted (throw `ForbiddenError`) even though `can()` would otherwise return `true`. This keeps the general permission model untouched for every other role/module and scopes the new time-gate narrowly to the one case that needs it, rather than generalizing a "probation period" concept the rest of the system doesn't ask for yet.

**Not yet implemented** — this ADR records the decision and the mechanism; the `authorize()` change and the `user_roles.grantedAt` column are next-sprint work, tracked against this ADR.

### 13.5 Admin (CEO's Assistant) — proposed permission design

**Decision:** The client explicitly left this open — *"we'll figure how to auth this based on all other roles, this will be curated to aiding CEO activities"* — so what follows is a **proposed design**, not a client-dictated spec, flagged as such for confirmation before it's built.

Admin is framed as two things at once: partial HR function, and direct CEO support (scheduling, executive requests, triage). The proposed permission set reflects both halves without granting either full HR authority or financial approval authority — an assistant amplifies the CEO's reach, it doesn't inherit the CEO's sign-off power:

```
identity.user.read            // HR-adjacent: can see the org, not edit roles/access (that stays CEO-only)
settings.entity.read          // visibility into thresholds, no write
audit.log.read                // same oversight-adjacent read CEO/GM/Finance Head already get
...keysFor("scheduling")      // runs the CEO's calendar — this is the core "assistant" function
support.ticket.manage         // triages the "admin is the main support endpoint" queue on the CEO's behalf
crm.contact.read, crm.lead.read   // read-only visibility to brief the CEO, no pipeline editing
properties.property.read, properties.lease.read, properties.maintenance.read   // same, read-only briefing visibility
```

**Explicitly excluded:**
- `finance.*` (any) — no approval or transaction authority.
- `hr.complaint.manage` — complaints are confidentiality-gated to HR Head/GM/CEO by hardcoded routing (HR spec §6.4); Admin assisting the CEO does not extend to reading complaint content, including complaints escalated *to* the CEO.
- `operations.project.write` — Admin can see projects (read-only, via a future `operations.project.read` grant if the client wants visibility) but doesn't run them.
- `identity.role.write`, System Administration — CEO-exclusive per ADR 012, unchanged.

Scope: `global` (an assistant to the CEO isn't tied to one operating entity, matching every other department-head-tier role in this system).

### 13.6 Tenant/Landlord portal: complaint routing + miscellaneous charges

Covered in full in the updated `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`:
- Tenant complaints/maintenance requests now route to the property's assigned **Property Manager**, not a generic Front Office/Ops queue.
- A new **Miscellaneous Charges** category (water, garbage — **explicitly not electricity**, which runs on a prepaid token system entirely outside Sunland's ledger) joins rent as a tenant-payable charge type, handled by Property Managers.

### 13.7 What this ADR does *not* change

- The permission catalog's module structure (`<module>.<resource>.<action>`, ADR 011) — new roles are new grants of existing or narrowly-added keys, not a new authz model.
- `property_manager`'s existing entity-scoped permission set — Head of Strategy is a new role *above* it, not a rename of it.
- The tenant/landlord identity model (`users.contactId`, `isExternal`, `external_invitations`) — still not built; this ADR only changes who a tenant's complaint routes to once that portal exists.

**Supersedes:** ADR 007's six-role emulation list (CEO, GM, Finance Head, HR Head, Line Manager, Front Office Head) is stale — "Line Manager" no longer exists as a role (folded into Property Manager earlier this build), and the roster above is now the canonical set. ADR 007 is kept for history with a superseded marker rather than deleted, per this file's own convention.

**Rationale & build detail:** `.agents/skills/workflow-fixes/SKILL.md` (design notes, non-canonical scratch space), `docs/SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md` (complaint routing + misc charges), `docs/SUNLAND_FINANCE_LEDGER_ARCHITECTURE.md` §8 (downstream data-flow model, added alongside this ADR).


