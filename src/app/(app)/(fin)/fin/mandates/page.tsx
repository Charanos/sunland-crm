import { redirect } from "next/navigation";

export default function MandatesIndexPage() {
  redirect("/fin/mandates/active");
}
