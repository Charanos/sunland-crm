import { redirect } from "next/navigation";

export default function LedgerIndexPage() {
  redirect("/fin/ledger/journal-entries");
}
