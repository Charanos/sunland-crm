import { IconUsersGroup } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function ContactsPage() {
  return (
    <ModulePage
      action="Add contact"
      description="Manage landlords, tenants, buyers, sellers, contractors, and business contacts with assignment and activity history."
      emptyDescription="Contacts you manage or are assigned to will appear here."
      emptyTitle="No contacts yet"
      eyebrow="Client intelligence"
      icon={IconUsersGroup}
      title="Contacts"
    />
  );
}
