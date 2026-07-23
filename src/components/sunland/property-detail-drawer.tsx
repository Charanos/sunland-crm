"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconBath,
  IconBed,
  IconBuildingSkyscraper,
  IconCar,
  IconEdit,
  IconEye,
  IconMail,
  IconMapPin,
  IconPhone,
  IconRuler,
  IconStar,
  IconStarFilled,
  IconTag,
  IconTrash,
  IconChevronDown,
  IconUsers,
} from "@tabler/icons-react";
import { Button, ConfirmDialog, Avatar } from "@/components/ui/erp-primitives";
import { Drawer } from "@/components/ui/drawer";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  LISTING_TYPE_LABEL,
  STATUS_CONFIG,
  STATUS_ORDER,
  ownerDisplayName,
  type Property,
  type PropertyStatus,
} from "./property-constants";

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
}

/** Loose shape of an expanded owner block that may arrive in legacy payloads */
interface OwnerContact {
  name?: string;
  phone?: string;
  email?: string;
}

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

function primaryImageUrl(property: Property): string | null {
  if (!property.media || property.media.length === 0) return null;
  return property.media.find((m) => m.isPrimary)?.url ?? property.media[0].url;
}

/** Safely extract the legacy-payload owner contact block (untyped on Property base) */
function ownerContact(property: Property): OwnerContact | null {
  const raw = (property as Record<string, unknown>).owner;
  if (raw && typeof raw === "object") return raw as OwnerContact;
  return null;
}

export function PropertyDetailDrawer({
  property,
  open,
  entityId,
  onClose,
  canManage,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleFeature,
}: {
  property: Property | null;
  open: boolean;
  entityId?: string;
  onClose: () => void;
  canManage: boolean;
  onEdit: (property: Property) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PropertyStatus) => Promise<void> | void;
  onToggleFeature?: (id: string, currentlyFeatured: boolean) => void;
}) {
  const [pendingArchive, setPendingArchive] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [activity, setActivity] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!open || !property || !entityId) {
      Promise.resolve().then(() => setActivity([]));
      return;
    }
    fetch(
      `/api/audit?entityId=${entityId}&associatedType=property&associatedId=${property.id}&limit=10`
    )
      .then((r) => r.json())
      .then((data) => setActivity(Array.isArray(data.entries) ? data.entries : []))
      .catch(() => setActivity([]));
  }, [open, property, entityId]);

  if (!property) return null;

  const isForSale = property.listingType === "sale";

  const priceVal = isForSale
    ? property.askingPriceKes
      ? formatCompactKES(parseFloat(property.askingPriceKes))
      : "On Request"
    : property.monthlyRentKes
      ? `${formatCompactKES(parseFloat(property.monthlyRentKes))}/mo`
      : "On Request";

  const applyStatusChange = async (next: PropertyStatus) => {
    if (next === property.status) return;
    if (next === "off_market") {
      setPendingArchive(true);
      return;
    }
    setUpdating(true);
    try {
      await onStatusChange(property.id, next);
    } finally {
      setUpdating(false);
    }
  };

  const confirmArchive = async () => {
    setUpdating(true);
    try {
      await onStatusChange(property.id, "off_market");
    } finally {
      setUpdating(false);
      setPendingArchive(false);
    }
  };

  const statusConfig = STATUS_CONFIG[property.status] ?? STATUS_CONFIG.available;
  const ownerName = ownerDisplayName(property);
  const ownerHasName = ownerName !== "Unassigned owner";
  const contact = ownerContact(property);

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Property Details"
        width="36rem"
        footer={
          <div className="flex items-center gap-3">
            {canManage && onToggleFeature && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onToggleFeature(property.id, !!property.isFeatured)}
                aria-pressed={!!property.isFeatured}
                className={cn(
                  "px-4 border-transparent shadow-none bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors",
                  property.isFeatured && "text-amber-500 bg-amber-50 hover:bg-amber-100"
                )}
              >
                {property.isFeatured ? <IconStarFilled size={16} /> : <IconStar size={16} />}
              </Button>
            )}
            {canManage && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(property)}
                className="flex-1 border-transparent shadow-none bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <IconEdit size={14} className="mr-1.5" />
                Edit
              </Button>
            )}
            <Link href={`/admin/properties/${property.id}`} className="flex-1">
              <Button size="sm" className="w-full bg-[#151936] text-white hover:bg-[#151936]/90 shadow-none border-transparent transition-colors">
                <IconEye size={14} className="mr-1.5" />
                Full View
              </Button>
            </Link>
            {canManage && (
              <Button variant="danger" size="sm" onClick={() => onDelete(property.id)} className="px-4 border-transparent shadow-none bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                <IconTrash size={14} />
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-8 animate-fade-in-up pb-6">
          {/* ── Hero Image ── */}
          <div className="relative aspect-[16/10] sm:aspect-[21/9] w-full rounded-[16px] overflow-hidden bg-slate-100 group">
            {primaryImageUrl(property) ? (
              <Image
                src={primaryImageUrl(property)!}
                alt={property.name}
                fill
                sizes="600px"
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
              />
            ) : (
              <div className="size-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <IconBuildingSkyscraper size={48} className="text-slate-200" stroke={1.2} />
              </div>
            )}

            {/* Tags overlay */}
            <div className="absolute top-4 right-4 flex items-center gap-2 flex-wrap justify-end z-10">
              {property.isFeatured && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md bg-white/70 text-amber-600 label-caps border border-white/40 shadow-sm">
                  <IconStarFilled size={12} /> Featured
                </span>
              )}
              {canManage ? (
                <div className="relative inline-flex items-center rounded-full px-3 py-1.5 backdrop-blur-md bg-white/90 border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all hover:bg-white hover:shadow-[0_4px_24px_rgba(0,0,0,0.1)] group cursor-pointer">
                  <span className={cn("size-2 rounded-full shrink-0 shadow-sm absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none", statusConfig.dot)} aria-hidden="true" />
                  <select
                    value={property.status}
                    disabled={updating}
                    onChange={(e) => applyStatusChange(e.target.value as PropertyStatus)}
                    aria-label={`Change status for ${property.name}`}
                    className="appearance-none bg-transparent outline-none cursor-pointer disabled:cursor-wait label-caps text-slate-900 tracking-widest font-medium pl-5 pr-6 w-full h-full relative z-10"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_CONFIG[s].label}
                      </option>
                    ))}
                  </select>
                  <IconChevronDown size={14} stroke={2.5} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-all group-hover:text-slate-900 z-10" />
                </div>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md bg-white/70 border border-white/40 shadow-sm">
                  <span className={cn("size-2 rounded-full shrink-0", statusConfig.dot)} aria-hidden="true" />
                  <span className="label-caps text-slate-800 tracking-widest">{statusConfig.label}</span>
                </span>
              )}
            </div>

            {/* Subtle bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 p-5 pt-8">
              <p className="text-white/80 mb-1 label-caps tracking-widest">{property.propertyType}</p>
              <h3 className="headline-md text-white tracking-tight leading-tight">{property.name}</h3>
            </div>
          </div>

          {/* ── Price & Location ── */}
          <div className="flex flex-col gap-5 border-b border-slate-100 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-slate-400 label-caps mb-1.5 tracking-widest">{isForSale ? "Asking Price" : "Monthly Rent"}</p>
                <div className="flex items-baseline gap-1.5 text-slate-900">
                  <span className="mono-stat text-4xl sm:text-5xl font-normal tracking-tight">{priceVal.replace("KES ", "").replace("/mo", "")}</span>
                  <span className="text-slate-400 label-caps font-normal">{priceVal.includes("KES") ? "KES" : ""}{priceVal.includes("/mo") ? " / mo" : ""}</span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="mono-stat text-2xl font-normal text-slate-900">N/A</span>
                <p className="label-caps text-slate-400 mt-0.5 tracking-widest">Annual ROI</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <IconMapPin size={16} stroke={1.2} className="text-slate-400 shrink-0" />
              <span className="body-sm">{property.location}</span>
            </div>
          </div>

          {/* ── Key Specs (Sleek Grid) ── */}
          <div>
            <p className="label-caps text-slate-400 mb-5 tracking-widest">Property Specifications</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
              {[
                { icon: IconBed, label: "Bedrooms", value: property.bedrooms != null ? String(property.bedrooms) : "—" },
                { icon: IconBath, label: "Bathrooms", value: property.bathrooms != null ? String(property.bathrooms) : "—" },
                { icon: IconUsers, label: "Tenants", value: (property as Record<string, unknown>).leases ? `${((property as Record<string, unknown>).leases as Array<{ status: string }>).filter((l) => l.status === "active").length} Active` : "1 Active" },
                { icon: IconRuler, label: "Size (sqft)", value: property.sizeSqft != null ? property.sizeSqft.toLocaleString() : "—" },
                { icon: IconCar, label: "Parking", value: property.parkingSpaces != null ? String(property.parkingSpaces) : "—" },
                { icon: IconTag, label: "Listing", value: LISTING_TYPE_LABEL[property.listingType as keyof typeof LISTING_TYPE_LABEL] ?? (property.listingType?.toLowerCase() === "sale" ? "For Sale" : property.listingType || "—") },
              ].map((tile, idx) => (
                <div key={tile.label + idx} className="flex flex-col gap-1.5 border-l border-slate-100 pl-4">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <tile.icon size={14} stroke={1.5} />
                    <span className="label-caps tracking-widest">{tile.label}</span>
                  </div>
                  <span className="mono-stat text-xl text-slate-800 font-normal">{tile.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Amenities (Minimal List) ── */}
          {property.amenities && property.amenities.length > 0 && (
            <div className="border-t border-slate-100 pt-8">
              <p className="label-caps text-slate-400 mb-5 tracking-widest">Amenities & Features</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {property.amenities.map((amenity: string) => (
                  <span key={amenity} className="flex items-center gap-2 text-slate-600 body-sm">
                    <span className="size-1 rounded-full bg-slate-300" />
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Property Owner (Flush Row) ── */}
          {ownerHasName && (
            <div className="border-t border-slate-100 pt-8">
              <p className="label-caps text-slate-400 mb-5 tracking-widest">Property Owner</p>
              <div className="flex items-center justify-between gap-4 group">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={property.owner?.avatarUrl || undefined}
                    fallback={ownerName.slice(0, 2).toUpperCase()}
                    className="size-12 bg-slate-50 text-slate-600 text-sm"
                  />
                  <div>
                    <p className="text-slate-900 font-medium text-base">{ownerName}</p>
                    <p className="text-slate-500 text-sm mt-0.5">Landlord</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {contact?.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="size-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      aria-label="Call owner"
                    >
                      <IconPhone size={18} stroke={1.5} />
                    </a>
                  )}
                  {contact?.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="size-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      aria-label="Email owner"
                    >
                      <IconMail size={18} stroke={1.5} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Activity Timeline (Delicate) ── */}
          <div className="border-t border-slate-100 pt-8">
            <p className="label-caps text-slate-400 mb-6 tracking-widest">Recent Activity</p>
            {activity.length === 0 ? (
              <p className="body-sm text-slate-400 italic">No recorded activity yet.</p>
            ) : (
              <div className="space-y-5 pl-1.5 relative">
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-slate-100" />
                {activity.map((entry) => (
                  <div key={entry.id} className="flex gap-4 relative">
                    <div className="size-[6px] rounded-full bg-slate-300 shrink-0 mt-[6px] z-10" />
                    <div className="flex-1 min-w-0">
                      <p className="body-sm text-slate-700 leading-snug">{entry.summary}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {relativeTime(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={pendingArchive}
        title="Take this property off market?"
        description={`${property.name} will stop appearing in active listings. You can reactivate it later by changing its status again.`}
        confirmLabel="Take off market"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={confirmArchive}
        onClose={() => setPendingArchive(false)}
      />
    </>
  );
}
