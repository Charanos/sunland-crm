import type { UserRole } from "@/types";

const roleAccess: Record<UserRole, string[]> = {
  ceo: ["/admin"],
  general_manager: ["/admin", "/ops"],
  bd_head: ["/admin/pipeline", "/admin/contacts", "/admin/properties"],
  agent: ["/admin/pipeline", "/admin/contacts", "/admin/properties"],
  property_manager: ["/admin/properties", "/admin/leases", "/admin/maintenance"],
  accounts_manager: ["/admin/finance", "/admin/reports"],
  accounts_officer: ["/admin/finance"],
  hr_manager: ["/hr"],
  auditor: ["/admin/reports"],
};

export function canAccess(role: UserRole, pathname: string) {
  return roleAccess[role].some((prefix) => pathname.startsWith(prefix));
}
