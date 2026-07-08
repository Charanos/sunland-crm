import type { z } from "zod";
import { DomainValidationError } from "@/lib/authz/errors";

/** Parses with Zod, converting failures into a DomainValidationError (→ HTTP 400 via handleRouteError). */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new DomainValidationError(message);
  }
  return result.data;
}
