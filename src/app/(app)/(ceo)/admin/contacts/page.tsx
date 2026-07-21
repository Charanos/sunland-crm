"use client";

import { useUIStore } from "@/store/ui";
import { ContactsBoard } from "@/components/sunland/contacts-board";

export default function ContactsPage() {
  const { activeEntityId } = useUIStore();

  return <ContactsBoard entityId={activeEntityId} />;
}
