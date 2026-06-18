"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconSearch,
  IconMapPin,
  IconBuildingSkyscraper,
  IconHome,
  IconBuildingStore,
  IconTrendingUp,
  IconUsers,
  IconChevronRight,
  IconEye,
  IconEdit,
  IconShare,
  IconChevronLeft,
  IconPlus,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { PropertyFormModal } from "./property-form-modal";
import { PropertyDetailDrawer } from "./property-detail-drawer";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";

const ALL_PROPERTIES = [
  { id: "p1", name: "Runda Grove Villa", location: "Runda, Nairobi", type: "Villa", status: "Available", price: "KES 21.3M", roi: "12.0%", imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80" },
  { id: "p2", name: "Westlands Tower 4B", location: "Westlands, Nairobi", type: "Commercial", status: "Occupied", price: "KES 720K/mo", roi: "9.6%", imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80" },
  { id: "p3", name: "Karen Ridge House", location: "Karen, Nairobi", type: "Villa", status: "Under Offer", price: "KES 62M", roi: "8.4%", imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=600&q=80" },
  { id: "p4", name: "Kilimani Heights", location: "Kilimani, Nairobi", type: "Apartment", status: "Available", price: "KES 14M", roi: "6.8%", imageUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80" },
  { id: "p5", name: "Upper Hill Plaza", location: "Upper Hill, Nairobi", type: "Commercial", status: "Available", price: "KES 120M", roi: "11.2%", imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=600&q=80" },
  { id: "p6", name: "Lavington Gardens", location: "Lavington, Nairobi", type: "Apartment", status: "Sold", price: "KES 48M", roi: "5.0%", imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80" },
  { id: "p7", name: "Industrial Area Depot", location: "Industrial Area", type: "Land", status: "Available", price: "KES 160M", roi: "10.4%", imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80" },
  { id: "p8", name: "Riverside Haven", location: "Riverside, Nairobi", type: "Apartment", status: "Available", price: "KES 8.5M", roi: "4.0%", imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80" },
  { id: "p9", name: "Muthaiga Grand", location: "Muthaiga, Nairobi", type: "Villa", status: "Occupied", price: "KES 150M", roi: "7.2%", imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80" },
];

const STATUS_STYLES: Record<string, string> = {
  Available: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Occupied: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Under Offer": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Sold: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

export function UnifiedMarketBoard() {
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [agentPeriod, setAgentPeriod] = useState("This Month");
  const ITEMS_PER_PAGE = 6;

  // Modals & Drawers
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [drawerProperty, setDrawerProperty] = useState<any | null>(null);

  const filteredProperties = useMemo(() => {
    return ALL_PROPERTIES.filter((p) => {
      const matchesTab = activeTab === "all" || p.type.toLowerCase() === activeTab.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                            p.location.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [activeTab, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProperties.length / ITEMS_PER_PAGE));
  const paginatedProperties = filteredProperties.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleShare = (e: React.MouseEvent, propName: string) => {
    e.stopPropagation();
    pushToast({ tone: "success", title: "Link Copied", body: `Share link for ${propName} copied to clipboard.` });
  };

  return (
    <div className="flex flex-col gap-4 mt-6">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 flex-wrap gap-2 animate-fade-in-up">
        <div>
          <h2 className="title-serif text-slate-900 text-[22px]">Market Insights & Portfolio</h2>
          <p className="text-[12px] text-slate-500 font-medium tracking-wide mt-1">Explore current market listings and top performing agents.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* ── Left Col: Property Grid ── */}
        <div className="xl:col-span-8 flex flex-col gap-4 animate-fade-in-up stagger-1">
          {/* Filters & Search */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
              {[
                { id: "all", label: "All Properties" },
                { id: "villa", label: "Villas" },
                { id: "apartment", label: "Apartments" },
                { id: "commercial", label: "Commercial" },
                { id: "land", label: "Land For Sale" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                  className={cn(
                    "text-[12.5px] px-4 py-2 rounded-lg transition-all font-medium whitespace-nowrap",
                    activeTab === tab.id ? "bg-[#15464e] text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search portfolio..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                onKeyDown={(e) => e.key === "Escape" && setSearch("")}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] focus:outline-none focus:border-[#15464e] transition-colors shadow-sm"
              />
            </div>
          </div>

          {/* Grid */}
          {paginatedProperties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedProperties.map((prop, idx) => (
                <Card 
                  key={prop.id} 
                  className="group relative overflow-hidden bg-white border-slate-100 hover:shadow-lg transition-all duration-300 rounded-[16px] animate-fade-in-up cursor-pointer"
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() => setDrawerProperty(prop)}
                >
                  <div className="aspect-[4/3] relative w-full overflow-hidden">
                    <Image src={prop.imageUrl} alt={prop.name} fill sizes="(max-width: 640px) 100vw, 300px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/20" />
                    <div className="absolute top-3 inset-x-3 flex items-start justify-between">
                      <span className="backdrop-blur-md bg-white/20 text-white border border-white/20 text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider font-medium">
                        {prop.type}
                      </span>
                      <span className={cn("text-[10px] px-2.5 py-1 rounded-md border backdrop-blur-md font-medium uppercase tracking-wider", STATUS_STYLES[prop.status])}>
                        {prop.status}
                      </span>
                    </div>
                    {/* Hover Actions Overlay */}
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button className="size-10 rounded-full bg-white text-slate-700 hover:text-[#15464e] flex items-center justify-center shadow-lg transition-colors scale-75 group-hover:scale-100 duration-300 delay-75"><IconEye size={18} /></button>
                      <button onClick={(e) => handleShare(e, prop.name)} className="size-10 rounded-full bg-white text-slate-700 hover:text-[#15464e] flex items-center justify-center shadow-lg transition-colors scale-75 group-hover:scale-100 duration-300 delay-100"><IconShare size={18} /></button>
                    </div>
                  </div>
                  <div className="p-4 relative">
                    <h3 className="text-[15px] font-medium text-slate-800 leading-tight mb-1 group-hover:text-[#15464e] transition-colors">{prop.name}</h3>
                    <p className="text-[12px] text-slate-500 font-medium flex items-center gap-1 mb-3"><IconMapPin size={12} /> {prop.location}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-[16px] font-mono font-medium text-[#15464e] tracking-tight">{prop.price}</span>
                      <span className="text-[11.5px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{prop.roi} ROI</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-100 shadow-sm text-center">
              <IconBuildingSkyscraper size={48} className="text-slate-200 mb-4" />
              <h3 className="text-[16px] font-medium text-slate-800">No properties found</h3>
              <p className="text-[13px] text-slate-500 mt-1 mb-4">We couldn't find any properties matching your search.</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setSearch("")}>Clear Search</Button>
                <Button onClick={() => setPropertyModalOpen(true)}>
                  <IconPlus size={16} className="mr-1" /> Add Property
                </Button>
              </div>
            </div>
          )}

          {/* Pagination */}
          {filteredProperties.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="size-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
              >
                <IconChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={cn(
                    "size-8 flex items-center justify-center rounded-lg text-[13px] font-medium transition-colors border shadow-sm",
                    p === currentPage ? "bg-[#15464e] text-white border-[#15464e]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="size-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* ── Right Col: Insights Sidebar ── */}
        <div className="xl:col-span-4 flex flex-col gap-4 animate-fade-in-up stagger-2">
          {/* Revenue Overview Link Card */}
          <Link href="/admin/finance" className="block group">
            <Card className="bg-[#15464e] text-white p-6 rounded-[20px] border-none shadow-sm hover:shadow-lg transition-all relative overflow-hidden h-[140px] flex flex-col justify-between">
              <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:scale-110 transition-transform duration-500">
                <IconTrendingUp size={120} stroke={1} />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <h3 className="text-[15px] font-medium tracking-wide">Total Market Value</h3>
                <div className="size-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 group-hover:bg-white/20 transition-colors">
                  <IconChevronRight size={16} />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-[32px] font-mono font-medium tracking-tight leading-none">KES 1.4B</p>
                <p className="text-[12px] text-emerald-300 font-medium mt-1.5 flex items-center gap-1"><IconTrendingUp size={12} /> +12.4% vs last year</p>
              </div>
            </Card>
          </Link>

          {/* Top Agents */}
          <Card className="bg-white p-6 rounded-[20px] border border-slate-100 shadow-sm flex-1">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-medium text-slate-800">Top Performing Agents</h3>
              <select 
                className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2 py-1 focus:outline-none"
                value={agentPeriod}
                onChange={(e) => setAgentPeriod(e.target.value)}
              >
                <option>This Week</option>
                <option>This Month</option>
                <option>This Quarter</option>
                <option>All Time</option>
              </select>
            </div>
            
            <div className="space-y-4">
              {[
                { name: "Amina Wanjiku", sales: "KES 142M", deals: 8, avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face" },
                { name: "James Mwangi", sales: "KES 98M", deals: 5, avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" },
                { name: "Ruth Njeri", sales: "KES 76M", deals: 4, avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1b4dce?w=100&h=100&fit=crop&crop=face" },
              ].map((agent, i) => (
                <Link href="/admin/contacts" key={agent.name}>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group cursor-pointer animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="size-[42px] rounded-full overflow-hidden border-2 border-white shadow-sm relative shrink-0">
                      <Image src={agent.avatar} alt={agent.name} fill sizes="42px" className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-slate-800 leading-none mb-1.5 group-hover:text-[#15464e] transition-colors">{agent.name}</p>
                      <p className="text-[11px] text-slate-500 font-medium leading-none">{agent.deals} Closed Deals</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13.5px] font-mono font-medium text-slate-800 leading-none mb-1.5">{agent.sales}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <Link href="/admin/contacts" className="block mt-4">
              <button className="w-full text-center text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors py-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-100">
                View All Agents
              </button>
            </Link>
          </Card>
        </div>
      </div>

      <PropertyFormModal open={propertyModalOpen} onClose={() => setPropertyModalOpen(false)} onSubmit={() => {}} />
      <PropertyDetailDrawer open={!!drawerProperty} onClose={() => setDrawerProperty(null)} property={drawerProperty} onEdit={() => {}} onDelete={() => {}} />
    </div>
  );
}
