"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowUpRight,
  IconBriefcase,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconClock,
  IconDotsVertical,
  IconEdit,
  IconLayoutKanban,
  IconMail,
  IconMessageCircle,
  IconMoodEmpty,
  IconPhone,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { Avatar, Badge, BoardHeader, Button, ConfirmDialog, DropdownItem, DropdownMenu, SkeletonBlock } from "@/components/ui/erp-primitives";
import { PageTransition } from "@/components/shared/page-transition";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { ContactFormModal } from "./contact-form-modal";
import { ContactProfilePeek, type ProfilePeekData } from "./contact-profile-peek";
import { STATUS_META, TYPE_META, type ContactCrmStatus, type ContactType } from "./contact-constants";

// ── Types (mirror the real /api/contacts + /api/crm/contacts-overview shape) ──

export interface Contact {
  id: string;
  displayName: string;
  type: ContactType;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  source: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToAvatarUrl: string | null;
  createdAt: string;
  status: ContactCrmStatus;
}

interface LeadDigestItem {
  id: string;
  contactId: string | null;
  clientName: string;
  propertyInterest: string;
  propertyImageUrl: string | null;
  stage: string;
  priority: "low" | "medium" | "high";
  phone: string;
  email: string;
  nextActionAt: string | null;
}

interface ViewingEvent {
  id: string;
  title: string;
  startsAt: string;
  contactId: string | null;
  leadId: string | null;
}

interface TouchEvent {
  id: string;
  contactId: string;
  summary: string;
  actorName: string | null;
  createdAt: string | null;
}

interface Overview {
  totalContacts: number;
  newThisMonth: number;
  viewingsToday: number;
  openLeadsCount: number;
  followUpsDueCount: number;
  newLeadsToday: number;
  hotLeads: LeadDigestItem[];
  followUpsDue: LeadDigestItem[];
  todaysViewings: ViewingEvent[];
  upcomingViewing: ViewingEvent | null;
  recentTouches: TouchEvent[];
}

const STAGE_LABELS: Record<string, string> = {
  inquiry: "New Inquiry",
  qualification: "Qualified",
  viewing: "Viewing Scheduled",
  offer: "Offer Sent",
  negotiation: "Legal & Docs",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const PRIORITY_PILL: Record<string, string> = {
  high: "bg-rose-50 text-rose-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

// Content-shaped loading state, replacing a centered spinner - same
// "replace the spinner" precedent as every sibling board this session.
function ContactBoardSkeleton() {
  return (
    <div className="gsap-stagger grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
      <div className="flex flex-col gap-3.5">
        <SkeletonBlock className="h-[130px] w-full rounded-3xl" />
        <SkeletonBlock className="h-[220px] w-full rounded-3xl" />
        <SkeletonBlock className="h-[180px] w-full rounded-3xl" />
      </div>
      <SkeletonBlock className="h-[520px] w-full rounded-3xl" />
    </div>
  );
}

export function ContactsBoard({ entityId }: { entityId: string }) {
  const { pushToast } = useToast();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [peekData, setPeekData] = useState<ProfilePeekData | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts?entityId=${entityId}`);
      const data = await res.json();
      if (Array.isArray(data.contacts)) {
        setContacts(data.contacts as Contact[]);
        setSpotlightId((prev) => prev ?? data.contacts[0]?.id ?? null);
      }
    } catch {
      pushToast({ tone: "warning", title: "Error", body: "Failed to load contacts." });
    }
  }, [entityId, pushToast]);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/contacts-overview?entityId=${entityId}`);
      const data = await res.json();
      if (data.overview) setOverview(data.overview as Overview);
    } catch {
      // Non-critical - hero/digest widgets degrade to empty, not a hard error.
    }
  }, [entityId]);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    Promise.all([loadContacts(), loadOverview()]).finally(() => setLoading(false));
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setCurrentUserName(d.user?.name ?? null)).catch(() => { });
  }, [entityId, loadContacts, loadOverview]);

  const spotlight = useMemo(() => contacts.find((c) => c.id === spotlightId) ?? null, [contacts, spotlightId]);

  const spotlightLastTouch = useMemo(() => {
    if (!spotlight || !overview) return null;
    return overview.recentTouches.find((t) => t.contactId === spotlight.id) ?? null;
  }, [spotlight, overview]);

  const spotlightNextAction = useMemo(() => {
    if (!spotlight || !overview) return null;
    const candidates = [...overview.hotLeads, ...overview.followUpsDue].filter((l) => l.contactId === spotlight.id && l.nextActionAt);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => new Date(a.nextActionAt!).getTime() - new Date(b.nextActionAt!).getTime())[0];
  }, [spotlight, overview]);

  const directory = useMemo(() => {
    const q = directoryQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.displayName.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q) || (c.phone ?? "").includes(q));
  }, [contacts, directoryQuery]);

  const heroGreeting = useMemo(() => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const firstName = currentUserName?.split(" ")[0] ?? "there";
    const needsAttention = overview ? overview.hotLeads.length + overview.followUpsDueCount : 0;
    return `Good ${timeOfDay}, ${firstName}${needsAttention > 0 ? ` — ${needsAttention} contact${needsAttention === 1 ? "" : "s"} need${needsAttention === 1 ? "s" : ""} you today` : ""}`;
  }, [currentUserName, overview]);

  const heroSub = useMemo(() => {
    if (!overview) return "";
    const bits: string[] = [];
    if (overview.hotLeads.length > 0) bits.push(`${overview.hotLeads.length} hot prospect${overview.hotLeads.length === 1 ? "" : "s"} awaiting a follow-up`);
    if (overview.viewingsToday > 0) bits.push(`${overview.viewingsToday} viewing${overview.viewingsToday === 1 ? "" : "s"} scheduled today`);
    return bits.length > 0 ? `${bits.join("; ")}.` : "No urgent follow-ups right now.";
  }, [overview]);

  // ── Mutations ──────────────────────────────────────────────────────────

  const logTouch = async (contactId: string, channel: "call" | "email" | "whatsapp", contactName: string) => {
    try {
      const res = await fetch(`/api/contacts/${contactId}/touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, channel }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to log");
      pushToast({ tone: "success", title: `Logged: ${channel}`, body: `${contactName}'s timeline updated.` });
      loadOverview();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handleScheduleViewing = async (contact: Contact) => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    try {
      const res = await fetch("/api/scheduling/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          title: `Property viewing — ${contact.displayName}`,
          type: "viewing",
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          contactId: contact.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to schedule");
      pushToast({ tone: "success", title: "Viewing scheduled", body: `Tomorrow 10:00 AM with ${contact.displayName}.` });
      loadOverview();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handleCreateOrUpdate = async (payload: {
    displayName: string;
    type: ContactType;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    assignedToId?: string | null;
  }) => {
    try {
      if (editingContact) {
        const res = await fetch(`/api/contacts/${editingContact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to update contact");
        pushToast({ tone: "success", title: "Contact updated", body: `Changes saved for "${payload.displayName}".` });
        setEditingContact(undefined);
      } else {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to create contact");
        pushToast({ tone: "success", title: "Contact created", body: `"${payload.displayName}" added to the directory.` });
      }
      setFormOpen(false);
      loadContacts();
    } catch (err) {
      pushToast({ tone: "warning", title: "Could not save contact", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const confirmDeleteContact = async () => {
    if (!deleteConfirmId) return;
    const contact = contacts.find((c) => c.id === deleteConfirmId);
    try {
      const res = await fetch(`/api/contacts/${deleteConfirmId}?entityId=${entityId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to delete contact");
      setContacts((prev) => prev.filter((c) => c.id !== deleteConfirmId));
      if (spotlightId === deleteConfirmId) setSpotlightId(null);
      pushToast({ tone: "success", title: "Contact removed", body: `"${contact?.displayName ?? "Record"}" removed from the directory.` });
    } catch (err) {
      pushToast({ tone: "warning", title: "Could not delete", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openPeekForLead = (lead: LeadDigestItem) => {
    setPeekData({
      contactId: lead.contactId,
      name: lead.clientName,
      photo: lead.propertyImageUrl,
      badge: `${STAGE_LABELS[lead.stage] ?? lead.stage} · ${lead.propertyInterest}`,
      phone: lead.phone || undefined,
      info: [
        { icon: IconUser, label: "Stage", value: STAGE_LABELS[lead.stage] ?? lead.stage },
        { icon: IconClock, label: "Next action", value: lead.nextActionAt ? new Date(lead.nextActionAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—" },
        { icon: IconMail, label: "Email", value: lead.email || "—" },
      ],
    });
  };

  const openPeekForTouch = (touch: TouchEvent) => {
    const contact = contacts.find((c) => c.id === touch.contactId);
    setPeekData({
      contactId: touch.contactId,
      name: contact?.displayName ?? "Contact",
      photo: contact?.avatarUrl ?? null,
      badge: touch.summary,
      phone: contact?.phone ?? undefined,
      info: [
        { icon: IconClock, label: "When", value: relativeTime(touch.createdAt) },
        { icon: IconUser, label: "Logged by", value: touch.actorName ?? "—" },
        { icon: IconMail, label: "Email", value: contact?.email || "—" },
      ],
    });
  };

  const openInSpotlight = (contactId: string | null) => {
    if (!contactId) return;
    setSpotlightId(contactId);
    setPeekData(null);
  };

  const newClientsPct = overview && contacts.length > 0 ? Math.min(100, Math.round((overview.newThisMonth / contacts.length) * 100)) : 0;
  const followUpsPct = overview && overview.openLeadsCount > 0 ? Math.min(100, Math.round((overview.followUpsDueCount / overview.openLeadsCount) * 100)) : 0;

  return (
    <PageTransition className="mx-auto flex max-w-[98rem] flex-col gap-5">
      <BoardHeader
        eyebrow={<Badge tone="primary">Directory & Relationships</Badge>}
        title="Keep-in-Touch"
        description="Every landlord, tenant, buyer, and partner across the organization - real contact history, real follow-ups, real touchpoints."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400">
              All Contacts <span className="font-mono text-slate-700">({contacts.length})</span>
            </span>
            <div className="flex bg-white border border-slate-100 rounded-xl p-1 gap-1">
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#151936] text-white">
                <IconUsers size={14} /> Contacts
              </span>
              <Link href="/admin/pipeline" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                <IconLayoutKanban size={14} /> Pipeline
              </Link>
            </div>
            <Button size="sm" onClick={() => { setEditingContact(undefined); setFormOpen(true); }}>
              <IconPlus size={14} /> New Contact
            </Button>
          </div>
        }
      />

      {loading ? (
        <ContactBoardSkeleton />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
          {/* ── Left column ── */}
          <div className="gsap-stagger flex flex-col gap-3.5 min-w-0">
            {/* Hero band */}
            <div className="relative rounded-3xl overflow-hidden min-h-[130px] flex bg-gradient-to-br from-[#0c1f24] to-[#1e1b4b]">
              <div className="relative p-6 flex items-center justify-between gap-4 flex-1 flex-wrap">
                <div>
                  <p className="font-serif text-xl text-white leading-tight">{heroGreeting}</p>
                  <p className="text-xs text-white/75 mt-1 leading-relaxed">{heroSub}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "Viewings today", value: overview?.viewingsToday ?? 0 },
                    { label: "Follow-ups due", value: overview?.followUpsDueCount ?? 0 },
                    { label: "New leads today", value: overview?.newLeadsToday ?? 0 },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-3.5 py-2 min-w-[90px]">
                      <p className="font-mono text-lg text-white leading-none">{s.value}</p>
                      <p className="text-[9.5px] uppercase tracking-wide text-white/65 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact spotlight */}
            {spotlight ? (
              <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5">
                <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-4">
                  <Avatar src={spotlight.avatarUrl ?? undefined} fallback={initialsOf(spotlight.displayName)} className="size-[100px] rounded-2xl text-2xl mx-auto sm:mx-0" />
                  <div className="min-w-0 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-serif text-lg text-slate-900 truncate">{spotlight.displayName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{spotlight.companyName ?? TYPE_META[spotlight.type].label}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => { setEditingContact(spotlight); setFormOpen(true); }} aria-label="Edit contact" className="size-8 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors">
                          <IconEdit size={14} />
                        </button>
                        <DropdownMenu label="Contact actions" align="right" trigger={<div className="size-8 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors"><IconDotsVertical size={14} /></div>}>
                          <DropdownItem icon={IconTrash} variant="danger" onClick={() => setDeleteConfirmId(spotlight.id)}>Delete Contact</DropdownItem>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {spotlight.phone && <a href={`tel:${spotlight.phone}`} className="flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-[#151936] transition-colors w-fit"><IconPhone size={13} className="text-slate-400" />{spotlight.phone}</a>}
                      {spotlight.email && <a href={`mailto:${spotlight.email}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#151936] transition-colors w-fit"><IconMail size={13} className="text-slate-400" />{spotlight.email}</a>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1">
                      {[
                        { label: "Status", value: <span className="flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full inline-block", STATUS_META[spotlight.status].dot)} />{spotlight.status}</span> },
                        { label: "Type", value: TYPE_META[spotlight.type].label },
                        { label: "Source", value: spotlight.source ?? "—" },
                        { label: "Assigned to", value: spotlight.assignedToName ?? "Unassigned" },
                      ].map((f) => (
                        <div key={f.label}>
                          <p className="text-[10px] text-slate-400">{f.label}</p>
                          <p className="text-xs font-medium text-slate-900 mt-0.5 truncate">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-3 flex-wrap border-t border-slate-100 mt-4 pt-3.5">
                  <div className="flex gap-5 flex-wrap">
                    {[
                      { label: "First contacted", value: new Date(spotlight.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) },
                      { label: "Last touch", value: spotlightLastTouch ? relativeTime(spotlightLastTouch.createdAt) : "No activity yet" },
                      { label: "Next follow-up", value: spotlightNextAction?.nextActionAt ? new Date(spotlightNextAction.nextActionAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—" },
                    ].map((d) => (
                      <div key={d.label}>
                        <p className="text-[10px] text-slate-400">{d.label}</p>
                        <p className="text-xs font-mono text-slate-900 mt-0.5">{d.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <DropdownMenu label="Quick task" align="right" trigger={<div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">Quick Task</div>}>
                      <DropdownItem icon={IconPhone} onClick={() => logTouch(spotlight.id, "call", spotlight.displayName)}>Log Call</DropdownItem>
                      <DropdownItem icon={IconMail} onClick={() => logTouch(spotlight.id, "email", spotlight.displayName)}>Log Email</DropdownItem>
                      <DropdownItem icon={IconMessageCircle} onClick={() => logTouch(spotlight.id, "whatsapp", spotlight.displayName)}>Log WhatsApp</DropdownItem>
                      <div className="my-1 h-px bg-slate-100" />
                      <DropdownItem icon={IconCalendarEvent} onClick={() => handleScheduleViewing(spotlight)}>Schedule Viewing (tomorrow 10am)</DropdownItem>
                    </DropdownMenu>
                    <Button size="sm" onClick={() => logTouch(spotlight.id, "call", spotlight.displayName)}>Prospecting Update</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/50 p-8 text-center text-sm text-slate-400">Add a contact to see it spotlighted here.</div>
            )}

            {/* Lead Status Overview */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-3.5">
                <p className="text-sm font-medium text-slate-800">Lead Status Overview</p>
                <span className="text-xs text-slate-400">Hot prospects</span>
              </div>
              {overview && overview.hotLeads.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {overview.hotLeads.map((lead) => (
                    <button key={lead.id} onClick={() => openPeekForLead(lead)} className="text-left rounded-2xl p-3.5 bg-[#fafbf8] border border-slate-100 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] transition-shadow">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Avatar fallback={initialsOf(lead.clientName)} className="size-6 text-[9px]" />
                          <span className="text-xs font-medium text-slate-900 truncate">{lead.clientName}</span>
                        </span>
                        <IconArrowUpRight size={13} className="text-slate-300 shrink-0" />
                      </div>
                      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium uppercase", PRIORITY_PILL[lead.priority])}>{STAGE_LABELS[lead.stage] ?? lead.stage}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No hot prospects right now.</p>
              )}
            </div>

            {/* Appointments + Follow-ups */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-800">Property Appointments</p>
                  <span className="text-xs text-slate-400">Today</span>
                </div>
                <div className="flex flex-col gap-2.5 mb-3.5">
                  {[
                    { label: "New Contacts (mo.)", value: `${overview?.newThisMonth ?? 0}/${contacts.length}`, pct: newClientsPct, color: "#151936" },
                    { label: "Follow-Ups Due", value: `${overview?.followUpsDueCount ?? 0}/${overview?.openLeadsCount ?? 0}`, pct: followUpsPct, color: "#f3df27" },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="flex justify-between mb-1"><span className="text-[11px] text-slate-500">{bar.label}</span><span className="text-[11px] font-mono text-slate-700">{bar.value}</span></div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${bar.pct}%`, background: bar.color }} /></div>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-700 mb-2">Today's Viewings <span className="font-mono text-[11px] text-slate-400">{overview?.viewingsToday ?? 0}</span></p>
                {overview && overview.todaysViewings.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {overview.todaysViewings.slice(0, 4).map((v) => (
                      <div key={v.id} className="flex items-center gap-2.5 text-xs">
                        <span className="font-mono text-[11px] text-slate-400 w-12 shrink-0">{new Date(v.startsAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-slate-700 truncate">{v.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No viewings scheduled today.</p>
                )}
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5">
                <p className="text-sm font-medium text-slate-800 mb-3">Follow-Up Tasks</p>
                {overview && overview.followUpsDue.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {overview.followUpsDue.map((lead) => (
                      <div key={lead.id} className="bg-[#fafbf8] border border-slate-100 rounded-2xl p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <Avatar fallback={initialsOf(lead.clientName)} className="size-6 text-[9px]" />
                            <span className="text-xs font-medium text-slate-900 truncate">{lead.clientName}</span>
                          </span>
                          <span className="flex gap-1 shrink-0">
                            {lead.phone && <a href={`tel:${lead.phone}`} onClick={(e) => { e.stopPropagation(); if (lead.contactId) logTouch(lead.contactId, "call", lead.clientName); }} aria-label={`Call ${lead.clientName}`} className="size-6 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center"><IconPhone size={11} /></a>}
                            <button onClick={() => openPeekForLead(lead)} aria-label="Open" className="size-6 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center"><IconArrowUpRight size={11} /></button>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{lead.propertyInterest}</p>
                        <p className="text-[10.5px] font-mono text-slate-400 mt-1 flex items-center gap-1"><IconClock size={11} /> {lead.nextActionAt ? new Date(lead.nextActionAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-6">No follow-ups due.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Right rail ── */}
          <div className="flex flex-col gap-3.5">
            {/* Quick Connects */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4.5 flex flex-col gap-3">
              <p className="text-sm font-medium text-slate-800">Quick Connects</p>

              {overview?.upcomingViewing ? (
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-[#fafbf8]">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-[#151936]"><IconCalendarEvent size={13} /> Viewing</span>
                    <span className="font-mono text-[10.5px] text-slate-400">{new Date(overview.upcomingViewing.startsAt).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}</span>
                  </div>
                  <div className="px-3.5 pb-3.5">
                    <p className="text-xs font-medium text-slate-900 truncate">{overview.upcomingViewing.title}</p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">{new Date(overview.upcomingViewing.startsAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 text-center gap-1.5 border border-dashed border-slate-150 rounded-2xl">
                  <IconMoodEmpty size={18} className="text-slate-300" />
                  <p className="text-[11px] text-slate-400">No upcoming viewings scheduled.</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                {overview && overview.recentTouches.length > 0 ? (
                  overview.recentTouches.map((t) => (
                    <button key={t.id} onClick={() => openPeekForTouch(t)} className="text-left border border-slate-50 bg-[#fafbf8] rounded-2xl px-3 py-2 hover:bg-slate-100/60 transition-colors">
                      <p className="text-xs text-slate-700 truncate">{t.summary}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10.5px] text-slate-400">{t.actorName ?? "System"}</span>
                        <span className="text-[10.5px] font-mono text-slate-400">{relativeTime(t.createdAt)}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-400 text-center py-4">No recent touchpoints logged yet.</p>
                )}
              </div>
            </div>

            {/* Directory */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4.5">
              <p className="text-sm font-medium text-slate-800 mb-2.5">Directory</p>
              <div className="relative mb-2.5">
                <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={directoryQuery} onChange={(e) => setDirectoryQuery(e.target.value)} placeholder="Search contacts…" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-[#151936]/30 focus:ring-2 focus:ring-[#151936]/10 transition-all" />
              </div>
              <div className="flex flex-col gap-0.5 max-h-[420px] overflow-y-auto custom-scrollbar">
                {directory.length > 0 ? directory.map((c) => (
                  <button key={c.id} onClick={() => setSpotlightId(c.id)} className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors", c.id === spotlightId ? "bg-[#f4f6f0]" : "hover:bg-slate-50")}>
                    <Avatar src={c.avatarUrl ?? undefined} fallback={initialsOf(c.displayName)} className="size-7 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-900 truncate">{c.displayName}</span>
                      <span className="block text-[10.5px] text-slate-400 truncate">{TYPE_META[c.type].label} · {c.status}</span>
                    </span>
                    <span className={cn("size-2 rounded-full shrink-0", STATUS_META[c.status].dot)} />
                  </button>
                )) : (
                  <p className="text-xs text-slate-400 text-center py-6">No contacts match your search.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ContactProfilePeek data={peekData} onClose={() => setPeekData(null)} onOpenSpotlight={() => openInSpotlight(peekData?.contactId ?? null)} />

      <ContactFormModal
        open={formOpen}
        entityId={entityId}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingContact}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDeleteContact}
        title="Delete Contact?"
        description="This permanently removes the contact record. Contacts with active leases, mandates, or pipeline deals cannot be deleted - reassign or close those first."
        confirmLabel="Delete Contact"
        tone="danger"
      />
    </PageTransition>
  );
}
