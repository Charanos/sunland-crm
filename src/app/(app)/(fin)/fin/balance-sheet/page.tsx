import { redirect } from "next/navigation";

export default function LegacyBalanceSheetPage() {
  redirect("/fin/ledger/balance-sheet");
}
