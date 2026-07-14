"use client";

import { useUIStore } from "@/store/ui";
import { ContactsBoard } from "@/components/sunland/contacts-board";

export default function ContactsPage() {
  const { activeEntityId } = useUIStore();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="title-serif mt-2 text-slate-900">
          Directory & Relationships
        </h1>
        <p className="text-slate-400 max-w-2xl">
          Manage landlords, tenants, contractors, and partners across the organization.
        </p>
      </div>

      <ContactsBoard entityId={activeEntityId} />
    </div>
  );
}
