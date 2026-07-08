import fs from "fs";
import path from "path";

// Manually load env variables from .env.local before importing database
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    for (const line of envConfig.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.endsWith("\r")) {
          value = value.substring(0, value.length - 1);
        }
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.warn("Failed to load .env.local", e);
}

// Dynamically import to bypass ES import hoisting issue
async function run() {
  console.log("=== STARTING ONBOARDING & DOCUMENT SYSTEMS E2E VERIFICATION ===");

  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { properties, entities, users } = await import("../src/db/schema");
  const { createContact } = await import("../src/lib/services/crm");
  const { createProperty, createLease, createDocument } = await import("../src/lib/services/properties");
  const { buildCallerContext } = await import("../src/lib/services/types");

  // 1. Resolve seed user and entity context
  const [testUser] = await db.select().from(users).limit(1);
  const [testEntity] = await db.select().from(entities).where(eq(entities.slug, "group")).limit(1);

  if (!testUser || !testEntity) {
    console.error("Test pre-requisites missing. Make sure database is seeded.");
    process.exit(1);
  }

  const ctx = buildCallerContext(
    {
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      role: testUser.role,
    },
    testEntity.id
  );

  console.log(`Using Entity Context: ${testEntity.name} (${testEntity.id})`);
  console.log(`Using Actor User: ${testUser.name} (${testUser.role})`);

  // 2. Onboard Landlord Contact
  console.log("\n1. Onboarding Landlord Contact...");
  const landlord = await createContact(ctx, {
    displayName: "Landlord Dennis Munge",
    type: "landlord",
    email: "dennis.munge@landlords.co.ke",
    phone: "+254 711 222 333",
  });
  console.log(`✅ Landlord Onboarded. ID: ${landlord.id}`);

  // 3. Register Property portfolio linked to Landlord
  console.log("\n2. Registering Property unit...");
  const property = await createProperty(ctx, {
    propertyCode: `PROP-E2E-${Date.now()}`,
    name: "Karen Elite Residences Block A",
    propertyType: "Apartment",
    listingType: "Rent",
    location: "Karen, Nairobi",
    ownerContactId: landlord.id,
    monthlyRentKes: "95000",
  });
  console.log(`✅ Property registered. Code: ${property.propertyCode}, Status: ${property.status}`);

  // 4. Onboard Tenant Contact
  console.log("\n3. Onboarding Tenant Contact...");
  const tenant = await createContact(ctx, {
    displayName: "Tenant Amina Hassan",
    type: "tenant",
    email: "amina.hassan@tenants.co.ke",
    phone: "+254 722 333 444",
  });
  console.log(`✅ Tenant Onboarded. ID: ${tenant.id}`);

  // 5. Register Lease Agreement & verify auto-status updates
  console.log("\n4. Finalizing Lease contract...");
  const lease = await createLease(ctx, {
    propertyId: property.id,
    tenantContactId: tenant.id,
    startsAt: "2026-08-01",
    endsAt: "2027-08-01",
    monthlyRentKes: "95000",
    depositKes: "190000",
  });
  console.log(`✅ Lease registered. ID: ${lease.id}`);

  // Check property status updated to occupied
  const [updatedProp] = await db.select().from(properties).where(eq(properties.id, property.id)).limit(1);
  if (updatedProp.status !== "occupied") {
    throw new Error(`Assertion failed: Property status should be occupied, got: ${updatedProp.status}`);
  }
  console.log(`✅ Verified Property status successfully switched to: ${updatedProp.status}`);

  // 6. Upload and catalog mandate letter document
  console.log("\n5. Cataloging signed Mandate Agreement PDF...");
  const document = await createDocument(ctx, {
    type: "mandate_letter",
    title: "Signed Property Management Mandate — Block A",
    fileUrl: "https://cloudinary.com/sunland/docs/signed_mandate_munge_blocka.pdf",
    ownerContactId: landlord.id,
    metadata: { unitCount: 1, rate: 0.1 },
  });
  console.log(`✅ Mandate Letter cataloged. ID: ${document.id}, Type: ${document.type}`);

  console.log("\n=== E2E ONBOARDING & DOCUMENT WORKFLOW PASSED SUCCESSFULLY ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("\n❌ E2E VERIFICATION FAILED:", err);
  process.exit(1);
});
