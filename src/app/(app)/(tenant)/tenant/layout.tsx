"use client";

import { TenantNav } from "@/components/layout/tenant-nav";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TenantNav />
      <div className="min-h-screen lg:pl-[240px]">
        <div className="px-4 pb-24 pt-16 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">
          {children}
        </div>
      </div>
    </div>
  );
}
