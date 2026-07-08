// Barrel re-export — schema is split by module (platform/crm/properties/finance)
// for maintainability as the finance ledger and remaining modules grow.
// Existing `import { X } from "@/db/schema"` call sites keep working unchanged.
export * from "@/db/schema/platform";
export * from "@/db/schema/crm";
export * from "@/db/schema/properties";
export * from "@/db/schema/finance";
