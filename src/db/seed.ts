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

import { inArray, eq } from "drizzle-orm";
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
  remittanceAdvices,
  propertyUnits,
} from "@/db/schema";
import { randomBytes } from "crypto";
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
    await db.delete(remittanceAdvices);
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
          avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80",
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
          avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
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
        avatarUrl: "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=400&q=80",
        source: "Direct Referral",
        assignedToId: ceoUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "landlord",
        displayName: "Margaret Wambui",
        email: "margaret@wambui.me",
        phone: "+254733111222",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
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
        avatarUrl: "https://images.unsplash.com/photo-1549692520-acc6669e2f0c?w=400&q=80",
        source: "Listing Portal",
        assignedToId: financeOfficerUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "tenant",
        displayName: "Alice Odhiambo",
        email: "alice@odhiambo.co.ke",
        phone: "+254700333444",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
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
        avatarUrl: [
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80",
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
          "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&q=80",
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80",
          "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80"
        ][i % 8],
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
        description: "A premium Grade-A commercial office suite situated in the prestigious heart of Westlands, Nairobi's premier business district.\n\nThis meticulously designed 2,400 sq.ft space offers an unparalleled corporate environment, featuring open-plan flexibility alongside executive private offices. The property boasts full-capacity backup power generation, guaranteeing zero downtime for mission-critical operations. High-speed, multi-provider fiber connectivity is pre-installed, ensuring seamless global communications from day one.\n\nTenants enjoy exclusive access to dedicated, secure basement parking, with 5 reserved bays included in the lease. The building is serviced by high-speed, intelligent elevators that minimize wait times even during peak hours. Security is paramount, with 24/7 manned guarding, comprehensive CCTV surveillance covering all common areas, and restricted biometric access control.\n\nThe Plaza is perfectly zoned for commercial use and sits within walking distance of high-end dining, luxury hotels, and major financial institutions, offering the ultimate convenience for your team and visiting clients.",
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
      {
        entityId: groupEntity.id,
        propertyCode: "PROP-RES-088",
        name: "The Sovereign Riverside Penthouse",
        propertyType: "Residential",
        listingType: "Rental",
        status: "available",
        location: "Riverside Drive, Nairobi",
        ownerContactId: landlordB.id,
        monthlyRentKes: "450000.00",
        sizeSqft: 4200,
        yearBuilt: 2024,
        parkingSpaces: 3,
        amenities: [
          "Smart Home Automation",
          "Private Plunge Pool",
          "Rooftop Infinity Pool (Shared)",
          "Fully Fitted Bosch Kitchen",
          "DSQ with Separate Entrance",
          "Panoramic Floor-to-Ceiling Windows",
          "Centralized Air Conditioning",
          "Biometric Fingerprint Access",
          "24/7 Concierge Service",
          "State-of-the-Art Gymnasium",
          "Spa and Sauna",
          "Backup Generator (Full Load)",
          "Borehole Water Supply",
          "High-Speed Fiber Internet",
          "EV Charging Stations"
        ],
        description: "An architectural masterpiece redefining luxury living in Nairobi, The Sovereign Riverside Penthouse offers an unparalleled residential experience. Perched atop the city's most exclusive new development on Riverside Drive, this expansive 4,200 sq.ft, four-bedroom residence delivers breathtaking, uninterrupted 360-degree views of the Nairobi skyline and lush canopy below.\n\nDesigned for the most discerning tenant, the penthouse features a sprawling open-concept living and dining area, wrapped in floor-to-ceiling double-glazed acoustic glass that ensures absolute tranquility. The chef-grade kitchen is a culinary dream, arriving fully fitted with top-of-the-line integrated Bosch appliances, custom European cabinetry, and a stunning Calacatta marble waterfall island. Entertainment is effortless with a seamless flow onto the massive wrap-around terrace, complete with a private, temperature-controlled plunge pool.\n\nThe master suite operates as a private sanctuary, boasting a custom walk-in dressing room, a spa-inspired en-suite bathroom with a freestanding soaking tub, dual rain showers, and premium fixtures. Every room is fully integrated with a cutting-edge smart home automation system, allowing you to control lighting, climate, automated blinds, and multi-room audio straight from your smartphone or the central control hub.\n\nResidents enjoy access to world-class communal amenities including a rooftop infinity pool, a commercial-grade fitness center, a dedicated yoga studio, and a wellness spa. Security is military-grade, featuring multi-tier biometric access, 24/7 CCTV surveillance, and a round-the-clock dedicated concierge and management team. The property includes a self-contained domestic staff quarter (DSQ) with a discrete entrance and three reserved premium parking bays equipped with EV charging capabilities.",
        media: [
          { url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80", alt: "Penthouse exterior and terrace", isPrimary: true },
          { url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80", alt: "Luxury open-plan living room" },
          { url: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80", alt: "Fitted designer kitchen with marble island" },
          { url: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80", alt: "Master bedroom with floor-to-ceiling windows" },
          { url: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=80", alt: "Spa-inspired en-suite bathroom" }
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
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
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

    // 5a. Management mandates + Property Manager assignments - permanent (not
    // an ephemeral enrichment script) since assignedPmId backs the Properties
    // board's manager mini-cards/column and the manager profile drawer;
    // wiping mandates on every reseed without a reinsert left those surfaces
    // pointing at nothing. isFeatured is also set here (the base insert never
    // sets it), preferring properties that also carry a mandate + manager so
    // the featured carousel's landlord/manager mini-cards always render real
    // data rather than an "Unassigned" state.
    console.log("Step 5a: Establishing management mandates and PM assignments...");
    const pmRoster = [lineManagerUser, propertyManager1User, propertyManager2User, salesAgent1User, salesAgent2User];
    const featuredExtraIdx = [5, 12, 20, 30, 42];
    const mandatedExtraIdx = [...featuredExtraIdx, 7, 15, 25];

    await db.update(properties).set({ isFeatured: true }).where(
      inArray(properties.id, [propComm.id, propRes.id, ...featuredExtraIdx.map((i) => insertedProps[i].id)]),
    );

    const mandateStartDate = new Date();
    mandateStartDate.setMonth(mandateStartDate.getMonth() - 6);
    // Removed propComm from activeMandateProps so it can be pending_approval instead
    const activeMandateProps = [propRes, ...mandatedExtraIdx.map((i) => insertedProps[i])];
    // propRes is deliberately the one active, real multi-unit mandate in dev
    // data (every other active mandate below is unitCount 1) - gives the
    // Mandate File's Units & Tenants tab a genuine multi-unit, mixed
    // occupied/vacant scenario to render against real property_units rows.
    const propResUnitBreakdown = [
      { unitType: "2 Bedroom", count: 8, monthlyRentKes: "45000.00" },
      { unitType: "3 Bedroom", count: 4, monthlyRentKes: "65000.00" },
    ];
    await db.update(properties).set({ unitBreakdown: propResUnitBreakdown }).where(eq(properties.id, propRes.id));

    const activeMandatesToInsert: (typeof propertyMandates.$inferInsert)[] = activeMandateProps.map((p, i) => ({
      entityId: groupEntity.id,
      propertyId: p.id,
      landlordContactId: p.ownerContactId!,
      // Every 5th mandate stays unassigned so the "Unassigned" empty state
      // (grid card / table / drawer trigger) also has real data to exercise.
      assignedPmId: i % 5 === 4 ? null : pmRoster[i % pmRoster.length].id,
      mandateRate: "0.1000",
      unitCount: p.id === propRes.id ? 12 : 1,
      startDate: mandateStartDate,
      status: "active",
    }));
    const insertedActiveMandates = await db.insert(propertyMandates).values(activeMandatesToInsert).returning();

    // Real property_units rows for propRes, generated the same way
    // generateUnitsFromBreakdown would - the first "2 Bedroom" unit is
    // reserved here to be occupied by the real lease Step 6 creates below;
    // the other 11 stay vacant with their own real rent figures.
    const propResUnitsToInsert: (typeof propertyUnits.$inferInsert)[] = [];
    let propResUnitCounter = 1;
    for (const entry of propResUnitBreakdown) {
      for (let i = 0; i < entry.count; i++) {
        propResUnitsToInsert.push({
          entityId: groupEntity.id,
          propertyId: propRes.id,
          unitLabel: `${entry.unitType} ${propResUnitCounter}`,
          unitType: entry.unitType,
          monthlyRentKes: entry.monthlyRentKes,
          status: "vacant",
        });
        propResUnitCounter++;
      }
    }
    const insertedPropResUnits = await db.insert(propertyUnits).values(propResUnitsToInsert).returning();
    const propResOccupiedUnit = insertedPropResUnits[0];

    // Make propComm have a pending mandate and critical maintenance request
    const pendingProp1 = propComm;
    const [pendingMandate1] = await db
      .insert(propertyMandates)
      .values({
        entityId: groupEntity.id,
        propertyId: pendingProp1.id,
        landlordContactId: pendingProp1.ownerContactId!,
        assignedPmId: propertyManager1User.id,
        mandateRate: "0.1500",
        rateJustification: "Premium commercial management rate.",
        unitCount: 24,
        startDate: new Date(),
        status: "pending_approval",
      })
      .returning();
    await db.insert(approvalRequests).values({
      entityId: groupEntity.id,
      requestType: "mandate_activation",
      relatedTable: "property_mandates",
      relatedId: pendingMandate1.id,
      requestedById: propertyManager1User.id,
      requiredApproverRole: "gm",
      status: "pending",
    });

    await db.insert(maintenanceRequests).values({
      entityId: groupEntity.id,
      propertyId: propComm.id,
      title: "Elevator breakdown in block A",
      description: "Main passenger elevator is stuck between floors.",
      priority: "critical",
      status: "open",
      reportedByContactId: tenantA.id,
    });

    const pendingProp = insertedProps[35];
    const [pendingMandate] = await db
      .insert(propertyMandates)
      .values({
        entityId: groupEntity.id,
        propertyId: pendingProp.id,
        landlordContactId: pendingProp.ownerContactId!,
        assignedPmId: propertyManager1User.id,
        mandateRate: "0.1200",
        rateJustification: "Larger multi-unit block - above-standard servicing effort.",
        unitCount: 14,
        startDate: new Date(),
        status: "pending_approval",
      })
      .returning();
    await db.insert(approvalRequests).values({
      entityId: groupEntity.id,
      requestType: "mandate_activation",
      relatedTable: "property_mandates",
      relatedId: pendingMandate.id,
      requestedById: propertyManager1User.id,
      requiredApproverRole: "gm",
      status: "pending",
    });

    const terminatedProp = insertedProps[45];
    await db.insert(propertyMandates).values({
      entityId: groupEntity.id,
      propertyId: terminatedProp.id,
      landlordContactId: terminatedProp.ownerContactId!,
      assignedPmId: salesAgent2User.id,
      mandateRate: "0.1000",
      unitCount: 1,
      startDate: mandateStartDate,
      endDate: new Date(),
      status: "terminated",
    });

    console.log(`Created ${activeMandatesToInsert.length + 3} management mandates (active/pending/terminated) with PM assignments, and marked ${2 + featuredExtraIdx.length} properties as featured.`);

    // 5a2. Seed one pending remittance advice against the first active
    // mandate (propRes) so the Mandate File's remittance panel / release-
    // flag flow, and the Leases Board's "remittance pending" indicator, are
    // both exercisable without generating one by hand first.
    const remittancePeriodStart = new Date();
    remittancePeriodStart.setDate(1);
    const remittanceCollected = 285000;
    const remittanceFee = remittanceCollected * 0.1;
    const remittanceExpenses = 12500;
    const remittanceToken = randomBytes(24).toString("base64url");
    const [seededRemittance] = await db
      .insert(remittanceAdvices)
      .values({
        entityId: groupEntity.id,
        mandateId: insertedActiveMandates[0].id,
        periodStart: remittancePeriodStart,
        periodEnd: new Date(),
        collectedKes: remittanceCollected.toFixed(2),
        managementFeeKes: remittanceFee.toFixed(2),
        expensesKes: remittanceExpenses.toFixed(2),
        netRemittanceKes: (remittanceCollected - remittanceFee - remittanceExpenses).toFixed(2),
        status: "pending",
        verificationToken: remittanceToken,
        generatedById: propertyManager1User.id,
      })
      .returning();
    await db.insert(reportExports).values({
      entityId: groupEntity.id,
      reportType: "remittance_advice",
      generatedById: propertyManager1User.id,
      verificationToken: remittanceToken,
      snapshot: {
        remittanceAdviceId: seededRemittance.id,
        mandateId: insertedActiveMandates[0].id,
        property: propRes.name,
        periodStart: remittancePeriodStart.toISOString().split("T")[0],
        periodEnd: new Date().toISOString().split("T")[0],
        collectedKes: remittanceCollected,
        managementFeeKes: remittanceFee,
        expensesKes: remittanceExpenses,
        netRemittanceKes: remittanceCollected - remittanceFee - remittanceExpenses,
        generatedBy: propertyManager1User.name,
      },
    });
    console.log("Seeded 1 pending remittance advice.");

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

    const allTenants = await db
      .select()
      .from(contacts)
      .where(eq(contacts.type, "tenant"));

    // propRes's lease is deliberately given a near-term end date so the
    // Leases Board's "expiring soon" Needs Attention branch has real data in dev.
    const expiringSoonEndsAt = new Date();
    expiringSoonEndsAt.setDate(expiringSoonEndsAt.getDate() + 18);

    const leasesToInsert = activeMandateProps.map((p, idx) => {
      const tenant = allTenants[idx % allTenants.length];
      const isPropRes = p.id === propRes.id;
      // propRes's lease rents the real occupied unit specifically, not the
      // property-level flat rent field, now that it has real per-unit rents.
      const rentAmount = isPropRes ? propResOccupiedUnit.monthlyRentKes! : (p.monthlyRentKes || "120000.00");
      const depositAmount = (parseFloat(rentAmount) * 2).toString() + ".00";

      return {
        entityId: groupEntity.id,
        propertyId: p.id,
        unitId: isPropRes ? propResOccupiedUnit.id : undefined,
        tenantContactId: tenant.id,
        startsAt,
        endsAt: isPropRes ? expiringSoonEndsAt : endsAt,
        monthlyRentKes: rentAmount,
        depositKes: depositAmount,
        isActive: true,
      };
    });

    if (!activeMandateProps.some(p => p.id === propComm.id)) {
      leasesToInsert.push({
        entityId: groupEntity.id,
        propertyId: propComm.id,
        unitId: undefined,
        tenantContactId: tenantA.id,
        startsAt,
        endsAt,
        monthlyRentKes: "350000.00",
        depositKes: "700000.00",
        isActive: true,
      });
    }

    const insertedLeases = await db
      .insert(leases)
      .values(leasesToInsert)
      .returning();

    const leaseA = insertedLeases.find(l => l.propertyId === propComm.id) || insertedLeases[0];
    const leaseB = insertedLeases.find(l => l.propertyId === propRes.id) || insertedLeases[1];

    // Sync the occupied unit's status/currentLeaseId to the real lease id
    // now that it exists - mirrors what createLease's service-layer logic
    // does for a unit-scoped lease, done directly here since seed data
    // bypasses the service layer entirely.
    await db
      .update(propertyUnits)
      .set({ status: "occupied", currentLeaseId: leaseB.id })
      .where(eq(propertyUnits.id, propResOccupiedUnit.id));

    console.log(`Created ${insertedLeases.length} active leases (1 unit-scoped for propRes; 11 other propRes units remain vacant).`);

    // 7. Create Transactions
    console.log("Step 7: Generating ledger transactions...");
    const txs: (typeof transactions.$inferInsert)[] = [];

    // Add a rent payment for this current month for every active lease EXCEPT
    // propComm's, which is deliberately left unpaid so the Leases Board's
    // "overdue balance" Needs Attention branch + KPI have real data in dev.
    insertedLeases.forEach((l) => {
      if (l.propertyId === propComm.id) return;
      const collectedAmount = parseFloat(l.monthlyRentKes);
      txs.push({
        entityId: groupEntity.id,
        type: "rent",
        contactId: l.tenantContactId,
        propertyId: l.propertyId,
        leaseId: l.id,
        amountKes: collectedAmount.toFixed(2),
        occurredAt: new Date(), // Today (this month)
        recordedById: financeOfficerUser.id,
        notes: `Rent payment - current month`,
      });
    });

    // Add some random historical rent/expense transactions distributed across all mandated properties
    for (let i = 0; i < 40; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() - (Math.floor(Math.random() * 120) + 5)); // 5 to 125 days ago
      const randomLease = insertedLeases[i % insertedLeases.length];
      // leaseA (propComm) is deliberately left unpaid for the current month above;
      // never let this loop backfill a "rent" entry for it, since a randomly-picked
      // recent date could still fall inside the current month and mask the arrears.
      const isRent = randomLease.id === leaseA.id ? false : Math.random() > 0.3;
      const rentVal = parseFloat(randomLease.monthlyRentKes);
      const val = isRent ? rentVal : Math.floor(Math.random() * 15) * 5000 + 5000;

      txs.push({
        entityId: groupEntity.id,
        type: isRent ? "rent" : "expense",
        contactId: isRent ? randomLease.tenantContactId : landlordA.id,
        propertyId: randomLease.propertyId,
        leaseId: isRent ? randomLease.id : null,
        amountKes: val.toFixed(2),
        occurredAt: dt,
        recordedById: financeOfficerUser.id,
        notes: `Auto-generated historical ${isRent ? "rent" : "expense"} ` + i,
      });
    }

    await db.insert(transactions).values(txs);

    console.log("Created all transactions and rent ledger entries.");

    // 7b. Create Maintenance Requests and Documents
    console.log("Step 7b: Generating maintenance requests and property documents...");
    await db.insert(maintenanceRequests).values([
      {
        entityId: groupEntity.id,
        propertyId: propComm.id,
        title: "Main generator electrical fault",
        priority: "critical",
        status: "open",
        description: "The main backup generator is failing to auto-start during grid blackouts. Needs urgent technician attention.",
        reportedByContactId: tenantA.id,
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      },
      {
        entityId: groupEntity.id,
        propertyId: propRes.id,
        title: "Master bathroom plumbing leak",
        priority: "high",
        status: "in_progress",
        description: "Water leaking under the sink, causing dampness in the cabinets.",
        reportedByContactId: tenantB.id,
        createdAt: new Date(Date.now() - 5 * 86_400_000),
      }
    ]);

    await db.insert(documents).values([
      {
        entityId: groupEntity.id,
        propertyId: propComm.id,
        ownerContactId: landlordA.id,
        title: "Signed Management Mandate - Nexus Office Plaza",
        type: "mandate_letter",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/mandate_nexus.pdf",
        uploadedById: financeOfficerUser.id,
        metadata: { status: "signed" },
        createdAt: new Date(Date.now() - 180 * 86_400_000),
      }
    ]);

    console.log("Created maintenance requests and documents.");

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
    const hoursAgo = (n: number) => new Date(new Date().getTime() - n * 60 * 60 * 1000);
    const daysAgoTs = (n: number) => new Date(new Date().getTime() - n * 24 * 60 * 60 * 1000);

    // Seeded leases bypass the createLease/terminateLease service layer (and
    // therefore writeAudit), so the Leases Board's "Recent Lease Activity"
    // panel would otherwise show an empty state in dev. Insert realistic
    // activity rows directly, anchored on leaseA (propComm, deliberately
    // left unpaid above) and leaseB (propRes, deliberately expiring soon
    // above) so their narratives line up with the Needs Attention band.
    const leaseActivitySeed: (typeof activityLogs.$inferInsert)[] = [
      {
        entityId: groupEntity.id,
        actorId: pmUser.id,
        associatedType: "lease",
        associatedId: leaseA.id,
        action: "properties.lease.create",
        summary: "Lease agreement executed for commercial unit.",
        createdAt: daysAgoTs(60),
      },
      {
        entityId: groupEntity.id,
        actorId: financeOfficerUser.id,
        associatedType: "lease",
        associatedId: leaseA.id,
        action: "properties.lease.overdue_followup",
        summary: "Rent payment overdue — follow-up call logged with tenant.",
        createdAt: hoursAgo(6),
      },
      {
        entityId: groupEntity.id,
        actorId: pmUser.id,
        associatedType: "lease",
        associatedId: leaseB.id,
        action: "properties.lease.create",
        summary: "Lease agreement executed for residential unit.",
        createdAt: daysAgoTs(55),
      },
      {
        entityId: groupEntity.id,
        actorId: lineManagerUser.id,
        associatedType: "lease",
        associatedId: leaseB.id,
        action: "properties.lease.renewal_discussion",
        summary: "Renewal discussion initiated ahead of upcoming lease expiry.",
        createdAt: hoursAgo(30),
      },
    ];
    if (insertedLeases[2]) {
      leaseActivitySeed.push({
        entityId: groupEntity.id,
        actorId: pmUser.id,
        associatedType: "lease",
        associatedId: insertedLeases[2].id,
        action: "properties.lease.create",
        summary: "Lease agreement executed and tenant move-in inspection completed.",
        createdAt: daysAgoTs(48),
      });
    }
    if (insertedLeases[3]) {
      leaseActivitySeed.push({
        entityId: groupEntity.id,
        actorId: financeOfficerUser.id,
        associatedType: "lease",
        associatedId: insertedLeases[3].id,
        action: "finance.transaction.record",
        summary: "Current month rent collected in full.",
        createdAt: daysAgoTs(2),
      });
    }

    await db.insert(activityLogs).values([
      {
        entityId: groupEntity.id,
        actorId: ceoUser.id,
        associatedType: "entities",
        associatedId: groupEntity.id,
        action: "initialize_workspace",
        summary: "Demo Workspace has been successfully initialized and configured.",
      },
      ...leaseActivitySeed,
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
