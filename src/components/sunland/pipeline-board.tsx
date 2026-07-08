"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  IconSearch,
  IconPlus,
  IconBuilding,
  IconDotsVertical,
  IconX,
  IconTrash,
  IconMessageCircle,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconArrowUpRight,
  IconAlertTriangle,
  IconChartBar,
  IconLayoutKanban,
  IconList,
  IconArrowRight,
  IconArrowLeft,
  IconCircleDot,
  IconEdit,
  IconClipboardList
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { LeadDetailDrawer } from "./lead-detail-drawer";
import { LeadFormModal } from "./lead-form-modal";
import { formatKES, formatCompactKES } from "@/lib/utils/format";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type PipelineStage =
  | "inquiry"
  | "qualification"
  | "viewing"
  | "offer"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export type PipelineSource =
  | "referral"
  | "walk_in"
  | "website"
  | "social_media"
  | "cold_call"
  | "existing_client"
  | "partner"
  | "exhibition";

export interface Lead {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  budget: number;
  propertyInterest: string;
  source: PipelineSource;
  stage: PipelineStage;
  assignedAgent: string;
  createdDate: string;
  notes?: string;
  timeline: {
    id: string;
    date: string;
    type: "call" | "email" | "meeting" | "message" | "system";
    summary: string;
    details?: string;
  }[];
}

// ─── Constants & Styling Maps ──────────────────────────────────────────────────

export const STAGE_LABELS: Record<PipelineStage, string> = {
  inquiry: "Inquiry",
  qualification: "Qualification",
  viewing: "Viewing",
  offer: "Offer",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const STAGE_COLORS: Record<PipelineStage, string> = {
  inquiry: "text-slate-650 bg-slate-50 border-slate-200/50",
  qualification: "text-indigo-700 bg-indigo-50 border-indigo-200/30",
  viewing: "text-cyan-700 bg-cyan-50 border-cyan-200/30",
  offer: "text-amber-700 bg-amber-50 border-amber-200/30",
  negotiation: "text-purple-700 bg-purple-50 border-purple-200/30",
  closed_won: "text-emerald-700 bg-emerald-50 border-emerald-200/30",
  closed_lost: "text-rose-700 bg-rose-50 border-rose-200/30",
};

export const SOURCE_COLORS: Record<PipelineSource, string> = {
  referral: "bg-emerald-50 text-emerald-650",
  walk_in: "bg-slate-50 text-slate-600",
  website: "bg-blue-50 text-blue-650",
  social_media: "bg-pink-50 text-pink-650",
  cold_call: "bg-purple-50 text-purple-650",
  existing_client: "bg-teal-50 text-teal-650",
  partner: "bg-indigo-50 text-indigo-650",
  exhibition: "bg-amber-50 text-amber-650",
};

// ─── Property & Agent Mappers ───────────────────────────────────────────────

const PROPERTY_IMAGES: Record<string, string> = {
  "Runda Grove Villa": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=200&fit=crop",
  "Westlands Tower 4B": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop",
  "Karen Ridge House": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=200&fit=crop",
  "Upper Hill Plaza": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop",
  "Kilimani Heights": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=200&fit=crop",
  "Lavington Gardens": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=200&fit=crop",
  "Riverside Haven": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=200&fit=crop",
  "Muthaiga Grand": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=200&fit=crop",
  "Gigiri Diplomatic": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=200&fit=crop",
};

export const getPropertyImage = (interest: string) => {
  return PROPERTY_IMAGES[interest] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=200&fit=crop";
};

const AGENT_AVATARS: Record<string, string> = {
  "Amina Wanjiku": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&crop=face",
  "John Mwangi": "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=80&h=80&fit=crop&crop=face",
};

const getAgentAvatar = (name: string) => {
  return AGENT_AVATARS[name] || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face";
};

const CLIENT_AVATARS: Record<string, string> = {
  "James Mwangi": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
  "Amina Abdalla": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
  "John Kamau": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
  "Fatma Hassan": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&crop=face",
  "Kevin Ochieng": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
  "Mary Wambui": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face",
  "Peter Kiprop": "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=80&h=80&fit=crop&crop=face",
  "Sarah Mwangi": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=face",
  "Michael Onyango": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
};

const getClientAvatar = (name: string) => {
  return CLIENT_AVATARS[name] || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face";
};

// ─── Initial Mock Data ─────────────────────────────────────────────────────────

const INITIAL_LEADS: Lead[] = [
  {
    id: "l1",
    clientName: "James Mwangi",
    email: "james@mwangi-invest.co.ke",
    phone: "+254 712 999 888",
    budget: 25000000,
    propertyInterest: "Runda Grove Villa",
    source: "website",
    stage: "inquiry",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-06-12",
    notes: "Client interested in cash payment. Needs layout plans of the Karen estate.",
    timeline: [
      { id: "tl1", date: "2026-06-12", type: "system", summary: "Inquiry Received", details: "Logged via website form." }
    ]
  },
  {
    id: "l2",
    clientName: "Amina Abdalla",
    email: "amina.a@abdallagroup.com",
    phone: "+254 722 111 222",
    budget: 72000000,
    propertyInterest: "Westlands Tower 4B",
    source: "referral",
    stage: "viewing",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-06-01",
    notes: "Requires building audit certificates and occupancy summaries.",
    timeline: [
      { id: "tl2", date: "2026-06-05", type: "meeting", summary: "Site Viewing Done", details: "Inspected office shell on Westlands 4B." }
    ]
  },
  {
    id: "l3",
    clientName: "John Kamau",
    email: "kamau.j@gmail.com",
    phone: "+254 734 555 444",
    budget: 62000000,
    propertyInterest: "Karen Ridge House",
    source: "social_media",
    stage: "offer",
    assignedAgent: "John Mwangi",
    createdDate: "2026-05-20",
    notes: "Submitted formal offer of KES 59.5M. Landlord reviewing.",
    timeline: [
      { id: "tl3", date: "2026-06-14", type: "email", summary: "Offer Submitted", details: "Emailed formal letter of intent." }
    ]
  },
  {
    id: "l4",
    clientName: "Fatma Hassan",
    email: "fatma.h@hassanco.com",
    phone: "+254 788 777 666",
    budget: 120000000,
    propertyInterest: "Upper Hill Plaza",
    source: "partner",
    stage: "qualification",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-06-10",
    notes: "Corporate expansion. Checking liquidity status and board resolution.",
    timeline: [
      { id: "tl4", date: "2026-06-11", type: "call", summary: "Introductory Audit Call", details: "Discussed corporate financial backing." }
    ]
  },
  {
    id: "l5",
    clientName: "Kevin Ochieng",
    email: "kevin.o@outlook.com",
    phone: "+254 701 444 333",
    budget: 14000000,
    propertyInterest: "Kilimani Heights",
    source: "existing_client",
    stage: "closed_won",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-05-01",
    notes: "Lease signed. First month rent and deposit cleared. Commission generated.",
    timeline: [
      { id: "tl5", date: "2026-06-15", type: "message", summary: "Escrow Cleared", details: "Fund verified in accounts." }
    ]
  },
  {
    id: "l6",
    clientName: "Mary Wambui",
    email: "mary.w@wambuicatering.com",
    phone: "+254 723 888 999",
    budget: 48000000,
    propertyInterest: "Lavington Gardens",
    source: "cold_call",
    stage: "closed_lost",
    assignedAgent: "John Mwangi",
    createdDate: "2026-04-15",
    notes: "Lost to competitor due to pricing mismatch. Karen site chosen instead.",
    timeline: [
      { id: "tl6", date: "2026-06-01", type: "system", summary: "Archived Lead", details: "Marked lost after no response." }
    ]
  },
  {
    id: "l7",
    clientName: "Peter Kiprop",
    email: "peter@kiprop-farms.co.ke",
    phone: "+254 711 222 333",
    budget: 8500000,
    propertyInterest: "Riverside Haven",
    source: "website",
    stage: "negotiation",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-06-03",
    notes: "Negotiating payment terms: 50% deposit and 12-month installments.",
    timeline: [
      { id: "tl7", date: "2026-06-16", type: "meeting", summary: "Terms Discussion", details: "Met at Riverside sales lounge." }
    ]
  },
  {
    id: "l8",
    clientName: "Sarah Mwangi",
    email: "sarah.m@mwangi-props.com",
    phone: "+254 733 666 999",
    budget: 150000000,
    propertyInterest: "Muthaiga Grand",
    source: "walk_in",
    stage: "viewing",
    assignedAgent: "John Mwangi",
    createdDate: "2026-05-28",
    notes: "Client scheduled second viewing with structural engineer.",
    timeline: [
      { id: "tl8", date: "2026-06-10", type: "meeting", summary: "Initial Tour", details: "Client toured the entire estate." }
    ]
  },
  {
    id: "l9",
    clientName: "Michael Onyango",
    email: "m.onyango@domain.com",
    phone: "+254 705 333 222",
    budget: 35000000,
    propertyInterest: "Gigiri Diplomatic",
    source: "exhibition",
    stage: "qualification",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-06-05",
    notes: "Needs property with diplomatic status or secure perimeter checks.",
    timeline: [
      { id: "tl9", date: "2026-06-07", type: "call", summary: "Security Verification", details: "Discussed diplomatic zone clearances." }
    ]
  }
];

const ROWS_PER_PAGE = 5;

export function PipelineBoard({
  defaultView = "kanban",
  isFullPageFocus = false
}: {
  defaultView?: "kanban" | "list";
  isFullPageFocus?: boolean;
}) {
  const { pushToast } = useToast();
  const { setSelectedChatDMId } = useUIStore();

  // App States
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [viewMode, setViewMode] = useState<"kanban" | "list">(defaultView);
  const [role, setRole] = useState<"CEO" | "Agent">("CEO");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Confirmation States
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Sorting & Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>("clientName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isLoading, setIsLoading] = useState(false);

  // Detail Drawer & Form Modal State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>(undefined);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  // Skeleton loading triggers
  useEffect(() => {
    Promise.resolve().then(() => setIsLoading(true));
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, stageFilter, sourceFilter, role, currentPage, sortField, sortDir, viewMode]);

  useEffect(() => {
    Promise.resolve().then(() => setSelectedIds([]));
  }, [searchQuery, stageFilter, sourceFilter, role, viewMode]);

  const resetPagination = () => setCurrentPage(1);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getDMIdForContact = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("amina") || n.includes("hassan") || n.includes("abdalla") || n.includes("wanjiku")) return "dm1";
    if (n.includes("james") || n.includes("mutua") || n.includes("mwangi")) return "dm2";
    if (n.includes("grace") || n.includes("omondi")) return "dm3";
    return "dm1";
  };

  // Filter Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Role Scope
      const matchesRole = role === "CEO" || lead.assignedAgent === "Amina Wanjiku";

      // 2. Search
      const matchesSearch =
        lead.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.propertyInterest.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase());

      // 3. Dropdowns
      const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
      const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;

      return matchesRole && matchesSearch && matchesStage && matchesSource;
    });
  }, [leads, searchQuery, stageFilter, sourceFilter, role]);

  // Sort Leads
  const sortedLeads = useMemo(() => {
    const sorted = [...filteredLeads];
    sorted.sort((a, b) => {
      const aVal = a[sortField as keyof Lead];
      const bVal = b[sortField as keyof Lead];

      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return sorted;
  }, [filteredLeads, sortField, sortDir]);

  // Paginated List
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return sortedLeads.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [sortedLeads, currentPage]);

  const totalPages = Math.ceil(sortedLeads.length / ROWS_PER_PAGE) || 1;

  // KPIs Calculations
  const stats = useMemo(() => {
    const scoped = leads.filter(l => role === "CEO" || l.assignedAgent === "Amina Wanjiku");
    const activeValue = scoped.filter(l => l.stage !== "closed_won" && l.stage !== "closed_lost").reduce((acc, l) => acc + l.budget, 0);
    const viewings = scoped.filter(l => l.stage === "viewing").length;
    const closedWon = scoped.filter(l => l.stage === "closed_won");
    const totalClosed = scoped.filter(l => l.stage === "closed_won" || l.stage === "closed_lost").length;

    const winRate = totalClosed > 0 ? Math.round((closedWon.length / totalClosed) * 100) : 0;
    const pendingOffers = scoped.filter(l => l.stage === "offer" || l.stage === "negotiation").reduce((acc, l) => acc + l.budget, 0);

    return {
      activeValue,
      viewings,
      winRate,
      pendingOffers,
      total: scoped.length
    };
  }, [leads, role]);

  // Drag-free Stage Advancement buttons on Kanban cards
  const handleMoveStage = (leadId: string, direction: "forward" | "backward") => {
    const stageSequence: PipelineStage[] = ["inquiry", "qualification", "viewing", "offer", "negotiation", "closed_won", "closed_lost"];
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const currentIndex = stageSequence.indexOf(lead.stage);
    const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;

    // Boundary safeguards
    if (nextIndex < 0 || nextIndex >= stageSequence.length) return;

    const newStage = stageSequence[nextIndex];

    // Append stage movement to timeline log
    const movementLog = {
      // eslint-disable-next-line
      id: `log-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      type: "system" as const,
      summary: "Stage Advanced",
      details: `Admin advanced stage from ${STAGE_LABELS[lead.stage]} to ${STAGE_LABELS[newStage]}.`
    };

    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, stage: newStage, timeline: [movementLog, ...(l.timeline || [])] }
        : l
    ));

    pushToast({
      tone: "success",
      title: "Opportunity Advanced",
      body: `"${lead.clientName}" is now in stage "${STAGE_LABELS[newStage]}".`
    });
  };

  const handleCreateOrUpdate = (payload: Partial<Lead>) => {
    if (editingLead) {
      // Update
      setLeads(prev => prev.map(l =>
        l.id === editingLead.id ? { ...l, ...payload } : l
      ));
      pushToast({ tone: "success", title: "Deal Updated", body: `Opportunity details saved for "${payload.clientName}".` });
      setEditingLead(undefined);
    } else {
      // Create
      const newLead: Lead = {
        id: `l${Date.now()}`,
        clientName: payload.clientName || "Unknown Client",
        email: payload.email || "",
        phone: payload.phone || "",
        budget: payload.budget || 0,
        propertyInterest: payload.propertyInterest || "Runda Grove Villa",
        source: payload.source || "website",
        stage: payload.stage || "inquiry",
        assignedAgent: payload.assignedAgent || "Amina Wanjiku",
        createdDate: new Date().toISOString().split("T")[0],
        notes: payload.notes,
        timeline: payload.timeline || []
      };
      setLeads(prev => [newLead, ...prev]);
      pushToast({ tone: "success", title: "Deal Opened", body: `Successfully logged pipeline lead "${newLead.clientName}".` });
    }
    setIsModalOpen(false);
  };

  const handleDeleteLead = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteLead = () => {
    if (!deleteConfirmId) return;
    const lead = leads.find(l => l.id === deleteConfirmId);
    setLeads(prev => prev.filter(l => l.id !== deleteConfirmId));
    pushToast({
      tone: "success",
      title: "Opportunity Cleared",
      body: `"${lead?.clientName || 'Record'}" was successfully scrubbed from CRM.`
    });
    setDeleteConfirmId(null);
  };

  // Bulk Handlers
  const handleBulkStageChange = (newStage: PipelineStage) => {
    setLeads(prev => prev.map(l =>
      selectedIds.includes(l.id) ? { ...l, stage: newStage } : l
    ));
    pushToast({ tone: "success", title: "Batch Updated", body: `Moved ${selectedIds.length} deals to stage "${STAGE_LABELS[newStage]}".` });
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    setIsBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = () => {
    setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)));
    pushToast({ tone: "success", title: "Batch Action Completed", body: `Deleted ${selectedIds.length} opportunities.` });
    setSelectedIds([]);
    setIsBulkDeleteConfirmOpen(false);
  };

  const handleBulkMessage = () => {
    pushToast({ tone: "success", title: "Direct Broadcast Dispatched", body: `Dispatched message links to ${selectedIds.length} prospects.` });
    setSelectedIds([]);
  };

  return (
    <div className={cn(
      "mx-auto w-full max-w-[98rem] flex flex-col gap-6",
      isFullPageFocus && "fixed inset-0 z-50 bg-slate-50 p-6 overflow-hidden h-screen w-screen"
    )}>

      {isFullPageFocus && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-2 shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/pipeline"
              className="flex items-center gap-1.5 font-medium text-slate-550 hover:text-slate-900 transition-colors bg-white px-3 py-1.5 border border-slate-200 rounded-xl shadow-sm animate-fade-in text-base"
            >
              <IconChevronLeft size={15} />
              <span>Exit Focus Mode</span>
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <h1 className="text-base  font-medium text-slate-800 tracking-tight font-serif">
              Deals Pipeline Focus Deck
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-[#f3df27]/20 text-[#151936] px-2.5 py-0.5 rounded-full border border-[#f3df27]/40 label-caps">
              CEO / Admin Control
            </span>
          </div>
        </div>
      )}

      {/* ── Operations Control Hub Navigator ── */}
      {!isFullPageFocus && (
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-indigo-50 text-indigo-650 flex items-center justify-center">
              <IconClipboardList size={16} />
            </div>
            <div>
              <h3 className="text-base font-medium text-slate-800 leading-none">Operations Control Hub</h3>
              <p className="text-sm text-slate-400 mt-1">Navigate across property CRM ops segments.</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
            <Link
              href="/admin/contacts"
              className="px-3.5 py-1.5 text-sm  font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Contacts</span>
              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full font-medium text-sm">CRM</span>
            </Link>
            <Link
              href="/admin/pipeline"
              className="px-3.5 py-1.5 text-sm  font-medium rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
            >
              <span>Deals Pipeline</span>
              <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full font-medium text-sm">Active</span>
            </Link>
            <Link
              href="/admin/leases"
              className="px-3.5 py-1.5 text-sm  font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Leases</span>
              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full font-medium text-sm">Tenancies</span>
            </Link>
            <Link
              href="/admin/maintenance"
              className="px-3.5 py-1.5 text-sm  font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
            >
              <span>Maintenance</span>
              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full font-medium text-sm">Tickets</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Top Analytics KPI Tier ── */}
      {!isFullPageFocus && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* KPI 1 */}
          <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm flex flex-col justify-between h-[135px] hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="size-[22px] rounded-full bg-slate-100 flex items-center justify-center text-slate-550">
                <IconChartBar size={13} />
              </div>
              <span className="text-base font-medium text-slate-400 tracking-wider uppercase">Active Pipeline Value</span>
            </div>
            <div className="flex items-end justify-between mt-auto mb-2">
              <span className="sm:text-[28px] font-medium text-slate-800 tracking-tight font-mono leading-none text-3xl">
                {formatCompactKES(stats.activeValue)}
              </span>
              <span className="text-sm text-emerald-650 font-medium">Active Leads: {stats.total}</span>
            </div>
            <div className="h-[3px] bg-slate-100 rounded-full w-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full w-[72%] transition-all duration-1000" />
            </div>
          </div>

          {/* KPI 2 */}
          <div className="bg-indigo-50/70 p-5 rounded-[20px] border border-indigo-100/50 shadow-sm flex flex-col justify-between h-[135px] hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="size-[22px] rounded-full bg-indigo-500 text-white flex items-center justify-center animate-none">
                <IconBuilding size={13} />
              </div>
              <span className="text-base font-medium text-indigo-700 tracking-wider uppercase">Active Viewings</span>
            </div>
            <div className="flex items-end justify-between mt-auto mb-2">
              <span className="text-indigo-900 tracking-tight leading-none mono-stat">{stats.viewings}</span>
              <span className="text-sm text-indigo-650 font-medium">Tours this month</span>
            </div>
            <div className="h-[3px] bg-indigo-200/50 rounded-full w-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full w-[45%] transition-all duration-1000" />
            </div>
          </div>

          {/* KPI 3 */}
          <div className="bg-emerald-50/70 p-5 rounded-[20px] border border-emerald-100/50 shadow-sm flex flex-col justify-between h-[135px] hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="size-[22px] rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <IconCheck size={13} />
              </div>
              <span className="text-base font-medium text-emerald-700 tracking-wider uppercase">Win Conversion Rate</span>
            </div>
            <div className="flex items-end justify-between mt-auto mb-2">
              <span className="text-emerald-900 tracking-tight leading-none mono-stat">{stats.winRate}%</span>
              <span className="text-sm text-emerald-650 font-medium">Won vs Lost ratio</span>
            </div>
            <div className="h-[3px] bg-emerald-200/50 rounded-full w-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full w-[80%] transition-all duration-1000" />
            </div>
          </div>

          {/* KPI 4 */}
          <div className="bg-amber-50/70 p-5 rounded-[20px] border border-amber-100/50 shadow-sm flex flex-col justify-between h-[135px] hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="size-[22px] rounded-full bg-amber-500 text-white flex items-center justify-center">
                <IconAlertTriangle size={13} />
              </div>
              <span className="text-base font-medium text-amber-700 tracking-wider uppercase">Pending Offers Value</span>
            </div>
            <div className="flex items-end justify-between mt-auto mb-2">
              <span className="sm:text-[28px] font-medium text-amber-900 tracking-tight font-mono leading-none text-3xl">
                {formatCompactKES(stats.pendingOffers)}
              </span>
              <span className="text-sm text-amber-750 font-medium">Offers & Negotiation</span>
            </div>
            <div className="h-[3px] bg-amber-200/50 rounded-full w-full overflow-hidden">
              <div className="h-full bg-amber-600 rounded-full w-[60%] transition-all duration-1000" />
            </div>
          </div>

        </div>
      )}

      {/* ── Main Data Board ── */}
      <Card className={cn(
        "flex flex-col overflow-hidden border border-slate-100 shadow-sm bg-white rounded-3xl",
        isFullPageFocus ? "flex-1 h-full" : ""
      )}>

        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-100 space-y-4 bg-white shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4">

            {/* View switcher & Search */}
            <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[280px]">

              {/* Kanban / List Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setViewMode("kanban")}
                  className={cn(
                    "p-1.5 rounded-lg transition-all text-slate-550 hover:text-slate-800",
                    viewMode === "kanban" && "bg-white shadow-sm text-[#151936]"
                  )}
                  aria-label="Kanban view"
                >
                  <IconLayoutKanban size={17} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1.5 rounded-lg transition-all text-slate-550 hover:text-slate-800",
                    viewMode === "list" && "bg-white shadow-sm text-[#151936]"
                  )}
                  aria-label="List view"
                >
                  <IconList size={17} />
                </button>
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search opportunities..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); resetPagination(); }}
                  className="pl-10 pr-4 py-2 w-full bg-slate-50 border border-slate-200/60 rounded-xl text-base focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Dropdown filters */}
            <div className="flex items-center gap-2 flex-wrap">

              {/* Stage select (List view only) */}
              {viewMode === "list" && (
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200/60 rounded-xl text-slate-600 text-base">
                  <span className="text-slate-400">Stage:</span>
                  <select
                    value={stageFilter}
                    onChange={(e) => { setStageFilter(e.target.value); resetPagination(); }}
                    className="bg-transparent focus:outline-none font-medium text-slate-800"
                  >
                    <option value="all">All Stages</option>
                    {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              )}
              {/* Source Select */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200/60 rounded-xl text-slate-600 font-normal text-base">
                <span className="text-slate-400">Source:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => { setSourceFilter(e.target.value); resetPagination(); }}
                  className="bg-transparent focus:outline-none font-medium text-slate-800"
                >
                  <option value="all">All Sources</option>
                  {Object.entries(SOURCE_COLORS).map(([k]) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
                </select>
              </div>

              {/* Scope Select */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200/60 rounded-xl text-slate-600 font-normal text-base">
                <span className="text-slate-400">Scope:</span>
                <select
                  value={role}
                  onChange={(e) => { setRole(e.target.value as "CEO" | "Agent"); resetPagination(); }}
                  className="bg-transparent focus:outline-none font-medium text-slate-800 cursor-pointer"
                >
                  <option value="CEO">CEO (All)</option>
                  <option value="Agent">Agent Amina</option>
                </select>
              </div>

              {/* Add Lead button */}
              <button
                onClick={() => { setEditingLead(undefined); setIsModalOpen(true); }}
                className="flex items-center gap-1.5 bg-[#f3df27] text-[#151936] px-4 py-2 rounded-xl font-medium hover:bg-[#e6d220] transition-colors shadow-sm cursor-pointer text-base"
              >
                <IconPlus size={15} stroke={2.5} />
                <span>Create Lead</span>
              </button>

              {/* Full Screen Focus button */}
              {!isFullPageFocus && (
                <Link
                  href="/admin/pipeline/kanban"
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-sm shrink-0 text-base"
                >
                  <IconArrowUpRight size={15} stroke={2.5} />
                  <span>Full Screen Focus</span>
                </Link>
              )}
            </div>
          </div>

          {/* Active filter chips */}
          {(stageFilter !== "all" || sourceFilter !== "all" || searchQuery !== "") && (
            <div className="flex items-center gap-2 flex-wrap pt-2 animate-fade-in">
              <span className="text-slate-400 label-caps">Active Filters:</span>
              {searchQuery && (
                <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-base font-medium border border-slate-200/40">
                  Search: &quot;{searchQuery}&quot;
                  <button onClick={() => setSearchQuery("")} className="hover:text-red-500"><IconX size={12} /></button>
                </span>
              )}
              {stageFilter !== "all" && (
                <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-base font-medium border border-indigo-200/40">
                  Stage: {STAGE_LABELS[stageFilter as PipelineStage]}
                  <button onClick={() => setStageFilter("all")} className="hover:text-red-500"><IconX size={12} /></button>
                </span>
              )}
              {sourceFilter !== "all" && (
                <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-base font-medium border border-amber-200/40 font-medium">
                  Source: {sourceFilter}
                  <button onClick={() => setSourceFilter("all")} className="hover:text-red-500"><IconX size={12} /></button>
                </span>
              )}
              <button onClick={() => { setSearchQuery(""); setStageFilter("all"); setSourceFilter("all"); }} className="text-sm font-medium text-slate-500 hover:text-slate-800 underline ml-1">
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── MAIN CONTENT DUAL VIEWS ── */}
        <div className="flex-1 min-h-[400px]">

          <AnimatePresence mode="wait">

            {isLoading ? (
              // Simple unified skeleton loader screen
              <div key="loading" className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border border-slate-100 rounded-2xl p-4 space-y-4">
                    <div className="h-4 w-24 bg-slate-100 rounded" />
                    <div className="space-y-2">
                      <div className="h-14 bg-slate-100 rounded-xl" />
                      <div className="h-14 bg-slate-50 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === "kanban" ? (

              // ── Kanban Board View ──
              <div
                key="kanban"
                className={cn(
                  "p-6 overflow-x-auto flex gap-4 custom-scrollbar select-none align-stretch",
                  isFullPageFocus ? "flex-1 overflow-y-hidden" : ""
                )}
              >
                {(Object.keys(STAGE_LABELS) as PipelineStage[]).map((stage) => {
                  const stageLeads = sortedLeads.filter(l => l.stage === stage);
                  const columnBudget = stageLeads.reduce((acc, l) => acc + l.budget, 0);

                  return (
                    <div key={stage} className="flex-1 min-w-[280px] bg-slate-50/50 rounded-2xl p-3 flex flex-col border border-slate-100">

                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("px-2 py-0.5 rounded-md text-sm font-medium border uppercase tracking-wider font-medium", STAGE_COLORS[stage])}>
                            {STAGE_LABELS[stage]}
                          </span>
                          <span className="text-slate-400 mono-data">({stageLeads.length})</span>
                        </div>
                        {columnBudget > 0 && (
                          <span className="text-sm  font-mono font-medium text-slate-500">{formatCompactKES(columnBudget)}</span>
                        )}
                      </div>

                      {/* Leads Cards Container */}
                      <div className={cn(
                        "flex-1 space-y-2 overflow-y-auto pr-0.5 custom-scrollbar min-h-[150px]",
                        isFullPageFocus ? "max-h-[calc(100vh-270px)]" : "max-h-[480px]"
                      )}>
                        {stageLeads.length > 0 ? (
                          stageLeads.map((lead) => (
                            <div
                              key={lead.id}
                              onClick={() => setSelectedLeadId(lead.id)}
                              className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group flex flex-col min-h-[180px] shadow-sm"
                            >
                              {/* Header Property Visual */}
                              <div className="relative h-[65px] w-full bg-slate-100 overflow-hidden">
                                <Image
                                  src={getPropertyImage(lead.propertyInterest)}
                                  alt={lead.propertyInterest}
                                  fill
                                  sizes="200px"
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute top-2 right-2">
                                  <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium tracking-wide uppercase shadow-sm bg-white/95 text-slate-800 border border-slate-100", SOURCE_COLORS[lead.source])}>
                                    {lead.source}
                                  </span>
                                </div>
                              </div>

                              {/* Card Content & Footer */}
                              <div className="p-3 flex-1 flex flex-col justify-between">
                                <div className="space-y-1">
                                  <h4 className="text-base font-normal text-slate-900 group-hover:text-[#151936] transition-colors leading-snug truncate">
                                    {lead.clientName}
                                  </h4>
                                  <p className="text-sm  text-slate-500 flex items-center gap-1 font-normal truncate">
                                    <IconBuilding size={12} className="text-slate-400 shrink-0" />
                                    <span>{lead.propertyInterest}</span>
                                  </p>
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-slate-100/70 flex items-center justify-between">
                                  {/* Budget & Agent Row */}
                                  <div className="flex items-center gap-2">
                                    <Avatar
                                      src={getAgentAvatar(lead.assignedAgent)}
                                      fallback={lead.assignedAgent[0]}
                                      className="size-5 shrink-0 border border-slate-100 shadow-sm"
                                    />
                                    <span className="text-slate-800 leading-none mono-data">
                                      {formatCompactKES(lead.budget)}
                                    </span>
                                  </div>

                                  {/* Manual stage adjustments and editing buttons */}
                                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => { setEditingLead(lead); setIsModalOpen(true); }}
                                      className="p-1 border border-slate-100/80 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                                      title="Edit Lead"
                                    >
                                      <IconEdit size={11} />
                                    </button>
                                    <div className="h-4 w-px bg-slate-100 mx-0.5" />
                                    <button
                                      onClick={() => handleMoveStage(lead.id, "backward")}
                                      disabled={lead.stage === "inquiry"}
                                      className="p-1 border border-slate-100/80 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                      aria-label="Move stage backward"
                                    >
                                      <IconArrowLeft size={11} />
                                    </button>
                                    <button
                                      onClick={() => handleMoveStage(lead.id, "forward")}
                                      disabled={lead.stage === "closed_lost"}
                                      className="p-1 border border-slate-100/80 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                      aria-label="Move stage forward"
                                    >
                                      <IconArrowRight size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-full border border-dashed border-slate-200 rounded-xl flex items-center justify-center p-6 text-center text-slate-400 min-h-[100px]">
                            <p className="text-sm  font-medium">Drag-free space</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (

              // ── List View (DataTable) ──
              <div key="list" className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 select-none label-caps">
                      <th className="py-4 pl-6 pr-2 w-10 text-center">
                        <input
                          type="checkbox"
                          onChange={() => {
                            const paginatedIds = paginatedLeads.map(l => l.id);
                            const allSelected = paginatedIds.every(id => selectedIds.includes(id));
                            if (allSelected) {
                              setSelectedIds(prev => prev.filter(id => !paginatedIds.includes(id)));
                            } else {
                              setSelectedIds(prev => [...prev, ...paginatedIds.filter(id => !prev.includes(id))]);
                            }
                          }}
                          checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.includes(l.id))}
                          className="rounded border-slate-300 text-[#151936] focus:ring-[#151936]/20 size-4 cursor-pointer"
                        />
                      </th>
                      <th className="py-4 px-4 font-medium cursor-pointer" onClick={() => handleSort("clientName")}>
                        Deal / Client Name {sortField === "clientName" && (sortDir === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="py-4 px-4 font-medium">Stage</th>
                      <th className="py-4 px-4 font-medium cursor-pointer text-right" onClick={() => handleSort("budget")}>
                        KES Budget {sortField === "budget" && (sortDir === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="py-4 px-4 font-medium">Property Interest</th>
                      <th className="py-4 px-4 font-medium">Assigned Agent</th>
                      <th className="py-4 px-4 font-medium">Source</th>
                      <th className="py-4 px-6 text-right w-20">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-50 bg-white">
                    {paginatedLeads.length > 0 ? (
                      paginatedLeads.map((lead, idx) => (
                        <motion.tr
                          key={lead.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15, delay: idx * 0.02 }}
                          className={cn(
                            "hover:bg-slate-50/50 transition-colors cursor-pointer text-base text-slate-700 group",
                            selectedIds.includes(lead.id) && "bg-indigo-50/20"
                          )}
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <td className="py-4 pl-6 pr-2 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(lead.id)}
                              onChange={() => setSelectedIds(prev => prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id])}
                              className="rounded border-slate-300 text-[#151936] focus:ring-[#151936]/20 size-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={getClientAvatar(lead.clientName)}
                                fallback={lead.clientName[0]}
                                className="size-9 shrink-0 border border-slate-100 shadow-sm"
                              />
                              <div>
                                <span className="font-normal text-slate-900 group-hover:text-[#151936] transition-colors leading-snug block body-md">
                                  {lead.clientName}
                                </span>
                                <span className="text-sm text-slate-400 font-mono mt-0.5 block font-normal">
                                  Created: {lead.createdDate}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn("px-2.5 py-0.5 text-sm font-medium rounded-full border uppercase tracking-wider font-medium", STAGE_COLORS[lead.stage])}>
                              {STAGE_LABELS[lead.stage]}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-mono font-medium text-slate-800">
                            {formatKES(lead.budget)}
                          </td>
                          <td className="py-4 px-4 text-slate-550">
                            <span className="flex items-center gap-1.5 font-normal">
                              <IconBuilding size={14} className="text-slate-400 shrink-0" />
                              <span>{lead.propertyInterest}</span>
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-600 font-normal">
                            <div className="flex items-center gap-2">
                              <Avatar
                                src={getAgentAvatar(lead.assignedAgent)}
                                fallback={lead.assignedAgent[0]}
                                className="size-5 shrink-0 border border-slate-100 shadow-sm"
                              />
                              <span>{lead.assignedAgent?.replace("CEO", "Admin")}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn("px-2.5 py-0.5 text-sm font-medium rounded-full capitalize block w-fit", SOURCE_COLORS[lead.source])}>
                              {lead.source}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right relative" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setRowMenuId(rowMenuId === lead.id ? null : lead.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <IconDotsVertical size={16} />
                            </button>

                            {rowMenuId === lead.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setRowMenuId(null)} />
                                <div className="absolute right-6 top-10 w-44 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-20 py-1 text-left animate-scale-in">
                                  <button
                                    onClick={() => { setSelectedLeadId(lead.id); setRowMenuId(null); }}
                                    className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base"
                                  >
                                    <IconCircleDot size={14} /> View Details
                                  </button>
                                  <button
                                    onClick={() => { setEditingLead(lead); setIsModalOpen(true); setRowMenuId(null); }}
                                    className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base"
                                  >
                                    <IconEdit size={14} /> Edit Lead
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedChatDMId(getDMIdForContact(lead.clientName));
                                      setRowMenuId(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base"
                                  >
                                    <IconMessageCircle size={14} /> Send Message
                                  </button>
                                  <div className="border-t border-slate-100 my-1" />
                                  <button
                                    onClick={() => { handleDeleteLead(lead.id); setRowMenuId(null); }}
                                    className="flex items-center gap-2 w-full px-3.5 py-2 text-red-650 hover:bg-red-50 font-medium transition-colors text-base"
                                  >
                                    <IconTrash size={14} /> Clear Record
                                  </button>
                                </div>
                              </>
                            )}
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                            <div className="size-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 mb-4 shadow-sm">
                              <IconChartBar size={28} />
                            </div>
                            <h4 className="font-medium text-slate-800 leading-none body-md">No active leads match filters</h4>
                            <button
                              onClick={() => {
                                setSearchQuery("");
                                setStageFilter("all");
                                setSourceFilter("all");
                              }}
                              className="mt-4 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-all shadow-sm text-base"
                            >
                              Reset Filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </AnimatePresence>

        </div>

        {/* List Pagination (List view only) */}
        {viewMode === "list" && (
          <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
            <span className="text-slate-400 mono-data">
              Showing {sortedLeads.length > 0 ? (currentPage - 1) * ROWS_PER_PAGE + 1 : 0}-
              {Math.min(currentPage * ROWS_PER_PAGE, sortedLeads.length)} of {sortedLeads.length} deals
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || isLoading}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors shadow-sm"
              >
                <IconChevronLeft size={16} />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    "size-8 rounded-lg text-[12.5px] font-medium transition-colors font-mono",
                    currentPage === i + 1 ? "bg-[#151936] text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || isLoading}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors shadow-sm"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </Card>

      {/* ── Sliding Bulk Actions Bar ── */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 inset-x-0 mx-auto w-full max-w-2xl bg-[#151936] text-white p-4 rounded-2xl shadow-[0_20px_50px_rgba(21,25,54,0.3)] flex items-center justify-between z-[70] border border-slate-800/40"
          >
            <div className="flex items-center gap-3">
              <span className="size-6 rounded-full bg-[#f3df27] text-[#151936] flex items-center justify-center mono-data">
                {selectedIds.length}
              </span>
              <div>
                <p className="font-medium leading-none text-base">Deals Selected</p>
                <p className="text-sm text-slate-400 mt-1">Batch actions will apply to marked deals.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkMessage}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-base font-medium rounded-xl transition-all"
              >
                <IconMessageCircle size={14} /> Message
              </button>

              {/* Set Stage Dropdown */}
              <div className="relative group/stage px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-base font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer">
                <span>Set Stage</span>
                <span className="text-sm ">▼</span>
                <div className="absolute bottom-full right-0 mb-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg text-slate-700 py-1 hidden group-hover/stage:block animate-scale-in max-h-[160px] overflow-y-auto custom-scrollbar">
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => handleBulkStageChange(k as PipelineStage)} className="w-full text-left px-3.5 py-2 text-base hover:bg-slate-50 font-medium transition-colors">{v}</button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-650 hover:bg-red-500 text-base font-medium rounded-xl transition-all"
              >
                <IconTrash size={14} /> Scrub Batch
              </button>

              <div className="w-[1px] h-6 bg-slate-700 mx-1" />

              <button
                onClick={() => setSelectedIds([])}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <IconX size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail Drawer & Creation Modal ── */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        leadData={leads.find(l => l.id === selectedLeadId)}
        onUpdateLead={(updated) => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
      />

      <LeadFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingLead}
      />

      <ConfirmDialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDeleteLead}
        title="Scrub Opportunity Record?"
        description="Are you sure you want to delete this opportunity? All activity logs, custom details, and files associated with this lead will be permanently deleted. This action cannot be undone."
        confirmLabel="Scrub Record"
        cancelLabel="Keep Record"
        tone="danger"
      />

      <ConfirmDialog
        open={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Scrub Selected Opportunities?"
        description={`Are you sure you want to bulk delete the ${selectedIds.length} selected opportunities? This will permanently erase all associated CRM pipelines, notes, and activity history. This action cannot be undone.`}
        confirmLabel="Scrub Opportunities"
        cancelLabel="Cancel"
        tone="danger"
      />

    </div>
  );
}
