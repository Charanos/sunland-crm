"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconArrowUpRight,
  IconBan,
  IconBrandWhatsapp,
  IconBuildingCommunity,
  IconFileDescription,
  IconMail,
  IconMoodEmpty,
  IconPhone,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { Avatar, Badge, Button, Drawer, SkeletonBlock } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";
import { formatKES } from "@/lib/utils/format";
import { PRIORITY_META, STAGE_META, STAGE_ORDER, type PipelineLeadPriority, type PipelineStage } from "./lead-constants";

interface LeadDetail {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  clientAvatarUrl: string | null;
  budget: number;
  propertyId: string | null;
  propertyInterest: string;
  propertyLocation: string | null;
  propertyImageUrl: string | null;
  stage: PipelineStage;
  priority: PipelineLeadPriority;
  assignedAgent: string;
  nextActionAt: string | null;
  createdDate: string;
  lostReason: string | null;
  timeline: Array<{ id: string; date: string; type: "system" | "note"; summary: string; details?: string | null }>;
  documents: Array<{ id: string; name: string; type: string; url: string; fileSizeBytes: number | null; createdAt: string | null }>;
  propertyPerformance: { mandateId: string; occupancyPct: number; rentRollKes: number; balanceKes: number; yieldPct: number | null } | null;
}

type Tab = "activity" | "notes" | "files";

const DOC_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "offer_letter", label: "Sale/Offer Agreement" },
  { value: "identification", label: "Client ID" },
  { value: "statement", label: "Other" },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

function activityTone(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes("delet") || lower.includes("lost")) return "bg-rose-300 ring-rose-50";
  if (lower.includes("won") || lower.includes("closed")) return "bg-emerald-300 ring-emerald-50";
  if (lower.includes("mov") || lower.includes("updat") || lower.includes("assign")) return "bg-indigo-300 ring-indigo-50";
  return "bg-slate-200 ring-white";
}

export function LeadDetailDrawer({
  leadId,
  entityId,
  onClose,
  onChanged,
}: {
  leadId: string | null;
  entityId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { pushToast } = useToast();
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("activity");
  const [activityQuery, setActivityQuery] = useState("");

  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [markLostOpen, setMarkLostOpen] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState(DOC_TYPE_OPTIONS[0].value);
  const [docUrl, setDocUrl] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);

  const load = () => {
    if (!leadId) return;
    setLoading(true);
    fetch(`/api/leads/${leadId}?entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d.lead ?? null))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setTab("activity");
    setActivityQuery("");
    setMarkLostOpen(false);
    setLostReasonInput("");
    if (leadId) load();
    else setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const nextStage = useMemo(() => {
    if (!detail) return null;
    const idx = STAGE_ORDER.indexOf(detail.stage);
    return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
  }, [detail]);

  const transition = async (stage: PipelineStage, lostReason?: string) => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/leads/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", entityId, stage, lostReason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to update the deal");
      pushToast({ tone: "success", title: `Moved to ${STAGE_META[stage].label}`, body: `${detail.clientName}'s opportunity updated.` });
      load();
      onChanged();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handleAdvance = async () => {
    if (!nextStage) return;
    setAdvancing(true);
    await transition(nextStage);
    setAdvancing(false);
  };

  const handleMarkLost = async () => {
    if (!lostReasonInput.trim()) {
      pushToast({ tone: "warning", title: "Reason required", body: "Add a short reason before marking this deal lost." });
      return;
    }
    await transition("closed_lost", lostReasonInput.trim());
    setMarkLostOpen(false);
    setLostReasonInput("");
  };

  const handleAddNote = async () => {
    if (!detail || !noteInput.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/leads/${detail.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, text: noteInput.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to add note");
      setNoteInput("");
      load();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddDocument = async () => {
    if (!detail || !docTitle.trim() || !docUrl.trim()) return;
    setSavingDoc(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, type: docType, title: docTitle.trim(), fileUrl: docUrl.trim(), leadId: detail.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to attach document");
      pushToast({ tone: "success", title: "File attached", body: `Saved against ${detail.clientName}'s deal.` });
      setDocTitle("");
      setDocUrl("");
      load();
      onChanged();
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Try again." });
    } finally {
      setSavingDoc(false);
    }
  };

  const filteredTimeline = useMemo(() => {
    if (!detail) return [];
    const q = activityQuery.trim().toLowerCase();
    if (!q) return detail.timeline;
    return detail.timeline.filter((e) => e.summary.toLowerCase().includes(q) || e.details?.toLowerCase().includes(q));
  }, [detail, activityQuery]);

  return (
    <Drawer open={!!leadId} onClose={onClose} title={detail?.clientName ?? "Deal"} width="30rem">
      {loading || !detail ? (
        <div className="flex flex-col gap-4">
          <SkeletonBlock className="h-36 w-[calc(100%+2.5rem)] rounded-none -mt-5 -mx-5" />
          <div className="px-5 flex flex-col gap-4">
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 -mt-5 -mx-5">
          {/* Hero */}
          <div className="relative h-36 overflow-hidden shrink-0">
            {detail.propertyImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.propertyImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#122a20] to-[#1e1b4b]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0d1c]/35 to-[#0a0d1c]/85" />
            <div className="relative h-full flex flex-col justify-end p-5">
              <div className="flex items-center gap-1.5 mb-auto">
                <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase", PRIORITY_META[detail.priority].pill)}>{PRIORITY_META[detail.priority].label}</span>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium bg-white/[0.18] text-white">{STAGE_META[detail.stage].label}</span>
              </div>
              <p className="font-mono text-[11px] text-white/70">{detail.id.slice(0, 8).toUpperCase()}</p>
              <p className="font-serif text-xl text-white mt-0.5 leading-tight truncate">{detail.propertyInterest}</p>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-5">
            {/* Client + quick actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar src={detail.clientAvatarUrl ?? undefined} fallback={detail.clientName.slice(0, 2).toUpperCase()} className="size-10" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{detail.clientName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{detail.propertyLocation ?? "—"}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {detail.phone && (
                <a href={`https://wa.me/${detail.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <IconBrandWhatsapp size={14} className="text-emerald-600" /> WhatsApp
                </a>
              )}
              {detail.phone && (
                <a href={`tel:${detail.phone}`} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <IconPhone size={14} /> Call
                </a>
              )}
              {detail.email && (
                <a href={`mailto:${detail.email}`} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <IconMail size={14} /> Email
                </a>
              )}
            </div>

            {/* Property Performance - only for leads on an already-managed property */}
            {detail.propertyPerformance && (
              <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-medium text-slate-800">Property Performance — under Sunland management</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-slate-100 rounded-lg px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Occupancy</p>
                    <p className="font-mono text-[13px] text-slate-900">{detail.propertyPerformance.occupancyPct}%</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-lg px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Rent roll</p>
                    <p className="font-mono text-[13px] text-slate-900">{formatKES(detail.propertyPerformance.rentRollKes)}/mo</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-lg px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Balance</p>
                    <p className={cn("font-mono text-[13px]", detail.propertyPerformance.balanceKes === 0 ? "text-emerald-700" : "text-slate-900")}>{detail.propertyPerformance.balanceKes === 0 ? "Cleared" : formatKES(detail.propertyPerformance.balanceKes)}</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-lg px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Yield basis</p>
                    <p className="font-mono text-[13px] text-[#122a20]">{detail.propertyPerformance.yieldPct != null ? `${detail.propertyPerformance.yieldPct}% est.` : "—"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Fact cells */}
            <div className="flex flex-col gap-1.5">
              {[
                { label: "Broker", value: detail.assignedAgent },
                { label: "Value", value: formatKES(detail.budget) },
                { label: "Next action", value: detail.nextActionAt ? new Date(detail.nextActionAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—" },
                { label: "Opened", value: detail.createdDate },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="font-medium text-slate-800">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Linked Records */}
            <div>
              <p className="text-xs font-medium text-slate-800 mb-2">Linked Records</p>
              <div className="flex flex-col gap-1.5">
                {detail.propertyId && (
                  <Link href={`/admin/properties/${detail.propertyId}`} className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2 hover:bg-slate-100/70 transition-colors">
                    <span className="size-7.5 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#151936] shrink-0"><IconBuildingCommunity size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-900 truncate">Property file</span>
                      <span className="block text-[10.5px] text-slate-400 truncate">{detail.propertyInterest}</span>
                    </span>
                    <IconArrowUpRight size={13} className="text-slate-300 shrink-0" />
                  </Link>
                )}
                {detail.propertyPerformance && (
                  <Link href="/admin/leases?mode=mandates" className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2 hover:bg-slate-100/70 transition-colors">
                    <span className="size-7.5 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#151936] shrink-0"><IconFileDescription size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-900 truncate">Mandate & remittance</span>
                      <span className="block text-[10.5px] text-slate-400 truncate">Real-managed portfolio property</span>
                    </span>
                    <IconArrowUpRight size={13} className="text-slate-300 shrink-0" />
                  </Link>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {([{ key: "activity", label: "Activity" }, { key: "notes", label: `Notes${detail.timeline.filter((e) => e.type === "note").length ? ` ${detail.timeline.filter((e) => e.type === "note").length}` : ""}` }, { key: "files", label: `Files${detail.documents.length ? ` ${detail.documents.length}` : ""}` }] as const).map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors", tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "activity" && (
              <div className="flex flex-col gap-3">
                {detail.timeline.length > 0 && (
                  <div className="relative">
                    <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={activityQuery} onChange={(e) => setActivityQuery(e.target.value)} placeholder="Search activity…" className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#151936]/10" />
                  </div>
                )}
                {filteredTimeline.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center gap-2">
                    <IconMoodEmpty size={22} className="text-slate-300" />
                    <p className="text-xs text-slate-400">No activity recorded yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 relative ml-0.5">
                    <div className="absolute left-[3px] top-1.5 bottom-4 w-px bg-slate-100 z-0" />
                    {filteredTimeline.map((entry) => (
                      <div key={entry.id} className="relative flex items-start gap-3 z-10">
                        <span className={cn("size-[7px] rounded-full mt-1.5 shrink-0 ring-4", activityTone(entry.summary))} />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2 bg-slate-50/50 rounded-lg px-2.5 py-1.5">
                          <p className="text-xs text-slate-600 leading-snug min-w-0">{entry.summary}{entry.type === "note" && entry.details ? <span className="block text-slate-400 mt-0.5">{entry.details}</span> : null}</p>
                          <Badge tone="neutral" className="shrink-0 whitespace-nowrap">{relativeTime(entry.date)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "notes" && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Add a note or interaction update…" className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#151936]/40" onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }} />
                  <Button size="sm" onClick={handleAddNote} disabled={savingNote || !noteInput.trim()}>{savingNote ? "Saving…" : "Log"}</Button>
                </div>
                {detail.timeline.filter((e) => e.type === "note").length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No notes yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.timeline.filter((e) => e.type === "note").map((n) => (
                      <div key={n.id} className="bg-slate-50/70 border border-slate-100 rounded-xl p-3">
                        <p className="text-xs text-slate-700">{n.details}</p>
                        <p className="text-[10.5px] text-slate-400 mt-1">{n.summary} · {relativeTime(n.date)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "files" && (
              <div className="flex flex-col gap-3">
                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex flex-col gap-2">
                  <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document title" className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#151936]/40" />
                  <div className="flex gap-2">
                    <select value={docType} onChange={(e) => setDocType(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                      {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="File URL" className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#151936]/40" />
                  </div>
                  <Button size="sm" onClick={handleAddDocument} disabled={savingDoc || !docTitle.trim() || !docUrl.trim()} className="self-end">
                    <IconPlus size={13} /> {savingDoc ? "Attaching…" : "Attach"}
                  </Button>
                </div>
                {detail.documents.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No files attached yet.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {detail.documents.map((d) => (
                      <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2 hover:bg-slate-100/70 transition-colors">
                        <IconFileDescription size={16} className="text-slate-400 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-slate-900 truncate">{d.name}</span>
                          <span className="block text-[10.5px] text-slate-400">{d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : ""}</span>
                        </span>
                        <IconArrowUpRight size={13} className="text-slate-300 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {markLostOpen && (
              <div className="bg-rose-50/60 border border-rose-200/70 rounded-2xl p-3.5 flex flex-col gap-2.5">
                <p className="text-xs font-medium text-slate-900">Why is this deal lost?</p>
                <textarea value={lostReasonInput} onChange={(e) => setLostReasonInput(e.target.value)} rows={2} placeholder="e.g. Client chose a competing listing" className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-rose-300" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setMarkLostOpen(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white rounded-lg">Cancel</button>
                  <button onClick={handleMarkLost} className="px-3 py-1.5 text-xs font-medium bg-rose-600 text-white hover:bg-rose-500 rounded-lg">Confirm Lost</button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3.5 flex gap-2">
            <Button className="flex-1" onClick={handleAdvance} disabled={!nextStage || advancing}>
              {advancing ? "Saving…" : nextStage ? `Advance to ${STAGE_META[nextStage].label}` : "Deal closed"}
            </Button>
            {detail.stage !== "closed_won" && detail.stage !== "closed_lost" && (
              <Button variant="secondary" className="text-rose-600 hover:bg-rose-50 hover:border-rose-200" onClick={() => setMarkLostOpen((v) => !v)}>
                <IconBan size={14} /> Mark Lost
              </Button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
