import { eq } from "drizzle-orm";
import { db } from "@/db";
import { entities, entitySlug } from "@/db/schema";
import { DomainValidationError } from "@/lib/authz/errors";

const ENTITY_SLUGS = entitySlug.enumValues;

/** Accepts either a real entity uuid or an entity slug ("group", "commercial", ...). */
export async function resolveEntityId(entityIdOrSlug: string): Promise<string> {
  if ((ENTITY_SLUGS as readonly string[]).includes(entityIdOrSlug)) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.slug, entityIdOrSlug as (typeof ENTITY_SLUGS)[number]))
      .limit(1);
    if (!entity) throw new DomainValidationError(`Unknown entity slug: ${entityIdOrSlug}`);
    return entity.id;
  }
  return entityIdOrSlug;
}
