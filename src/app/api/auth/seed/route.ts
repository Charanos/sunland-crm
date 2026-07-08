import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  entities,
  users,
  contacts,
  properties,
  leads,
  leases,
  maintenanceRequests,
  transactions,
  approvalRequests,
  notifications,
  activityLogs,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { grantUserRole, seedPermissionCatalog } from "@/lib/authz/seed";
import { seedDefaultSettings } from "@/lib/services/settings";

export async function POST() {
  console.log("--------------------------------------------------");
  console.log("Initializing Demo Workspace & Ledger Ledger Setup");
  console.log("--------------------------------------------------");

  try {
    // 1. Clean existing records in reverse dependency order
    await db.delete(activityLogs);
    await db.delete(notifications);
    await db.delete(approvalRequests);
    await db.delete(transactions);
    await db.delete(leases);
    await db.delete(maintenanceRequests);
    await db.delete(leads);
    await db.delete(properties);
    await db.delete(contacts);
    await db.delete(users);
    await db.delete(entities);

    // 2. Insert Entities (Divisions)
    const [groupEntity, commEntity, resEntity, valEntity] = await db
      .insert(entities)
      .values([
        {
          slug: "group",
          name: "Sunland Group",
          legalName: "Sunland Group Holdings Limited",
          isConsolidated: true,
        },
        {
          slug: "commercial",
          name: "Sunland Commercial",
          legalName: "Sunland Commercial Properties Limited",
          isConsolidated: false,
        },
        {
          slug: "residential",
          name: "Sunland Residential",
          legalName: "Sunland Residential Estates Limited",
          isConsolidated: false,
        },
        {
          slug: "valuers",
          name: "Sunland Valuers Ltd",
          legalName: "Sunland Valuers and Advisory Services Limited",
          isConsolidated: false,
        },
      ])
      .returning();

    // 3. Create Demo Users
    const hashedPass = await hashPassword("sunland-demo");

    const [
      ceoUser,
      gmUser,
      financeHeadUser,
      financeOfficerUser,
      pmUser,
      hrHeadUser,
      lineManagerUser,
      frontOfficeUser,
    ] = await db
      .insert(users)
      .values([
        {
          email: "ceo@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Paul Amos",
          role: "ceo",
          title: "Chief Executive Officer",
          primaryEntityId: groupEntity.id,
        },
        {
          email: "gm@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Grace Mutua",
          role: "general_manager",
          title: "General Manager",
          primaryEntityId: groupEntity.id,
        },
        {
          email: "finance.head@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Dennis Munge",
          role: "finance_head",
          title: "Head of Finance",
          primaryEntityId: groupEntity.id,
        },
        {
          email: "finance.officer@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Esther Howard",
          role: "finance_officer",
          title: "Finance Officer",
          primaryEntityId: commEntity.id,
        },
        {
          email: "ops.lead@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Jacob Jones",
          role: "operations_lead",
          title: "Operations Director",
          primaryEntityId: resEntity.id,
        },
        {
          email: "hr.head@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Cody Fisher",
          role: "hr_head",
          title: "Head of Human Resources",
          primaryEntityId: groupEntity.id,
        },
        {
          email: "line.manager@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Jared Omondi",
          role: "line_manager",
          title: "Line Manager",
          primaryEntityId: resEntity.id,
        },
        {
          email: "front.office@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Sharon Koech",
          role: "front_office_head",
          title: "Front Office Lead",
          primaryEntityId: groupEntity.id,
        },
      ])
      .returning();

    // 3b. Seed the permission catalog + system roles, then grant each seeded
    // user their role (backend master §3.1).
    await seedPermissionCatalog();
    const roleGrants: Array<{ userId: string; roleSlug: string; entityId: string | null }> = [
      { userId: ceoUser.id, roleSlug: "ceo", entityId: null },
      { userId: gmUser.id, roleSlug: "general_manager", entityId: null },
      { userId: financeHeadUser.id, roleSlug: "finance_head", entityId: null },
      { userId: financeOfficerUser.id, roleSlug: "finance_officer", entityId: commEntity.id },
      { userId: pmUser.id, roleSlug: "operations_lead", entityId: resEntity.id },
      { userId: hrHeadUser.id, roleSlug: "hr_head", entityId: null },
      { userId: lineManagerUser.id, roleSlug: "line_manager", entityId: resEntity.id },
      { userId: frontOfficeUser.id, roleSlug: "front_office_head", entityId: null },
    ];
    for (const grant of roleGrants) {
      await grantUserRole(grant.userId, grant.roleSlug, grant.entityId);
    }
    await seedDefaultSettings(groupEntity.id);

    // 4. Create Contacts (Landlords and Tenants)
    const [landlordA, landlordB, tenantA, tenantB] = await db
      .insert(contacts)
      .values([
        {
          entityId: commEntity.id,
          type: "landlord",
          displayName: "Kariuki Holdings",
          companyName: "Kariuki Real Estate Investments Ltd",
          email: "investments@kariuki.co.ke",
          phone: "+254722000111",
          source: "Direct Referral",
          assignedToId: ceoUser.id,
        },
        {
          entityId: resEntity.id,
          type: "landlord",
          displayName: "Margaret Wambui",
          email: "margaret@wambui.me",
          phone: "+254733111222",
          source: "Marketing Campaign",
          assignedToId: pmUser.id,
        },
        {
          entityId: commEntity.id,
          type: "tenant",
          displayName: "Nexus Tech Solutions",
          companyName: "Nexus Technology Solutions Ltd",
          email: "office@nexustech.co.ke",
          phone: "+254711222333",
          source: "Listing Portal",
          assignedToId: financeOfficerUser.id,
        },
        {
          entityId: resEntity.id,
          type: "tenant",
          displayName: "Alice Odhiambo",
          email: "alice@odhiambo.co.ke",
          phone: "+254700333444",
          source: "Walk-in Client",
          assignedToId: pmUser.id,
        },
      ])
      .returning();

    // 5. Create Properties
    const [propComm, propRes] = await db
      .insert(properties)
      .values([
        {
          entityId: commEntity.id,
          propertyCode: "PROP-COMM-001",
          name: "Nexus Office Plaza",
          propertyType: "Commercial Office",
          listingType: "Rental",
          status: "occupied",
          location: "Westlands, Nairobi",
          ownerContactId: landlordA.id,
          monthlyRentKes: "350000.00",
          sizeSqft: 2400,
        },
        {
          entityId: resEntity.id,
          propertyCode: "PROP-RES-001",
          name: "Lavington Heights Unit 4B",
          propertyType: "Apartment",
          listingType: "Rental",
          status: "occupied",
          location: "Lavington, Nairobi",
          ownerContactId: landlordB.id,
          monthlyRentKes: "95000.00",
          sizeSqft: 1500,
        },
      ])
      .returning();

    // 6. Create Leases
    const startsAt = new Date();
    startsAt.setMonth(startsAt.getMonth() - 2);
    const endsAt = new Date();
    endsAt.setFullYear(endsAt.getFullYear() + 1);

    const [leaseA, leaseB] = await db
      .insert(leases)
      .values([
        {
          entityId: commEntity.id,
          propertyId: propComm.id,
          tenantContactId: tenantA.id,
          startsAt,
          endsAt,
          monthlyRentKes: "350000.00",
          depositKes: "700000.00",
          isActive: true,
        },
        {
          entityId: resEntity.id,
          propertyId: propRes.id,
          tenantContactId: tenantB.id,
          startsAt,
          endsAt,
          monthlyRentKes: "95000.00",
          depositKes: "190000.00",
          isActive: true,
        },
      ])
      .returning();

    // 7. Create Transactions
    await db.insert(transactions).values([
      {
        entityId: commEntity.id,
        type: "rent",
        contactId: tenantA.id,
        propertyId: propComm.id,
        leaseId: leaseA.id,
        amountKes: "350000.00",
        occurredAt: new Date(),
        recordedById: financeOfficerUser.id,
        notes: "Rent payment for Nexus Tech Solutions - Month of June",
      },
      {
        entityId: resEntity.id,
        type: "rent",
        contactId: tenantB.id,
        propertyId: propRes.id,
        leaseId: leaseB.id,
        amountKes: "95000.00",
        occurredAt: new Date(),
        recordedById: pmUser.id,
        notes: "Rent payment for Alice Odhiambo - Month of June",
      },
      {
        entityId: commEntity.id,
        type: "expense",
        contactId: landlordA.id,
        propertyId: propComm.id,
        amountKes: "45000.00",
        occurredAt: new Date(),
        recordedById: financeOfficerUser.id,
        notes: "Elevator repair maintenance cost - Westlands Plaza",
      },
    ]);

    // 8. Create Approval Requests
    await db.insert(approvalRequests).values([
      {
        entityId: commEntity.id,
        requestType: "petty_cash",
        relatedTable: "transactions",
        relatedId: leaseA.id,
        requestedById: financeOfficerUser.id,
        amountKes: "6000.00",
        requiredApproverRole: "gm",
        status: "pending",
        decisionNotes: "Needs GM verification for office stationaries above threshold.",
      },
      {
        entityId: resEntity.id,
        requestType: "mandate_activation",
        relatedTable: "leases",
        relatedId: leaseB.id,
        requestedById: pmUser.id,
        amountKes: "5200000.00",
        requiredApproverRole: "ceo",
        status: "pending",
        decisionNotes: "Annualized contract value exceeds CEO threshold requirement.",
      },
    ]);

    // 9. Activity Logs
    await db.insert(activityLogs).values([
      {
        entityId: groupEntity.id,
        actorId: ceoUser.id,
        associatedType: "entities",
        associatedId: groupEntity.id,
        action: "initialize_workspace",
        summary: "Demo Workspace has been successfully initialized and configured.",
      },
    ]);

    return NextResponse.json({
      success: true,
      message: "Workspace initialized successfully.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Seeding failed";
    console.error("Seeding error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
