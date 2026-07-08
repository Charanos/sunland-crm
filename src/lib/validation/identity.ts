import { z } from "zod";
import { userRole } from "@/db/schema";

const userRoleEnum = z.enum(userRole.enumValues as [string, ...string[]]);

export const updateUserProfileSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
});

export const updateUserAccessSchema = z.object({
  role: userRoleEnum.optional(),
  isActive: z.boolean().optional(),
  primaryEntityId: z.string().uuid().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: userRoleEnum,
  title: z.string().optional(),
  primaryEntityId: z.string().uuid(),
});

export const createRoleSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z][a-z0-9_]*$/, "slug must be lowercase snake_case"),
  name: z.string().min(1),
  scopeType: z.enum(["global", "entity", "self"]).default("entity"),
  permissions: z.array(z.string()).default([]),
});

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export const grantRoleSchema = z.object({
  roleId: z.string().uuid(),
  entityId: z.string().uuid().nullable().optional(),
});
