"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconSearch,
  IconPlus,
  IconPhone,
  IconMail,
  IconBuilding,
  IconUserCircle,
  IconDotsVertical,
  IconX,
  IconTrash,
  IconEdit,
  IconMessageCircle,
  IconUsers,
  IconAlertTriangle,
  IconClipboardList
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import {
  BoardPanel,
  KpiCard,
  PaginationControls,
} from "@/components/ui/erp-primitives";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast-provider";
import { ContactDetailDrawer } from "./contact-detail-drawer";
import { ContactFormModal } from "./contact-form-modal";
import { formatCompactKES } from "@/lib/utils/format";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type ContactType =
  | "landlord"
  | "property_owner"
  | "investor"
  | "buyer"
  | "tenant"
  | "developer"
  | "financial_institution"
  | "advocate"
  | "contractor"
  | "valuer"
  | "government_agency";

export type ContactSource =
  | "referral"
  | "walk_in"
  | "website"
  | "social_media"
  | "cold_call"
  | "existing_client"
  | "partner"
  | "exhibition";

export type ContactStatus = "active" | "inactive" | "blacklisted";

export interface AssociatedProperty {
  id: string;
  name: string;
  role?: string;
}

export interface ContactFinancials {
  paid: number;
  arrears: number;
  balance: number;
  portfolioValue?: number;
}

export interface ContactInteractionLog {
  id: string;
  date: string;
  type: "call" | "email" | "meeting" | "message" | "system";
  summary: string;
  details?: string;
}

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  source: ContactSource;
  status: ContactStatus;
  email: string;
  phone: string;
  avatar?: string;
  associatedProperties: AssociatedProperty[];
  financials: ContactFinancials;
  timeline: ContactInteractionLog[];
  assignedAgent?: string;
  createdDate: string;
  notes?: string;
}

// ─── Constants & Styling Maps ──────────────────────────────────────────────────

export const TYPE_LABELS: Record<ContactType, string> = {
  landlord: "Landlord",
  property_owner: "Property Owner",
  investor: "Investor",
  buyer: "Buyer",
  tenant: "Tenant",
  developer: "Developer",
  financial_institution: "Financial Institution",
  advocate: "Advocate",
  contractor: "Contractor",
  valuer: "Valuer",
  government_agency: "Gov Agency",
};

export const SOURCE_LABELS: Record<ContactSource, string> = {
  referral: "Referral",
  walk_in: "Walk-In",
  website: "Website",
  social_media: "Social Media",
  cold_call: "Cold Call",
  existing_client: "Existing Client",
  partner: "Partner",
  exhibition: "Exhibition",
};

export const STATUS_LABELS: Record<ContactStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};

export const TYPE_COLORS: Record<ContactType, string> = {
  landlord: "bg-indigo-50/80 text-indigo-700 border-indigo-200/50",
  property_owner: "bg-purple-50/80 text-purple-700 border-purple-200/50",
  investor: "bg-emerald-50/80 text-emerald-700 border-emerald-200/50",
  buyer: "bg-blue-50/80 text-blue-700 border-blue-200/50",
  tenant: "bg-cyan-50/80 text-cyan-700 border-cyan-200/50",
  developer: "bg-violet-50/80 text-violet-700 border-violet-200/50",
  financial_institution: "bg-slate-100 text-slate-700 border-slate-300/50",
  advocate: "bg-orange-50/80 text-orange-700 border-orange-200/50",
  contractor: "bg-rose-50/80 text-rose-700 border-rose-200/50",
  valuer: "bg-amber-50/80 text-amber-700 border-amber-200/50",
  government_agency: "bg-red-50/80 text-red-700 border-red-200/50",
};

export const STATUS_COLORS: Record<ContactStatus, string> = {
  active: "text-emerald-700 bg-emerald-50 border-emerald-150",
  inactive: "text-slate-500 bg-slate-50 border-slate-200/70",
  blacklisted: "text-red-700 bg-red-50 border-red-150",
};

export const SOURCE_COLORS: Record<ContactSource, string> = {
  referral: "bg-emerald-50/50 text-emerald-600 border border-emerald-100/50",
  walk_in: "bg-slate-100 text-slate-600 border border-slate-200/50",
  website: "bg-blue-50/50 text-blue-600 border border-blue-100/50",
  social_media: "bg-pink-50/50 text-pink-600 border border-pink-100/50",
  cold_call: "bg-purple-50/50 text-purple-600 border border-purple-100/50",
  existing_client: "bg-teal-50/50 text-teal-600 border border-teal-100/50",
  partner: "bg-indigo-50/50 text-indigo-600 border border-indigo-100/50",
  exhibition: "bg-amber-50/50 text-amber-600 border border-amber-100/50",
};

// ─── Initial Mock Data ─────────────────────────────────────────────────────────

const INITIAL_CONTACTS: Contact[] = [
  {
    id: "c1",
    name: "David Kimani",
    type: "landlord",
    source: "referral",
    status: "active",
    email: "david.k@example.com",
    phone: "+254 712 345 678",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-04-12",
    associatedProperties: [
      { id: "p1", name: "Runda Grove Villa" },
      { id: "p2", name: "Karen Ridge House" }
    ],
    financials: { paid: 8400000, arrears: 0, balance: -8400000, portfolioValue: 83300000 },
    timeline: [
      { id: "l1", date: "2026-06-15", type: "call", summary: "Portfolio Review Call", details: "Reviewed Q2 lease revenues." }
    ]
  },
  {
    id: "c2",
    name: "Sarah Wanjiku",
    type: "tenant",
    source: "website",
    status: "active",
    email: "sarah.w@example.com",
    phone: "+254 723 456 789",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-05-01",
    associatedProperties: [
      { id: "p3", name: "Westlands Tower 4B" }
    ],
    financials: { paid: 720000, arrears: 0, balance: -720000, portfolioValue: 0 },
    timeline: [
      { id: "l2", date: "2026-06-18", type: "message", summary: "Lease Signed", details: "Signed digital renewal agreement." }
    ]
  },
  {
    id: "c3",
    name: "BuildTech Contractors Ltd",
    type: "contractor",
    source: "partner",
    status: "active",
    email: "info@buildtech.co.ke",
    phone: "+254 734 567 890",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-02-18",
    associatedProperties: [
      { id: "p4", name: "Upper Hill Plaza" }
    ],
    financials: { paid: 15400000, arrears: 0, balance: -15400000, portfolioValue: 0 },
    timeline: [
      { id: "l3", date: "2026-06-10", type: "meeting", summary: "Elevator Service Review", details: "Discussed elevator overhaul completion." }
    ]
  },
  {
    id: "c4",
    name: "John Omondi",
    type: "buyer",
    source: "walk_in",
    status: "active",
    email: "john.o@example.com",
    phone: "+254 745 678 901",
    assignedAgent: "John Mwangi",
    createdDate: "2026-06-01",
    associatedProperties: [],
    financials: { paid: 0, arrears: 0, balance: 0, portfolioValue: 0 },
    timeline: [
      { id: "l4", date: "2026-06-17", type: "call", summary: "Inquired about Karen Villa", details: "Interested in 4BR Karen residences." }
    ]
  },
  {
    id: "c5",
    name: "Alice Njoroge",
    type: "investor",
    source: "existing_client",
    status: "active",
    email: "alice.n@example.com",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces",
    phone: "+254 756 789 012",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-01-15",
    associatedProperties: [
      { id: "p5", name: "Lavington Gardens" },
      { id: "p6", name: "Muthaiga Grand" }
    ],
    financials: { paid: 48000000, arrears: 0, balance: -48000000, portfolioValue: 198000000 },
    timeline: [
      { id: "l5", date: "2026-05-20", type: "meeting", summary: "Disbursement Review", details: "Reviewed monthly fund distributions." }
    ]
  },
  {
    id: "c6",
    name: "Prime Properties Ltd",
    type: "property_owner",
    source: "referral",
    status: "active",
    email: "management@primeprops.co.ke",
    phone: "+254 767 890 123",
    assignedAgent: "John Mwangi",
    createdDate: "2026-03-30",
    associatedProperties: [
      { id: "p7", name: "Riverside Haven" }
    ],
    financials: { paid: 8500000, arrears: 0, balance: -8500000, portfolioValue: 8500000 },
    timeline: [
      { id: "l6", date: "2026-06-01", type: "email", summary: "Statement Sent", details: "Emailed Q1 yield calculations." }
    ]
  },
  {
    id: "c7",
    name: "KCB Bank Kenya",
    type: "financial_institution",
    source: "website",
    status: "active",
    email: "corporate@kcbgroup.com",
    phone: "+254 708 111 222",
    assignedAgent: "CEO",
    createdDate: "2026-02-10",
    associatedProperties: [],
    financials: { paid: 0, arrears: 0, balance: 0, portfolioValue: 0 },
    timeline: [
      { id: "l7", date: "2026-06-05", type: "meeting", summary: "Escrow Integration Audit", details: "Met regarding commercial escrows." }
    ]
  },
  {
    id: "c8",
    name: "Charles Ndegwa Advocate",
    type: "advocate",
    source: "cold_call",
    status: "active",
    email: "charles@ndegwa-law.co.ke",
    phone: "+254 722 987 654",
    assignedAgent: "CEO",
    createdDate: "2026-05-15",
    associatedProperties: [],
    financials: { paid: 350000, arrears: 0, balance: -350000, portfolioValue: 0 },
    timeline: [
      { id: "l8", date: "2026-06-12", type: "email", summary: "Lease Templates Sent", details: "Advocate drafted new commercial structures." }
    ]
  },
  {
    id: "c9",
    name: "Benson Musyoka",
    type: "tenant",
    source: "website",
    status: "blacklisted",
    email: "benson.m@outlook.com",
    phone: "+254 733 444 555",
    assignedAgent: "John Mwangi",
    createdDate: "2025-11-20",
    associatedProperties: [
      { id: "p8", name: "Kilimani Heights" }
    ],
    financials: { paid: 416000, arrears: 120000, balance: -296000, portfolioValue: 0 },
    timeline: [
      { id: "l9", date: "2026-06-14", type: "call", summary: "Arrears Demand", details: "Demanded payment on 2-month rental arrears." }
    ]
  },
  {
    id: "c10",
    name: "Diplomatic Estates Ltd",
    type: "developer",
    source: "exhibition",
    status: "active",
    email: "dev@diploestates.com",
    phone: "+254 788 333 444",
    assignedAgent: "Amina Wanjiku",
    createdDate: "2026-06-03",
    associatedProperties: [
      { id: "p9", name: "Gigiri Diplomatic" }
    ],
    financials: { paid: 0, arrears: 0, balance: 0, portfolioValue: 35000000 },
    timeline: [
      { id: "l10", date: "2026-06-04", type: "meeting", summary: "Pre-sales Briefing", details: "Attended Gigiri apartments pre-sale launch." }
    ]
  }
];

const ROWS_PER_PAGE = 5;

// ─── Component Code ───────────────────────────────────────────────────────────

export function ContactsBoard({ entityId: _entityId }: { entityId: string }) {
  const { pushToast } = useToast();
  const { setSelectedChatDMId } = useUIStore();

  // App States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Confirmation States
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Simulated Roles: "CEO" (sees everything) or "Agent" (sees only Amina Wanjiku's assignments)
  const [role, setRole] = useState<"CEO" | "Agent">("CEO");

  // Sorting & Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isLoading, setIsLoading] = useState(true);

  // Detail Drawer & Form Modal State
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/contacts?entityId=${_entityId}`);
      const data = await res.json();
      if (data.contacts) {
        const mapped = data.contacts.map((c: any) => ({
          id: c.id,
          name: c.displayName,
          type: c.type,
          source: c.source ?? "website",
          status: c.status ?? "active",
          email: c.email ?? "",
          phone: c.phone ?? "",
          associatedProperties: [],
          financials: { paid: 0, arrears: 0, balance: 0 },
          timeline: [],
          assignedAgent: "Staff Member",
          createdDate: c.createdAt ? c.createdAt.split("T")[0] : "",
        }));
        setContacts(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [_entityId]);

  useEffect(() => {
    if (_entityId) {
      fetchContacts();
    }
  }, [_entityId, fetchContacts]);

  // Trigger loading skeletons on filter changes
  useEffect(() => {
    const startTimer = setTimeout(() => {
      setIsLoading(true);
    }, 0);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [searchQuery, typeFilter, statusFilter, sourceFilter, role, currentPage, sortField, sortDir]);

  // Clear selections when filter or role changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedIds([]);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchQuery, typeFilter, statusFilter, sourceFilter, role]);

  // Reset page when filters change
  const resetPagination = () => setCurrentPage(1);

  // Filter contacts based on search, filters, and simulated role
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // 1. Role Scope
      const matchesRole = role === "CEO" || c.assignedAgent === "Amina Wanjiku";

      // 2. Search Box
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery);

      // 3. Dropdown filters
      const matchesType = typeFilter === "all" || c.type === typeFilter;
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesSource = sourceFilter === "all" || c.source === sourceFilter;

      return matchesRole && matchesSearch && matchesType && matchesStatus && matchesSource;
    });
  }, [contacts, searchQuery, typeFilter, statusFilter, sourceFilter, role]);

  // Sort contacts
  const sortedContacts = useMemo(() => {
    const sorted = [...filteredContacts];
    sorted.sort((a, b) => {
      let aVal: unknown = a[sortField as keyof Contact];
      let bVal: unknown = b[sortField as keyof Contact];

      // Nested object checking
      if (sortField === "financials.paid") {
        aVal = a.financials.paid;
        bVal = b.financials.paid;
      } else if (sortField === "financials.arrears") {
        aVal = a.financials.arrears;
        bVal = b.financials.arrears;
      }

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        const aNum = typeof aVal === "number" ? aVal : 0;
        const bNum = typeof bVal === "number" ? bVal : 0;
        return sortDir === "asc"
          ? aNum - bNum
          : bNum - aNum;
      }
    });
    return sorted;
  }, [filteredContacts, sortField, sortDir]);

  // Paginated contacts
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return sortedContacts.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [sortedContacts, currentPage]);

  const totalPages = Math.ceil(sortedContacts.length / ROWS_PER_PAGE) || 1;

  // Sorting Handler
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

  // Checkbox row toggler
  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  // Select all filtered contacts toggler
  const toggleSelectAll = () => {
    const paginatedIds = paginatedContacts.map(c => c.id);
    const allSelectedOnPage = paginatedIds.every(id => selectedIds.includes(id));

    if (allSelectedOnPage) {
      // Remove page IDs
      setSelectedIds(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      // Add missing page IDs
      setSelectedIds(prev => {
        const added = paginatedIds.filter(id => !prev.includes(id));
        return [...prev, ...added];
      });
    }
  };

  // Bulk Operations Handlers
  const handleBulkDelete = () => {
    setIsBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = () => {
    setContacts(prev => prev.filter(c => !selectedIds.includes(c.id)));
    pushToast({
      tone: "success",
      title: "Batch Action Completed",
      body: `Successfully deleted ${selectedIds.length} contact records from the CRM.`
    });
    setSelectedIds([]);
    setIsBulkDeleteConfirmOpen(false);
  };


  const handleBulkStatusChange = (newStatus: ContactStatus) => {
    setContacts(prev => prev.map(c =>
      selectedIds.includes(c.id) ? { ...c, status: newStatus } : c
    ));
    pushToast({
      tone: "success",
      title: "Batch Action Completed",
      body: `Status updated to "${STATUS_LABELS[newStatus]}" for ${selectedIds.length} contacts.`
    });
    setSelectedIds([]);
  };

  const handleBulkMessage = () => {
    pushToast({
      tone: "success",
      title: "Direct Broadcast Dispatched",
      body: `Dispatched chat invitations to ${selectedIds.length} selected recipients.`
    });
    setSelectedIds([]);
  };

  // Create / Edit Submissions
  const handleCreateOrUpdate = async (payload: Partial<Contact>) => {
    setIsLoading(true);
    try {
      if (editingContact) {
        // Update
        pushToast({ tone: "success", title: "Record Updated", body: `Changes saved for "${payload.name}".` });
        setEditingContact(undefined);
      } else {
        // Create
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: _entityId,
            displayName: payload.name,
            type: payload.type,
            email: payload.email,
            phone: payload.phone,
            source: payload.source,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create contact");

        pushToast({ tone: "success", title: "Record Created", body: `Successfully enrolled "${payload.name}".` });
        fetchContacts();
      }
    } catch (err: any) {
      pushToast({ tone: "warning", title: "Failed to Save", body: err.message });
    } finally {
      setIsLoading(false);
      setIsModalOpen(false);
    }
  };

  const handleDeleteContact = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteContact = () => {
    if (!deleteConfirmId) return;
    const contact = contacts.find(c => c.id === deleteConfirmId);
    setContacts(prev => prev.filter(c => c.id !== deleteConfirmId));
    pushToast({
      tone: "success",
      title: "Record Deleted",
      body: `"${contact?.name || 'Contact'}" has been successfully scrubbed from CRM.`
    });
    setDeleteConfirmId(null);
  };

  // Dynamic Contact Detail Updates (when logging notes in drawer)
  const handleUpdateContact = (updated: Contact) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  // Metric aggregates
  const stats = useMemo(() => {
    const filtered = contacts.filter(c => role === "CEO" || c.assignedAgent === "Amina Wanjiku");
    const totalPaid = filtered.reduce((acc, c) => acc + c.financials.paid, 0);
    const totalArrears = filtered.reduce((acc, c) => acc + c.financials.arrears, 0);

    return {
      total: filtered.length,
      landlords: filtered.filter(c => c.type === "landlord" || c.type === "property_owner").length,
      tenants: filtered.filter(c => c.type === "tenant").length,
      blacklisted: filtered.filter(c => c.status === "blacklisted").length,
      paid: totalPaid,
      arrears: totalArrears
    };
  }, [contacts, role]);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Operations Control Hub Navigator ── */}
      <BoardPanel className="flex flex-wrap items-center justify-between gap-4 p-4">
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
            className="px-3.5 py-1.5 text-sm  font-medium rounded-lg transition-all flex items-center gap-1.5 bg-[#151936] text-white shadow-sm"
          >
            <span>Contacts</span>
            <span className="bg-[#f3df27] text-[#151936] px-1.5 py-0.2 rounded-full font-medium text-sm">Active</span>
          </Link>
          <Link
            href="/admin/pipeline"
            className="px-3.5 py-1.5 text-sm  font-medium rounded-lg transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/45"
          >
            <span>Deals Pipeline</span>
            <span className="bg-slate-200 text-slate-650 px-1.5 py-0.2 rounded-full font-medium text-sm">Deals</span>
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
      </BoardPanel>

      {/* ── Top Analytics KPI Tier ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <KpiCard icon={IconUsers} label="Total Contacts" progress={80} tone="neutral" trend="+12%" value={stats.total} />
        <KpiCard icon={IconBuilding} label="Landlords & Owners" progress={65} tone="data" trend="32 Units Owned" value={stats.landlords} />
        <KpiCard icon={IconUsers} label="Active Tenants" progress={92} tone="success" trend="92% Occupancy" value={stats.tenants} />
        <KpiCard
          icon={IconAlertTriangle}
          label="Blacklisted / Risks"
          progress={15}
          tone="warning"
          trend={`Arrears: ${formatCompactKES(stats.arrears)}`}
          value={stats.blacklisted}
        />

      </div>

      {/* ── Main Data Board ── */}
      <BoardPanel className="flex flex-col overflow-hidden p-0">

        {/* Controls Header */}
        <div className="p-5 border-b border-slate-100 space-y-4 bg-white shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4">

            {/* Left search */}
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search CRM Directory..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); resetPagination(); }}
                className="pl-10 pr-4 py-2 w-full bg-slate-50 border border-slate-200/60 rounded-xl text-base focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>

            {/* Right filter dropdowns & actions */}
            <div className="flex items-center gap-2 flex-wrap">

              {/* Type Select */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200/60 rounded-xl text-slate-600 text-base">
                <span className="text-slate-400">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); resetPagination(); }}
                  className="bg-transparent focus:outline-none font-medium text-slate-800"
                >
                  <option value="all">All Types</option>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {/* Status Select */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200/60 rounded-xl text-slate-600 text-base">
                <span className="text-slate-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); resetPagination(); }}
                  className="bg-transparent focus:outline-none font-medium text-slate-800"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {/* Source Select */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200/60 rounded-xl text-slate-600 font-normal text-base">
                <span className="text-slate-400">Source:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => { setSourceFilter(e.target.value); resetPagination(); }}
                  className="bg-transparent focus:outline-none font-medium text-slate-800"
                >
                  <option value="all">All Sources</option>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

              {/* New Contact Trigger */}
              <button
                onClick={() => { setEditingContact(undefined); setIsModalOpen(true); }}
                className="flex items-center gap-1.5 bg-[#f3df27] text-[#151936] px-4 py-2 rounded-xl font-medium hover:bg-[#e6d220] transition-colors shadow-sm cursor-pointer text-base"
              >
                <IconPlus size={15} stroke={2.5} />
                <span>Add Record</span>
              </button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(typeFilter !== "all" || statusFilter !== "all" || sourceFilter !== "all" || searchQuery !== "") && (
            <div className="flex items-center gap-2 flex-wrap pt-2 animate-fade-in">
              <span className="text-slate-400 label-caps">Active Filters:</span>

              {searchQuery && (
                <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-base font-medium border border-slate-200/40">
                  Search: &quot;{searchQuery}&quot;
                  <button onClick={() => setSearchQuery("")} className="hover:text-red-500"><IconX size={12} /></button>
                </span>
              )}
              {typeFilter !== "all" && (
                <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-base font-medium border border-indigo-200/40">
                  Type: {TYPE_LABELS[typeFilter as ContactType]}
                  <button onClick={() => setTypeFilter("all")} className="hover:text-red-500"><IconX size={12} /></button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="flex items-center gap-1 bg-slate-150 text-slate-700 px-2.5 py-1 rounded-lg text-base font-medium border border-slate-200/40">
                  Status: {STATUS_LABELS[statusFilter as ContactStatus]}
                  <button onClick={() => setStatusFilter("all")} className="hover:text-red-500"><IconX size={12} /></button>
                </span>
              )}
              {sourceFilter !== "all" && (
                <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-base font-medium border border-amber-200/40">
                  Source: {SOURCE_LABELS[sourceFilter as ContactSource]}
                  <button onClick={() => setSourceFilter("all")} className="hover:text-red-500"><IconX size={12} /></button>
                </span>
              )}

              <button
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setSourceFilter("all");
                }}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Data Grid Table Wrapper (styled using custom scrollbars globally) */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 select-none label-caps">
                <th className="py-4 pl-6 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedIds.includes(c.id))}
                    className="rounded border-slate-300 text-[#151936] focus:ring-[#151936]/20 size-4 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-4 font-medium cursor-pointer hover:text-slate-650" onClick={() => handleSort("name")}>
                  Contact {sortField === "name" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="py-4 px-4 font-medium cursor-pointer hover:text-slate-650" onClick={() => handleSort("type")}>
                  Classification & Source {sortField === "type" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="py-4 px-4 font-medium">Contact Details</th>
                <th className="py-4 px-4 font-medium">Associated Entities</th>
                <th className="py-4 px-4 font-medium text-right cursor-pointer hover:text-slate-650" onClick={() => handleSort("financials.paid")}>
                  Financial Record {sortField === "financials.paid" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="py-4 px-4 font-medium cursor-pointer hover:text-slate-650" onClick={() => handleSort("createdDate")}>
                  Last Contact {sortField === "createdDate" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="py-4 px-6 font-medium text-right w-20">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 bg-white relative">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  // Skeleton Loading State
                  Array.from({ length: ROWS_PER_PAGE }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="py-4 pl-6 pr-2 text-center"><div className="size-4 bg-slate-100 rounded mx-auto" /></td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 bg-slate-100 rounded-full" />
                          <div className="space-y-2">
                            <div className="h-4 w-28 bg-slate-100 rounded" />
                            <div className="h-3 w-16 bg-slate-50 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div className="h-5 w-20 bg-slate-100 rounded" />
                          <div className="h-4 w-12 bg-slate-50 rounded" />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div className="h-3 w-32 bg-slate-55 rounded" />
                          <div className="h-3 w-24 bg-slate-50 rounded" />
                        </div>
                      </td>
                      <td className="py-4 px-4"><div className="h-6 w-24 bg-slate-100 rounded-lg" /></td>
                      <td className="py-4 px-4 text-right"><div className="h-4 w-20 bg-slate-100 rounded ml-auto" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
                      <td className="py-4 px-6 text-right"><div className="size-7 bg-slate-100 rounded-lg ml-auto" /></td>
                    </tr>
                  ))
                ) : paginatedContacts.length > 0 ? (
                  paginatedContacts.map((contact, idx) => (
                    <motion.tr
                      key={contact.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.02 }}
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors cursor-pointer group text-base text-slate-700",
                        selectedIds.includes(contact.id) && "bg-indigo-50/20"
                      )}
                      onClick={() => setSelectedContactId(contact.id)}
                    >
                      {/* Checkbox column */}
                      <td className="py-4 pl-6 pr-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(contact.id)}
                          onChange={() => toggleSelectRow(contact.id)}
                          className="rounded border-slate-300 text-[#151936] focus:ring-[#151936]/20 size-4 cursor-pointer"
                        />
                      </td>

                      {/* Profile column (names in font-normal) */}
                      <td className="py-4 px-4 font-normal text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar src={contact.avatar} fallback={contact.name[0]} className="size-9 border border-slate-200" />
                            <span className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white",
                              contact.status === "active" ? "bg-emerald-500" : contact.status === "inactive" ? "bg-slate-400" : "bg-red-500"
                            )} />
                          </div>
                          <div>
                            <span className="font-normal text-slate-900 group-hover:text-[#151936] transition-colors leading-snug block body-md">
                              {contact.name}
                            </span>
                            <span className="text-sm text-slate-400 mt-0.5 block font-medium capitalize">
                              Owner: {contact.assignedAgent?.replace("CEO", "Admin")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type badge / Source column */}
                      <td className="py-4 px-4 space-y-1.5">
                        <span className={cn("px-2.5 py-0.5 text-sm font-medium rounded-full border block w-fit whitespace-nowrap", TYPE_COLORS[contact.type])}>
                          {TYPE_LABELS[contact.type]}
                        </span>
                        <span className={cn("px-2.5 py-0.5 text-sm font-medium rounded-full block w-fit", SOURCE_COLORS[contact.source])}>
                          {SOURCE_LABELS[contact.source]}
                        </span>
                      </td>

                      {/* Quick contacts actions */}
                      <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                        <div className="space-y-1">
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-slate-500 hover:text-[#151936] transition-colors w-fit">
                            <IconMail size={13} className="text-slate-400" />
                            <span>{contact.email}</span>
                          </a>
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-slate-500 hover:text-[#151936] transition-colors w-fit font-mono">
                            <IconPhone size={13} className="text-slate-400" />
                            <span>{contact.phone}</span>
                          </a>
                        </div>
                      </td>

                      {/* Associated Properties (Pill Tag list) */}
                      <td className="py-4 px-4">
                        {contact.associatedProperties.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {contact.associatedProperties.map((p) => (
                              <span key={p.id} className="bg-slate-50 hover:bg-slate-100 hover:text-slate-800 transition-colors border border-slate-200/60 rounded px-1.5 py-0.5 text-sm font-medium text-slate-600 block truncate max-w-[120px]">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-450 italic text-sm ">No Properties</span>
                        )}
                      </td>

                      {/* Financial values (Paid & Arrears) */}
                      <td className="py-4 px-4 text-right">
                        <div className="space-y-0.5">
                          <span className="text-emerald-600 block leading-tight mono-data">
                            {formatCompactKES(contact.financials.paid)} Paid
                          </span>
                          {contact.financials.arrears > 0 && (
                            <span className="text-sm font-medium font-mono text-rose-500 block leading-tight">
                              {formatCompactKES(contact.financials.arrears)} Arrears
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last contacted / Activity snippet */}
                      <td className="py-4 px-4 text-slate-500">
                        <span className="font-mono body-sm">{contact.createdDate}</span>
                      </td>

                      {/* Row actions */}
                      <td className="py-4 px-6 text-right relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setRowMenuId(rowMenuId === contact.id ? null : contact.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <IconDotsVertical size={16} />
                        </button>

                        {rowMenuId === contact.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setRowMenuId(null)} />
                            <div className="absolute right-6 top-10 w-44 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-20 py-1 text-left animate-scale-in">
                              <button
                                onClick={() => { setSelectedContactId(contact.id); setRowMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base"
                              >
                                <IconUserCircle size={14} /> View Details
                              </button>
                              <button
                                onClick={() => { setEditingContact(contact); setIsModalOpen(true); setRowMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base"
                              >
                                <IconEdit size={14} /> Edit Profile
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedChatDMId(getDMIdForContact(contact.name));
                                  setRowMenuId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 font-medium transition-colors text-base"
                              >
                                <IconMessageCircle size={14} /> Send Message
                              </button>
                              <div className="border-t border-slate-100 my-1" />

                              <button
                                onClick={() => { handleDeleteContact(contact.id); setRowMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3.5 py-2 text-red-650 hover:bg-red-50 font-medium transition-colors text-base"
                              >
                                <IconTrash size={14} /> Scrub Record
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  // Empty State
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="size-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 mb-4 shadow-sm">
                          <IconUserCircle size={28} />
                        </div>
                        <h4 className="font-medium text-slate-800 leading-none body-md">No contact records found</h4>
                        <p className="text-base text-slate-400 mt-2 leading-relaxed">
                          Your current search filters or security scope returned zero matches.
                        </p>
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setTypeFilter("all");
                            setStatusFilter("all");
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
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Board Footer / Pagination */}
        <div className="px-6 py-1">
          <PaginationControls
            currentPage={currentPage}
            label={`Showing ${sortedContacts.length > 0 ? (currentPage - 1) * ROWS_PER_PAGE + 1 : 0}-${Math.min(currentPage * ROWS_PER_PAGE, sortedContacts.length)} of ${sortedContacts.length} records`}
            onPageChange={setCurrentPage}
            totalPages={totalPages}
          />
        </div>

      </BoardPanel>

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
                <p className="font-medium leading-none text-base">Contacts Selected</p>
                <p className="text-sm text-slate-400 mt-1">Batch actions apply to selected records only.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkMessage}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-base font-medium rounded-xl transition-all"
              >
                <IconMessageCircle size={14} /> Broadcast
              </button>

              {/* Bulk Status Select */}
              <div className="relative group/status px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-base font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer">
                <span>Set Status</span>
                <span className="text-sm ">▼</span>
                <div className="absolute bottom-full right-0 mb-2 w-36 bg-white border border-slate-200 rounded-xl shadow-lg text-slate-700 py-1 hidden group-hover/status:block animate-scale-in">
                  <button onClick={() => handleBulkStatusChange("active")} className="w-full text-left px-3.5 py-2 text-base hover:bg-slate-50 font-medium transition-colors">Active</button>
                  <button onClick={() => handleBulkStatusChange("inactive")} className="w-full text-left px-3.5 py-2 text-base hover:bg-slate-50 font-medium transition-colors">Inactive</button>
                  <button onClick={() => handleBulkStatusChange("blacklisted")} className="w-full text-left px-3.5 py-2 text-base hover:bg-slate-50 text-red-650 hover:bg-red-50 font-medium transition-colors">Blacklisted</button>
                </div>
              </div>

              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-base font-medium rounded-xl transition-all"
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

      {/* ── Drawers & Modals ── */}
      <ContactDetailDrawer
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        contactData={contacts.find(c => c.id === selectedContactId)}
        onUpdateContact={handleUpdateContact}
      />

      <ContactFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingContact}
      />

      <ConfirmDialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDeleteContact}
        title="Scrub Contact Record?"
        description="Are you sure you want to delete this contact? All associated tenant leases, payment records, and activity timeline events will be permanently deleted. This action cannot be undone."
        confirmLabel="Scrub Record"
        cancelLabel="Keep Record"
        tone="danger"
      />

      <ConfirmDialog
        open={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Scrub Selected Contacts?"
        description={`Are you sure you want to bulk delete the ${selectedIds.length} selected contacts? This will permanently erase all associated CRM pipelines, notes, and activity history. This action cannot be undone.`}
        confirmLabel="Scrub Contacts"
        cancelLabel="Cancel"
        tone="danger"
      />
    </div>
  );
}
