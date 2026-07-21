# Property Lifecycle Architecture

Status: current as of 2026-07-21. Companion to ADR 014 (Mandate Letter Flow), ADR 015 (Property Lifecycle Unification), and ADR 016 (Mandates Folded Into Leases, Maintenance Board Precision Rebuild) in `docs/ARCHITECTURE_DECISIONS.md` - this document is the durable map; the ADRs are the dated decision record. If the two ever disagree, trust the ADRs and update this file.

## 0. Why this document exists

The property lifecycle spans six phases built across separate workstreams at separate times: valuation/acquisition, mandate paperwork, active management, sales & marketing, tenancy, and remittances/rent. No single document previously described how they connect, which parts are real, and which are intentionally deferred. This is that document - written so a future session (or a future engineer) can pick up any phase without re-deriving the whole system from source.

## 1. The lifecycle map

```
 1. Valuation / Acquisition
      valuations table, valuationStage enum
      requested -> site_visit -> valued -> offer_sent -> accepted -> mandate_signed (+declined)
        |
        | signMandateFromValuation() on accepted -> mandate_signed:
        |   - creates a real `properties` row if the subject was external (createProperty)
        |   - calls the real, pre-existing createMandate()
        |   - sets valuations.resultingMandateId
        v
 2. Mandate Paperwork Completeness
      property_mandates.status: draft | pending_approval | active | terminated
      mandateLetterStatus(documents, propertyId): "verified" | "pending_upload"
        - derived, not stored - a documents row of type "mandate_letter" scoped
          to this specific propertyId (see §3)
        - does NOT gate mandate activation or remittance creation (see §5)
        |
        v
 3. Active Management
      property_mandates.status = "active"
      Surfaced on: property full-view, mandate full-view, and the paperwork
      queue folded into leases-board.tsx's mandates mode (see §4)
        |
        +--> 3a. Maintenance & Works     (branches off active management)
        |      maintenance_requests table
        |      status: reported -> awaiting_approval -> scheduled ->
        |              in_progress -> done
        |      severity: routine | urgent | critical
        |      category: reactive | planned | compliance
        |      Real cost-approval routing (createMandate's own tier ladder)
        |      and a real Scheduler link (calendar_events.maintenance_
        |      request_id) - see §4.2
        v
 4. Sales & Marketing            (branches off active management, not sequential after it)
      leads table (real schema + real backend as of ADR 015 §15.4)
      pipeline_stage: inquiry -> qualification -> viewing -> offer -> negotiation -> closed_won/lost
      UI: pipeline-board.tsx (real data, pre-existing visual design - see §6)
        |
        v (closed_won, on a "let" listing)
 5. Tenancy
      leases table, real, built earlier this build
        |
        v
 6. Remittances / Rent
      finance/remittances.ts + transactions, real, built earlier this build
```

Phases 1-3 are strictly sequential per property. Phase 4 (Sales & Marketing) is not "after" phase 3 in the sense of replacing it - a property under active management can simultaneously be marketed for sale or re-letting; `properties.listingType` (`"let" | "sale"`) determines which of phases 5/6 apply once a deal closes. See `property-full-view-board.tsx`'s existing Sales Pipeline / Tenancy tab split, driven by this same field.

## 2. What's real vs. mock, per phase

| Phase | Table(s) | Backend | Frontend |
|---|---|---|---|
| 1. Valuation | `valuations` | Real | Real (register, kanban, focus board, detail) |
| 2. Paperwork | `documents` (type=mandate_letter) | Real, correctly scoped (ADR 015 §15.1) | Real (banners + badges on mandate/property pages, queue folded into `leases-board.tsx`'s mandates mode - ADR 016 §16.1) |
| 3. Active Management | `property_mandates` | Real | Real |
| 3a. Maintenance & Works | `maintenance_requests`, `calendar_events` | Real (ADR 016 §16.2-16.4) | Real, precision rebuild against Claude Design mockup (ADR 016 §16.6) |
| 4. Sales & Marketing | `leads` | Real (ADR 015 §15.4) | Real data, pre-existing visual design (not redesigned this pass - see §6) |
| 5. Tenancy | `leases` | Real | Real |
| 6. Remittances | `transactions`, `remittance_advices` | Real | Real |

Nothing in this system is mock as of this document's date. The two things that *were* mock before ADR 015 - the leads pipeline's data layer, and the mandate-letter-scoping - are now real. What remains **explicitly unbuilt** (not mock, just not built) is listed in §7.

## 3. Mandate paperwork completeness - the mechanism

`src/components/sunland/mandate-constants.ts`:
- `findMandateLetterDocument(documents, propertyId)` - finds a `documents` row with `type === "mandate_letter" && propertyId === propertyId`.
- `mandateLetterStatus(documents, propertyId)` - `"verified"` if found, else `"pending_upload"`.

This replaced an earlier version of the same check that only matched on `ownerContactId`, which meant a letter uploaded for one of a landlord's properties silently read as "attached" for every other property that landlord owns (documented in ARCHITECTURE_DECISIONS.md ADR 014 §14.4's addendum). The fix is entirely a read-side + upload-payload correction (`mandate-letter-modal.tsx` now sends `propertyId`, `getPropertyWithDetails`'s document summary now threads `propertyId` through) - no schema or migration was needed since `documents.propertyId` already existed.

**This is a visibility fix, not an enforcement gate.** `createMandate()` and the remittance-creation path still have zero dependency on `mandateLetterStatus`. A mandate can go `active` and generate remittances with no letter on file, exactly as before. Turning this into a real gate is a future decision - see §7.

## 4. Reconciling the 132 seeded properties / 57 legacy mandates

The honest answer, not a fabricated one: **no history was invented.** Two real, derived (not stored) signals answer the reconciliation question:

1. **Paperwork status** (§3) - correctly-scoped, tells you today whether a specific mandate's letter is on file. As of this build's seed data, this is true for exactly the mandates that were seeded with a matching `documents` row; every other active mandate correctly reads `"pending_upload"`.
2. **Origin classification** (`mandateOriginLabel()` in `mandate-constants.ts`, backed by `getMandateWithDetails`'s `originValuation` field) - a mandate either has a `valuations` row whose `resultingMandateId` points at it ("Acquisition Pipeline · VAL-...", linked) or it doesn't ("Legacy / Direct Onboarding"). All 57 pre-existing mandates fall into the second bucket, truthfully, because they were seeded directly before the `valuations` acquisition pipeline existed. No valuation trail was retroactively invented for them.

Both are shown on the mandate file page and on `leases-board.tsx`'s mandates-mode table/grid/mobile cards (§4.1 below). This was the deliberate alternative to flagging existing properties as "pending valuation" - that framing would have misrepresented already-active management relationships as incomplete, when the real gap is specifically paperwork, not valuation history.

### 4.1 The paperwork queue - folded into `leases-board.tsx`'s mandates mode (ADR 016 §16.1)

There is no longer a standalone `/admin/mandates` list route. `leases-board.tsx` is already split between a "mandates" mode and a "leases" mode (one page, one mode switcher, matching the fact that the app treats management mandates and tenant leases as two views of the same Property Portfolio family) - the paperwork queue was purely additive surfacing on the existing mandates-mode renders: a paperwork-status badge and origin label on every row/card, a "Letter pending only" filter toggle, a 6th KPI-tier cell counting letters pending upload, and the same "Attach Letter" row action (still the same `MandateLetterModal`) the old standalone queue had. No fetch or service change was needed - `listMandates()` in `src/lib/services/mandates.ts` already returned `paperworkStatus` and `originValuation` on every row from ADR 015 §15.2/§15.3; the fold-in only had to start reading fields the client-side `Mandate` interface simply hadn't declared yet.

`src/components/sunland/mandates-queue-board.tsx` and `src/app/(app)/(ceo)/admin/mandates/page.tsx` are deleted; the nav-model `/admin/mandates` entry is removed. The real per-mandate detail route, `/admin/mandates/[id]`, is untouched - it was never part of the duplication.

**This is still hosted on CEO admin deliberately, not under a Front Office route.** Per ADR 014 §14.5, the Front Office Paperwork module (`/admin/front-office/paperwork`) was explicitly deferred as unbuilt - it's still unbuilt today. See §7.1 for the exact seam, updated to point at `leases-board.tsx`'s mandates mode rather than the now-deleted standalone board.

### 4.2 Maintenance & Works (ADR 016 §16.2-16.4)

`maintenance_requests` carries three real, independently-migrated vocabularies:

- **Status** (5-stage, linear): `reported → awaiting_approval → scheduled → in_progress → done`. `awaiting_approval` is a real gate - a request enters it only via a real cost-approval submission (`submitMaintenanceCostForApproval`, gated to only fire from `reported`) and leaves it only via a real `decideApprovalRequest` decision (which reverts it to `reported` either way, since the decision is what it was waiting on, not a status of its own). `scheduled` means a real `calendar_events` row exists (below) - contractor assignment no longer implies any status change on its own.
- **Severity** (3-tier): `routine | urgent | critical`.
- **Category** (3-way, new): `reactive | planned | compliance` - lets the board honestly distinguish tenant-reported repairs from preventive works and statutory compliance renewals, rather than treating everything as one undifferentiated "maintenance" bucket.

**Real cost-approval routing** reuses `createMandate`'s own actor-rank/threshold ladder (ADR 014 §14.2) via `costApprovalTierFor()` (`maintenance-constants.ts`): a request's `estimatedCostKes` is evaluated against the property's own active mandate's `maintenanceAuthorityKes` (auto-approve ceiling) and the real settings-backed GM/CEO thresholds, both at creation time (`createMaintenanceRequest`) and on later submission (`submitMaintenanceCostForApproval`) - an auto-tier estimate stamps `actualCostKes` immediately; a gm/ceo-tier estimate opens a real `approvalRequests` row and moves the request to `awaiting_approval`.

**Real Scheduler integration**: `calendar_events` carries a nullable `maintenanceRequestId` FK. `scheduleMaintenanceVisit()` books (or reschedules) a real calendar event and flips the request to `scheduled` in one transaction; marking a request `done` resolves the linked event's `outcome` to `completed` in the same transaction as the status write; cancelling a request unlinks and marks the linked event `cancelled` before deleting the request (required by the FK). "Scheduling a work-order visit auto-creates the Scheduler event; closing the order closes the event" is a literally true statement about this codebase, not marketing copy carried over from the design mockup it was inspired by.

## 5. Why remittances still don't gate on paperwork

Deliberately unchanged this pass. `src/lib/services/finance/remittances.ts` has no dependency on `documents`/`mandateLetterStatus`, and this document doesn't propose adding one - a real enforcement gate is a business-policy decision (what happens to an already-active mandate whose landlord never delivers a letter?) that hasn't been asked for. The banner copy on the mandate/property pages ("Required on file before first remittance") is aspirational UI text, not a currently-true statement; a future session tightening this should either make the enforcement real or soften the copy to match reality.

## 6. Sales & CRM (`leads`) - real backend, frontend redesign is separate

As of ADR 015 §15.4, `leads` has a real service layer (`src/lib/services/leads.ts`), validation (`src/lib/validation/leads.ts`), and API routes (`/api/leads`, `/api/leads/[id]`), gated by the pre-existing `crm.lead.read`/`crm.lead.write` permissions that no route previously exercised. `pipeline-board.tsx` is wired to this real backend - real fetch, real create/update/transition/delete calls - but its **visual design was not rebuilt** to match `docs/SUNLAND_BD_DASHBOARD_SPEC.md`. That's a deliberate, separate scope decision, not an oversight: the client's own framing was "build the backend, the frontend will be done shortly after."

Known consequences of this split, for whoever picks up the frontend pass:
- `pipeline-board.tsx`'s property/agent photo lookups (`PROPERTY_IMAGES`, `AGENT_AVATARS`, `CLIENT_AVATARS`) are keyed by the old fictional names and will always fall through to their generic fallback image now that real property/contact names flow through - harmless, but visually flat until real photos are wired in.
- The `role: "CEO" | "Agent"` toggle's Agent-scoping still hardcodes `lead.assignedAgent === "Amina Wanjiku"` - a pre-existing mock affordance, not touched this pass. Real per-viewer scoping (matching the logged-in user to `assignedToId`) is frontend-redesign work.
- The detail drawer's quick-note log (`lead-detail-drawer.tsx`) stays local/ephemeral - it doesn't persist to `leads.notes` or the audit log, since a genuine append-only note-log needs a backend concept (a notes table, or audit-log entries authored by users rather than the system) that doesn't exist yet. The real, persisted `timeline` shown on open comes from the audit log (creation + stage transitions only).

### 6.1 The one real connection to the base portfolio, already existing before this pass

`property-full-view-board.tsx`'s "Sales Pipeline" tab (shown instead of "Tenancy" when `listingType === "sale"`) is genuinely `leads`-backed via `getPropertyWithDetails`'s `salesPipeline` field - real data, explicitly read-only. This is the natural extension point once `leads` gets real write endpoints from its own page context (e.g., closing a deal from the property page itself) - not built this pass, but the read side already composes correctly with the new backend.

## 7. Explicit seams for future modules

### 7.1 Front Office paperwork module

When Front Office's own dashboard is built (per `docs/SUNLAND_FRONT_OFFICE_DASHBOARD_SPEC.md`), it should absorb - not duplicate - the mechanism in §3/§4.1:
- `mandateLetterStatus()`/`findMandateLetterDocument()` (`mandate-constants.ts`) is the completeness signal. A real workflow module would add internal states *around* the same `documents.type = 'mandate_letter'` row (Draft Received -> Formalizing -> Sent for Approval -> Signed/Active, per the spec's §8.4) rather than replacing the binary verified/pending signal - the binary signal is what every other page (mandate file, property file) should keep reading regardless of how granular Front Office's own internal queue gets.
- `listMandates()`'s paperwork/origin fields and their surfacing on `leases-board.tsx`'s mandates mode (§4.1, ADR 016 §16.1 - the standalone `mandates-queue-board.tsx` this note originally pointed at is deleted) are the intended starting point to relocate, not a throwaway prototype.
- Today, `front_office_head`/`front_office_admin` hold no `properties.property.write` (needed to attach a letter) - granting it is a real, small permissions decision to make when that module actually gets built and staffed, not before.

### 7.2 Sales & CRM frontend redesign

Plugs into the real backend from §6 as-is - `/api/leads` and `/api/leads/[id]` are stable contracts. The redesign's job is presentation, not data modeling: real property/contact photos, real per-viewer role scoping, and (if wanted) a persisted notes/comment concept for the detail drawer.

### 7.3 Enforcement (remittance gating on paperwork)

Not designed here since it wasn't asked for - flagged in §5 as the natural next step if the business wants "no remittance without a letter on file" to become literally true rather than aspirational copy.

## 8. Known, deliberately deferred issues

- **`property-mandates-board.tsx`** (`/fin/mandates`, Finance's own mandates board) is still a hardcoded mock (`INITIAL_MANDATES`, a status vocabulary that doesn't match the real `mandate_status` enum) - flagged in ADR 014 §14.5 as a pre-existing follow-up, untouched by ADR 015. `/admin/mandates` (§4.1) is the new real list surface; `/fin/mandates` is not it.
- **Wider `listingType` casing history**: before ADR 015 §15.5, the live property form wrote `"Rent"/"Sale"` while every read site checked lowercase `"sale"`. Normalized to the canonical `"let"|"sale"` vocabulary throughout this pass (form, valuations' property-creation call, the one other hardcoded non-canonical write site, and the seed data). The column remains free text, not a Postgres enum - normalizing the vocabulary closed the real bug; changing the column type would be a separate, larger, not-currently-warranted change.
- **Remittance-paperwork enforcement** (§5, §7.3) - visible but not enforced, by design, pending a real policy decision.
- **The Maintenance Board design mockup's "landlord portal" claim** (ADR 016 §16.5) - the mid-cost-tier copy in the Claude Design source ("approval captured via portal") has no real backing; no tenant/landlord portal exists anywhere in this app. The real GM-approval mechanism was kept and only the displayed copy was corrected. If a real landlord/tenant portal is ever built, this is the natural place to revisit whether cost approvals should route through it.
