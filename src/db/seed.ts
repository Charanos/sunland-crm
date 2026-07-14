import fs from "fs";
import path from "path";

// Manually load env variables from .env and .env.local in development environment
try {
  const loadEnv = (fileName: string) => {
    const envPath = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, "utf-8");
      for (const line of envConfig.split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";
          if (value.endsWith("\r")) value = value.substring(0, value.length - 1);
          if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
          process.env[key] = value;
        }
      }
    }
  };
  loadEnv(".env");
  loadEnv(".env.local");
} catch (e) {
  console.warn("Failed to load local env files:", e);
}

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
  documents,
  reportExports,
  settings,
  projects,
  calendarEvents,
  complaints,
  supportTickets,
  conversations,
  conversationParticipants,
  messages,
  valuations,
  propertyMandates,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { grantUserRole, seedPermissionCatalog } from "@/lib/authz/seed";
import { seedDefaultSettings } from "@/lib/services/settings";

async function runSeed() {
  console.log("--------------------------------------------------");
  console.log("Initializing Demo Workspace & Ledger Ledger Setup");
  console.log("--------------------------------------------------");

  try {
    // 1. Clean existing records in reverse dependency order
    console.log("Step 1: Clearing existing records...");
    await db.delete(activityLogs);
    await db.delete(notifications);
    await db.delete(reportExports);
    await db.delete(documents);
    await db.delete(settings);
    // FK-ordered: messages/participants before conversations; complaints and
    // support_tickets before users; calendar_events before projects (its
    // projectId FK) and both before users.
    await db.delete(messages);
    await db.delete(conversationParticipants);
    await db.delete(conversations);
    await db.delete(complaints);
    await db.delete(supportTickets);
    await db.delete(calendarEvents);
    await db.delete(projects);
    await db.delete(approvalRequests);
    await db.delete(transactions);
    await db.delete(leases);
    await db.delete(maintenanceRequests);
    await db.delete(leads);
    await db.delete(valuations);
    await db.delete(propertyMandates);
    await db.delete(properties);
    await db.delete(contacts);
    await db.delete(users);
    await db.delete(entities);
    console.log("Database cleared successfully.");

    // 2. Insert Entities (Divisions)
    console.log("Step 2: Populating business divisions...");
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

    console.log(`Created 4 divisions: Group (${groupEntity.id}), Commercial (${commEntity.id}), Residential (${resEntity.id}), Valuers (${valEntity.id}).`);

    // 3. Create Demo Users
    console.log("Step 3: Creating administrative and operational user roles...");
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
      propertyManager1User,
      propertyManager2User,
      salesAgent1User,
      salesAgent2User,
      legalOfficerUser,
    ] = await db
      .insert(users)
      .values([
        {
          email: "ceo@sunlandre.co.ke", passwordHash: hashedPass, name: "Paul Amos", role: "ceo", title: "Chief Executive Officer", avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80", primaryEntityId: groupEntity.id,
        },
        {
          email: "gm@sunlandre.co.ke", passwordHash: hashedPass, name: "Grace Mutua", role: "general_manager", title: "General Manager", avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80", primaryEntityId: groupEntity.id,
        },
        {
          email: "finance.head@sunlandre.co.ke", passwordHash: hashedPass, name: "Dennis Munge", role: "finance_head", title: "Head of Finance", avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80", primaryEntityId: groupEntity.id,
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
          name: "James Kiptoo",
          role: "property_manager",
          title: "Operations Manager",
          primaryEntityId: commEntity.id,
        },
        {
          email: "front.office@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Alice Wanjiku",
          role: "front_office_head",
          title: "Front Office Manager",
          primaryEntityId: groupEntity.id,
        },
        // Seeded Ops / Property Managers
        {
          email: "pm1@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "David Omondi",
          role: "property_manager",
          title: "Senior Property Manager",
          primaryEntityId: commEntity.id,
        },
        {
          email: "pm2@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Jane Wanjiru",
          role: "property_manager",
          title: "Property Manager",
          primaryEntityId: resEntity.id,
        },
        // Seeded Sales / BD Agents
        {
          email: "sales1@sunlandre.co.ke", passwordHash: hashedPass, name: "Kevin Mbugua", role: "property_manager", title: "Senior Broker", avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80", primaryEntityId: commEntity.id,
        },
        {
          email: "sales2@sunlandre.co.ke", passwordHash: hashedPass, name: "Lucy Kariuki", role: "property_manager", title: "Sales Agent", avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80", primaryEntityId: resEntity.id,
        },
        // Seeded Legal / Escrow Officers
        {
          email: "legal1@sunlandre.co.ke",
          passwordHash: hashedPass,
          name: "Brian Njoroge",
          role: "rentals_mandates_officer",
          title: "Escrow Officer",
          primaryEntityId: groupEntity.id,
        },
      ])
      .returning();

    console.log(`Created 14 users. Authenticate with email and password 'sunland-demo'.`);

    // 3b. Seed the permission catalog + system roles, then grant each seeded
    // user their role (backend master §3.1). CEO/GM are global scope (no
    // entity restriction); the rest are scoped to their own primaryEntityId.
    console.log("Step 3b: Seeding permission catalog and granting system roles...");
    await seedPermissionCatalog();
    const roleGrants: Array<{ userId: string; roleSlug: string; entityId: string | null }> = [
      { userId: ceoUser.id, roleSlug: "ceo", entityId: null },
      { userId: gmUser.id, roleSlug: "general_manager", entityId: null },
      { userId: financeHeadUser.id, roleSlug: "finance_head", entityId: null },
      { userId: financeOfficerUser.id, roleSlug: "finance_officer", entityId: commEntity.id },
      { userId: pmUser.id, roleSlug: "operations_lead", entityId: resEntity.id },
      { userId: hrHeadUser.id, roleSlug: "hr_head", entityId: null },
      { userId: lineManagerUser.id, roleSlug: "property_manager", entityId: resEntity.id },
      { userId: frontOfficeUser.id, roleSlug: "front_office_head", entityId: null },
      // These five were seeded for department-stat/headcount variety but
      // never granted a role - left them able to log in but unable to do
      // anything (zero permissions), since RBAC checks user_roles, not the
      // users.role column alone.
      { userId: propertyManager1User.id, roleSlug: "property_manager", entityId: commEntity.id },
      { userId: propertyManager2User.id, roleSlug: "property_manager", entityId: resEntity.id },
      { userId: salesAgent1User.id, roleSlug: "property_manager", entityId: commEntity.id },
      { userId: salesAgent2User.id, roleSlug: "property_manager", entityId: resEntity.id },
      { userId: legalOfficerUser.id, roleSlug: "rentals_mandates_officer", entityId: groupEntity.id },
    ];
    for (const grant of roleGrants) {
      await grantUserRole(grant.userId, grant.roleSlug, grant.entityId);
    }
    console.log(`Granted roles to ${roleGrants.length} users.`);

    await seedDefaultSettings(groupEntity.id);
    console.log("Seeded default entity settings/thresholds.");

    // 4. Create Contacts (Landlords and Tenants)
    console.log("Step 4: Creating client and partner records...");
    const contactsToInsert: (typeof contacts.$inferInsert)[] = [
      {
        entityId: groupEntity.id,
        type: "landlord",
        displayName: "Kariuki Holdings",
        companyName: "Kariuki Real Estate Investments Ltd",
        email: "investments@kariuki.co.ke",
        phone: "+254722000111",
        source: "Direct Referral",
        assignedToId: ceoUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "landlord",
        displayName: "Margaret Wambui",
        email: "margaret@wambui.me",
        phone: "+254733111222",
        source: "Marketing Campaign",
        assignedToId: pmUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "tenant",
        displayName: "Nexus Tech Solutions",
        companyName: "Nexus Technology Solutions Ltd",
        email: "office@nexustech.co.ke",
        phone: "+254711222333",
        source: "Listing Portal",
        assignedToId: financeOfficerUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "tenant",
        displayName: "Alice Odhiambo",
        email: "alice@odhiambo.co.ke",
        phone: "+254700333444",
        source: "Walk-in Client",
        assignedToId: pmUser.id,
      },
    ];

    for (let i = 5; i <= 20; i++) {
      contactsToInsert.push({
        entityId: groupEntity.id,
        type: i % 2 === 0 ? "landlord" : "tenant",
        displayName: i % 2 === 0 ? `Landlord Corp ${i}` : `Tenant Client ${i}`,
        companyName: i % 3 === 0 ? `Company ${i} Ltd` : null as unknown as string,
        email: `contact${i}@example.co.ke`,
        phone: `+2547000000${i.toString().padStart(2, '0')}`,
        source: i % 4 === 0 ? "Listing Portal" : "Direct Referral",
        assignedToId: i % 2 === 0 ? pmUser.id : financeOfficerUser.id,
      });
    }

    const [landlordA, landlordB, tenantA, tenantB] = await db
      .insert(contacts)
      .values(contactsToInsert)
      .returning();

    console.log("Created 20 contacts.");

    // 5. Create Properties
    console.log("Step 5: Logging managed properties...");
    const propsToInsert: (typeof properties.$inferInsert)[] = [
      {
        entityId: groupEntity.id,
        propertyCode: "PROP-COMM-001",
        name: "Nexus Office Plaza",
        propertyType: "Commercial",
        listingType: "Rental",
        status: "occupied",
        location: "Westlands, Nairobi",
        ownerContactId: landlordA.id,
        monthlyRentKes: "350000.00",
        sizeSqft: 2400,
        yearBuilt: 2018,
        parkingSpaces: 5,
        amenities: ["Ample Parking", "Backup Generator", "High-Speed Elevators", "24/7 Security", "Internet / Fiber Ready", "CCTV Surveillance", "Commercial Zoning"],
        description: "A premium commercial office suite situated in the heart of Westlands. Features full backup power, high-speed fiber connectivity, and dedicated basement parking.",
        media: [
          { url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80", alt: "Office exterior", isPrimary: true },
          { url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80", alt: "Lobby" },
        ]
      },
      {
        entityId: groupEntity.id,
        propertyCode: "PROP-RES-001",
        name: "Lavington Heights Unit 4B",
        propertyType: "Apartment",
        listingType: "Rental",
        status: "occupied",
        location: "Lavington, Nairobi",
        ownerContactId: landlordB.id,
        monthlyRentKes: "95000.00",
        sizeSqft: 1500,
        yearBuilt: 2021,
        parkingSpaces: 2,
        amenities: ["Swimming Pool", "Gym / Fitness Center", "Balcony", "Fitted Kitchen", "Children's Play Area", "Borehole Water Supply"],
        description: "Luxurious, sunlit residential apartment overlooking the Lavington valley. Modern fitted kitchen and exclusive access to the resident clubhouse and pool.",
        media: [
          { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80", alt: "Living room", isPrimary: true },
          { url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80", alt: "Bedroom" },
        ]
      },
    ];

    const propertyTypes = ["Apartment", "Commercial", "House", "Villa", "Land"];
    const typeImages: Record<string, string[]> = {
      "Apartment": [
        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80"
      ],
      "Commercial": [
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
        "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80",
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80"
      ],
      "House": [
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
        "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80"
      ],
      "Villa": [
        "https://images.unsplash.com/photo-1613490900233-08ba5d54a7ee?w=800&q=80",
        "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800&q=80",
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80"
      ],
      "Land": [
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80"
      ]
    };
    const secondaryImages = [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80"
    ];

    for (let i = 2; i <= 60; i++) {
      const type = propertyTypes[i % propertyTypes.length];
      const primaryImg = typeImages[type][i % typeImages[type].length];
      const secImg = secondaryImages[i % secondaryImages.length];

      const isLand = type === "Land";
      const isCommercial = type === "Commercial";
      const hasBuilding = !isLand;

      const statuses = ["available", "occupied", "under_offer", "maintenance", "off_market"] as const;
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      // Give them a random subset of amenities
      const allAmenities = [
        "Swimming Pool", "Gym / Fitness Center", "Backup Generator", "Borehole Water Supply",
        "High-Speed Elevators", "24/7 Security", "CCTV Surveillance", "Ample Parking",
        "Children's Play Area", "Clubhouse", "Fitted Kitchen", "Balcony",
        "Electric Fence", "Servant Quarters (DSQ)", "Solar Water Heating", "Internet / Fiber Ready",
        "Garden / Landscaping", "Paved Driveway", "Commercial Zoning", "Office Partitioning", "Boundary Wall"
      ];
      const propAmenities = [];
      const numAmenities = Math.floor(Math.random() * 5) + (isLand ? 1 : 4);
      const shuffled = [...allAmenities].sort(() => 0.5 - Math.random());
      for (let j = 0; j < numAmenities; j++) {
        propAmenities.push(shuffled[j]);
      }

      propsToInsert.push({
        entityId: groupEntity.id,
        propertyCode: `PROP-AUTO-${i.toString().padStart(3, '0')}`,
        name: `Premium ${type} ${i}`,
        propertyType: type,
        listingType: i % 3 === 0 ? "sale" : "let",
        status: randomStatus,
        location: i % 2 === 0 ? "Kilimani, Nairobi" : "Nairobi CBD",
        ownerContactId: i % 2 === 0 ? landlordB.id : landlordA.id,
        monthlyRentKes: (Math.floor(Math.random() * 20) * 10000 + 50000).toString() + ".00",
        bedrooms: hasBuilding && !isCommercial ? Math.floor(Math.random() * 5) + 1 : null,
        bathrooms: hasBuilding && !isCommercial ? Math.floor(Math.random() * 4) + 1 : null,
        sizeSqft: hasBuilding ? Math.floor(Math.random() * 2000) + 1000 : null,
        landAreaSqft: isLand || type === "Villa" || type === "House" ? Math.floor(Math.random() * 10000) + 2000 : null,
        yearBuilt: hasBuilding ? 2010 + Math.floor(Math.random() * 13) : null,
        parkingSpaces: hasBuilding ? Math.floor(Math.random() * 10) : null,
        amenities: propAmenities,
        description: `This exceptional ${type.toLowerCase()} offers unparalleled value in a highly sought-after location. Ideal for discerning clients looking for premium real estate.`,
        media: [
          { url: primaryImg, alt: `${type} exterior view`, isPrimary: true },
          { url: secImg, alt: "Interior view" }
        ]
      });
    }

    const insertedProps = await db
      .insert(properties)
      .values(propsToInsert)
      .returning();

    const propComm = insertedProps[0];
    const propRes = insertedProps[1];

    console.log("Created 2 properties.");

    // 5b. Create pipeline leads - spans this-week/this-month/last-month so the
    // executive overview's CRM metrics (closed deals, active pipeline, new
    // leads, conversion) have real, non-zero data to compute from instead of
    // showing an all-zero dashboard on a fresh seed.
    console.log("Step 5b: Populating sales pipeline...");
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
    await db.insert(leads).values([
      {
        entityId: groupEntity.id,
        title: "3BR Apartment Inquiry - Kilimani",
        stage: "inquiry",
        assignedToId: lineManagerUser.id,
        expectedValueKes: "14000000.00",
        probability: 10,
        createdAt: daysAgo(2),
      },
      {
        entityId: groupEntity.id,
        title: "Office Space Lease - Westlands",
        stage: "qualification",
        propertyId: propComm.id,
        assignedToId: lineManagerUser.id,
        expectedValueKes: "4200000.00",
        probability: 25,
        createdAt: daysAgo(5),
      },
      {
        entityId: groupEntity.id,
        title: "Villa Purchase - Karen",
        stage: "viewing",
        assignedToId: lineManagerUser.id,
        expectedValueKes: "62000000.00",
        probability: 40,
        createdAt: daysAgo(12),
      },
      {
        entityId: groupEntity.id,
        title: "Retail Unit - CBD",
        stage: "offer",
        assignedToId: lineManagerUser.id,
        expectedValueKes: "9500000.00",
        probability: 60,
        createdAt: daysAgo(18),
      },
      {
        entityId: groupEntity.id,
        title: "Land Sale - Ruiru",
        stage: "negotiation",
        assignedToId: lineManagerUser.id,
        expectedValueKes: "18000000.00",
        probability: 75,
        createdAt: daysAgo(20),
      },
      {
        entityId: groupEntity.id,
        title: "Nexus Tech Office Lease",
        stage: "closed_won",
        contactId: tenantA.id,
        propertyId: propComm.id,
        assignedToId: lineManagerUser.id,
        expectedValueKes: "4200000.00",
        probability: 100,
        createdAt: daysAgo(25),
        closedAt: daysAgo(10),
      },
      {
        entityId: groupEntity.id,
        title: "Riverside Apartment Sale",
        stage: "closed_won",
        assignedToId: lineManagerUser.id,
        expectedValueKes: "8500000.00",
        probability: 100,
        createdAt: daysAgo(50),
        closedAt: daysAgo(35),
      },
      {
        entityId: groupEntity.id,
        title: "Industrial Warehouse Deal",
        stage: "closed_lost",
        assignedToId: lineManagerUser.id,
        expectedValueKes: "16000000.00",
        probability: 0,
        lostReason: "Budget constraints on buyer side",
        createdAt: daysAgo(28),
        closedAt: daysAgo(8),
      },
    ]);
    console.log("Created 8 pipeline leads across the funnel.");

    // 6. Create Leases
    console.log("Step 6: Executing lease agreements...");
    const startsAt = new Date();
    startsAt.setMonth(startsAt.getMonth() - 2);
    const endsAt = new Date();
    endsAt.setFullYear(endsAt.getFullYear() + 1);

    const [leaseA, leaseB] = await db
      .insert(leases)
      .values([
        {
          entityId: groupEntity.id,
          propertyId: propComm.id,
          tenantContactId: tenantA.id,
          startsAt,
          endsAt,
          monthlyRentKes: "350000.00",
          depositKes: "700000.00",
          isActive: true,
        },
        {
          entityId: groupEntity.id,
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

    console.log("Created 2 active leases.");

    // 7. Create Transactions
    console.log("Step 7: Generating ledger transactions...");
    const txs: (typeof transactions.$inferInsert)[] = [
      {
        entityId: groupEntity.id,
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
        entityId: groupEntity.id,
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
        entityId: groupEntity.id,
        type: "expense",
        contactId: landlordA.id,
        propertyId: propComm.id,
        amountKes: "45000.00",
        occurredAt: new Date(),
        recordedById: financeOfficerUser.id,
        notes: "Elevator repair maintenance cost - Westlands Plaza",
      },
    ];

    for (let i = 0; i < 30; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() - Math.floor(Math.random() * 120)); // Last 4 months
      txs.push({
        entityId: groupEntity.id,
        type: Math.random() > 0.3 ? "rent" : "expense",
        contactId: Math.random() > 0.5 ? tenantA.id : tenantB.id,
        propertyId: Math.random() > 0.5 ? propComm.id : propRes.id,
        amountKes: (Math.floor(Math.random() * 50) * 10000 + 50000).toString() + ".00",
        occurredAt: dt,
        recordedById: financeOfficerUser.id,
        notes: "Auto-generated transaction " + i,
      });
    }
    await db.insert(transactions).values(txs);

    console.log("Created 3 initial transactions.");

    // 8. Create Approval Requests
    console.log("Step 8: Populating dynamic approvals queue...");
    await db.insert(approvalRequests).values([
      {
        entityId: groupEntity.id,
        requestType: "petty_cash",
        relatedTable: "transactions",
        relatedId: leaseA.id, // using lease id for demonstration
        requestedById: financeOfficerUser.id,
        amountKes: "6000.00",
        requiredApproverRole: "gm",
        status: "pending",
        decisionNotes: "Needs GM verification for office stationaries above threshold.",
      },
      {
        entityId: groupEntity.id,
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

    console.log("Created 2 pending approval requests.");

    // 9. Activity Logs
    console.log("Step 9: Writing initial system activity audit logs...");
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

    // 10. Cross-Department Projects - real rows behind the Overview's
    // "Cross-Department Operations" panel and the /admin/projects page,
    // replacing what used to be hardcoded example JSX.
    console.log("Step 10: Populating cross-department projects...");
    const now = new Date();
    const daysFromNow = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString().split("T")[0];
    const eventDaysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

    const [recruitmentProject, escrowProject, safetyAuditProject, payrollMigrationProject, onboardingProject] =
      await db
        .insert(projects)
        .values([
          {
            entityId: groupEntity.id,
            title: "Q3 Broker Recruitment Drive",
            description: "Interviewing 12 candidates for the commercial sector.",
            department: "sales",
            status: "in_progress",
            progressPercent: 60,
            assigneeIds: [salesAgent1User.id, salesAgent2User.id],
            createdById: gmUser.id,
          },
          {
            entityId: groupEntity.id,
            title: "Escrow Clearance: Muthaiga Estate",
            description: "Finalizing deed transfers and tax documentation.",
            department: "legal",
            status: "awaiting_review",
            assigneeIds: [legalOfficerUser.id, financeHeadUser.id],
            createdById: financeHeadUser.id,
          },
          {
            entityId: groupEntity.id,
            title: "Routine Safety Audits",
            description: "Inspecting 4 multi-family complexes in Westlands.",
            department: "ops",
            status: "planning",
            assigneeIds: [propertyManager1User.id],
            dueDate: daysFromNow(14),
            createdById: pmUser.id,
          },
          {
            entityId: groupEntity.id,
            title: "Payroll System Migration",
            description: "Moving statutory calculations onto the new ledger module.",
            department: "finance",
            status: "in_progress",
            progressPercent: 35,
            assigneeIds: [financeHeadUser.id],
            createdById: financeHeadUser.id,
          },
          {
            entityId: groupEntity.id,
            title: "New Hire Onboarding Playbook",
            description: "Standardizing the first-week checklist across departments.",
            department: "hr",
            status: "on_hold",
            assigneeIds: [hrHeadUser.id],
            dueDate: daysFromNow(30),
            createdById: hrHeadUser.id,
          },
        ])
        .returning();

    console.log("Created 5 cross-department projects.");

    // 11. Calendar Events - real cross-department schedules, some linked to
    // the projects above, spanning every event type, plus one already-past
    // event left at outcome="pending" so the disposition flow has something
    // real to surface on first load.
    console.log("Step 11: Populating cross-department calendar events...");
    await db.insert(calendarEvents).values([
      {
        entityId: groupEntity.id,
        title: "Executive Team Sync",
        description: "Weekly leadership standup.",
        type: "internal",
        startsAt: new Date(now.getTime() + 3_600_000),
        endsAt: new Date(now.getTime() + 5_400_000),
        location: "HQ Boardroom",
        organizerId: ceoUser.id,
        attendees: [
          { name: gmUser.name, userId: gmUser.id },
          { name: financeHeadUser.name, userId: financeHeadUser.id },
        ],
      },
      {
        entityId: groupEntity.id,
        title: "Client Viewing - Muthaiga Estate",
        description: "Walkthrough with the incoming buyer's counsel.",
        type: "external",
        startsAt: new Date(now.getTime() + 2 * 86_400_000),
        endsAt: new Date(now.getTime() + 2 * 86_400_000 + 3_600_000),
        location: "Muthaiga Estate",
        organizerId: salesAgent1User.id,
        attendees: [{ name: "External Buyer Counsel" }],
        projectId: escrowProject.id,
      },
      {
        entityId: groupEntity.id,
        title: "Escrow Signing - Muthaiga Estate",
        description: "Deed transfer signature and tax documentation handoff.",
        type: "legal",
        startsAt: new Date(now.getTime() + 5 * 86_400_000),
        endsAt: new Date(now.getTime() + 5 * 86_400_000 + 5_400_000),
        location: "Legal Office",
        organizerId: legalOfficerUser.id,
        attendees: [{ name: financeHeadUser.name, userId: financeHeadUser.id }],
        projectId: escrowProject.id,
      },
      {
        entityId: groupEntity.id,
        title: "Site Inspection - Westlands Plaza",
        description: "Routine safety audit walkthrough.",
        type: "maintenance",
        startsAt: new Date(now.getTime() + 3 * 86_400_000),
        endsAt: new Date(now.getTime() + 3 * 86_400_000 + 7_200_000),
        location: "Westlands Plaza",
        organizerId: propertyManager1User.id,
        attendees: [{ name: propertyManager2User.name, userId: propertyManager2User.id }],
        projectId: safetyAuditProject.id,
      },
      {
        entityId: groupEntity.id,
        title: "Recruitment Panel - Commercial Sector",
        description: "Second-round interviews for the Q3 broker drive.",
        type: "internal",
        startsAt: new Date(now.getTime() + 4 * 86_400_000),
        endsAt: new Date(now.getTime() + 4 * 86_400_000 + 7_200_000),
        location: "HQ - Interview Room 2",
        organizerId: gmUser.id,
        attendees: [{ name: salesAgent2User.name, userId: salesAgent2User.id }],
        projectId: recruitmentProject.id,
      },
      {
        entityId: groupEntity.id,
        title: "Payroll Migration Checkpoint",
        description: "Review statutory calculation parity before cutover.",
        type: "internal",
        startsAt: eventDaysAgo(3),
        endsAt: new Date(eventDaysAgo(3).getTime() + 3_600_000),
        location: "Finance Office",
        organizerId: financeHeadUser.id,
        attendees: [],
        projectId: payrollMigrationProject.id,
        outcome: "completed",
      },
      {
        entityId: groupEntity.id,
        title: "Onboarding Playbook Kickoff",
        description: "Initial scoping session - since deferred pending Q3 headcount plan.",
        type: "internal",
        startsAt: eventDaysAgo(2),
        endsAt: new Date(eventDaysAgo(2).getTime() + 3_600_000),
        location: "HR Office",
        organizerId: hrHeadUser.id,
        attendees: [],
        projectId: onboardingProject.id,
        // Deliberately left at the default "pending" outcome - this is the
        // seeded example of an event whose day has passed without a
        // resolution, so needsDisposition renders true on first load.
      },
    ]);

    console.log("Created 7 calendar events.");

    console.log("--------------------------------------------------");
    console.log("Database Seed Finished Successfully!");
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("Database seeding failed:", error);
    throw error;
  }
}

// drizzle-orm/neon-serverless's Pool keeps a WebSocket connection open (unlike
// the old neon-http transport, which was stateless per-request) - the process
// won't exit on its own once runSeed() resolves, so this script must do it.
runSeed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
