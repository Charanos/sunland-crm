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
    stats: { properties: 47, contacts: 312, revenue: "KES 284M" },
  },
  {
    id: "commercial",
    name: "Sunland Commercial",
    subtitle: "Commercial Division",
    description: "Office spaces, retail units and commercial property portfolio",
    avatarUrl:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=160&h=160&fit=crop",
    stats: { properties: 18, contacts: 145, revenue: "KES 112M" },
  },
  {
    id: "residential",
    name: "Sunland Residential",
    subtitle: "Residential Division",
    description: "Residential estates, apartments and premium housing units",
    avatarUrl:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=160&h=160&fit=crop",
    stats: { properties: 29, contacts: 167, revenue: "KES 172M" },
  },
];

export function getEntityById(id: string): Entity {
  return ENTITIES.find((e) => e.id === id) ?? ENTITIES[0];
}
