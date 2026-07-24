import { z } from "zod";
import { userRole } from "@/db/schema";

const userRoleEnum = z.enum(userRole.enumValues as [string, ...string[]]);

export const updateUserProfileSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  phone: z.string().max(40).nullable().optional(),
});

// Per-user preference upsert (Account console → Preferences). Free-key like
// the entity settings store, but user-scoped. Known keys: language, dateFmt,
// accent, density, navMode, topBar, quietHours, digest.
export const upsertUserPreferenceSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.unknown(),
});

// Bulk preference save (the Preferences tab saves several at once).
export const upsertUserPreferencesSchema = z.object({
  preferences: z.array(upsertUserPreferenceSchema).min(1),
});

// Notification routing matrix save. inApp genuinely gates delivery;
// email/sms are stored pending a real provider.
export const updateNotificationPrefsSchema = z.object({
  rows: z
    .array(
      z.object({
        category: z.string().min(1).max(40),
        inApp: z.boolean(),
        email: z.boolean(),
        sms: z.boolean(),
      }),
    )
    .min(1),
});

// Self-service password change (Account console → Security).
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// TOTP verify step (confirm the 6-digit code during enrollment / to disable).
export const totpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
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
