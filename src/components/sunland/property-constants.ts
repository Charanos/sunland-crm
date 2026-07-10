import type { ComponentType } from "react";
import {
  IconBuildingEstate,
  IconBuildingWarehouse,
  IconHome2,
  IconTrees,
  IconBuildingSkyscraper,
} from "@tabler/icons-react";

/**
 * Aligned to the Sunland.co.ke public-site designations per
 * SUNLAND_BACKEND_ARCHITECTURE_MASTER.md §5.3 ("align property_type to
 * Sunland.co.ke designations"). `propertyType` on the API payload is kept as
 * `string` in the Property type below so legacy/unaligned rows don't break
 * rendering — the table falls back to the raw string as a label if it
 * doesn't match one of these five.
 */
export type PropertyType = "Apartment" | "Commercial" | "House" | "Land" | "Villa";

export const PROPERTY_TYPES: PropertyType[] = [
  "Apartment",
  "Commercial",
  "House",
  "Land",
  "Villa",
];

export const PROPERTY_TYPE_ICON: Record<
  PropertyType,
  ComponentType<{ size?: number; stroke?: number; className?: string }>
> = {
  Apartment: IconBuildingEstate,
  Commercial: IconBuildingWarehouse,
  House: IconHome2,
  Land: IconTrees,
  Villa: IconBuildingSkyscraper,
};

/**
 * "sale" vs "let" mirrors the fee vocabulary already used in the finance
 * spec (letting fees vs sales commissions). Labeled "To Let" rather than
 * "For Rent" to match standard Kenyan listing/signage convention.
 */
export type ListingType = "sale" | "let";

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  sale: "For Sale",
  let: "To Let",
};

export type PropertyStatus =
  | "available"
  | "occupied"
  | "under_offer"
  | "maintenance"
  | "off_market";

export const STATUS_ORDER: PropertyStatus[] = [
  "available",
  "occupied",
  "under_offer",
  "maintenance",
  "off_market",
];

/**
 * Colors are drawn only from the Terrain Identity semantic palette
 * (TERRAIN_IDENTITY_FOUNDATION.md) — emerald/rose/amber/slate. No new
 * module-specific color is introduced, per that doc's explicit rule.
 */
export const STATUS_CONFIG: Record<
  PropertyStatus,
  { label: string; dot: string; pill: string; description: string }
> = {
  available: {
    label: "Available",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 border-slate-200",
    description: "Vacant and ready to market",
  },
  occupied: {
    label: "Occupied",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-700 border-emerald-300/60",
    description: "Under an active lease or sale agreement",
  },
  under_offer: {
    label: "Under Offer",
    dot: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-700 border-amber-300/60",
    description: "Offer received, pending close",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-rose-500",
    pill: "bg-rose-500/15 text-rose-700 border-rose-300/60",
    description: "Temporarily off-market for repairs",
  },
  off_market: {
    label: "Off Market",
    dot: "bg-slate-300",
    pill: "bg-slate-50 text-slate-400 border-slate-200",
    description: "Withdrawn from active listing",
  },
};

export type Property = {
  id: string;
  propertyCode: string;
  name: string;
  propertyType: PropertyType | string;
  listingType: ListingType;
  status: PropertyStatus;
  location: string;
  ownerContactId: string | null;
  /** Optional joined display name — falls back to ownerContactId, then "Unassigned". */
  ownerName?: string | null;
  askingPriceKes: string | null;
  monthlyRentKes: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqft: number | null;
  /**
   * Optional — only rendered if present. Maps to property_mandates.status
   * (SUNLAND_ERP_IMPLEMENTATION_SPEC.md §5.4) once a landlord mandate is
   * linked. Absent/undefined means "not under a Sunland management mandate"
   * and the field is simply not shown.
   */
  mandateStatus?: "draft" | "pending_approval" | "active" | "terminated" | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isFeatured?: boolean;
  media?: Array<{ url: string; alt?: string; isPrimary?: boolean }> | null;
};

export function formatPropertyDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ownerDisplayName(property: Pick<Property, "ownerName" | "ownerContactId">): string {
  if (property.ownerName) return property.ownerName;
  if (property.ownerContactId) return `Contact ${property.ownerContactId.slice(0, 8)}`;
  return "Unassigned owner";
}
