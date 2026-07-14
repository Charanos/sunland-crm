# Sunland ERP - Dashboard & Portal Architecture (Independence + Interconnection)

Date: 2026-06-29
Status: **Design decision + build blueprint.** Supersedes the routing statements in ADR 005 and ADR 008 (see §7). Companion to `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` (§3 RBAC) and `SUNLAND_TENANT_LANDLORD_PORTALS_SPEC.md`.

> **Goal, in the client's words:** every dashboard is *independent in its own way*, but the system is one coherent, interconnected whole. Concretely: a Finance user never gets bounced into the CEO/admin shell to view their own profile (the reported bug), yet the CEO can still see and act across everything.

---

## 1. The problem being solved

The codebase is caught mid-migration between two models (full analysis in the audit §4):

- **Model A (specs, ADR 005/008):** departments under `/admin/*`; self-service (profile/settings/security/messages/notifications) hosted under `/admin` and whitelisted in `UNIVERSAL_PATHS`.
- **Model B (what Finance actually became):** an independent route group `(fin)/fin/**` with its own shell and its own `fin/profile`, `fin/settings`, etc.

Finance is Model B; HR, BD, and Front-Office are still Model A (under `(ceo)/admin/*`). Because `UNIVERSAL_PATHS` and ADR 008 declare self-service to live under `/admin`, navigation can route a Finance user to `/admin/profile` - dropping them out of the `/fin` shell into the CEO shell. That is the exact "in fin dashboard but profile routed via admin/profile" symptom.

**Decision: commit fully to Model B for every role. Retire Model A.** Each portal is self-contained; interconnection is through shared data + the approval/notification engines, not shared routes.

---

## 2. Portal map

One route group per portal, each with its own `layout.tsx` (shell: sidebar, top pill, entity switcher) and its own self-service pages.

| Portal | Route group | Root | Primary roles |
|---|---|---|---|
| Executive | `(exec)` | `/exec` | ceo, general_manager, auditor_compliance (read) |
| Finance | `(fin)` | `/fin` | finance_head, finance_officer, rentals_mandates_officer, payroll_officer |
| HR | `(hr)` | `/hr` | hr_head, hr_officer |
| Business Development | `(bd)` | `/bd` | line_manager, bd_agent |
| Front Office | `(front)` | `/front` | front_office_head, front_office_admin, driver |
| Operations | `(ops)` | `/ops` | operations_lead, valuer, property_manager |
| Landlord (external) | `(landlord)` | `/landlord` | landlord |
| Tenant (external) | `(tenant)` | `/tenant` | tenant |

> **Naming note:** the current CEO group is `(ceo)/admin`. Two acceptable choices: (a) rename to `(exec)/exec` for consistency, or (b) keep `/admin` as the executive root but treat it as *just another independent portal*, not a catch-all others live under. Either works; the invariant is that **no other portal's functionality lives under the executive root**. This doc uses `/exec` for clarity; if `/admin` is retained, substitute throughout.

Every portal has, under its own root:
```
/<portal>                 overview
/<portal>/profile         self-service (portal-local)
/<portal>/settings        self-service (portal-local)
/<portal>/security        self-service (portal-local)
/<portal>/notifications   self-service (portal-local)
/<portal>/messages        self-service (portal-local)
/<portal>/...             department pages
```

---

## 3. Self-service is portal-local (the actual bug fix)

There is **no** global `/admin/profile`. Each portal renders its own profile/settings/etc. **within its own shell**. The pages can (and should) share the same underlying components and API - the *route* is portal-local, the *implementation* is shared.

```
src/components/self-service/profile-page.tsx   ← one implementation
src/app/(app)/(fin)/fin/profile/page.tsx       → <ProfilePage />
src/app/(app)/(hr)/hr/profile/page.tsx         → <ProfilePage />
src/app/(app)/(exec)/exec/profile/page.tsx     → <ProfilePage />
...
```

So a Finance user's "Profile" link points to `/fin/profile`, stays inside the `/fin` shell, and hits the same `PUT /api/users/me` the HR user's `/hr/profile` does. Independence of *route/shell*, unity of *implementation/data*. This is exactly the pattern the Andishi Platform-group refinement landed on (shared `ProfilePage`/`ModalShell` behind per-portal routes).

`UNIVERSAL_PATHS` in its current form (a whitelist of `/admin/*` + `/fin/*` self-service paths) is deleted. Its job is replaced by: "self-service segments (`profile|settings|security|notifications|messages`) are allowed under **any** portal root the user can access."

---

## 4. Portal-prefix navigation helper (no hardcoded `/admin/*`)

The root cause of cross-portal jumps is components hardcoding `/admin/profile`. Fix it with a single resolver so shared components link within the *active* portal.

```ts
// src/lib/nav/portal.ts
export type Portal = "exec" | "fin" | "hr" | "bd" | "front" | "ops" | "landlord" | "tenant";

// Derive the active portal from the pathname (or from a layout-provided context).
export function usePortalPrefix(): string {           // e.g. "/fin"
  const pathname = usePathname();
  const seg = pathname.split("/")[1];
  return `/${seg}`;
}

// Shared components build links relatively:
const prefix = usePortalPrefix();
<Link href={`${prefix}/profile`}>Profile</Link>       // never <Link href="/admin/profile">
```

Each portal `layout.tsx` also provides a `PortalContext` (portal id, home root, permitted nav items) so the sidebar/top-pill render the correct destinations without string-guessing. **Rule: no shared component may hardcode a portal root; always resolve via the prefix/context.**

---

## 5. RBAC enforcement surface (routes → actions)

Two layers, both required (see backend master §3):

1. **Edge route guard (`proxy.ts`)** - coarse: "may this user load any page under this portal root?" Resolves the user's permitted portals from `user_roles`/`role_permissions`, redirects to their default portal otherwise. Also: **remove the blanket dev auth bypass** default (`SUNLAND_AUTH_BYPASS` should default to enforcing, opt-*out* explicitly), so RBAC is actually exercised in dev.
2. **Action-level authorization in services** - fine: `authorize(ctx, "finance.remittance.approve")`. The page loading is necessary but not sufficient; the *action* is gated in the service. This is what lets a Finance Officer open the remittances page (view) but not approve a payout (Finance Head only).

Navigation itself is **permission-driven**: the sidebar renders only the items whose governing permission the user holds, so users don't see doors they can't open. Nav config is a declarative list `{ href, label, icon, permission }` filtered by `can()`.

---

## 6. The CEO super-admin / executive oversight model

Per the Executive spec (§6 "One Dashboard, Two Tiers"; §8.3 "System Administration, CEO only"), and the client's ask ("CEO/admin is super admin… handle CRUD top-down through all roles but mostly oversight, still having all permissions").

Design:

- **CEO holds every permission** (seeded explicitly, not a code bypass - backend master §3.1). GM holds all **except** CEO-only System Administration and the highest-threshold overrides.
- **The executive portal is oversight-first, not a duplicate of every department screen.** It presents: cross-department KPIs (derived from the ledger, rental ledger, pipeline - not mock; **not built yet, that's P8**), the **approvals queue** (everything escalated to GM/CEO; `approval_requests` + the P0 reference service exist, a dedicated escalated-to-me view doesn't yet), the **reports center** (P5, not built), and **System Administration** - user/role/permission management, entity config, thresholds in `settings`, session revocation, audit-log explorer.
- **System Administration is now real backend surface, not just this design paragraph** - built 2026-07-08, ahead of P1 at the client's explicit direction ("CEO backend... guide going forward"). Full detail: backend master §3.4. Summary: `src/lib/services/identity/{users,roles,user-roles,sessions,access}.ts` + `src/lib/services/settings.ts` + `src/lib/services/audit-log.ts`, exposed under `/api/identity/*`, `/api/settings`, `/api/audit`. `isLastSuperAdmin()` is the concrete mechanism behind "real dominion... not accidentally locked out" below - it blocks deactivating or role-stripping the sole remaining active CEO account, checked inline before the action, not bolted on after.
- **Top-down CRUD via impersonation/deep-link, logged loudly (§6.4 "the override, used rarely and logged loudly").** When the CEO needs to act *inside* a department, they do it through the department's own screens/services (so the same authorization, validation, and audit apply) - either by navigating there (they have access to every portal) or via an explicit, audited "act as" that records the override in the audit log with a reason. The CEO does **not** get a parallel set of god-mode endpoints that bypass the service layer; they get *all permissions* flowing through the *same* services. This keeps oversight and action on one auditable rail. **Not yet built**: the explicit "act as" impersonation mechanism itself - today the CEO acts through their own identity only (which already carries every permission); a logged impersonation flow is a distinct, smaller follow-up if the client asks for it specifically.
- **Auditor/Compliance** is read-everywhere, write-nothing (a permission set, not a bypass) - implemented as `allReadKeys()` in `catalog.ts` (every permission key ending `.read`), verified to hold 0 write-class permissions.

This mirrors Andishi's super_admin (all permissions, data-driven, no code bypass) but adds the executive oversight surface (approvals + reports + system admin) the real-estate business needs.

---

## 7. Superseding ADRs (recorded in ARCHITECTURE_DECISIONS.md)

- **ADR 009 (supersedes ADR 005):** Portals are independent route groups, each with its own root and shell (`/exec`, `/fin`, `/hr`, `/bd`, `/front`, `/ops`, `/landlord`, `/tenant`). No department's functionality lives under another portal's root. `/admin/*` as a catch-all is retired.
- **ADR 010 (supersedes ADR 008):** Self-service (profile/settings/security/notifications/messages) is portal-local: rendered within each portal's shell from shared components, never hosted under a single global root. `UNIVERSAL_PATHS` is removed; self-service segments are permitted under any portal root the user can access.
- **ADR 011 (extends ADR 004):** Authorization is permission-based and enforced at two layers - edge route guard (portal access) and service-level `authorize()` (action). Route-prefix gating alone is retired.

(The originals stay in the file as history, marked superseded - do not delete the paper trail.)

---

## 8. Interconnection: how independent portals stay one system

Independence is about *routing and shell*, not *data silos*. Coherence comes from:

1. **One database, entity-scoped.** Every portal reads/writes the same tables through the same services; there are no per-portal copies of data.
2. **The ledger is shared truth.** Finance posts; the landlord portal reads its slice (`journal_lines` dimensioned to `landlordId`); the executive portal reads aggregates. Same numbers everywhere, by construction.
3. **The approval engine spans portals.** A Line-Manager's mandate expense (BD portal) surfaces in the Finance approvals list and the Executive approvals queue - one `approval_requests` row, many views.
4. **Notifications are cross-portal.** A rent default (Finance) notifies the owning Line-Manager (BD); a maintenance complaint (Tenant) notifies Front Office/Ops.
5. **Shared component library + Terrain Identity** keep every portal visually and behaviorally consistent (`erp-primitives`, `Drawer`, `Modal`, `ConfirmDialog`, `PaginationControls`, `formatCompactKES`).

> The test of "interconnected but independent": the CEO and a landlord looking at the same mandate's June remittance see the **same figure**, each within their **own** portal shell, each seeing only what their permissions allow.

---

## 9. Build checklist (Phase P6 of the master roadmap)

- [ ] Create `(exec)`, `(hr)`, `(bd)`, `(front)`, `(ops)` route groups mirroring `(fin)`; migrate department pages out of `(ceo)/admin/*`.
- [ ] Extract shared self-service pages; render them portal-locally in every group.
- [ ] Add `usePortalPrefix()` + `PortalContext`; replace every hardcoded `/admin/*` link.
- [ ] Rebuild `proxy.ts` + `roles.ts` around permitted-portals + permission-driven access; remove default dev auth bypass.
- [ ] Permission-driven sidebar nav.
- [ ] Seed CEO super-admin (all permissions) + GM + department roles; retire prototype role aliases.
- [ ] Verify: a Finance user's profile is `/fin/profile` and never leaves the `/fin` shell; an HR user has `/hr/profile`; the CEO can reach every portal and every action they take is audited.
- [ ] Append ADR 009/010/011; mark ADR 005/008 superseded.
