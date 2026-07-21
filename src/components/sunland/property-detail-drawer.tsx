"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconBath,
  IconBed,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconCar,
  IconClock,
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
} from "@tabler/icons-react";
import { Button, ConfirmDialog, Avatar, Badge } from "@/components/ui/erp-primitives";
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

  const statusConfig = STATUS_CONFIG[property.status];
  const ownerName = ownerDisplayName(property);
  const ownerHasName = ownerName !== "Unassigned owner";
  const contact = ownerContact(property);

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Property Details"
        width="32rem"
        footer={
          <div className="flex items-center gap-2">
            {canManage && onToggleFeature && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onToggleFeature(property.id, !!property.isFeatured)}
                aria-pressed={!!property.isFeatured}
                className={cn(
                  property.isFeatured && "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                )}
              >
                {property.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
              </Button>
            )}
            {canManage && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(property)}
                className="flex-1"
              >
                <IconEdit size={14} />
                Edit
              </Button>
            )}
            <Link href={`/admin/properties/${property.id}`} className="flex-1">
              <Button size="sm" className="w-full bg-[#151936] text-white hover:bg-[#151936]/90">
                <IconEye size={14} />
                Full View
              </Button>
            </Link>
            {canManage && (
              <Button variant="danger" size="sm" onClick={() => onDelete(property.id)}>
                <IconTrash size={14} />
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-6 animate-fade-in-up">
          {/* ── Hero Image ── */}
          <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-100">
            {primaryImageUrl(property) ? (
              <Image
                src={primaryImageUrl(property)!}
                alt={property.name}
                fill
                sizes="500px"
                className="object-cover"
              />
            ) : (
              <div className="size-full flex items-center justify-center">
                <IconBuildingSkyscraper size={40} className="text-slate-300" stroke={1.5} />
              </div>
            )}

            {/* Tags overlay */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 flex-wrap justify-end">
              {property.isFeatured && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg border shadow-sm bg-amber-50 text-amber-700 border-amber-200 label-caps">
                  <IconStarFilled size={12} /> Featured
                </span>
              )}
              {canManage ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-sm backdrop-blur-sm bg-white/85 border border-slate-200/80"
                >
                  <span className={cn("size-1.5 rounded-full shrink-0", statusConfig.dot)} aria-hidden="true" />
                  <select
                    value={property.status}
                    disabled={updating}
                    onChange={(e) => applyStatusChange(e.target.value as PropertyStatus)}
                    aria-label={`Change status for ${property.name}`}
                    className="appearance-none bg-transparent outline-none cursor-pointer disabled:cursor-wait label-caps text-slate-700"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_CONFIG[s].label}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
                <Badge
                  tone={
                    property.status === "available" ? "success" :
                    property.status === "under_offer" ? "warning" :
                    property.status === "maintenance" ? "risk" :
                    "neutral"
                  }
                >
                  {statusConfig.label}
                </Badge>
              )}
            </div>

            {/* Bottom gradient */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <p className="text-white/70 mb-1 label-caps">{property.propertyType}</p>
              <h3 className="text-white leading-snug">{property.name}</h3>
            </div>
          </div>

          {/* ── Price & Location ── */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[#151936] tracking-tight leading-none mono-stat">{priceVal}</p>
              <div className="flex items-center gap-1.5 mt-2 text-slate-400">
                <IconMapPin size={13} stroke={2} />
                <span className="body-sm">{property.location}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="mono-data text-slate-600">N/A</span>
              <p className="label-caps text-slate-400 mt-0.5">Annual ROI</p>
            </div>
          </div>

          {/* ── Info Tiles ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: IconBed,
                label: "Bedrooms",
                value: property.bedrooms != null ? String(property.bedrooms) : "—",
              },
              {
                icon: IconBath,
                label: "Bathrooms",
                value: property.bathrooms != null ? String(property.bathrooms) : "—",
              },
              {
                icon: IconRuler,
                label: "Size",
                value:
                  property.sizeSqft != null
                    ? `${property.sizeSqft.toLocaleString()} sqft`
                    : "—",
              },
              {
                icon: IconCalendarEvent,
                label: "Year Built",
                value: property.yearBuilt != null ? String(property.yearBuilt) : "—",
              },
              {
                icon: IconCar,
                label: "Parking Spaces",
                value: property.parkingSpaces != null ? String(property.parkingSpaces) : "—",
              },
              {
                icon: IconRuler,
                label: "Land Area",
                value:
                  property.landAreaSqft != null
                    ? `${property.landAreaSqft.toLocaleString()} sqft`
                    : "—",
              },
              {
                icon: IconTag,
                label: "Listing Type",
                value: LISTING_TYPE_LABEL[property.listingType as keyof typeof LISTING_TYPE_LABEL]
                  ?? (property.listingType?.toLowerCase() === "sale" ? "For Sale" : property.listingType || "—"),
              },
            ].map((tile, idx) => (
              <div
                key={tile.label + idx}
                className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="size-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                  <tile.icon size={16} stroke={1.5} />
                </div>
                <div>
                  <p className="mono-data text-slate-800 leading-none">{tile.value}</p>
                  <p className="label-caps text-slate-400 mt-1">{tile.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Amenities ── */}
          {property.amenities && property.amenities.length > 0 && (
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
              <p className="label-caps text-slate-400 mb-3">Amenities & Features</p>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((amenity: string) => (
                  <span
                    key={amenity}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium shadow-sm"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Property Owner ── */}
          {ownerHasName && (
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
              <p className="label-caps text-slate-400 mb-3">Property Owner</p>
              <div className="flex items-center gap-3">
                <Avatar
                  src={property.owner?.avatarUrl || undefined}
                  fallback={ownerName.slice(0, 2).toUpperCase()}
                  className="size-10 bg-white border border-slate-200 text-slate-400 shrink-0 text-xxs"
                />
                <div className="flex-1 min-w-0">
                  <p className="body-sm text-slate-800 leading-none mb-1 truncate">{ownerName}</p>
                  <p className="label-caps text-slate-400 leading-none">Landlord</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {contact?.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#151936] hover:border-[#151936]/30 transition-colors shadow-sm"
                      aria-label="Call owner"
                    >
                      <IconPhone size={14} stroke={2} />
                    </a>
                  )}
                  {contact?.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#151936] hover:border-[#151936]/30 transition-colors shadow-sm"
                      aria-label="Email owner"
                    >
                      <IconMail size={14} stroke={2} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Activity Timeline ── */}
          <div>
            <p className="label-caps text-slate-400 mb-3">Recent Activity</p>
            {activity.length === 0 ? (
              <p className="body-sm text-slate-400">No recorded activity yet.</p>
            ) : (
              <div className="space-y-0">
                {activity.map((entry, i) => (
                  <div key={entry.id} className="flex gap-3 relative py-2.5">
                    {i < activity.length - 1 && (
                      <div className="absolute left-[7px] top-[28px] bottom-0 w-px bg-slate-100" />
                    )}
                    <div className="size-[15px] rounded-full border-2 border-slate-200 bg-white shrink-0 mt-0.5 z-10" />
                    <div className="flex-1 min-w-0">
                      <p className="body-sm text-slate-700 leading-snug">{entry.summary}</p>
                      <p className="label-caps text-slate-400 mt-0.5 flex items-center gap-1">
                        <IconClock size={11} stroke={2} />
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
