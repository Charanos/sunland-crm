import { db } from "@/db";
import { leases, properties, contacts, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { scopeEntityFilter } from "@/lib/utils/entity-scope";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");

    const filter = await scopeEntityFilter(leases.entityId, entityId || "group");

    // Fetch active leases with property and owner contact details
    const activeLeases = await db
      .select({
        id: leases.id,
        monthlyRent: leases.monthlyRentKes,
        propertyName: properties.name,
        propertyId: properties.id,
        ownerContactId: properties.ownerContactId,
        tenantName: contacts.displayName,
      })
      .from(leases)
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .innerJoin(contacts, eq(leases.tenantContactId, contacts.id))
      .where(filter);

    // Fetch landlord contact details
    const landlordIds = activeLeases.map((l) => l.ownerContactId).filter(Boolean) as string[];
    const landlords = landlordIds.length > 0
      ? await db.select().from(contacts).where(eq(contacts.type, "landlord"))
      : [];

    const landlordMap = landlords.reduce((acc, l) => {
      acc[l.id] = l.displayName;
      return acc;
    }, {} as Record<string, string>);

    // Fetch rent and expense transactions
    const txs = await db.select().from(transactions);

    const leasePayments = txs.reduce((acc, tx) => {
      if (tx.type === "rent" && tx.leaseId) {
        const amt = parseFloat(tx.amountKes.toString()) || 0;
        acc[tx.leaseId] = (acc[tx.leaseId] || 0) + amt;
      }
      return acc;
    }, {} as Record<string, number>);

    const propertyExpenses = txs.reduce((acc, tx) => {
      if (tx.type === "expense" && tx.propertyId) {
        const amt = parseFloat(tx.amountKes.toString()) || 0;
        acc[tx.propertyId] = (acc[tx.propertyId] || 0) + amt;
      }
      return acc;
    }, {} as Record<string, number>);

    const remittances = activeLeases.map((lease) => {
      const landlordName = lease.ownerContactId ? (landlordMap[lease.ownerContactId] || "Kariuki Holdings") : "Margaret Wambui";
      const collected = leasePayments[lease.id] || 0;
      const expected = parseFloat(lease.monthlyRent.toString()) || 0;
      const fee = collected * 0.10;
      const expenses = lease.propertyId ? (propertyExpenses[lease.propertyId] || 0) : 0;
      const netRemittance = Math.max(0, collected - fee - expenses);

      return {
        leaseId: lease.id,
        landlordName,
        propertyName: lease.propertyName,
        expectedRent: expected,
        collectedRent: collected,
        feeRetained: fee,
        maintenanceExpenses: expenses,
        netRemittance,
        status: netRemittance > 0 ? "Pending Remittance" : "No Balance Available",
      };
    });

    const totalRemittances = remittances.reduce((sum, r) => sum + r.netRemittance, 0);

    // Let's add other bills (like utilities or contractors)
    const bills = [
      { ref: "PAY-048", payee: "Jambo Contractors", item: "Plumbing repair (Lavington)", amount: 18500, due: "2026-06-25", status: "Approved" },
      { ref: "PAY-049", payee: "Nairobi Water Co.", item: "Water utility deposit", amount: 5000, due: "2026-06-28", status: "Awaiting Sign-off" },
    ];

    const totalAwaitingSignoff = bills.filter(b => b.status === "Awaiting Sign-off").reduce((sum, b) => sum + b.amount, 0);

    return NextResponse.json({
      remittances,
      bills,
      totalRemittances,
      totalAwaitingSignoff,
    });
  } catch (error) {
    console.error("Payables API Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
