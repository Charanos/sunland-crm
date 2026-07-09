"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconBed,
  IconBath,
  IconRuler,
  IconTag,
  IconEdit,
  IconTrash,
  IconEye,
  IconMapPin,
  IconClock,
  IconPhone,
  IconMail,
  IconBuildingSkyscraper,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface PropertyDetailData {
  id: string;
  name: string;
  location: string;
  type: string;
  listingType?: string;
  status: "Available" | "Sold" | "Under Offer" | "Occupied";
  roi: string;
  price: string;
  imageUrl: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sizeSqft?: number | null;
  owner?: { id: string; name: string; email: string | null; phone: string | null } | null;
  isFeatured?: boolean;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Occupied: "bg-blue-50 text-blue-700 border-blue-200",
  "Under Offer": "bg-amber-50 text-amber-700 border-amber-200",
  Sold: "bg-slate-100 text-slate-600 border-slate-200",
};

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

export function PropertyDetailDrawer({
  open,
  onClose,
  property,
  entityId,
  onEdit,
  onDelete,
  onToggleFeature,
}: {
  open: boolean;
  onClose: () => void;
  property: PropertyDetailData | null;
  entityId?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFeature?: (id: string, currentlyFeatured: boolean) => void;
}) {
  const [activity, setActivity] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!open || !property || !entityId) {
      Promise.resolve().then(() => setActivity([]));
      return;
    }
    fetch(`/api/audit?entityId=${entityId}&associatedType=property&associatedId=${property.id}&limit=10`)
      .then((r) => r.json())
      .then((data) => setActivity(Array.isArray(data.entries) ? data.entries : []))
      .catch(() => setActivity([]));
  }, [open, property, entityId]);

  if (!property) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Property Details"
      width="32rem"
      footer={
        <div className="flex items-center gap-2">
          {onToggleFeature && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onToggleFeature(property.id, !!property.isFeatured)}
              aria-pressed={!!property.isFeatured}
              className={cn(property.isFeatured && "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100")}
            >
              {property.isFeatured ? <IconStarFilled size={14} /> : <IconStar size={14} />}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(property.id)}
            className="flex-1"
          >
            <IconEdit size={14} />
            Edit
          </Button>
          <Link href="/admin/properties" className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              <IconEye size={14} />
              Full View
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(property.id)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      }
    >
      <div className="space-y-6 animate-fade-in-up">
        {/* Hero Image */}
        <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-100">
          {property.imageUrl ? (
            <Image
              src={property.imageUrl.replace("w=120&h=80", "w=600&h=400")}
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
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {property.isFeatured && (
              <span className="flex items-center gap-1 text-sm px-2.5 py-1 rounded-lg font-medium border shadow-sm bg-amber-50 text-amber-700 border-amber-200">
                <IconStarFilled size={12} /> Featured
              </span>
            )}
            <span
              className={cn(
                "text-sm px-3 py-1 rounded-lg font-medium border shadow-sm",
                STATUS_STYLES[property.status]
              )}
            >
              {property.status}
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <p className="text-white/70 mb-1 label-caps">
              {property.type}
            </p>
            <h3 className="text-white text-lg font-medium leading-snug">
              {property.name}
            </h3>
          </div>
        </div>

        {/* Price & Location */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#151936] tracking-tight leading-none mono-stat">
              {property.price}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-slate-500">
              <IconMapPin size={13} stroke={2} />
              <span className="text-base font-medium">{property.location}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono font-medium text-slate-600 body-md">
              {property.roi}
            </span>
            <p className="text-slate-400 mt-0.5 label-caps">
              Annual ROI
            </p>
          </div>
        </div>

        {/* InfoTile Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: IconBed, label: "Bedrooms", value: property.bedrooms != null ? String(property.bedrooms) : "—" },
            { icon: IconBath, label: "Bathrooms", value: property.bathrooms != null ? String(property.bathrooms) : "—" },
            { icon: IconRuler, label: "Size", value: property.sizeSqft != null ? `${property.sizeSqft.toLocaleString()} sqft` : "—" },
            { icon: IconTag, label: "Listing Type", value: property.listingType ?? "—" },
          ].map((tile) => (
            <div
              key={tile.label}
              className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
            >
              <div className="size-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-500 shadow-sm">
                <tile.icon size={16} stroke={1.5} />
              </div>
              <div>
                <p className="font-mono font-medium text-slate-800 leading-none text-lg">
                  {tile.value}
                </p>
                <p className="text-slate-400 mt-1 label-caps">
                  {tile.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Property Owner */}
        {property.owner?.name && (
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
            <p className="label-caps text-slate-400 mb-3">Property Owner</p>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-white border border-slate-200 shadow-sm shrink-0 flex items-center justify-center text-slate-500 font-medium">
                {property.owner.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-slate-800 leading-none mb-1 truncate">
                  {property.owner.name}
                </p>
                <p className="text-sm text-slate-500 font-medium leading-none">
                  Landlord
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {property.owner.phone && (
                  <a
                    href={`tel:${property.owner.phone}`}
                    className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#151936] hover:border-[#151936]/30 transition-colors shadow-sm"
                    aria-label="Call owner"
                  >
                    <IconPhone size={14} stroke={2} />
                  </a>
                )}
                {property.owner.email && (
                  <a
                    href={`mailto:${property.owner.email}`}
                    className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#151936] hover:border-[#151936]/30 transition-colors shadow-sm"
                    aria-label="Email owner"
                  >
                    <IconMail size={14} stroke={2} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        <div>
          <p className="label-caps text-slate-400 mb-3">Recent Activity</p>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400">No recorded activity yet.</p>
          ) : (
            <div className="space-y-0">
              {activity.map((entry, i) => (
                <div key={entry.id} className="flex gap-3 relative py-2.5">
                  {i < activity.length - 1 && (
                    <div className="absolute left-[7px] top-[28px] bottom-0 w-px bg-slate-100" />
                  )}
                  <div className="size-[15px] rounded-full border-2 border-slate-200 bg-white shrink-0 mt-0.5 z-10" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 leading-snug text-base">
                      {entry.summary}
                    </p>
                    <p className="text-sm text-slate-400 font-medium mt-0.5 flex items-center gap-1">
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
  );
}
