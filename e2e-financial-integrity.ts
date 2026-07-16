import { db } from "@/db";
import { leases, transactions, propertyMandates, contacts, documents } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";

async function main() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Systemic check: no active lease's current-month collected total exceeds its monthly rent.
  const activeLeases = await db.select().from(leases).where(eq(leases.isActive, true));
  const rentTx = await db
    .select({ leaseId: transactions.leaseId, amountKes: transactions.amountKes })
    .from(transactions)
    .where(and(eq(transactions.type, "rent"), gte(transactions.occurredAt, monthStart)));

  let violations = 0;
  for (const l of activeLeases) {
    const collected = rentTx.filter((t) => t.leaseId === l.id).reduce((sum, t) => sum + parseFloat(t.amountKes), 0);
    const rent = parseFloat(l.monthlyRentKes);
    if (collected > rent) {
      violations++;
      console.error(`VIOLATION: lease ${l.id} collected ${collected} vs rent ${rent}`);
    }
  }
  console.log(`Checked ${activeLeases.length} active leases for current-month over-collection. Violations: ${violations}`);
  console.assert(violations === 0, "No active lease should ever collect more than its monthly rent in the current month");

  // 2. No transaction predates its lease's startsAt, and no terminated lease has a transaction after its endsAt.
  const allLeases = await db.select().from(leases);
  const leaseById = new Map(allLeases.map((l) => [l.id, l]));
  const allTx = await db.select().from(transactions);
  let dateViolations = 0;
  for (const t of allTx) {
    if (!t.leaseId) continue;
    const lease = leaseById.get(t.leaseId);
    if (!lease) continue;
    if (t.occurredAt < lease.startsAt) {
      dateViolations++;
      console.error(`VIOLATION: tx ${t.id} occurredAt ${t.occurredAt.toISOString()} predates lease ${lease.id} startsAt ${lease.startsAt.toISOString()}`);
    }
    if (!lease.isActive && t.occurredAt > lease.endsAt) {
      dateViolations++;
      console.error(`VIOLATION: tx ${t.id} occurredAt ${t.occurredAt.toISOString()} is after terminated lease ${lease.id} endsAt ${lease.endsAt.toISOString()}`);
    }
  }
  console.log(`Checked ${allTx.length} transactions for date-window violations. Violations: ${dateViolations}`);
  console.assert(dateViolations === 0, "No transaction should fall outside its lease's active window");

  // 3. Variety states each have at least one real row.
  const draftMandates = await db.select().from(propertyMandates).where(eq(propertyMandates.status, "draft"));
  const terminatedLeases = await db.select().from(leases).where(eq(leases.isActive, false));
  const now2 = new Date();
  const expiredOrExpiringSoon = allLeases.filter((l) => l.isActive && l.endsAt.getTime() - now2.getTime() <= 30 * 86_400_000);
  const nullDepositLeases = allLeases.filter((l) => l.depositKes === null);
  const verifiedLandlords = await db.select().from(contacts).where(and(eq(contacts.type, "landlord")));
  const verifiedCount = verifiedLandlords.filter((c) => c.verifiedAt !== null).length;
  const mandatesWithTerms = await db.select().from(propertyMandates);
  const termsPopulatedCount = mandatesWithTerms.filter((m) => m.maintenanceAuthorityKes !== null).length;
  const docTypes = new Set((await db.select({ type: documents.type }).from(documents)).map((d) => d.type));
  const docsWithSize = (await db.select().from(documents)).filter((d) => d.fileSizeBytes !== null).length;

  console.log("Variety check:", {
    draftMandates: draftMandates.length,
    terminatedLeases: terminatedLeases.length,
    expiredOrExpiringSoonLeases: expiredOrExpiringSoon.length,
    nullDepositLeases: nullDepositLeases.length,
    verifiedLandlords: verifiedCount,
    mandatesWithTermsPopulated: termsPopulatedCount,
    distinctDocumentTypes: [...docTypes],
    documentsWithFileSize: docsWithSize,
  });

  console.assert(draftMandates.length > 0, "Expected at least one draft mandate");
  console.assert(terminatedLeases.length > 0, "Expected at least one terminated lease");
  console.assert(expiredOrExpiringSoon.length > 0, "Expected at least one expiring-soon lease");
  console.assert(nullDepositLeases.length > 0, "Expected at least one null-deposit lease");
  console.assert(verifiedCount > 0, "Expected at least one verified landlord");
  console.assert(termsPopulatedCount > 0, "Expected at least one mandate with term fields populated");
  console.assert(docTypes.size > 1, "Expected more than one document type");
  console.assert(docsWithSize > 0, "Expected at least one document with fileSizeBytes set");

  if (violations === 0 && dateViolations === 0) {
    console.log("ALL FINANCIAL INTEGRITY + VARIETY CHECKS PASSED.");
  } else {
    throw new Error("Financial integrity violations found - see above.");
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
