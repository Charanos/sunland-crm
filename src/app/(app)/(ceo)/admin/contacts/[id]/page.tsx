"use client";

import { useUIStore } from "@/store/ui";
import { ContactFullViewBoard } from "@/components/sunland/contact-full-view-board";
import { useParams } from "next/navigation";

export default function ContactDetailPage() {
  const { activeEntityId } = useUIStore();
  const params = useParams();
  const contactId = params.id as string;

  if (!contactId) return null;

  return <ContactFullViewBoard entityId={activeEntityId} contactId={contactId} />;
}
