// Barrel re-export - schema is split by module (platform/crm/properties/finance)
// for maintainability as the finance ledger and remaining modules grow.
// Existing `import { X } from "@/db/schema"` call sites keep working unchanged.
export * from "@/db/schema/platform";
export * from "@/db/schema/crm";
export * from "@/db/schema/properties";
export * from "@/db/schema/finance";
export * from "@/db/schema/documents";
export * from "@/db/schema/operations";
export * from "@/db/schema/scheduling";
export * from "@/db/schema/support";
export * from "@/db/schema/hr";
export * from "@/db/schema/messaging";
export * from "@/db/schema/valuations";
export * from "@/db/schema/mandates";

