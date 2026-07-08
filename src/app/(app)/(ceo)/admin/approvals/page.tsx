import { ApprovalsQueueBoard } from "@/components/sunland/approvals-queue-board";

export const metadata = {
  title: "Approvals Queue — Sunland ERP",
  description: "Cross-department approval requests routed to GM and CEO for decision.",
};

export default function ApprovalsPage() {
  return <ApprovalsQueueBoard />;
}
