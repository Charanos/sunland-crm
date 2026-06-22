import { redirect } from "next/navigation";

export default function PayrollIndexPage() {
  redirect("/fin/payroll/runs");
}
