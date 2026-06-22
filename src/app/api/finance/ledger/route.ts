import { db } from "@/db";
import { transactions } from "@/db/schema";
import { scopeEntityFilter } from "@/lib/utils/entity-scope";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const filter = await scopeEntityFilter(transactions.entityId, entityId || "group");

    // Fetch all transactions scoped by entity
    const rawTx = await db
      .select()
      .from(transactions)
      .where(filter);

    // Apply period filtering if provided
    let txs = rawTx;
    if (startDateParam) {
      const start = new Date(startDateParam);
      txs = txs.filter((t) => new Date(t.occurredAt) >= start);
    }
    if (endDateParam) {
      const end = new Date(endDateParam);
      txs = txs.filter((t) => new Date(t.occurredAt) <= end);
    }

    // Sort by occurredAt descending for recent journal view
    txs.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    // Calculate balances dynamically
    let rentSum = 0;
    let commissionSum = 0;
    let valuationSum = 0;
    let expenseSum = 0;
    let depositSum = 0;
    let otherSum = 0;

    txs.forEach((tx) => {
      const amt = parseFloat(tx.amountKes.toString()) || 0;
      if (tx.type === "rent") rentSum += amt;
      else if (tx.type === "commission") commissionSum += amt;
      else if (tx.type === "valuation_fee") valuationSum += amt;
      else if (tx.type === "expense") expenseSum += amt;
      else if (tx.type === "deposit") depositSum += amt;
      else if (tx.type === "other") otherSum += amt;
    });

    const operatingAccount = rentSum + commissionSum + valuationSum + depositSum + otherSum - expenseSum;
    const rentClearing = 0; // Rent is allocated immediately
    const remittancesPayable = rentSum * 0.90 - expenseSum;
    const securityDeposit = depositSum;
    const managementFeeRev = rentSum * 0.10 + commissionSum + valuationSum;
    const operatingExpenses = expenseSum;
    const retainedEarnings = 3485000 + otherSum; // Seed base + other

    const accounts = [
      { code: "1000", name: "Operating Bank Account", category: "Asset", balance: operatingAccount },
      { code: "1200", name: "Tenant Rent Clearing Account", category: "Liability", balance: rentClearing },
      { code: "1300", name: "Tenant Security Deposit Account", category: "Liability", balance: securityDeposit },
      { code: "2000", name: "Landlord Remittances Payable", category: "Liability", balance: remittancesPayable },
      { code: "3000", name: "Retained Earnings", category: "Equity", balance: retainedEarnings },
      { code: "4000", name: "Management Fee Revenue", category: "Revenue", balance: managementFeeRev },
      { code: "5000", name: "Office Administrative Expense", category: "Expense", balance: operatingExpenses },
    ];

    // Generate Journal Entries
    const journals = txs.map((tx) => {
      const amt = parseFloat(tx.amountKes.toString()) || 0;
      const lines: Array<{ accountCode: string; accountName: string; type: "debit" | "credit"; amount: number }> = [];

      if (tx.type === "rent") {
        // Rent Collection
        lines.push({ accountCode: "1000", accountName: "Operating Bank Account", type: "debit", amount: amt });
        lines.push({ accountCode: "1200", accountName: "Tenant Rent Clearing Account", type: "credit", amount: amt });
        // Allocation
        lines.push({ accountCode: "1200", accountName: "Tenant Rent Clearing Account", type: "debit", amount: amt });
        lines.push({ accountCode: "2000", accountName: "Landlord Remittances Payable", type: "credit", amount: amt * 0.90 });
        lines.push({ accountCode: "4000", accountName: "Management Fee Revenue", type: "credit", amount: amt * 0.10 });
      } else if (tx.type === "expense") {
        lines.push({ accountCode: "5000", accountName: "Office Administrative Expense", type: "debit", amount: amt });
        lines.push({ accountCode: "1000", accountName: "Operating Bank Account", type: "credit", amount: amt });
        // Landlord deduction
        lines.push({ accountCode: "2000", accountName: "Landlord Remittances Payable", type: "debit", amount: amt });
        lines.push({ accountCode: "5000", accountName: "Office Administrative Expense", type: "credit", amount: amt });
      } else if (tx.type === "commission") {
        lines.push({ accountCode: "1000", accountName: "Operating Bank Account", type: "debit", amount: amt });
        lines.push({ accountCode: "4000", accountName: "Management Fee Revenue", type: "credit", amount: amt });
      } else if (tx.type === "valuation_fee") {
        lines.push({ accountCode: "1000", accountName: "Operating Bank Account", type: "debit", amount: amt });
        lines.push({ accountCode: "4000", accountName: "Management Fee Revenue", type: "credit", amount: amt });
      } else if (tx.type === "deposit") {
        lines.push({ accountCode: "1000", accountName: "Operating Bank Account", type: "debit", amount: amt });
        lines.push({ accountCode: "1300", accountName: "Tenant Security Deposit Account", type: "credit", amount: amt });
      } else {
        lines.push({ accountCode: "1000", accountName: "Operating Bank Account", type: "debit", amount: amt });
        lines.push({ accountCode: "3000", accountName: "Retained Earnings", type: "credit", amount: amt });
      }

      return {
        id: `JRN-${tx.id.substring(0, 5).toUpperCase()}`,
        date: new Date(tx.occurredAt).toISOString().split("T")[0],
        memo: tx.notes || `${tx.type.toUpperCase()} transaction recorded`,
        amount: amt,
        lines,
      };
    });

    return NextResponse.json({ accounts, journals });
  } catch (error: any) {
    console.error("Ledger API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
