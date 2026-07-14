import { SystemAdminBoard } from "@/components/sunland/system-admin-board";

export const metadata = {
  title: "System Administration - Sunland ERP",
  description: "CEO-only system administration: user management, approval thresholds, and the consolidated audit log.",
};

export default function SystemAdminPage() {
  return <SystemAdminBoard />;
}
