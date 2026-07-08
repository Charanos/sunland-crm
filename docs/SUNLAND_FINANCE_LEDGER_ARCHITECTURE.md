# Sunland Finance — Ledger & Accounting Architecture

Date: 2026-06-29
Status: **Design / implementation blueprint.** No code in this document is live yet. It operationalizes the intent in `SUNLAND_ERP_IMPLEMENTATION_SPEC.md` §5 into a concrete, migration-ready backend, and it is the authority for anything money-related.
Companion: `SUNLAND_CURRENT_STATE_AUDIT.md` (why this is needed), `SUNLAND_BACKEND_ARCHITECTURE_MASTER.md` (how it fits the wider backend).

> **The one rule that governs this entire document (ADR 002, restated):** No subsystem invents its own balance. There is exactly one source of financial truth — the general ledger (`journal_lines`). Rentals, mandates, payroll, AP/AR, cheques, fees, and commissions **write into** it and **query over** it. The balance sheet, trial balance, and cash-flow statement are *derived*, never separately maintained. Today's code violates this rule (balances are synthesized from a flat `transactions` table with hardcoded rules); this design restores it.

---

## 1. Accounting model in one page

Sunland is a **property-management agency**, and the accounting has one distinctive feature that must be correct or the whole system is wrong:

> **Rent collected on a landlord's behalf is NOT Sunland revenue.** It is a liability owed to the landlord. Only the **management fee** (and any service fees Sunland bills) are revenue.

So a single rent receipt of KES 100,000 on a 10% mandate is not "KES 100,000 revenue." It is:
- **+100,000** to the bank (asset),
- **+90,000** owed to the landlord (liability),
- **+10,000** management fee (revenue).

If that split is ever computed off `expected` rent instead of `collected` rent, or ever posted as gross revenue, the P&L, the landlord statements, and the tax position are all wrong. This is why the management fee is a **generated database column on collected amount**, not application arithmetic (spec §5.4).

Double-entry keeps this honest: every economic event is one **journal entry** whose **lines** sum to zero (Σdebits = Σcredits). Balances are `SUM(debit) − SUM(credit)` grouped by account. If the journal balances, the books balance — provably, at any instant.

---

## 2. Chart of Accounts (COA)

A real table, entity-scoped, seeded but editable. Account "normal side" is derived from `type` (asset/expense are debit-normal; liability/equity/revenue are credit-normal).

```ts
// src/db/schema/finance.ts
export const accountType = pgEnum("account_type", [
  "asset", "liability", "equity", "revenue", "expense",
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(),
  code: text("code").notNull(),            // "1000", "2000" ...
  name: text("name").notNull(),
  type: accountType("type").notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => accounts.id), // sub-accounts / rollups
  isControl: boolean("is_control").default(false).notNull(), // reconciled against a subledger
  isCash: boolean("is_cash").default(false).notNull(),       // feeds cash-flow statement
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (t) => ({
  entityCodeIdx: uniqueIndex("accounts_entity_code_idx").on(t.entityId, t.code),
  typeIdx: index("accounts_type_idx").on(t.type),
}));
```

### 2.1 Seed COA (starting point — the client's accountant should confirm codes)

The hardcoded 7 accounts in `ledger/route.ts` today are a good *start*; a real property-management agency needs more granularity. Recommended seed:

| Code | Account | Type | Notes |
|---|---|---|---|
| 1000 | Operating Bank Account | asset | `isCash` |
| 1010 | Client Trust / Rent Collection Account | asset | `isCash`; ideally a segregated trust account — landlord money is not Sunland money |
| 1100 | Accounts Receivable (fees) | asset | control acct for AR subledger |
| 1200 | Rent Receivable / Arrears | asset | control acct for rental ledger arrears |
| 1300 | Prepayments | asset | |
| 2000 | Landlord Remittances Payable | liability | control acct — what we owe landlords |
| 2100 | Tenant Security Deposits Held | liability | must never be recognised as revenue |
| 2200 | Accounts Payable (suppliers/contractors) | liability | control acct for AP subledger |
| 2300 | Statutory Payable — PAYE | liability | |
| 2310 | Statutory Payable — NSSF | liability | |
| 2320 | Statutory Payable — SHIF (ex-NHIF) | liability | |
| 2330 | Statutory Payable — Affordable Housing Levy | liability | 1.5% employer + 1.5% employee |
| 2340 | Statutory Payable — WHT (KRA) | liability | 10% withheld on agent commissions |
| 2400 | Rent Received in Advance | liability | |
| 3000 | Share Capital | equity | |
| 3100 | Retained Earnings | equity | closed to at period end — never a magic constant |
| 4000 | Management Fee Revenue | revenue | the core P&L line |
| 4100 | Letting / Lease Fee Revenue | revenue | |
| 4200 | Sales Commission Revenue | revenue | |
| 4300 | Valuation Fee Revenue | revenue | |
| 4400 | Late-Fee / Penalty Revenue | revenue | |
| 5000 | Salaries & Wages | expense | |
| 5100 | Office & Administrative | expense | |
| 5200 | Property Operating Expenses (rechargeable) | expense | offset against landlord remittance |
| 5300 | Bank Charges | expense | |
| 6000 | Tax Expense | expense | |

Entity scope: each of the four entities (Group, Commercial, Residential, Valuers) has its own COA instance; Group consolidates.

---

## 3. The journal (the immutable core)

```ts
export const journalStatus = pgEnum("journal_status", ["draft", "posted", "reversed"]);

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(),
  reference: text("reference").notNull(),        // "JE-2026-000042" (sequence per entity/period)
  memo: text("memo").notNull(),
  occurredOn: date("occurred_on").notNull(),     // accounting date (period bucket)
  status: journalStatus("status").default("draft").notNull(),
  // provenance: which subsystem/event created this entry
  sourceType: text("source_type").notNull(),     // "rent_receipt" | "mandate_expense" | "cheque_credit" | ...
  sourceId: uuid("source_id"),
  reversalOfId: uuid("reversal_of_id").references((): AnyPgColumn => journalEntries.id),
  postedById: uuid("posted_by_id").references(() => users.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  periodId: uuid("period_id").references(() => accountingPeriods.id).notNull(),
  ...timestamps,
}, (t) => ({
  entityRefIdx: uniqueIndex("journal_entries_entity_ref_idx").on(t.entityId, t.reference),
  sourceIdx: index("journal_entries_source_idx").on(t.sourceType, t.sourceId),
  periodIdx: index("journal_entries_period_idx").on(t.periodId),
}));

export const journalLines = pgTable("journal_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  entryId: uuid("entry_id").references(() => journalEntries.id, { onDelete: "cascade" }).notNull(),
  accountId: uuid("account_id").references(() => accounts.id).notNull(),
  // exactly one of debit/credit is > 0; both are non-negative
  debitKes: numeric("debit_kes", { precision: 14, scale: 2 }).default("0").notNull(),
  creditKes: numeric("credit_kes", { precision: 14, scale: 2 }).default("0").notNull(),
  // optional dimensions for subledger reconciliation & drill-down
  landlordId: uuid("landlord_id").references(() => contacts.id),
  tenantId: uuid("tenant_id").references(() => contacts.id),
  propertyId: uuid("property_id").references(() => properties.id),
  leaseId: uuid("lease_id").references(() => leases.id),
  mandateId: uuid("mandate_id"),   // → property_mandates
  memo: text("memo"),
  ...timestamps,
}, (t) => ({
  entryIdx: index("journal_lines_entry_idx").on(t.entryId),
  accountIdx: index("journal_lines_account_idx").on(t.accountId),
  landlordIdx: index("journal_lines_landlord_idx").on(t.landlordId),
}));
```

### 3.1 Invariants (enforced in code AND, where possible, in the DB)

1. **Balanced:** for every posted entry, `Σ debit_kes = Σ credit_kes`. Enforced in the posting service (below) and re-checkable by a scheduled integrity job. Optionally a deferred constraint trigger.
2. **One-sided lines:** each line has `debit > 0 XOR credit > 0`; both non-negative. DB CHECK constraint.
3. **Append-only:** posted entries are never edited or deleted. Corrections are **reversing entries** (`status = reversed` on the original + a new entry with `reversalOfId`). This is what makes the audit trail real.
4. **Period-bound:** an entry belongs to exactly one `accounting_period`; you cannot post into a `closed` period (see §8).
5. **Entity-consistent:** every line's account must belong to the entry's `entity_id`. Cross-entity movements are modeled as **two** entries (one per entity) plus an inter-entity clearing account, never a single mixed entry.

---

## 4. The single write path: `postJournalEntry()`

Every economic event in the entire ERP that touches money goes through **one** service function. Nothing else may `INSERT` into `journal_lines`. This is the Andishi `postTransaction()` pattern, adapted.

```ts
// src/lib/services/finance/ledger.ts
type PostInput = {
  entityId: string;
  occurredOn: string;              // ISO date
  memo: string;
  sourceType: string;
  sourceId?: string;
  lines: Array<{
    accountCode: string;           // resolved to accountId within entity
    debit?: number; credit?: number;
    landlordId?: string; tenantId?: string; propertyId?: string; leaseId?: string; mandateId?: string;
    memo?: string;
  }>;
};

export async function postJournalEntry(ctx: CallerContext, input: PostInput) {
  await authorize(ctx, "finance.journal.post");          // action-level RBAC
  assertBalanced(input.lines);                           // Σdebit === Σcredit, else DomainError
  const period = await resolveOpenPeriod(input.entityId, input.occurredOn); // throws if closed
  return db.transaction(async (tx) => {
    const reference = await nextJournalReference(tx, input.entityId, period);
    const [entry] = await tx.insert(journalEntries).values({ ... , status: "posted", postedAt: now }).returning();
    await tx.insert(journalLines).values(resolveAccounts(input.lines, entry.id));
    await writeAudit(tx, ctx, { action: "finance.journal.post", resource: "journal_entry", id: entry.id, after: entry });
    return entry;
  });
}

export function assertBalanced(lines) {
  const d = sum(lines.map(l => l.debit ?? 0));
  const c = sum(lines.map(l => l.credit ?? 0));
  if (round2(d) !== round2(c)) throw new DomainValidationError(`Unbalanced: debit ${d} ≠ credit ${c}`);
}
```

`assertBalanced` is a pure function → trivially unit-testable (Andishi does exactly this; reuse the test shape). `postJournalEntry` is the only exported writer; subsystem services below call it with domain-specific line recipes.

---

## 5. Posting recipes (the business rules, in one place)

These replace the hardcoded `if (tx.type === ...)` ladder currently in `ledger/route.ts`. Each is a small function that builds `lines[]` and calls `postJournalEntry`. Amounts shown for a KES 100,000 rent receipt on a 10% mandate.

### 5.1 Rent receipt (tenant pays)
Money arrives in the trust/collection account; the obligation to the landlord and the fee are recognised at allocation.
```
Dr 1010 Client Trust Account        100,000
   Cr 2400 Rent Received in Advance          100,000     (if before due) — or straight to allocation
```
Then **allocation** (can be same entry when due):
```
Dr 2400 / 1010 clearing              100,000
   Cr 2000 Landlord Remittances Payable       90,000
   Cr 4000 Management Fee Revenue              10,000
```
Fee = `collected × mandate_rate`, taken from the **generated column** on `mandate_collections`, never recomputed here.

### 5.2 Rechargeable property expense (paid by Sunland, owed by landlord)
```
Dr 5200 Property Operating Expense    x
   Cr 1000 Operating Bank Account            x
Dr 2000 Landlord Remittances Payable  x        (reduce what we owe the landlord)
   Cr 5200 Property Operating Expense         x   (recover the cost)
```
Net effect: landlord bears the cost, Sunland P&L is neutral. Requires approval if > threshold (§7).

### 5.3 Landlord remittance payout (we pay the landlord their share)
```
Dr 2000 Landlord Remittances Payable  87,000    (90,000 − 3,000 approved expenses, e.g.)
   Cr 1000 Operating Bank Account            87,000
```
`landlord_remittance` is a generated column: `collected − management_fee − approved_expenses`.

### 5.4 Tenant security deposit (held, not earned)
```
Dr 1010 Client Trust Account          d
   Cr 2100 Tenant Security Deposits Held      d
```
On lease end, either refunded (reverse) or applied to arrears/damages (reclassify) — never touches revenue while held.

### 5.5 Banker's cheque — credited (spec §5.6: journal only on `credited`)
No journal entry on `deposited`. When status → `credited`:
```
Dr 1000 Operating Bank Account        amount
   Cr <source account per cheque purpose>     amount
```
Cheques > KES 500,000 require GM/CEO approval before crediting (§7).

### 5.6 Sales/valuation commission earned + WHT withheld (spec §5.8)
Sunland earns a commission; KRA WHT of 10% is withheld by the payer/retained for filing.
```
Dr 1100 Accounts Receivable           gross_commission
   Cr 4200 Sales Commission Revenue           gross_commission
On settlement with WHT withheld:
Dr 1000 Operating Bank Account        gross × 0.90
Dr 2340 Statutory Payable — WHT       gross × 0.10   (asset: WHT credit claimable / or receivable from KRA)
   Cr 1100 Accounts Receivable                gross
```
(Exact WHT treatment — withheld-by-payer vs withheld-by-Sunland-as-agent — must be confirmed with the client's tax advisor; the table supports both by choice of accounts.)

### 5.7 Payroll run (spec §5.5, Kenyan statutory)
Gross → net with statutory deductions, each to its payable account:
```
Dr 5000 Salaries & Wages              gross
   Cr 2300 PAYE Payable                       paye
   Cr 2310 NSSF Payable                       nssf
   Cr 2320 SHIF Payable                       shif
   Cr 2330 AH Levy Payable                    ahl_employee
   Cr 1000 Operating Bank Account             net_pay
Employer contributions (AHL employer, NSSF employer):
Dr 5000 Salaries & Wages (employer cost)  employer_contribs
   Cr 231x/233x payables                      employer_contribs
```
Statutory remittance (paying KRA/NSSF/SHIF) later debits the payable and credits bank.

### 5.8 Service fee charged (late fee, letting fee — spec §5.7)
Rule-driven (`service_fee_rules`): create an AR + revenue entry when a charge is raised; clear AR when paid.

---

## 6. Subledgers (the domain tables that feed the journal)

Each is a **subledger** reconciled to a **control account** in the COA. This is what lets the CEO drill from "we're owed KES 2.4M in arrears" down to the specific tenants.

### 6.1 Property mandates (spec §5.4) — the agency agreement
```ts
export const mandateStatus = pgEnum("mandate_status", ["draft","pending_approval","active","terminated"]);

export const propertyMandates = pgTable("property_mandates", {
  id, entityId, landlordId → contacts, propertyId → properties,
  mandateRate: numeric(5,4).default("0.1000"),      // 10% default; deviations require justification (revamp guide §3)
  rateJustification: text(),                          // required if rate ≠ 0.10
  unitCount: integer(),                               // > 10 → pending_approval (revamp guide §4)
  startDate, endDate, status,
  ...timestamps,
});

export const mandateCollections = pgTable("mandate_collections", {
  id, mandateId, period,                              // "2026-06"
  collectedAmount: numeric(14,2),
  // GENERATED columns — DB enforces the business rule, not app code:
  managementFee: numeric GENERATED ALWAYS AS (collected_amount * mandate_rate),
  approvedExpenses: numeric(14,2).default(0),
  landlordRemittance: numeric GENERATED ALWAYS AS (collected_amount - management_fee - approved_expenses),
  ...timestamps,
});

export const mandateExpenses = pgTable("mandate_expenses", {
  id, mandateId, period, category, amount,
  loggedById → users, approvalStatus: (auto_approved|pending_gm|approved|rejected),
  approvalRequestId → approval_requests,
  ...timestamps,
});
```
> **Build constraint (spec §5.4, load-bearing):** management fee = `collected × rate`, **never** `expected × rate`, enforced by the generated column. Do not let a future developer "fix" this into app arithmetic.

### 6.2 Rental ledger (spec §5.3) — per unit, per period
```ts
export const rentalStatus = pgEnum("rental_status", ["current","vacant","partial","defaulted"]);
export const rentalLedger = pgTable("rental_ledger", {
  id, entityId, leaseId → leases, propertyId, period,   // one row per lease per month
  expectedAmount: numeric(14,2),
  collectedAmount: numeric(14,2).default(0),
  deficit: numeric GENERATED ALWAYS AS (expected_amount - collected_amount),
  status: rentalStatus,
  daysInArrears: integer().default(0),
  ...timestamps,
}, uniqueIndex on (leaseId, period));
```
This **fixes Gap F-3**: arrears is `expected(this period) − collected(this period)`, bucketed by `daysInArrears` into current / 30 / 60 / 90+. A materialized "defaulters" view surfaces tenants beyond a configurable threshold, shared with the responsible Line Manager (collection is a relationship the LM owns; Finance only tracks the numbers).

### 6.3 Cheques, fees, AP/AR, payroll, commissions
Tables per spec §5.5–5.8 (`bankers_cheques`, `service_fee_rules`, `service_fee_charges`, `accounts_payable`, `accounts_receivable`, `payroll_runs`, `payslips`, `statutory_remittances`, `commissions`, `wht_records`). Each: entity-scoped, references its control account, and posts to the journal via the recipes in §5. Full column lists in the backend master's module map.

### 6.4 Accounting periods + report exports
```ts
export const periodStatus = pgEnum("period_status", ["open","closing","closed"]);
export const accountingPeriods = pgTable("accounting_periods", {
  id, entityId, label,   // "2026-06"
  startsOn, endsOn, status,
  closedById → users, closedAt,
  ...timestamps,
}, uniqueIndex on (entityId, label));

export const reportExports = pgTable("report_exports", {   // spec §5.9 QR verification
  id, entityId, reportType, generatedById, generatedAt,
  verificationToken: text().unique(),   // signed, time-limited
  expiresAt, snapshot: jsonb,            // frozen figures at generation time
});
```

---

## 7. Approval thresholds (enforced in the write path — fixes Gap A-5)

The generic `approval_requests` engine (ADR 004) is **invoked by the posting/subsystem services**, server-side, before the consequential effect happens. From the Finance Revamp guide §4:

| Trigger | Threshold | Effect |
|---|---|---|
| Banker's cheque | > KES 500,000 | status `pending_approval`; no journal credit until GM/CEO approves |
| Property/office petty-cash expense | > KES 5,000 | `mandate_expense`/expense stays `pending_gm`; not netted against remittance until approved |
| Mandate | portfolio > 10 units | mandate `pending_approval`; rental-ledger tracking locked until GM signs off |
| Mandate rate | ≠ 10% | require `rateJustification`; route for approval |
| Any GM/CEO rejection | — | mandatory justification note, written to the audit log |

These checks live in the service functions, not the UI. The UI's amber "Pending Approval" badges become a *reflection* of server state, not the gate.

---

## 8. Derived statements (queries, never stored balances)

- **Trial balance:** `SELECT account, SUM(debit) AS dr, SUM(credit) AS cr FROM journal_lines JOIN accounts ... GROUP BY account`, filtered to a period/entity. It **balances by construction** if every entry balanced. This is the integrity check the current system literally cannot perform.
- **Balance sheet:** account balances (`Σdr − Σcr`, sign by normal side) as at a date, grouped asset/liability/equity, entity-scoped, consolidatable to Group. Assets = Liabilities + Equity holds automatically.
- **Cash-flow statement:** movements on `isCash` accounts, classified operating/investing/financing; profit-before-tax → tax → profit-after-tax with D&A add-backs, broken out by revenue stream (management/letting/lease/sales/late/valuation) per spec §5.2.
- **Landlord statement:** all `journal_lines` dimensioned to a `landlordId` over a period → the exact statement a landlord sees in their portal (see tenant/landlord doc).
- **Consolidation:** Group = sum of entity balances with inter-entity clearing accounts eliminated.

Every statement is a pure read over `journal_lines` + `accounts`. Cache with Upstash keyed by `(entity, period, as-of)` and invalidate on any post into that period.

---

## 9. Migration path from today's code

1. **Add tables** (COA, journal, subledgers, periods) alongside the existing `transactions` — do not drop `transactions` yet.
2. **Seed COA + open the current period.**
3. **Backfill:** write a one-off script that replays existing `transactions` rows through the §5 posting recipes into real journal entries (the recipes already exist, in effect, inside `ledger/route.ts` — lift them out, correct the magic constants, and run once). Reconcile the resulting trial balance against expected opening balances with the client's accountant.
4. **Cut the API over:** replace `finance/ledger/route.ts`'s synthesis with reads over the journal; delete the hardcoded COA and the `3485000` retained-earnings constant.
5. **Demote `transactions`** to a raw bank-feed / receipt-capture staging table (input to posting), or retire it. It is no longer a source of balances.
6. **Wire the boards:** point the finance board components at the real endpoints; remove inline demo constants.

Do this **entity by entity** if needed, but the ledger must be all-or-nothing per entity — you cannot have half a period in the journal and half in `transactions`.

---

## 10. Definition of done for the finance core

- [ ] `assertBalanced` unit-tested; `postJournalEntry` is the only writer to `journal_lines`.
- [ ] Trial balance for every entity provably balances (dr = cr) on real data.
- [ ] Management fee is a generated column on `collected`; verified it cannot be set off `expected`.
- [ ] Rent is never in a revenue account; landlord payable + deposit-held liabilities reconcile to their subledgers.
- [ ] Approval thresholds enforced server-side; cheque > 500k cannot post a credit pre-approval.
- [ ] Balance sheet balances (A = L + E) and consolidates to Group.
- [ ] Every posted entry is append-only; corrections are reversals with a linked `reversalOfId`.
- [ ] Closed periods reject new posts.
- [ ] Report exports snapshot frozen figures + a verifiable QR token.
- [ ] No hardcoded financial constants remain in any route handler.
