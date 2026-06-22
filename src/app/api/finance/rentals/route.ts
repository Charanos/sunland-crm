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

    // Fetch active leases with properties and tenant details
    const activeLeases = await db
      .select({
        id: leases.id,
        monthlyRent: leases.monthlyRentKes,
        propertyName: properties.name,
        propertyCode: properties.propertyCode,
        tenantName: contacts.displayName,
      })
      .from(leases)
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .innerJoin(contacts, eq(leases.tenantContactId, contacts.id))
      .where(filter);

    // Fetch all rent transactions
    const rentTx = await db
      .select({
        leaseId: transactions.leaseId,
        amount: transactions.amountKes,
      })
      .from(transactions)
      .where(eq(transactions.type, "rent"));

    // Map collected rent by lease ID
    const leasePayments = rentTx.reduce((acc, tx) => {
      if (tx.leaseId) {
        const amt = parseFloat(tx.amount.toString()) || 0;
        acc[tx.leaseId] = (acc[tx.leaseId] || 0) + amt;
      }
      return acc;
    }, {} as Record<string, number>);

    // Build rental records
    const records = activeLeases.map((lease) => {
      const expected = parseFloat(lease.monthlyRent.toString()) || 0;
      const collected = leasePayments[lease.id] || 0;
      const arrears = Math.max(0, expected - collected);
      const fee = collected * 0.10; // 10% management fee on collected rent!
      
      let status = "Arrears";
      if (collected >= expected) {
        status = "Paid";
      } else if (collected > 0) {
        status = "Partial";
      }

      return {
        id: lease.id,
        propertyCode: lease.propertyCode,
        propertyName: lease.propertyName,
        tenantName: lease.tenantName,
        expected,
        collected,
        arrears,
        status,
        managementFee: fee,
      };
    });

    return NextResponse.json({ records });
  } catch (error: any) {
    console.error("Rentals API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
