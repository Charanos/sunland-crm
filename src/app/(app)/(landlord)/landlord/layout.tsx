"use client";

import { LandlordNav } from "@/components/layout/landlord-nav";

export default function LandlordLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f0]">
      <LandlordNav />
      <div className="min-h-screen lg:pl-[260px]">
        <div className="px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pt-6">
          {children}
        </div>
      </div>
    </div>
  );
}
