// ─── Sunland Entity Registry ───────────────────────────────────────────────────
// Single source of truth for all business entities within the Sunland Group.
// Used by: sidebar switcher, entity-switch overlay, top-bar context indicator.

export interface Entity {
  id: string;
  name: string;
  /** Short descriptor shown beneath the name */
  subtitle: string;
  /** One-line context description shown in the switch overlay */
  description: string;
  /** Unsplash representative image URL */
  avatarUrl: string;
  /** KPI snapshot surfaced during entity switch */
  stats: {
    properties: number;
    contacts: number;
    revenue: string;
  };
}

export const ENTITIES: Entity[] = [
  {
    id: "group",
    name: "Sunland Group",
    subtitle: "Headquarters",
    description: "Group-level operations and consolidated reporting across all divisions",
    avatarUrl:
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=160&h=160&fit=crop",
    stats: { properties: 48, contacts: 215, revenue: "KES 42.8M" },
  },
  {
    id: "commercial",
    name: "Sunland Commercial",
    subtitle: "Commercial Division",
    description: "Office spaces, retail units and commercial property portfolio",
    avatarUrl:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=160&h=160&fit=crop",
    stats: { properties: 12, contacts: 85, revenue: "KES 16.7M" },
  },
  {
    id: "residential",
    name: "Sunland Residential",
    subtitle: "Residential Division",
    description: "Residential estates, apartments and premium housing units",
    avatarUrl:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=160&h=160&fit=crop",
    stats: { properties: 36, contacts: 130, revenue: "KES 26.1M" },
  },
  {
    id: "valuers",
    name: "Sunland Valuers Ltd",
    subtitle: "Valuation & Advisory",
    description: "Professional property valuation and real estate advisory services",
    avatarUrl:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=160&h=160&fit=crop",
    stats: { properties: 84, contacts: 45, revenue: "KES 8.2M" },
  },
];

export function getEntityById(id: string): Entity {
  return ENTITIES.find((e) => e.id === id) ?? ENTITIES[0];
}
