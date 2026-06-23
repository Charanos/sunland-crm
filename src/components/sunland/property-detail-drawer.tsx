"use client";

import Image from "next/image";
import Link from "next/link";
import {
  IconBed,
  IconBath,
  IconRuler,
  IconCalendar,
  IconEdit,
  IconTrash,
  IconEye,
  IconMapPin,
  IconUser,
  IconClock,
  IconPhone,
  IconMail,
} from "@tabler/icons-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface PropertyDetailData {
  id: string;
  name: string;
  location: string;
  type: string;
  status: "Available" | "Sold" | "Under Offer" | "Occupied";
  roi: string;
  price: string;
  imageUrl: string;
}

const STATUS_STYLES: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Occupied: "bg-blue-50 text-blue-700 border-blue-200",
  "Under Offer": "bg-amber-50 text-amber-700 border-amber-200",
  Sold: "bg-slate-100 text-slate-600 border-slate-200",
};

// Mock additional detail data (would come from API in production)
const MOCK_DETAILS = {
  bedrooms: 4,
  bathrooms: 3,
  size: "3,200 sqft",
  yearBuilt: "2022",
  agent: {
    name: "Amina Wanjiku",
    role: "Senior Agent",
    phone: "+254 712 345 678",
    email: "amina@sunlandre.co.ke",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
  },
  activities: [
    { time: "2 hours ago", text: "Viewing completed with James Mwangi", type: "viewing" },
    { time: "1 day ago", text: "Price updated from KES 19.5M to KES 21.3M", type: "update" },
    { time: "3 days ago", text: "Photography session completed", type: "system" },
    { time: "1 week ago", text: "Listed on Sunland portfolio", type: "system" },
  ],
};

export function PropertyDetailDrawer({
  open,
  onClose,
  property,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  property: PropertyDetailData | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!property) return null;

  const details = MOCK_DETAILS;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Property Details"
      width="32rem"
      footer={
        <div className="flex items-center gap-2">
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
        <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-100">
          <Image
            src={property.imageUrl.replace("w=120&h=80", "w=600&h=400")}
            alt={property.name}
            fill
            sizes="500px"
            className="object-cover"
          />
          <div className="absolute top-3 right-3">
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
            { icon: IconBed, label: "Bedrooms", value: String(details.bedrooms) },
            { icon: IconBath, label: "Bathrooms", value: String(details.bathrooms) },
            { icon: IconRuler, label: "Size", value: details.size },
            { icon: IconCalendar, label: "Year Built", value: details.yearBuilt },
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

        {/* Assigned Agent */}
        <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
          <p className="label-caps text-slate-400 mb-3">Listing Agent</p>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full overflow-hidden border border-slate-200 shadow-sm relative shrink-0">
              <Image
                src={details.agent.avatar}
                alt={details.agent.name}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-slate-800 leading-none mb-1">
                {details.agent.name}
              </p>
              <p className="text-sm text-slate-500 font-medium leading-none">
                {details.agent.role}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={`tel:${details.agent.phone}`}
                className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#151936] hover:border-[#151936]/30 transition-colors shadow-sm"
                aria-label="Call agent"
              >
                <IconPhone size={14} stroke={2} />
              </a>
              <a
                href={`mailto:${details.agent.email}`}
                className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#151936] hover:border-[#151936]/30 transition-colors shadow-sm"
                aria-label="Email agent"
              >
                <IconMail size={14} stroke={2} />
              </a>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div>
          <p className="label-caps text-slate-400 mb-3">Recent Activity</p>
          <div className="space-y-0">
            {details.activities.map((activity, i) => (
              <div key={i} className="flex gap-3 relative py-2.5">
                {i < details.activities.length - 1 && (
                  <div className="absolute left-[7px] top-[28px] bottom-0 w-px bg-slate-100" />
                )}
                <div className="size-[15px] rounded-full border-2 border-slate-200 bg-white shrink-0 mt-0.5 z-10" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 leading-snug text-base">
                    {activity.text}
                  </p>
                  <p className="text-sm text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                    <IconClock size={11} stroke={2} />
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
