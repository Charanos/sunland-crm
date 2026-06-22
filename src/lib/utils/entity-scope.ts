import { db } from "@/db";
import { entities } from "@/db/schema";
import { eq, inArray, type SQL, type Column } from "drizzle-orm";

export async function getScopeEntityIds(slug: string): Promise<string[]> {
  if (slug === "group") {
    const all = await db.select({ id: entities.id }).from(entities);
    return all.map((e) => e.id);
  }
  // Clean registry translation mapping for Valuers (registry uses slug values aligned with enum)
  const mappedSlug = slug === "valuations" ? "valuers" : slug;
  const [entity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.slug, mappedSlug as "group" | "commercial" | "residential" | "valuers"));
  return entity ? [entity.id] : [];
}

export async function scopeEntityFilter(
  entityIdColumn: Column,
  slug: string
): Promise<SQL | undefined> {
  const ids = await getScopeEntityIds(slug);
  if (ids.length === 0) {
    // Return a fallback filter referencing a non-existent UUID to prevent accidental leaking
    return eq(entityIdColumn, "00000000-0000-0000-0000-000000000000");
  }
  return inArray(entityIdColumn, ids);
}
