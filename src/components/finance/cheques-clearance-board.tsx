"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  IconSearch,
  IconCoins,
  IconCheck,
  IconBuildingBank,
  IconAlertTriangle,
  IconShieldCheck,
  IconBan,
  IconTransfer,
  IconScale,
  IconClock,
  IconPlus,
  IconCamera,
  IconUpload,
  IconQrcode,
  IconX,
  IconArrowRight,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { FinanceModuleNav } from "@/components/finance/finance-module-nav";
import { FinanceQrProof } from "@/components/finance/finance-qr-proof";
import { BoardHeader, BoardPanel, Button, PaginationControls } from "@/components/ui/erp-primitives";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { getEntityById } from "@/data/entities";
import { useUIStore } from "@/store/ui";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ChequeRecord {
  id: string;
  chequeNumber: string;
  payerName: string;
  bankName: string;
  amount: number;
  depositedDate: string;
  status: "Pending" | "Credited" | "Returned";
  description: string;
  source: "Front Office" | "Finance" | "Rentals";
  holder: string;
  auditLog: string[];
  reconciliationDate?: string;
  ledgerJournal?: string;
  returnReason?: "Insufficient Funds" | "Signature Mismatch" | "Post-Dated" | "Refer to Drawer" | "Other";
  followUpAction?: "Re-presented" | "Voided" | "Tenant Notified";
  approvalStatus?: "Pending Approval";
  approvalRef?: string;
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_CHEQUES: ChequeRecord[] = [
  {
    id: "c1",
    chequeNumber: "CHQ-0098",
    payerName: "Global Trade Inc",
    bankName: "NCBA Bank Kenya",
    amount: 640000,
    depositedDate: "2026-06-18",
    status: "Pending",
    description: "Office rent settlement for Riverside Annex - Suite 3B",
    source: "Front Office",
    holder: "Finance Head + GM",
    auditLog: ["Cheque deposited by Front Office", "Bank confirmation pending", "Above threshold review required"]
  },
  {
    id: "c2",
    chequeNumber: "CHQ-0097",
    payerName: "Nairobi Retailers Ltd",
    bankName: "Equity Bank Kenya",
    amount: 120000,
    depositedDate: "2026-06-17",
    status: "Credited",
    description: "Commercial space lease service charges - Kilimani Shop 12",
    source: "Finance",
    holder: "Finance Officer",
    auditLog: ["Cheque deposited", "Bank credit confirmed", "Journal JE-1038 posted"],
    reconciliationDate: "2026-06-19",
    ledgerJournal: "JE-1038"
  },
  {
    id: "c3",
    chequeNumber: "CHQ-0096",
    payerName: "Quick Logistics Ltd",
    bankName: "KCB Bank Kenya",
    amount: 45000,
    depositedDate: "2026-06-15",
    status: "Returned",
    description: "Late rent fine payment - Kilimani Office 5",
    source: "Rentals",
    holder: "Rentals Officer",
    auditLog: ["Cheque deposited", "Bank returned cheque", "Tenant follow-up task opened"],
    reconciliationDate: "2026-06-16",
    returnReason: "Signature Mismatch",
    followUpAction: "Tenant Notified"
  },
  {
    id: "c4",
    chequeNumber: "CHQ-0095",
    payerName: "Acme Corp Ltd",
    bankName: "Stanchart Kenya",
    amount: 450000,
    depositedDate: "2026-06-12",
    status: "Credited",
    description: "Annual mandate consultation settlement",
    source: "Finance",
    holder: "Finance Officer",
    auditLog: ["Cheque deposited", "Bank credit confirmed", "Journal JE-1033 posted"],
    reconciliationDate: "2026-06-14",
    ledgerJournal: "JE-1033"
  },
  {
    id: "c5",
    chequeNumber: "CHQ-0094",
    payerName: "Hurlingham Court Management",
    bankName: "Co-operative Bank",
    amount: 320000,
    depositedDate: "2026-06-20",
    status: "Pending",
    description: "Property repair contribution split",
    source: "Front Office",
    holder: "Bank Clearing Desk",
    auditLog: ["Cheque deposited", "Deposit slip matched", "Awaiting bank credit stamp"]
  },
  {
    id: "c6",
    chequeNumber: "CHQ-0090",
    payerName: "Mary Wanjiku",
    bankName: "Family Bank Ltd",
    amount: 125000,
    depositedDate: "2026-06-08",
    status: "Credited",
    description: "Residential rent settlement - Apt 4B Westpoint",
    source: "Rentals",
    holder: "Finance Officer",
    auditLog: ["Cheque deposited", "Bank credit confirmed", "Journal JE-1025 posted"],
    reconciliationDate: "2026-06-10",
    ledgerJournal: "JE-1025"
  }
];

const INITIAL_CHART_DATA = [
  { month: "Jan", Cleared: 1500000, Returned: 0 },
  { month: "Feb", Cleared: 1850000, Returned: 45000 },
  { month: "Mar", Cleared: 2200000, Returned: 125000 },
  { month: "Apr", Cleared: 1950000, Returned: 0 },
  { month: "May", Cleared: 2400000, Returned: 68000 },
  { month: "Jun", Cleared: 695000, Returned: 45000 }
];

const ROWS_PER_PAGE = 5;
const CHEQUE_APPROVAL_THRESHOLD = 500000;
const WORK_DATE = new Date("2026-06-22T00:00:00");
const formatMoney = (value: number) => formatCompactKES(value);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
const clearingAge = (value: string) =>
  Math.max(0, Math.ceil((WORK_DATE.getTime() - new Date(`${value}T00:00:00`).getTime()) / 86_400_000));

export function ChequesClearanceBoard({ tabId = "deposited" }: { tabId: string }) {
  const { pushToast } = useToast();
  const activeEntityId = useUIStore((state) => state.activeEntityId);
  const activeEntity = getEntityById(activeEntityId);
  const [mounted, setMounted] = useState(false);

  // Sync tab active segment
  const activeTab = tabId;

  // Search & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Data states
  const [cheques, setCheques] = useState<ChequeRecord[]>(INITIAL_CHEQUES);
  const [chartData, setChartData] = useState(INITIAL_CHART_DATA);

  // Modals & drawers state
  const [selectedCheque, setSelectedCheque] = useState<ChequeRecord | null>(null);
  const [clearCheque, setClearCheque] = useState<ChequeRecord | null>(null);
  const [returnCheque, setReturnCheque] = useState<ChequeRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - Clear Cheque
  const [clearJournalDesc, setClearJournalDesc] = useState("");

  // Form State - Return Cheque
  const [retReason, setRetReason] = useState<NonNullable<ChequeRecord["returnReason"]>>("Insufficient Funds");
  const [retAction, setRetAction] = useState<NonNullable<ChequeRecord["followUpAction"]>>("Tenant Notified");

  // ── Log New Cheque modal state ──────────────────────────────────────────────
  const [logOpen, setLogOpen] = useState(false);
  const [logStep, setLogStep] = useState<"form" | "photo" | "qr">("form");
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logPhotoUrl, setLogPhotoUrl] = useState<string | null>(null);
  const [logGenerated, setLogGenerated] = useState<ChequeRecord | null>(null);
  const [logQrToken, setLogQrToken] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [usingCamera, setUsingCamera] = useState(false);
  const [logForm, setLogForm] = useState({
    chequeNumber: "",
    payerName: "",
    bankName: "",
    amount: "",
    description: "",
    source: "Front Office" as ChequeRecord["source"],
    depositedDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const openClearModalFor = (c: ChequeRecord) => {
    setClearCheque(c);
    setClearJournalDesc(`Confirm credit posting for ${c.chequeNumber} from ${c.payerName}`);
  };

  const openReturnModalFor = (c: ChequeRecord) => {
    setReturnCheque(c);
  };

  // ── Log New Cheque handlers ─────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setUsingCamera(false);
  }, [cameraStream]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      setUsingCamera(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; }
    } catch {
      pushToast({ tone: "warning", title: "Camera unavailable", body: "Could not access camera. Please upload a photo instead." });
    }
  }, [pushToast]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setLogPhotoUrl(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.chequeNumber || !logForm.payerName || !logForm.bankName || !logForm.amount) return;
    setLogStep("photo");
  };

  const handleLogFinalize = async () => {
    setLogSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    // Generate a stable token at event-time (not during render)
    const stableToken = `CHQ-${Date.now()}`;
    const newRecord: ChequeRecord = {
      id: `c${Date.now()}`,
      chequeNumber: logForm.chequeNumber,
      payerName: logForm.payerName,
      bankName: logForm.bankName,
      amount: parseFloat(logForm.amount.replace(/,/g, "")),
      depositedDate: logForm.depositedDate,
      status: "Pending",
      description: logForm.description || `Cheque received from ${logForm.payerName}`,
      source: logForm.source,
      holder: "Finance Officer",
      auditLog: ["Logged via Sunland ERP Cheque Board", logPhotoUrl ? "Cheque photo captured and attached" : "No photo attached"],
    };
    setCheques(prev => [newRecord, ...prev]);
    setLogGenerated(newRecord);
    setLogQrToken(stableToken); // store for render-time use
    setLogStep("qr");
    setLogSubmitting(false);
    pushToast({ tone: "success", title: "Cheque Logged", body: `${newRecord.chequeNumber} added to the deposited queue.` });
  };

  const resetLogModal = () => {
    stopCamera();
    setLogOpen(false);
    setLogStep("form");
    setLogPhotoUrl(null);
    setLogGenerated(null);
    setLogQrToken("");
    setLogForm({ chequeNumber: "", payerName: "", bankName: "", amount: "", description: "", source: "Front Office", depositedDate: new Date().toISOString().split("T")[0] });
  };

  // --- Handlers ---

  const handleClearChequeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearCheque) return;
    setIsSubmitting(true);
    // Simulate double-entry clearing validation
    await new Promise(resolve => setTimeout(resolve, 800));

    const todayStr = new Date().toISOString().split("T")[0];
    const mockJournal = "JE-" + Math.floor(1040 + Math.random() * 50);
    const needsApproval = clearCheque.amount > CHEQUE_APPROVAL_THRESHOLD;

    if (needsApproval) {
      const approvalRef = "APR-CHQ-" + clearCheque.chequeNumber.replace("CHQ-", "");

      setCheques(prev =>
        prev.map(c => {
          if (c.id === clearCheque.id) {
            return {
              ...c,
              approvalStatus: "Pending Approval",
              approvalRef,
              holder: "GM / Finance Head",
              auditLog: [`${approvalRef} routed for dual sign-off`, ...c.auditLog]
            };
          }
          return c;
        })
      );

      setClearCheque(null);
      setIsSubmitting(false);

      pushToast({
        tone: "warning",
        title: "Approval Hold Created",
        body: `Cheque ${clearCheque.chequeNumber} exceeds ${formatMoney(CHEQUE_APPROVAL_THRESHOLD)}. ${approvalRef} routed for GM/CEO approval with no ledger posting yet.`
      });
      return;
    }

    setCheques(prev =>
      prev.map(c => {
        if (c.id === clearCheque.id) {
          return {
            ...c,
            status: "Credited",
            reconciliationDate: todayStr,
            ledgerJournal: mockJournal,
            approvalStatus: undefined,
            approvalRef: undefined,
            holder: "Finance Officer",
            auditLog: [`Bank credit posted through ${mockJournal}`, ...c.auditLog]
          };
        }
        return c;
      })
    );

    // Update June chart cleared volumes reactively
    setChartData(prev =>
      prev.map(c => (c.month === "Jun" ? { ...c, Cleared: c.Cleared + clearCheque.amount } : c))
    );

    setClearCheque(null);
    setIsSubmitting(false);

    pushToast({
      tone: "success",
      title: "Cheque Cleared & Posted",
      body: `Cheque ${clearCheque.chequeNumber} cleared. DR Cash Operating / CR Receivables of ${formatMoney(clearCheque.amount)}. Journal entry logged as ${mockJournal}.`
    });
  };

  const handleReturnChequeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnCheque) return;
    setIsSubmitting(true);
    // Simulate check return workflow
    await new Promise(resolve => setTimeout(resolve, 600));

    const todayStr = new Date().toISOString().split("T")[0];

    setCheques(prev =>
      prev.map(c => {
        if (c.id === returnCheque.id) {
          return {
            ...c,
            status: "Returned",
            reconciliationDate: todayStr,
            returnReason: retReason,
            followUpAction: retAction,
            holder: retAction,
            auditLog: [`Returned by bank: ${retReason}. Follow-up: ${retAction}`, ...c.auditLog]
          };
        }
        return c;
      })
    );

    // Update June chart returned volumes reactively
    setChartData(prev =>
      prev.map(c => (c.month === "Jun" ? { ...c, Returned: c.Returned + returnCheque.amount } : c))
    );

    setReturnCheque(null);
    setIsSubmitting(false);

    pushToast({
      tone: "error",
      title: "Cheque Dishonored / Returned",
      body: `Cheque ${returnCheque.chequeNumber} flagged as Returned. Reason: ${retReason}. Follow up workflow: ${retAction}.`
    });
  };

  // --- Calculations ---

  const metrics = useMemo(() => {
    const depositedCount = cheques.filter(c => c.status === "Pending").length;
    const depositedValue = cheques.filter(c => c.status === "Pending").reduce((sum, c) => sum + c.amount, 0);

    const clearedValue = cheques.filter(c => c.status === "Credited").reduce((sum, c) => sum + c.amount, 0);
    const returnedCount = cheques.filter(c => c.status === "Returned").length;
    const approvalHeld = cheques.filter(c => c.approvalStatus === "Pending Approval").length;
    const staleClearing = cheques.filter(c => c.status === "Pending" && clearingAge(c.depositedDate) > 5).length;
    const returnValue = cheques.filter(c => c.status === "Returned").reduce((sum, c) => sum + c.amount, 0);

    return {
      depositedCount,
      depositedValue,
      clearedValue,
      returnedCount,
      approvalHeld,
      staleClearing,
      returnValue
    };
  }, [cheques]);

  const clearanceQueue = useMemo(() => {
    return cheques
      .filter(c => c.status === "Pending" || c.status === "Returned")
      .sort((a, b) => {
        const aScore = (a.approvalStatus ? 100 : 0) + clearingAge(a.depositedDate) + (a.status === "Returned" ? 50 : 0);
        const bScore = (b.approvalStatus ? 100 : 0) + clearingAge(b.depositedDate) + (b.status === "Returned" ? 50 : 0);
        return bScore - aScore;
      })
      .slice(0, 5);
  }, [cheques]);

  // Filters and search logic
  const filteredRows = useMemo(() => {
    const targetStatus = activeTab === "deposited" ? "Pending" : activeTab === "credited" ? "Credited" : "Returned";
    return cheques.filter(c =>
      c.status === targetStatus && (
        c.chequeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [cheques, activeTab, searchQuery]);

  const paginatedRows = useMemo(() => {
    return filteredRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  if (!mounted) return <div className="h-screen w-full skeleton-shimmer bg-slate-50" />;

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-4 animate-fade-in pb-12">
      <BoardHeader
        title="Banker's Cheques Clearance Board"
        description="Verify deposited checks in clearing, confirm bank credits to post double-entries, and track returned checks."
        actions={
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--sidebar)] px-4 py-2 text-caption text-white shadow-sm hover:opacity-90 transition-all"
          >
            <IconPlus size={14} />
            Log New Cheque
          </button>
        }
      />

      <FinanceModuleNav />

      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 animate-fade-in-up">
        <div className="relative min-h-[255px] overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 text-white shadow-2xl">
          {/* Subtle Institutional Grid Background Pattern */}
          <div
            className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h30v30H0V0zm1 1h28v28H1V1z' fill='%23ffffff' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              backgroundSize: "30px 30px"
            }}
          />

          {/* Premium Unsplash Background with low opacity */}
          <div
            className="absolute inset-0 opacity-[0.06] mix-blend-luminosity"
            style={{
              backgroundImage: `url(https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2564&auto=format&fit=crop)`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />

          {/* Subtle Glowing Accents */}
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-slate-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative z-10 flex h-full flex justify-between gap-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
              {/* Left Column: Context & Title */}
              <div className="max-w-xl space-y-5">
                <div className="flex items-center gap-3">
                  <Badge tone="primary" className="bg-slate-700/60 text-slate-200 border-slate-600/50 px-3 py-1 shadow-sm backdrop-blur-md">
                    {activeEntity.name}
                  </Badge>
                  <span className="label-caps tracking-wider text-meta-muted">Treasury Control Console</span>
                </div>
                <div>
                  <h2 className="title-serif font-normal leading-tight tracking-tight text-white mb-3">
                    Cheque Clearance
                  </h2>
                  <p className="leading-relaxed text-slate-300 font-normal max-w-lg body-md">
                    Track deposited cheques, verify bank credit status, and route transaction amounts exceeding the policy limit to the CEO/GM approval chain before posting ledger records.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-4">
                  <div className="flex -space-x-2.5">
                    <div className="size-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center font-medium text-white shadow-md transition-all duration-300 hover:scale-125 hover:z-10 hover:translate-y-[-2px] cursor-pointer text-sm" title="Clearing Agent: John Doe">JD</div>
                    <div className="size-8 rounded-full border-2 border-slate-900 bg-slate-600 flex items-center justify-center font-medium text-white shadow-md transition-all duration-300 hover:scale-125 hover:z-10 hover:translate-y-[-2px] cursor-pointer text-sm" title="Clearing Agent: Alice M.">AM</div>
                    <div className="flex size-8 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800/80 font-medium text-slate-300 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-125 hover:z-10 hover:translate-y-[-2px] cursor-pointer text-sm">
                      +2
                    </div>
                  </div>
                  <span className="font-normal text-slate-400 body-sm">Clearing Agents</span>
                </div>
              </div>

              {/* Right Column: Sleek HUD Panel */}
              <div className="w-full lg:max-w-xs shrink-0 self-stretch flex flex-col justify-center">
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/15 group">
                  {/* Subtle Grid overlay */}
                  <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center" />

                  <div className="relative z-10 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 label-caps">Clearance Policy Threshold</span>
                      <IconScale size={16} stroke={1.8} className="text-amber-400" />
                    </div>

                    {/* Value Area */}
                    <div className="flex flex-col gap-0.5">
                      <div className="text-3xl font-medium tracking-tight font-sans text-amber-400">
                        {formatCompactKES(CHEQUE_APPROVAL_THRESHOLD)}
                      </div>
                      <span className="text-sm text-slate-400 font-medium tracking-wide">
                        Auto-credit clearance threshold limit
                      </span>
                    </div>

                    {/* Proportional Limit Meter */}
                    {(() => {
                      const clearingVal = metrics.depositedValue;
                      const thresholdPct = Math.min(100, Math.round((clearingVal / CHEQUE_APPROVAL_THRESHOLD) * 100));
                      return (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-slate-400 label-caps">
                            <span>Clearing: {formatCompactKES(clearingVal)}</span>
                            <span>Limit: {thresholdPct}%</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-slate-900/80 overflow-hidden flex border border-white/[0.02]">
                            <div
                              style={{ width: `${thresholdPct}%` }}
                              className={cn("h-full transition-all duration-500", clearingVal > CHEQUE_APPROVAL_THRESHOLD ? "bg-rose-500/80 animate-pulse" : "bg-amber-500/70")}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Divider */}
                    <div className="h-px bg-white/5 my-1" />

                    {/* Divider-divided bottom strip */}
                    <div className="grid grid-cols-3 divide-x divide-white/5 border border-white/5 rounded-lg bg-slate-950/20 text-center overflow-hidden">
                      <div className="py-2 px-1">
                        <div className="text-slate-400 label-caps">Approval</div>
                        <div className="mt-0.5 text-slate-200 font-mono text-sm font-normal">{metrics.approvalHeld}</div>
                      </div>
                      <div className="py-2 px-1">
                        <div className="text-slate-400 label-caps">Stale</div>
                        <div className="mt-0.5 text-slate-200 font-mono text-sm font-normal">{metrics.staleClearing}</div>
                      </div>
                      <div className="py-2 px-1">
                        <div className="text-slate-400 label-caps">Returned</div>
                        <div className="mt-0.5 text-slate-200 font-mono text-sm font-normal">{metrics.returnedCount}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <BoardPanel className="p-0 overflow-hidden flex flex-col h-full relative group shadow-lg border-slate-200">
          <div className="border-b border-slate-100/80 p-6 bg-white z-10 relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-slate-900 tracking-tight font-sans text-xl">Clearance Queue</h3>
                <p className="mt-1 text-desc-secondary">Highest-risk deposited and returned instruments.</p>
              </div>
              <Badge tone={clearanceQueue.length > 0 ? "warning" : "success"} className="shadow-sm px-3 py-1.5">{clearanceQueue.length} Active</Badge>
            </div>
          </div>
          <div className="divide-y divide-slate-100/80 flex-1 overflow-y-auto bg-slate-50/30">
            {clearanceQueue.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedCheque(item)}
                className="flex w-full items-center gap-4 p-5 text-left transition-all duration-300 hover:bg-white hover:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] hover:-translate-y-[1px] relative group/item"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                <div className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover/item:scale-110 shadow-sm",
                  item.status === "Returned" ? "bg-rose-50 text-rose-600 group-hover/item:bg-rose-100" : item.approvalStatus ? "bg-amber-50 text-amber-600 group-hover/item:bg-amber-100" : "bg-slate-100/80 text-slate-400 group-hover/item:bg-indigo-50 group-hover/item:text-indigo-600"
                )}>
                  {item.status === "Returned" ? <IconAlertTriangle size={20} stroke={2} /> : <IconBuildingBank size={20} stroke={2} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-slate-900 mono-amount">{item.chequeNumber}</span>
                    <Badge tone={item.status === "Returned" ? "risk" : item.approvalStatus ? "warning" : "data"} className="h-5 px-2 shadow-sm label-caps">
                      {item.status === "Returned" ? item.returnReason : item.approvalStatus ?? `${clearingAge(item.depositedDate)} days`}
                    </Badge>
                  </div>
                  <p className="truncate font-medium text-slate-800 leading-snug body-md">{item.payerName}</p>
                  <p className="mt-0.5 truncate text-desc-secondary">{item.source} - {item.holder}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="tracking-tight text-slate-900 group-hover/item:text-indigo-700 transition-colors mono-stat">
                    {formatMoney(item.amount)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </BoardPanel>
      </section>

      {/* ── 1. KPI Cards Row ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        {/* KPI 1: Awaiting Clearance */}
        <BoardPanel className="p-5 flex flex-col justify-between min-h-[142px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-amber-250 bg-gradient-to-b from-white to-amber-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconBuildingBank size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-200/50">
              <IconBuildingBank size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps text-xs">Awaiting Clearance</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-[#151936] text-3xl">
              {formatMoney(metrics.depositedValue)}
            </span>
            <span className="mt-1 text-desc-secondary">Instruments in bank transit</span>
          </div>
        </BoardPanel>

        {/* KPI 2: Cleared & Posted */}
        <BoardPanel className="p-5 flex flex-col justify-between min-h-[142px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-250 bg-gradient-to-b from-white to-emerald-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconCheck size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50">
              <IconCheck size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps text-xs">Cleared & Posted</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-[#151936] text-3xl">
              {formatMoney(metrics.clearedValue)}
            </span>
            <span className="mt-1 text-desc-secondary">Settled ledger postings</span>
          </div>
        </BoardPanel>

        {/* KPI 3: Returned Cheques */}
        <BoardPanel className="p-5 flex flex-col justify-between min-h-[142px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-rose-250 bg-gradient-to-b from-white to-rose-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconAlertTriangle size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 text-rose-600 flex items-center justify-center shadow-sm border border-rose-200/50">
              <IconAlertTriangle size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps text-xs">Returned Cheques</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-rose-700 text-3xl">
              {metrics.returnedCount} <span className="text-rose-700/65 text-lg">Cheques</span>
            </span>
            <span className="mt-1 text-desc-secondary">Dishonored & returned items</span>
          </div>
        </BoardPanel>

        {/* KPI 4: Average Clear Time */}
        <BoardPanel className="p-5 flex flex-col justify-between min-h-[142px] relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-indigo-250 bg-gradient-to-b from-white to-indigo-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
            <IconClock size={100} stroke={1} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-200/50">
              <IconClock size={16} stroke={2.5} />
            </div>
            <span className="text-slate-400 label-caps text-xs">Average Clear Time</span>
          </div>
          <div className="flex flex-col mt-auto relative z-10">
            <span className="font-mono font-normal tracking-tight text-[#151936] text-3xl">
              3.5 <span className="text-slate-400 text-lg">Biz Days</span>
            </span>
            <span className="mt-1 text-desc-secondary">Performance target (3.0d)</span>
          </div>
        </BoardPanel>
      </section>

      {/* ── 2. Visualization Section ────────────────────────────────────────── */}
      <BoardPanel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="font-medium text-slate-900 tracking-tight body-md">Cheque Clearance Trends</h3>
            <p className="text-sm text-slate-400 mt-0.5">Cleared values vs. returned values trend analysis</p>
          </div>
          <div className="flex items-center gap-4 font-medium text-sm">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <span className="size-2 rounded-full bg-indigo-400" /> Cleared (KES)
            </span>
            <span className="flex items-center gap-1.5 text-rose-600">
              <span className="size-2 rounded-full bg-rose-500" /> Returned (KES)
            </span>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCleared" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReturned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ background: "#151936", border: "none", borderRadius: "12px", color: "#fff" }}
                formatter={(value: unknown) => [formatMoney(Number(value)), ""]}
              />
              <Area type="monotone" dataKey="Cleared" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCleared)" />
              <Area type="monotone" dataKey="Returned" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorReturned)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BoardPanel>

      <div className="pt-6 border-t border-slate-200/60 my-2 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal">Policy Gates & Ledger Impact</h2>
        <p className="text-desc-secondary mt-1">
          Deposited cheques have zero statement impact; only credited cheques post to the ledger, while returns open debtor follow-up.
        </p>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in-up">
        {[
          {
            title: "Deposited",
            body: "Bank confirmation pending. No journal entry exists while the cheque is in transit.",
            value: `${metrics.depositedCount} items`,
            icon: IconBuildingBank,
            tone: "border-amber-200/60 bg-gradient-to-b from-amber-50/80 to-white text-amber-700 hover:border-amber-300"
          },
          {
            title: "Credited",
            body: "Posts DR Cash / CR Receivables after threshold and approval checks pass.",
            value: formatMoney(metrics.clearedValue),
            icon: IconTransfer,
            tone: "border-emerald-200/60 bg-gradient-to-b from-emerald-50/80 to-white text-emerald-700 hover:border-emerald-300"
          },
          {
            title: "Returned",
            body: "Does not post cash. Creates debtor follow-up and records return reason.",
            value: `${metrics.returnedCount} items`,
            icon: IconBan,
            tone: "border-rose-200/60 bg-gradient-to-b from-rose-50/80 to-white text-rose-700 hover:border-rose-300"
          },
        ].map((item) => {
          const ItemIcon = item.icon;
          return (
            <BoardPanel key={item.title} className={cn("p-5 border transition-all duration-300 hover:-translate-y-1 hover:shadow-sm", item.tone)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label-caps">{item.title}</p>
                  <p className="mt-3 font-mono font-normal tracking-tight text-slate-900 text-2xl">{item.value}</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100/50">
                  <ItemIcon size={20} />
                </div>
              </div>
              <p className="mt-4 leading-relaxed text-desc-secondary">{item.body}</p>
            </BoardPanel>
          );
        })}
      </section>


      {/* ── 3. Segment Content Title & Queue ─────────────────────────────────── */}
      <div className="pt-2 my-2 animate-fade-in-up">
        <h2 className="title-serif text-slate-900 font-normal capitalize">
          {activeTab} Cheques Panel
        </h2>
        <p className="text-desc-secondary mt-1">
          {activeTab === "deposited" && "Review cheques currently sitting in bank clearance queues awaiting credit notifications."}
          {activeTab === "credited" && "Successfully posted banker's cheques marked as reconciled with general ledger impact logs."}
          {activeTab === "returned" && "List of bounced or returned checks. Log dishonor reason or represent for clearing."}
        </p>
      </div>

      <BoardPanel className="p-0 overflow-hidden shadow-sm border-slate-200 animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
          <div className="flex flex-1 max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition hover:bg-slate-100/50">
            <IconSearch size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search by cheque number, payer, bank..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full bg-transparent text-slate-700 placeholder-slate-400 focus:outline-none text-base"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-body-regular">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 bg-slate-50/50 label-caps">
                <th className="px-5 py-3">Cheque Number</th>
                <th className="px-5 py-3">Payer / Description</th>
                <th className="px-5 py-3">Clearing Bank</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Deposited Date</th>
                {activeTab === "credited" && <th className="px-5 py-3">Ledger Journal</th>}
                {activeTab === "returned" && <th className="px-5 py-3">Return Reason</th>}
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedCheque(c)}
                  className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                >
                  <td className="px-5 py-3.5 text-slate-900 mono-data">{c.chequeNumber}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-title-primary leading-snug">{c.payerName}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{c.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="data" className="h-5 text-sm ">{c.source}</Badge>
                      <Badge tone={c.approvalStatus ? "warning" : c.status === "Returned" ? "risk" : "neutral"} className="h-5 text-sm ">{c.holder}</Badge>
                    </div>
                    {c.approvalStatus ? (
                      <Badge tone="warning" className="mt-2 h-5 text-sm ">
                        {c.approvalRef} awaiting GM/CEO
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 text-base">
                    <span className="flex items-center gap-1"><IconBuildingBank size={12} /> {c.bankName}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-900 mono-data">
                    {formatMoney(c.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 text-base">
                    <span className="font-mono">{formatDate(c.depositedDate)}</span>
                    <p className="mt-1 text-sm text-slate-400">{clearingAge(c.depositedDate)} days in bank path</p>
                  </td>
                  {activeTab === "credited" && (
                    <td className="px-5 py-3.5">
                      <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mono-data">
                        {c.ledgerJournal || "Awaiting Post"}
                      </span>
                    </td>
                  )}
                  {activeTab === "returned" && (
                    <td className="px-5 py-3.5">
                      <span className="text-base text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-medium">
                        {c.returnReason}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {c.status === "Pending" ? (
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openClearModalFor(c)}
                          disabled={Boolean(c.approvalStatus)}
                          className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 py-1 px-2.5 h-7 text-sm "
                        >
                          {c.approvalStatus ? "Approval Routed" : "Confirm Credit"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openReturnModalFor(c)}
                          className="bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 py-1 px-2.5 h-7 text-sm "
                        >
                          Bounced
                        </Button>
                      </div>
                    ) : c.status === "Credited" ? (
                      <div className="flex justify-end pr-2 text-emerald-600">
                        <IconCheck size={16} stroke={2.5} />
                      </div>
                    ) : (
                      <div className="flex justify-end pr-2 text-rose-500 gap-1.5 items-center font-medium text-sm">
                        <IconAlertTriangle size={15} /> {c.followUpAction}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          label={`${filteredRows.length} of ${cheques.filter(c => c.status === (activeTab === "deposited" ? "Pending" : activeTab === "credited" ? "Credited" : "Returned")).length} records shown, ${ROWS_PER_PAGE} rows per page`}
        />
      </BoardPanel>

      {/* ── 4. Confirm Clear Modal ─────────────────────────────────────────── */}
      <Modal open={clearCheque !== null} onClose={() => setClearCheque(null)} title="Confirm Cheque Credit">
        {clearCheque && (
          <form onSubmit={handleClearChequeSubmit} className="space-y-5 pt-1">
            <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/[0.02] to-indigo-500/[0.02] border border-slate-100 p-4 rounded-xl space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Cheque Reference</span>
                <span className="font-mono font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{clearCheque.chequeNumber}</span>
              </div>
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Drawer / Payer</span>
                <span className="font-medium text-slate-800">{clearCheque.payerName}</span>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Clearing Value</span>
                <span className="font-mono font-normal text-emerald-700 bg-emerald-50/60 px-2.5 py-1 rounded-lg border border-emerald-100/30">{formatMoney(clearCheque.amount)}</span>
              </div>
            </div>

            {clearCheque.amount > CHEQUE_APPROVAL_THRESHOLD ? (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 leading-relaxed text-amber-800 flex items-start gap-2.5 body-sm">
                <IconAlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-medium block mb-0.5">Threshold Escalation Active</span>
                  This cheque exceeds the limit of {formatMoney(CHEQUE_APPROVAL_THRESHOLD)}. Submitting will route a GM/CEO approval hold with zero immediate ledger impact.
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 leading-relaxed text-emerald-800 flex items-start gap-2.5 body-sm">
                <IconShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <span className="font-medium block mb-0.5">Auto-Credit Path</span>
                  This cheque is within approval limits. Submitting will immediately mark it as Credited and auto-post a ledger double-entry.
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-slate-400 block label-caps">Double Entry Description</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <IconCoins size={15} />
                </div>
                <input
                  type="text"
                  required
                  value={clearJournalDesc}
                  onChange={(e) => setClearJournalDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-medium text-base"
                />
              </div>
              <span className="text-slate-400 block leading-tight text-sm">Clearing will debit Cash Accounts (NCBA Bank) and credit Accounts Receivable.</span>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setClearCheque(null)} className="h-9 px-4 text-base">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-9 px-4 bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] font-medium rounded-lg text-base">
                {isSubmitting ? "Processing..." : clearCheque.amount > CHEQUE_APPROVAL_THRESHOLD ? "Route Approval Request" : "Post & Reconcile Cash"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── 5. Dishonor Cheque Modal ───────────────────────────────────────── */}
      <Modal open={returnCheque !== null} onClose={() => setReturnCheque(null)} title="Flag Bounced / Returned Cheque">
        {returnCheque && (
          <form onSubmit={handleReturnChequeSubmit} className="space-y-5 pt-1">
            <div className="relative overflow-hidden bg-gradient-to-r from-rose-500/[0.02] to-amber-500/[0.02] border border-rose-100/50 p-4 rounded-xl space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Cheque Reference</span>
                <span className="font-mono font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{returnCheque.chequeNumber}</span>
              </div>
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Payer</span>
                <span className="font-medium text-slate-800">{returnCheque.payerName}</span>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <div className="flex justify-between items-center body-sm">
                <span className="text-slate-400 font-normal">Returned Sum</span>
                <span className="font-mono font-normal text-rose-700 bg-rose-50/50 px-2.5 py-1 rounded-lg border border-rose-100/30">{formatMoney(returnCheque.amount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 block label-caps">Return Reason</label>
                <select
                  value={retReason}
                  onChange={(e) => setRetReason(e.target.value as NonNullable<ChequeRecord["returnReason"]>)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 transition-all font-medium text-base"
                >
                  <option value="Insufficient Funds">Insufficient Funds</option>
                  <option value="Signature Mismatch">Signature Mismatch</option>
                  <option value="Post-Dated">Post-Dated</option>
                  <option value="Refer to Drawer">Refer to Drawer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-400 block label-caps">Follow-up Workflow</label>
                <select
                  value={retAction}
                  onChange={(e) => setRetAction(e.target.value as NonNullable<ChequeRecord["followUpAction"]>)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 transition-all font-medium text-base"
                >
                  <option value="Tenant Notified">Tenant/Client Notified</option>
                  <option value="Re-presented">Re-present next cycle</option>
                  <option value="Voided">Void cheque entry</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setReturnCheque(null)} className="h-9 px-4 text-base">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-9 px-4 bg-rose-600 text-white hover:bg-rose-700 font-medium rounded-lg text-base">
                {isSubmitting ? "Flagging..." : "Confirm Returned Status"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── 6. Cheque Detail Drawer ─────────────────────────────────────────── */}
      <Drawer
        open={selectedCheque !== null}
        onClose={() => setSelectedCheque(null)}
        title="Banker's Cheque Details"
        footer={
          selectedCheque && (
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setSelectedCheque(null)} className="h-9 text-base">
                Close Panel
              </Button>
              {selectedCheque.status === "Pending" && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => { setSelectedCheque(null); openReturnModalFor(selectedCheque); }}
                    className="bg-rose-50/10 text-rose-700 hover:bg-rose-500/20 py-1.5 px-3 rounded-lg font-medium text-base"
                  >
                    Flag Bounced
                  </Button>
                  <Button
                    onClick={() => { setSelectedCheque(null); openClearModalFor(selectedCheque); }}
                    disabled={Boolean(selectedCheque.approvalStatus)}
                    className="bg-[#f3df27] text-[#151936] hover:bg-[#e6d220] py-1.5 px-3 rounded-lg font-medium text-base"
                  >
                    {selectedCheque.approvalStatus ? "Approval Routed" : "Clear Credit"}
                  </Button>
                </div>
              )}
            </div>
          )
        }
      >
        {selectedCheque && (
          <div className="space-y-6 text-slate-700 text-sm">
            {/* Header context */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shadow-sm border border-slate-100/50">
                <IconBuildingBank size={20} />
              </div>
              <div>
                <h4 className="font-medium text-slate-900 leading-snug body-md">{selectedCheque.payerName}</h4>
                <p className="text-slate-400 mt-0.5 text-sm">{selectedCheque.chequeNumber} · {selectedCheque.bankName}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Authentic Banker's Cheque Simulation */}
              <div className="relative border border-[#0f172a]/15 bg-gradient-to-r from-teal-50/70 via-indigo-50/30 to-teal-50/50 p-5 rounded-2xl flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.02)] h-[150px] select-none outline outline-4 outline-white/80 outline-offset-[-5px] font-sans">
                {/* Slanted clearance stamp watermark */}
                <div className="absolute right-10 top-6 select-none pointer-events-none opacity-[0.15] origin-center -rotate-12 border-2 border-dashed border-current px-3 py-1.5 font-black tracking-widest rounded transition-all duration-300 text-xl">
                  {selectedCheque.status === "Credited" && <span className="text-emerald-600">CREDITED</span>}
                  {selectedCheque.status === "Returned" && <span className="text-rose-600">RETURNED</span>}
                  {selectedCheque.status === "Pending" && <span className="text-amber-600">CLEARING</span>}
                </div>

                <div className="flex justify-between items-start text-slate-400 font-mono text-sm">
                  <div className="flex items-center gap-1">
                    <IconBuildingBank size={14} className="text-slate-400" />
                    <span className="font-normal text-slate-700 tracking-wider">{selectedCheque.bankName}</span>
                  </div>
                  <span>CHEQUE NO: {selectedCheque.chequeNumber.replace("CHQ-", "")}</span>
                </div>

                <div className="flex justify-between items-center my-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-slate-400 font-mono label-caps">Pay to the order of</span>
                    <span className="text-sm font-normal text-slate-800 font-serif border-b border-dashed border-slate-300/80 pr-4 pb-0.5 leading-none">
                      Sunland Real Estate Ltd
                    </span>
                  </div>
                  <div className="bg-white/90 border border-slate-300/60 px-3.5 py-1.5 rounded-lg font-normal text-slate-800 font-mono shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] shrink-0 body-md">
                    {formatMoney(selectedCheque.amount)}
                  </div>
                </div>

                <div className="flex justify-between items-end text-slate-400 border-t border-slate-200/50 pt-2 font-mono text-sm">
                  <div>
                    <span className="text-slate-400">DRAWER:</span>{" "}
                    <span className="text-slate-700 font-sans font-medium">{selectedCheque.payerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">DATE:</span>{" "}
                    <span className="text-slate-700">{formatDate(selectedCheque.depositedDate)}</span>
                  </div>
                </div>

                {/* MICR Code lines */}
                <div className="text-center tracking-[0.25em] font-mono text-slate-400/80 mt-1 select-none pointer-events-none text-sm">
                  ⑈ {selectedCheque.chequeNumber.replace("CHQ-", "")} ⑈   01109288211 ⑈   0123849920 ⑈
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 label-caps">Allocation Memo</span>
                <p className="text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-xl text-base">{selectedCheque.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 label-caps">Deposited Date</span>
                  <p className="text-slate-700 mt-1 mono-data">{formatDate(selectedCheque.depositedDate)}</p>
                </div>
                <div>
                  <span className="text-slate-400 label-caps">Clearing Status</span>
                  <div className="mt-1">
                    <Badge
                      tone={selectedCheque.status === "Credited" ? "success" : selectedCheque.status === "Returned" ? "risk" : "warning"}
                      className="px-2.5 py-0.5"
                    >
                      {selectedCheque.status === "Pending" ? "Awaiting Bank Clearance" : selectedCheque.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Source</span>
                  <p className="mt-0.5 font-medium text-slate-700 text-base">{selectedCheque.source}</p>
                </div>
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Holder</span>
                  <p className="mt-0.5 font-medium text-slate-700 text-base">{selectedCheque.holder}</p>
                </div>
                <div className="rounded-xl bg-slate-50/50 border border-slate-100/50 p-3">
                  <span className="text-slate-400 label-caps">Clearing Age</span>
                  <p className="mt-0.5 text-slate-700 mono-data">{clearingAge(selectedCheque.depositedDate)} days</p>
                </div>
              </div>

              {selectedCheque.approvalStatus && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 leading-relaxed text-amber-800 flex gap-2.5 items-start body-sm">
                  <IconAlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-normal text-amber-900 mb-0.5">Approval Hold Active: {selectedCheque.approvalRef}</p>
                    <p className="text-slate-600 leading-normal">No ledger journal has been posted. The cheque remains in Deposited until the GM/CEO approval is decided.</p>
                  </div>
                </div>
              )}

              {selectedCheque.status === "Credited" && (
                <div className="p-4 bg-emerald-50/20 border border-emerald-100/40 rounded-xl space-y-1.5">
                  <span className="text-slate-400 block label-caps">Credit Reconciliation Log</span>
                  <div className="grid grid-cols-2 gap-2 pt-0.5 body-sm">
                    <div>
                      <span className="text-slate-400">Reconciled Date:</span>
                      <p className="font-mono font-medium text-slate-700 mt-0.5">{selectedCheque.reconciliationDate ? formatDate(selectedCheque.reconciliationDate) : "Pending"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Ledger Journal:</span>
                      <p className="font-mono font-normal text-indigo-700 mt-0.5">{selectedCheque.ledgerJournal}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedCheque.status === "Returned" && (
                <div className="p-4 bg-rose-50/20 border border-rose-100/40 rounded-xl space-y-2">
                  <span className="text-slate-400 block label-caps">Dishonor Audit Log</span>
                  <div className="grid grid-cols-2 gap-2 pt-0.5 body-sm">
                    <div>
                      <span className="text-slate-400">Returned Date:</span>
                      <p className="font-mono font-medium text-slate-700 mt-0.5">{selectedCheque.reconciliationDate ? formatDate(selectedCheque.reconciliationDate) : "Pending"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Dispute Reason:</span>
                      <p className="font-normal text-rose-700 mt-0.5">{selectedCheque.returnReason}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-rose-100/30">
                      <span className="text-slate-400">Follow-up Workflow Action:</span>
                      <p className="font-medium text-slate-700 mt-0.5">{selectedCheque.followUpAction}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Cheque Verification QR for Processed Cheques */}
              {(selectedCheque.status === "Credited" || selectedCheque.status === "Returned") && (
                <div className="pt-1.5">
                  <FinanceQrProof
                    compact={true}
                    artifactRef={selectedCheque.status === "Credited" ? selectedCheque.ledgerJournal || "Awaiting Post" : `RTN-${selectedCheque.chequeNumber}`}
                    artifactType={selectedCheque.status === "Credited" ? "Cheque Credit Receipt" : "Returned Cheque Notice"}
                    entityName={activeEntity.name}
                    generatedAt={selectedCheque.reconciliationDate || "2026-06-22"}
                    token={`sunland_chq_${selectedCheque.status.toLowerCase()}_${selectedCheque.chequeNumber.replace("CHQ-", "")}`}
                    amount={selectedCheque.amount}
                  />
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block label-caps">Activity Log</span>
                <div className="mt-3.5 space-y-3">
                  {selectedCheque.auditLog.map((entry, index) => (
                    <div key={`${selectedCheque.id}-${entry}`} className="flex gap-2.5">
                      <span className="mt-1.5 size-1.5 rounded-full bg-slate-400 shrink-0" />
                      <div>
                        <p className="text-slate-700 leading-normal font-medium text-base">{entry}</p>
                        <p className="font-mono text-slate-400 mt-0.5 text-sm">Step {selectedCheque.auditLog.length - index}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
      {/* ── Log New Cheque Modal (3-step: Form → Photo Capture → QR) ── */}
      {logOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={resetLogModal} />

          <div className="relative z-10 w-full max-w-lg animate-scale-in">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  {/* Breadcrumb steps */}
                  {(["Form", "Photo", "QR"] as const).map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className={cn(
                        "size-5 rounded-full flex items-center justify-center text-[10px] transition-all",
                        (logStep === "form" && i === 0) || (logStep === "photo" && i === 1) || (logStep === "qr" && i === 2)
                          ? "bg-[var(--sidebar)] text-white"
                          : (i === 0 && logStep !== "form") || (i === 1 && logStep === "qr")
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-100 text-slate-400"
                      )}>
                        {((i === 0 && logStep !== "form") || (i === 1 && logStep === "qr")) ? <IconCheck size={10} stroke={3} /> : i + 1}
                      </div>
                      <span className="text-tiny text-slate-400 hidden sm:inline">{s}</span>
                      {i < 2 && <IconArrowRight size={11} className="text-slate-300" />}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={resetLogModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <IconX size={18} />
                </button>
              </div>

              {/* Step 1: Form */}
              {logStep === "form" && (
                <form onSubmit={handleLogSubmit} className="p-6 space-y-4">
                  <h2 className="headline-md text-slate-900 mb-1">Log New Cheque</h2>
                  <p className="text-tiny text-slate-400 mb-4">Enter cheque details then attach a photo.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-caps text-slate-400 mb-1.5 block">Cheque Number</label>
                      <input required value={logForm.chequeNumber}
                        onChange={e => setLogForm(p => ({ ...p, chequeNumber: e.target.value }))}
                        placeholder="CHQ-XXXX"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:border-[var(--sidebar)] focus:outline-none transition-all" />
                    </div>
                    <div>
                      <label className="label-caps text-slate-400 mb-1.5 block">Amount (KES)</label>
                      <input required value={logForm.amount}
                        onChange={e => setLogForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="e.g. 250,000"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption font-mono text-slate-800 focus:border-[var(--sidebar)] focus:outline-none transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="label-caps text-slate-400 mb-1.5 block">Payer / Drawer Name</label>
                    <input required value={logForm.payerName}
                      onChange={e => setLogForm(p => ({ ...p, payerName: e.target.value }))}
                      placeholder="Company or individual name"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:border-[var(--sidebar)] focus:outline-none transition-all" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-caps text-slate-400 mb-1.5 block">Clearing Bank</label>
                      <input required value={logForm.bankName}
                        onChange={e => setLogForm(p => ({ ...p, bankName: e.target.value }))}
                        placeholder="NCBA, Equity…"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:border-[var(--sidebar)] focus:outline-none transition-all" />
                    </div>
                    <div>
                      <label className="label-caps text-slate-400 mb-1.5 block">Deposit Date</label>
                      <input type="date" value={logForm.depositedDate}
                        onChange={e => setLogForm(p => ({ ...p, depositedDate: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:border-[var(--sidebar)] focus:outline-none transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="label-caps text-slate-400 mb-1.5 block">Source</label>
                    <select value={logForm.source}
                      onChange={e => setLogForm(p => ({ ...p, source: e.target.value as ChequeRecord["source"] }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:outline-none transition-all">
                      <option>Front Office</option>
                      <option>Finance</option>
                      <option>Rentals</option>
                    </select>
                  </div>

                  <div>
                    <label className="label-caps text-slate-400 mb-1.5 block">Description (optional)</label>
                    <input value={logForm.description}
                      onChange={e => setLogForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="e.g. Rent settlement for Unit 4B"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-caption text-slate-800 focus:border-[var(--sidebar)] focus:outline-none transition-all" />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button type="button" onClick={resetLogModal}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-caption text-slate-600 hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                    <button type="submit"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--sidebar)] text-caption text-white hover:opacity-90 transition-all">
                      Next: Attach Photo <IconArrowRight size={13} />
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Photo Capture */}
              {logStep === "photo" && (
                <div className="p-6 space-y-4">
                  <h2 className="headline-md text-slate-900">Attach Cheque Photo</h2>
                  <p className="text-tiny text-slate-400">Capture or upload a photo of the physical cheque for audit trail.</p>

                  {/* Camera/Photo area */}
                  <div className="relative rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 min-h-[220px] flex items-center justify-center">
                    {usingCamera ? (
                      <div className="relative w-full">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
                        <canvas ref={canvasRef} className="hidden" />
                        <button type="button" onClick={capturePhoto}
                          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white px-5 py-2 text-caption text-slate-800 shadow-lg hover:bg-slate-50 transition-colors">
                          <IconCamera size={14} />
                          Capture Photo
                        </button>
                      </div>
                    ) : logPhotoUrl ? (
                      <div className="relative w-full">
                        <Image src={logPhotoUrl} width={800} height={250} alt="Cheque" className="w-full rounded-xl object-contain max-h-[250px]" />
                        <button type="button" onClick={() => setLogPhotoUrl(null)}
                          className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
                          <IconX size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 p-8 text-center">
                        <div className="size-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <IconCamera size={24} className="text-slate-400" />
                        </div>
                        <div>
                          <p className="text-caption text-slate-700">Capture or upload a cheque photo</p>
                          <p className="text-tiny text-slate-400 mt-0.5">JPEG or PNG · Recommended: full cheque visible</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={startCamera}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-caption text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                            <IconCamera size={14} />
                            Use Camera
                          </button>
                          <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-caption text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                            <IconUpload size={14} />
                            Upload Photo
                          </button>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button type="button" onClick={() => setLogStep("form")}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-caption text-slate-600 hover:bg-slate-50 transition-colors">
                      Back
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleLogFinalize}
                        disabled={logSubmitting}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-caption text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                        Skip Photo
                      </button>
                      <button type="button" onClick={handleLogFinalize}
                        disabled={!logPhotoUrl || logSubmitting}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--sidebar)] text-caption text-white hover:opacity-90 transition-all disabled:opacity-40">
                        {logSubmitting ? <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <IconQrcode size={14} />}
                        Generate QR
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: QR Code Proof */}
              {logStep === "qr" && logGenerated && (
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="headline-md text-slate-900">Cheque QR Generated</h2>
                      <p className="text-tiny text-slate-400 mt-0.5">{logGenerated.chequeNumber} · {logGenerated.bankName}</p>
                    </div>
                    <span className="badge-pill badge-tone-success">Logged</span>
                  </div>

                  {/* Cheque photo thumbnail + QR side by side */}
                  <div className="flex items-start gap-4">
                    {logPhotoUrl && (
                      <div className="shrink-0">
                        <p className="label-caps text-slate-400 mb-1.5">Cheque Photo</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <Image src={logPhotoUrl} width={128} height={80} alt="Cheque" className="w-32 h-20 object-cover rounded-xl border border-slate-200 shadow-sm" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="label-caps text-slate-400 mb-1.5">Verification QR Code</p>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm inline-block">
                        <QRCodeSVG
                          value={JSON.stringify({
                            ref: logGenerated.chequeNumber,
                            type: "Banker's Cheque - Clearance Record",
                            entity: logGenerated.payerName,
                            bank: logGenerated.bankName,
                            amount: logGenerated.amount,
                            deposited: logGenerated.depositedDate,
                            token: logQrToken,
                            verify: `${typeof window !== "undefined" ? window.location.origin : "https://sunland.co.ke"}/fin/reports/verify/${logQrToken}`,
                          })}
                          size={120}
                          bgColor="#ffffff"
                          fgColor="#151936"
                          level="H"
                          marginSize={1}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cheque meta */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Cheque", value: logGenerated.chequeNumber, mono: true },
                      { label: "Amount", value: formatMoney(logGenerated.amount), mono: true },
                      { label: "Bank", value: logGenerated.bankName },
                      { label: "Source", value: logGenerated.source },
                    ].map(item => (
                      <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p className="label-caps text-slate-400">{item.label}</p>
                        <p className={cn("text-caption text-slate-800 mt-0.5", item.mono && "font-mono")}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button type="button" onClick={resetLogModal}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--sidebar)] text-caption text-white hover:opacity-90 transition-all">
                      <IconCheck size={14} />
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
