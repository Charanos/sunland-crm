import { redirect } from "next/navigation";

export default function ChequesIndexPage() {
  redirect("/fin/cheques/deposited");
}
