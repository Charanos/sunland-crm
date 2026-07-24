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
  leadNotes,
  leases,
  maintenanceRequests,
  transactions,
  approvalRequests,
  notifications,
  notificationPrefs,
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
    // property_units.currentLeaseId <-> leases.unitId is a circular FK (added
    // when property_units was introduced) - break BOTH sides before either
    // table can be deleted, otherwise deleting either one fails with a
    // foreign key violation the moment any unit has ever been occupied.
    await db.update(propertyUnits).set({ currentLeaseId: null });
    await db.update(leases).set({ unitId: null });
    await db.delete(propertyUnits);
    await db.delete(leases);
    await db.delete(maintenanceRequests);
    await db.delete(leadNotes);
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
        verifiedAt: new Date(Date.now() - 90 * 86_400_000),
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
      // Sales Pipeline / Contacts CRM real-data variety (2026 CRM precision
      // rebuild) - the app's contact_type enum has 3 more real values
      // (buyer/seller/company) than the original seed ever used, and every
      // pipeline lead below needs a real contactId now that listLeads()
      // inner-joins contacts (a lead with no contactId is invisible on the
      // Sales Pipeline board, not just incomplete).
      {
        entityId: groupEntity.id,
        type: "buyer",
        displayName: "James Mwangi",
        email: "j.mwangi@gmail.com",
        phone: "+254712345001",
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
        source: "website",
        assignedToId: lineManagerUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "company",
        displayName: "Meridian Business Park Ltd",
        companyName: "Meridian Business Park Ltd",
        email: "leasing@meridianbp.co.ke",
        phone: "+254712345002",
        avatarUrl: "https://images.unsplash.com/photo-1549692520-acc6669e2f0c?w=400&q=80",
        source: "existing_client",
        assignedToId: lineManagerUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "buyer",
        displayName: "Daniel Kiptoo",
        email: "d.kiptoo@outlook.com",
        phone: "+254712345003",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
        source: "referral",
        assignedToId: lineManagerUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "buyer",
        displayName: "Grace Nyambura",
        email: "grace.nyambura@yahoo.com",
        phone: "+254712345004",
        avatarUrl: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&q=80",
        source: "walk_in",
        assignedToId: lineManagerUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "seller",
        displayName: "Samuel Kimani",
        email: "s.kimani@gmail.com",
        phone: "+254712345005",
        avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80",
        source: "cold_call",
        assignedToId: lineManagerUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "buyer",
        displayName: "Peter Otieno",
        email: "p.otieno@gmail.com",
        phone: "+254712345006",
        avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80",
        source: "website",
        assignedToId: lineManagerUser.id,
      },
      {
        entityId: groupEntity.id,
        type: "company",
        displayName: "Constructive Ventures Ltd",
        companyName: "Constructive Ventures Ltd",
        email: "info@constructiveventures.co.ke",
        phone: "+254712345007",
        avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80",
        source: "partner",
        assignedToId: lineManagerUser.id,
      },
    ];

    // Grown from i<=20 to i<=60 (56 generated + 4 explicit = 60 contacts) so
    // the much larger property/lease pool below (D2) has enough distinct
    // landlords/tenants to avoid unrealistic over-reuse of the same tenant
    // across many simultaneous active leases.
    for (let i = 5; i <= 60; i++) {
      const isLandlord = i % 2 === 0;
      contactsToInsert.push({
        entityId: groupEntity.id,
        type: isLandlord ? "landlord" : "tenant",
        displayName: isLandlord ? `Landlord Corp ${i}` : `Tenant Client ${i}`,
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
        // Variety for the landlord "Verified" badge - roughly a third of
        // generated landlords are verified, the rest (and every tenant) are not.
        verifiedAt: isLandlord && i % 6 === 0 ? new Date(Date.now() - (30 + i) * 86_400_000) : undefined,
      });
    }

    const insertedContacts = await db
      .insert(contacts)
      .values(contactsToInsert)
      .returning();
    const [landlordA, landlordB, tenantA, tenantB, buyerJames, companyMeridian, buyerDaniel, buyerGrace, sellerSamuel, buyerPeter, companyConstructive] = insertedContacts;

    console.log(`Created ${insertedContacts.length} contacts.`);

    // 5. Create Properties
    console.log("Step 5: Logging managed properties...");
    const propsToInsert: (typeof properties.$inferInsert)[] = [
      {
        entityId: groupEntity.id,
        propertyCode: "PROP-COMM-001",
        name: "Nexus Office Plaza",
        propertyType: "Commercial",
        listingType: "let",
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
        listingType: "let",
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
        listingType: "let",
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

    // Real landlord pool (not just landlordA/landlordB) so ownership - and
    // therefore mandate/expense attribution downstream in Step 7 - is spread
    // across many distinct contacts, matching the larger property count below.
    const allLandlordsForOwnership = await db.select().from(contacts).where(eq(contacts.type, "landlord"));

    // Grown from i<=60 to i<=130 (129 auto-generated + 3 explicit = 132
    // properties total, up from 62) per the D2 "grow meaningfully larger" pass.
    for (let i = 2; i <= 130; i++) {
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

      // Media variety: most properties get the usual 2 photos, but ~10% get
      // just 1 and ~10% get none at all - previously every property had
      // exactly 2 (or 5, for the explicit penthouse), with zero coverage of
      // the 0/1-photo states the property card/hero fallback logic handles.
      const media =
        i % 10 === 0
          ? []
          : i % 10 === 5
            ? [{ url: primaryImg, alt: `${type} exterior view`, isPrimary: true }]
            : [
              { url: primaryImg, alt: `${type} exterior view`, isPrimary: true },
              { url: secImg, alt: "Interior view" },
            ];

      propsToInsert.push({
        entityId: groupEntity.id,
        propertyCode: `PROP-AUTO-${i.toString().padStart(3, '0')}`,
        name: `Premium ${type} ${i}`,
        propertyType: type,
        listingType: i % 3 === 0 ? "sale" : "let",
        status: randomStatus,
        location: i % 2 === 0 ? "Kilimani, Nairobi" : "Nairobi CBD",
        ownerContactId: allLandlordsForOwnership[i % allLandlordsForOwnership.length].id,
        monthlyRentKes: (Math.floor(Math.random() * 20) * 10000 + 50000).toString() + ".00",
        bedrooms: hasBuilding && !isCommercial ? Math.floor(Math.random() * 5) + 1 : null,
        bathrooms: hasBuilding && !isCommercial ? Math.floor(Math.random() * 4) + 1 : null,
        sizeSqft: hasBuilding ? Math.floor(Math.random() * 2000) + 1000 : null,
        landAreaSqft: isLand || type === "Villa" || type === "House" ? Math.floor(Math.random() * 10000) + 2000 : null,
        yearBuilt: hasBuilding ? 2010 + Math.floor(Math.random() * 13) : null,
        parkingSpaces: hasBuilding ? Math.floor(Math.random() * 10) : null,
        amenities: propAmenities,
        description: `This exceptional ${type.toLowerCase()} offers unparalleled value in a highly sought-after location. Ideal for discerning clients looking for premium real estate.`,
        media,
      });
    }

    const insertedProps = await db
      .insert(properties)
      .values(propsToInsert)
      .returning();

    const propComm = insertedProps[0];
    const propRes = insertedProps[1];

    console.log(`Created ${insertedProps.length} properties.`);

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

    // D2: grown from 8 fixed active-mandate indices to a much larger pool so
    // a realistic majority of the (also grown) property list actually carries
    // a mandate, plus dedicated pools for the previously-zero-representation
    // draft/pending/terminated states.
    const draftExtraIdx = [50, 58, 66];
    const pendingExtraIdx2 = [74, 82];
    const terminatedExtraIdx2 = [90, 98];
    const reservedIdx = new Set([35, 45, ...draftExtraIdx, ...pendingExtraIdx2, ...terminatedExtraIdx2]);
    const additionalActiveIdx = Array.from({ length: 44 }, (_, k) => 3 + k * 2).filter((i) => !reservedIdx.has(i));
    const mandatedExtraIdx = Array.from(new Set([...featuredExtraIdx, ...additionalActiveIdx]));

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

    // Renewal-type/notice-period vocabulary for the optional mandate term
    // fields - previously populated on zero mandates anywhere in the seed.
    const renewalTypes = ["automatic", "manual", "negotiated"] as const;
    const activeMandatesToInsert: (typeof propertyMandates.$inferInsert)[] = activeMandateProps.map((p, i) => {
      // Every 4th non-propRes mandate gets its optional term fields populated,
      // so the Overview tab's term cards have real (not "Not yet configured")
      // data on a meaningful subset, not just the one property this was
      // previously retrofitted onto.
      const withTerms = p.id !== propRes.id && i % 4 === 0;
      return {
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
        maintenanceAuthorityKes: withTerms ? (Math.floor(Math.random() * 8) * 25000 + 50000).toFixed(2) : undefined,
        renewalType: withTerms ? renewalTypes[i % renewalTypes.length] : undefined,
        noticePeriodDays: withTerms ? [30, 60, 90][i % 3] : undefined,
        scopeDescription: withTerms
          ? "Full rent collection, tenant sourcing/vetting, routine maintenance coordination, and monthly remittance reporting to the landlord."
          : undefined,
      };
    });
    const insertedActiveMandates = await db.insert(propertyMandates).values(activeMandatesToInsert).returning();

    // Draft mandates - proposed but not yet submitted for approval. Zero
    // representation previously; "draft" is the mandateStatus column default
    // but nothing ever actually inserted one.
    const draftMandatesToInsert: (typeof propertyMandates.$inferInsert)[] = draftExtraIdx.map((idx) => {
      const p = insertedProps[idx];
      return {
        entityId: groupEntity.id,
        propertyId: p.id,
        landlordContactId: p.ownerContactId!,
        assignedPmId: null,
        mandateRate: "0.1000",
        unitCount: 1,
        startDate: new Date(),
        status: "draft",
      };
    });
    const insertedDraftMandates = await db.insert(propertyMandates).values(draftMandatesToInsert).returning();

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

    // Bugfix (confirmed via screenshot): every OTHER active-mandate property
    // (plus propComm) also needs a real property_units row, matching what
    // propRes already had. Without this, a property's mandate vitals could
    // honestly show "1/1 occupied, 100% rent collected" (computed from the
    // real lease/transactions) while the Units & Tenants tab - which reads
    // ONLY property_units, never falls back to the lease - showed "No units
    // recorded for this property yet": a real lease and real rent with zero
    // property_units backing it anywhere except propRes.
    const singleUnitProps = [...activeMandateProps.filter((p) => p.id !== propRes.id), propComm];
    const singleUnitsToInsert: (typeof propertyUnits.$inferInsert)[] = singleUnitProps.map((p) => ({
      entityId: groupEntity.id,
      propertyId: p.id,
      unitLabel: "Unit 1",
      unitType: p.propertyType,
      monthlyRentKes: p.monthlyRentKes || "120000.00",
      status: "vacant",
    }));
    const insertedSingleUnits = await db.insert(propertyUnits).values(singleUnitsToInsert).returning();
    const propertyUnitMap = new Map<string, typeof insertedSingleUnits[number]>();
    insertedSingleUnits.forEach((u, i) => propertyUnitMap.set(singleUnitProps[i].id, u));
    propertyUnitMap.set(propRes.id, propResOccupiedUnit);
    console.log(`Created ${insertedSingleUnits.length} single property_units rows (1 per non-propRes active mandate + propComm) so the Units & Tenants tab never diverges from the real lease/vitals data.`);

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
      status: "reported",
      category: "reactive",
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
    const terminatedMandatesToInsert: (typeof propertyMandates.$inferInsert)[] = [terminatedProp, ...terminatedExtraIdx2.map((i) => insertedProps[i])].map((p, i) => ({
      entityId: groupEntity.id,
      propertyId: p.id,
      landlordContactId: p.ownerContactId!,
      assignedPmId: salesAgent2User.id,
      mandateRate: "0.1000",
      unitCount: 1,
      startDate: mandateStartDate,
      // Spread termination dates so they're not all "today".
      endDate: new Date(Date.now() - (i * 20 + 5) * 86_400_000),
      status: "terminated",
    }));
    const insertedTerminatedMandates = await db.insert(propertyMandates).values(terminatedMandatesToInsert).returning();

    // Two more pending_approval mandates beyond the original propComm +
    // insertedProps[35], for more Decision Queue variety.
    const extraPendingMandatesToInsert: (typeof propertyMandates.$inferInsert)[] = pendingExtraIdx2.map((idx) => {
      const p = insertedProps[idx];
      return {
        entityId: groupEntity.id,
        propertyId: p.id,
        landlordContactId: p.ownerContactId!,
        assignedPmId: propertyManager2User.id,
        mandateRate: "0.1100",
        unitCount: 1,
        startDate: new Date(),
        status: "pending_approval",
      };
    });
    const insertedExtraPendingMandates = await db.insert(propertyMandates).values(extraPendingMandatesToInsert).returning();
    await db.insert(approvalRequests).values(
      insertedExtraPendingMandates.map((m) => ({
        entityId: groupEntity.id,
        requestType: "mandate_activation" as const,
        relatedTable: "property_mandates",
        relatedId: m.id,
        requestedById: propertyManager2User.id,
        requiredApproverRole: "gm" as const,
        status: "pending" as const,
      })),
    );

    console.log(
      `Created ${activeMandatesToInsert.length} active, ${draftMandatesToInsert.length} draft, ${2 + extraPendingMandatesToInsert.length} pending, and ${terminatedMandatesToInsert.length} terminated management mandates, and marked ${2 + featuredExtraIdx.length} properties as featured.`,
    );

    // 5a2. The pending remittance advice against propRes's mandate used to be
    // seeded here with hardcoded collected/fee/expense figures that had no
    // relationship to any real transaction - moved to after Step 7 (below),
    // once real transactions exist, so its numbers are genuinely derived.

    // 5b. Create pipeline leads - spans this-week/this-month/last-month so the
    // executive overview's CRM metrics (closed deals, active pipeline, new
    // leads, conversion) have real, non-zero data to compute from instead of
    // showing an all-zero dashboard on a fresh seed. Every lead now carries a
    // real contactId (listLeads() inner-joins contacts - a lead without one
    // is invisible on the Sales Pipeline board, not just incomplete) and real
    // priority/nextActionAt variety for the Contacts CRM's hot-leads and
    // follow-ups-due digests to have real content.
    console.log("Step 5b: Populating sales pipeline...");
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
    const hoursFromNow = (n: number) => new Date(Date.now() + n * 3_600_000);
    const [
      leadInquiry,
      leadQualification,
      leadViewing,
      leadOffer,
      leadNegotiation,
      leadClosedWon1,
      leadClosedWon2,
      leadClosedLost,
    ] = await db.insert(leads).values([
      {
        entityId: groupEntity.id,
        title: "3BR Apartment Inquiry - Kilimani",
        stage: "inquiry",
        priority: "medium",
        contactId: buyerJames.id,
        assignedToId: lineManagerUser.id,
        expectedValueKes: "14000000.00",
        probability: 10,
        nextActionAt: hoursFromNow(30),
        createdAt: daysAgo(2),
      },
      {
        entityId: groupEntity.id,
        title: "Office Space Lease - Westlands",
        stage: "qualification",
        priority: "high",
        contactId: companyMeridian.id,
        propertyId: propComm.id,
        assignedToId: lineManagerUser.id,
        expectedValueKes: "4200000.00",
        probability: 25,
        nextActionAt: hoursFromNow(-6),
        createdAt: daysAgo(5),
      },
      {
        entityId: groupEntity.id,
        title: "Villa Purchase - Karen",
        stage: "viewing",
        priority: "high",
        contactId: buyerDaniel.id,
        assignedToId: lineManagerUser.id,
        expectedValueKes: "62000000.00",
        probability: 40,
        nextActionAt: hoursFromNow(4),
        createdAt: daysAgo(12),
      },
      {
        entityId: groupEntity.id,
        title: "Retail Unit - CBD",
        stage: "offer",
        priority: "medium",
        contactId: buyerGrace.id,
        assignedToId: lineManagerUser.id,
        expectedValueKes: "9500000.00",
        probability: 60,
        createdAt: daysAgo(18),
      },
      {
        entityId: groupEntity.id,
        title: "Land Sale - Ruiru",
        stage: "negotiation",
        priority: "low",
        contactId: sellerSamuel.id,
        assignedToId: lineManagerUser.id,
        expectedValueKes: "18000000.00",
        probability: 75,
        createdAt: daysAgo(20),
      },
      {
        entityId: groupEntity.id,
        title: "Nexus Tech Office Lease",
        stage: "closed_won",
        priority: "medium",
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
        priority: "medium",
        contactId: buyerPeter.id,
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
        priority: "low",
        contactId: companyConstructive.id,
        assignedToId: lineManagerUser.id,
        expectedValueKes: "16000000.00",
        probability: 0,
        lostReason: "Budget constraints on buyer side",
        createdAt: daysAgo(28),
        closedAt: daysAgo(8),
      },
    ]).returning();
    console.log("Created 8 pipeline leads across the funnel.");

    // Real, persisted lead notes + file attachments (Sales Pipeline precision
    // rebuild) - a couple of leads get genuine multi-entry activity so the
    // deal-peek drawer's Notes/Files tabs have real content on first load.
    await db.insert(leadNotes).values([
      {
        entityId: groupEntity.id,
        leadId: leadViewing.id,
        authorId: lineManagerUser.id,
        text: "Buyer confirmed for a viewing this week - flexible on financing, wants to move fast if the layout works.",
        createdAt: daysAgo(1),
      },
      {
        entityId: groupEntity.id,
        leadId: leadNegotiation.id,
        authorId: lineManagerUser.id,
        text: "Seller's counsel reviewing the draft sale agreement - expecting redlines back by end of week.",
        createdAt: daysAgo(2),
      },
      {
        entityId: groupEntity.id,
        leadId: leadQualification.id,
        authorId: lineManagerUser.id,
        text: "Meridian's ops lead wants a second walkthrough before committing to headcount-based floor plan.",
        createdAt: daysAgo(1),
      },
    ]);
    await db.insert(documents).values([
      {
        entityId: groupEntity.id,
        leadId: leadNegotiation.id,
        type: "offer_letter",
        title: "Land Sale Agreement - Draft v2.pdf",
        fileUrl: "https://example.com/documents/ruiru-land-sale-draft-v2.pdf",
        uploadedById: lineManagerUser.id,
      },
      {
        entityId: groupEntity.id,
        leadId: leadOffer.id,
        type: "identification",
        title: "Buyer ID - Grace Nyambura.pdf",
        fileUrl: "https://example.com/documents/grace-nyambura-id.pdf",
        uploadedById: lineManagerUser.id,
      },
    ]);
    console.log("Created 3 lead notes and 2 lead-scoped documents.");

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

    // D2 lease variety: a mandate no longer automatically implies a lease
    // (some mandated properties are legitimately awaiting a tenant), and the
    // leases that do exist are tagged into profiles so the previously
    // zero-representation states (terminated, already-expired-while-still-
    // marked-active-elsewhere, null deposit) each get real rows.
    const leasesToInsert: (typeof leases.$inferInsert)[] = [];
    activeMandateProps.forEach((p, idx) => {
      const tenant = allTenants[idx % allTenants.length];
      const isPropRes = p.id === propRes.id;
      const unit = propertyUnitMap.get(p.id)!;

      if (!isPropRes && idx % 6 === 0) {
        // Mandated but still vacant - no lease row at all for this property;
        // its real property_units row (created above) correctly stays vacant.
        return;
      }

      const rentAmount = unit.monthlyRentKes!;
      const depositAmount = (parseFloat(rentAmount) * 2).toString() + ".00";
      const isTerminated = !isPropRes && idx % 11 === 1;
      const isExpiringSoon = !isPropRes && idx % 13 === 2;
      const isNullDeposit = !isPropRes && idx % 17 === 3;

      let leaseStartsAt = startsAt;
      let leaseEndsAt = isPropRes ? expiringSoonEndsAt : endsAt;
      let leaseIsActive = true;
      if (isTerminated) {
        leaseStartsAt = new Date(Date.now() - (240 + idx) * 86_400_000);
        leaseEndsAt = new Date(Date.now() - (10 + (idx % 50)) * 86_400_000);
        leaseIsActive = false;
      } else if (isExpiringSoon) {
        leaseEndsAt = new Date(Date.now() + (8 + (idx % 22)) * 86_400_000);
      }

      leasesToInsert.push({
        entityId: groupEntity.id,
        propertyId: p.id,
        unitId: unit.id,
        tenantContactId: tenant.id,
        startsAt: leaseStartsAt,
        endsAt: leaseEndsAt,
        monthlyRentKes: rentAmount,
        depositKes: isNullDeposit ? null : depositAmount,
        isActive: leaseIsActive,
      });
    });

    if (!activeMandateProps.some(p => p.id === propComm.id)) {
      const propCommUnit = propertyUnitMap.get(propComm.id)!;
      leasesToInsert.push({
        entityId: groupEntity.id,
        propertyId: propComm.id,
        unitId: propCommUnit.id,
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

    // Sync every unit-scoped ACTIVE lease's unit to occupied/currentLeaseId -
    // mirrors what createLease's service-layer logic does, done directly here
    // since seed data bypasses the service layer entirely. A terminated
    // lease's unit deliberately stays at its default "vacant" status (the
    // tenant moved out - a live lease pointer to a dead lease would be wrong).
    let unitsSynced = 0;
    for (const lease of insertedLeases) {
      if (!lease.unitId || !lease.isActive) continue;
      await db
        .update(propertyUnits)
        .set({ status: "occupied", currentLeaseId: lease.id })
        .where(eq(propertyUnits.id, lease.unitId));
      unitsSynced++;
    }

    const activeLeaseCount = insertedLeases.filter((l) => l.isActive).length;
    console.log(`Created ${insertedLeases.length} leases (${activeLeaseCount} active, ${insertedLeases.length - activeLeaseCount} terminated); synced ${unitsSynced} property_units rows to occupied (propRes: 1 of 12 units occupied, 11 vacant).`);

    // 7. Create Transactions
    console.log("Step 7: Generating ledger transactions...");
    const txs: (typeof transactions.$inferInsert)[] = [];

    // D1 fix: real property owner per expense, instead of always landlordA.
    const propertyOwnerMap = new Map(insertedProps.map((p) => [p.id, p.ownerContactId!]));
    // D1 fix: track which (lease, calendar-month) pairs already have a rent
    // transaction so the random loop below can never create a second one in
    // the same month for the same lease - this was the root cause of a
    // lease's current-month collected total exceeding its monthly rent.
    const monthKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const usedLeaseMonths = new Set<string>();

    // Current-month collection per ACTIVE lease, deliberately varied into
    // arrears states (previously the ONLY arrears scenario in the whole
    // dataset was propComm's hardcoded unpaid lease - every other active
    // lease got a full guaranteed payment, so "partial"/"defaulted" arrears
    // had zero other representation). propComm keeps its original fully-
    // defaulted, zero-transaction state (Needs Attention band depends on it).
    // Every active lease's current-month key is pre-marked "used" here
    // regardless of outcome, so the random historical loop below can never
    // backfill an accidental extra current-month payment that would quietly
    // undo the intended arrears state.
    const nowForRent = new Date();
    let defaultedCount = 0;
    let partialCount = 0;
    let currentCount = 0;
    const activeNonCommLeases = insertedLeases.filter((l) => l.isActive && l.propertyId !== propComm.id);
    activeNonCommLeases.forEach((l, idx) => {
      usedLeaseMonths.add(`${l.id}:${monthKeyOf(nowForRent)}`);

      const isDefaulted = idx % 9 === 0;
      const isPartial = !isDefaulted && idx % 7 === 0;
      const fullRent = parseFloat(l.monthlyRentKes);

      if (isDefaulted) {
        // No rent transaction at all this month - full arrears.
        defaultedCount++;
        return;
      }

      const collectedAmount = isPartial ? fullRent * (0.3 + (idx % 5) * 0.1) : fullRent;
      if (isPartial) partialCount++; else currentCount++;

      txs.push({
        entityId: groupEntity.id,
        type: "rent",
        contactId: l.tenantContactId,
        propertyId: l.propertyId,
        leaseId: l.id,
        amountKes: collectedAmount.toFixed(2),
        occurredAt: nowForRent, // Today (this month)
        recordedById: financeOfficerUser.id,
        notes: isPartial ? "Partial rent payment - current month" : "Rent payment - current month",
      });
    });
    console.log(`Current-month collection variety: ${currentCount} fully current, ${partialCount} partial arrears, ${defaultedCount} fully defaulted (plus propComm's hardcoded unpaid lease).`);

    // Random historical rent/expense transactions distributed across all
    // leased properties. D1 fixes applied here: (a) a candidate date is
    // always within [lease.startsAt, lease.isActive ? now : lease.endsAt] -
    // never before the lease started, never after a terminated lease ended;
    // (b) a "rent" candidate that would land in a (lease, month) pair already
    // used (including the guaranteed current-month row above) is skipped
    // rather than pushed, so no lease can ever accumulate more than one rent
    // transaction in the same calendar month.
    for (let i = 0; i < 200; i++) {
      const randomLease = insertedLeases[i % insertedLeases.length];
      // leaseA (propComm) is deliberately left unpaid for the current month above;
      // never let this loop backfill a "rent" entry for it.
      const isRentCandidate = randomLease.id === leaseA.id ? false : Math.random() > 0.3;

      const earliestMs = randomLease.startsAt.getTime();
      const latestMs = randomLease.isActive ? nowForRent.getTime() : randomLease.endsAt.getTime();
      if (latestMs <= earliestMs) continue;
      const dt = new Date(earliestMs + Math.random() * (latestMs - earliestMs));

      if (isRentCandidate) {
        const key = `${randomLease.id}:${monthKeyOf(dt)}`;
        if (usedLeaseMonths.has(key)) continue;
        usedLeaseMonths.add(key);
        txs.push({
          entityId: groupEntity.id,
          type: "rent",
          contactId: randomLease.tenantContactId,
          propertyId: randomLease.propertyId,
          leaseId: randomLease.id,
          amountKes: parseFloat(randomLease.monthlyRentKes).toFixed(2),
          occurredAt: dt,
          recordedById: financeOfficerUser.id,
          notes: `Auto-generated historical rent ${i}`,
        });
      } else {
        const val = Math.floor(Math.random() * 15) * 5000 + 5000;
        txs.push({
          entityId: groupEntity.id,
          type: "expense",
          contactId: propertyOwnerMap.get(randomLease.propertyId) ?? landlordA.id,
          propertyId: randomLease.propertyId,
          leaseId: null,
          amountKes: val.toFixed(2),
          occurredAt: dt,
          recordedById: financeOfficerUser.id,
          notes: `Auto-generated historical expense ${i}`,
        });
      }
    }

    // Sunland's own entity-level operating expenses (propertyId: null) -
    // distinct from the property-tied "expense" transactions above, which
    // are rechargeable costs recovered from the landlord's remittance and
    // must NOT reduce Sunland's own P&L (finance ledger doc §5.2: "landlord
    // bears the cost, Sunland P&L is neutral"). Previously zero rows existed
    // with propertyId null, so after fixing computeExpenses() to correctly
    // exclude property-tied costs, Sunland's own expense line had nothing
    // real to compute against. Spans 3 months so incomeTrend/expensesTrend/
    // profitTrend all have genuine month-over-month data to compare.
    // Calibrated to roughly 70% of this portfolio's real monthly management-
    // fee income (~KES 500K at current seeded scale), leaving a realistic
    // ~30% operating margin as the default steady state - an always-loss-
    // making default would be just as inaccurate as an inflated-profit one.
    const operatingExpenseCatalog = [
      { notes: "Staff salaries - monthly payroll run", amount: 270000 },
      { notes: "Office rent - Westlands HQ", amount: 55000 },
      { notes: "Utilities and internet - HQ office", amount: 16000 },
      { notes: "Bank charges and transfer fees", amount: 3200 },
    ];
    const operatingExpensesToInsert: (typeof transactions.$inferInsert)[] = [];
    for (let monthsBack = 0; monthsBack < 3; monthsBack++) {
      const monthDate = new Date(nowForRent.getFullYear(), nowForRent.getMonth() - monthsBack, 3);
      operatingExpenseCatalog.forEach((item, idx) => {
        // Small month-to-month variance so the trend isn't a flat, suspicious repeat.
        const variance = 1 + ((monthsBack + idx) % 3) * 0.03;
        operatingExpensesToInsert.push({
          entityId: groupEntity.id,
          type: "expense",
          contactId: null,
          propertyId: null,
          leaseId: null,
          amountKes: (item.amount * variance).toFixed(2),
          occurredAt: monthDate,
          recordedById: financeHeadUser.id,
          notes: item.notes,
        });
      });
    }
    txs.push(...operatingExpensesToInsert);

    // Revenue-stream transactions for the two real closed_won pipeline deals
    // seeded in Step 5b (previously "commission" existed as a transaction
    // type but was never actually seeded, and "agreement_fee"/"sales_commission"
    // didn't exist at all - so BD's closed deals had zero corresponding
    // revenue in the finance ledger). Tied to real records rather than
    // invented ones: the agreement fee uses Nexus Office Plaza's actual
    // monthlyRentKes (350,000) as one month's letting-agreement fee, the
    // industry-standard basis in this market; the sales commission uses a
    // standard 3% of the Riverside Apartment Sale lead's expectedValueKes
    // (8,500,000), since that deal has no linked property/contact in seed.
    txs.push(
      {
        entityId: groupEntity.id,
        type: "agreement_fee",
        contactId: tenantA.id,
        propertyId: propComm.id,
        leaseId: null,
        amountKes: "350000.00",
        occurredAt: daysAgo(10),
        recordedById: financeOfficerUser.id,
        notes: "Letting agreement fee - Nexus Tech Office Lease (Nexus Office Plaza)",
      },
      {
        entityId: groupEntity.id,
        type: "sales_commission",
        contactId: null,
        propertyId: null,
        leaseId: null,
        amountKes: (8500000 * 0.03).toFixed(2),
        occurredAt: daysAgo(35),
        recordedById: financeOfficerUser.id,
        notes: "Sales commission (3%) - Riverside Apartment Sale",
      },
    );

    await db.insert(transactions).values(txs);

    console.log(`Created ${txs.length} transactions and rent ledger entries (${operatingExpensesToInsert.length} of which are Sunland's own entity-level operating expenses).`);

    // 5a2 (moved here from before Step 6/7). Seed remittance advices across a
    // SAMPLE of active mandates (previously only ever 1, tied to propRes,
    // with hardcoded collected/fee/expense numbers unrelated to any real
    // transaction). Every one here is genuinely derived from the real
    // transactions just inserted, and status is varied (pending/released/
    // flagged) so the remittance release flow and the Financials tab's
    // history list both have real, mixed-state data to exercise.
    const remittancePeriodStart = new Date(nowForRent.getFullYear(), nowForRent.getMonth(), 1);
    const remittanceSampleIdx = insertedActiveMandates.map((_, i) => i).filter((i) => i % 5 === 0);
    const reportExportsToInsert: (typeof reportExports.$inferInsert)[] = [];
    let remittancesCreated = 0;
    for (const [sampleIdx, mandateIdx] of remittanceSampleIdx.entries()) {
      const mandate = insertedActiveMandates[mandateIdx];
      const mandateProperty = activeMandateProps[mandateIdx];
      const collected = txs
        .filter((t) => t.propertyId === mandateProperty.id && t.type === "rent" && (t.occurredAt as Date) >= remittancePeriodStart)
        .reduce((sum, t) => sum + parseFloat(t.amountKes as string), 0);
      const expenses = txs
        .filter((t) => t.propertyId === mandateProperty.id && t.type === "expense" && (t.occurredAt as Date) >= remittancePeriodStart)
        .reduce((sum, t) => sum + parseFloat(t.amountKes as string), 0);
      const rate = parseFloat(mandate.mandateRate);
      const fee = collected * rate;
      const net = collected - fee - expenses;
      const token = randomBytes(24).toString("base64url");
      const isReleased = sampleIdx % 4 === 1;
      const isFlagged = sampleIdx % 7 === 3;
      const status: "pending" | "released" | "flagged" = isFlagged ? "flagged" : isReleased ? "released" : "pending";

      const [inserted] = await db
        .insert(remittanceAdvices)
        .values({
          entityId: groupEntity.id,
          mandateId: mandate.id,
          periodStart: remittancePeriodStart,
          periodEnd: new Date(),
          collectedKes: collected.toFixed(2),
          managementFeeKes: fee.toFixed(2),
          expensesKes: expenses.toFixed(2),
          netRemittanceKes: net.toFixed(2),
          status,
          verificationToken: token,
          generatedById: propertyManager1User.id,
          releasedById: status === "released" ? financeHeadUser.id : undefined,
          releasedAt: status === "released" ? new Date(Date.now() - (sampleIdx + 1) * 3 * 86_400_000) : undefined,
          flagReason: status === "flagged" ? "Collected amount is below the expected rent roll - verify with the tenant before releasing." : undefined,
        })
        .returning();

      reportExportsToInsert.push({
        entityId: groupEntity.id,
        reportType: "remittance_advice",
        generatedById: propertyManager1User.id,
        verificationToken: token,
        snapshot: {
          remittanceAdviceId: inserted.id,
          mandateId: mandate.id,
          property: mandateProperty.name,
          periodStart: remittancePeriodStart.toISOString().split("T")[0],
          periodEnd: new Date().toISOString().split("T")[0],
          collectedKes: collected,
          managementFeeKes: fee,
          expensesKes: expenses,
          netRemittanceKes: net,
          generatedBy: propertyManager1User.name,
        },
      });
      remittancesCreated++;
    }
    await db.insert(reportExports).values(reportExportsToInsert);
    console.log(`Seeded ${remittancesCreated} remittance advices across ${remittanceSampleIdx.length} mandates (mixed pending/released/flagged), each reconciled to real transactions.`);

    // 7b. Create Contractors, Maintenance Requests and Documents
    console.log("Step 7b: Generating contractors, maintenance requests, and property documents...");

    // Property lifecycle unification follow-up: contractors previously never
    // existed in seed data at all, so the reassignment picker on the
    // Maintenance Board had nothing real to show. Specialty lives in
    // metadata.specialty (contacts has no dedicated column for it - reusing
    // the existing, already-unused jsonb field rather than adding one).
    const contractorCatalog = [
      { displayName: "Fundi Bora Plumbing Services", specialty: "Plumbing", phone: "+254 722 340 118", email: "jobs@fundibora.co.ke" },
      { displayName: "Voltage Masters Electrical Ltd", specialty: "Electrical", phone: "+254 733 561 902", email: "dispatch@voltagemasters.co.ke" },
      { displayName: "CoolBreeze HVAC & Generators", specialty: "Generator & HVAC", phone: "+254 710 224 887", email: "service@coolbreeze.co.ke" },
      { displayName: "Jenga Imara General Contractors", specialty: "General & Structural", phone: "+254 720 998 341", email: "info@jengaimara.co.ke" },
      { displayName: "SecureGuard Access Systems Kenya", specialty: "Security & Access", phone: "+254 701 445 672", email: "support@secureguardke.com" },
      { displayName: "Safi Pest Control Services", specialty: "Pest Control", phone: "+254 715 662 034", email: "bookings@safipest.co.ke" },
      { displayName: "AquaFlow Water Systems", specialty: "Plumbing", phone: "+254 728 117 559", email: "aquaflow.nairobi@gmail.com" },
      { displayName: "Nyota Glass & Aluminium Works", specialty: "Glazing & General", phone: "+254 734 882 260", email: "orders@nyotaglass.co.ke" },
    ];
    const insertedContractors = await db
      .insert(contacts)
      .values(
        contractorCatalog.map((c) => ({
          entityId: groupEntity.id,
          type: "contractor" as const,
          displayName: c.displayName,
          phone: c.phone,
          email: c.email,
          source: "referral",
          metadata: { specialty: c.specialty },
        })),
      )
      .returning();
    console.log(`Created ${insertedContractors.length} contractors across ${new Set(contractorCatalog.map((c) => c.specialty)).size} specialties.`);
    const contractorBySpecialty = (specialty: string) => insertedContractors.filter((c) => (c.metadata as { specialty?: string } | null)?.specialty === specialty);

    // D2 follow-up: grown from 3 total (all tied to propComm/propRes) to a
    // real spread across many leased properties, with full priority/status
    // variety - the Executive Dashboard's "Ops" department stat and the
    // Internal Structure panel both read openMaintenanceCount from this
    // table, and 3 rows barely moved that number.
    const maintenanceCatalog = [
      { title: "Kitchen sink drainage blocked", description: "Water pools in the sink and drains very slowly.", specialty: "Plumbing", costKes: 4500 },
      { title: "Living room ceiling water stain", description: "A brown stain has appeared on the ceiling after recent rains.", specialty: "General & Structural", costKes: 18000 },
      { title: "Main gate motor not responding", description: "The automatic gate no longer opens on remote signal.", specialty: "Security & Access", costKes: 32000 },
      { title: "Bedroom window latch broken", description: "The window will not lock securely.", specialty: "Glazing & General", costKes: 2500 },
      { title: "Communal hallway lighting out", description: "Two light fixtures in the shared corridor are not working.", specialty: "Electrical", costKes: 6000 },
      { title: "Backup generator fuel gauge fault", description: "Fuel gauge reads empty even when the tank is full.", specialty: "Generator & HVAC", costKes: 45000 },
      { title: "Bathroom tiles cracked", description: "Several floor tiles near the shower have cracked and shifted.", specialty: "General & Structural", costKes: 15000 },
      { title: "Pest control - ants in kitchen", description: "Recurring ant trail spotted near the kitchen counter.", specialty: "Pest Control", costKes: 3500 },
      { title: "Intercom system unresponsive", description: "Visitors cannot reach the unit via the entry intercom.", specialty: "Security & Access", costKes: 9000 },
      { title: "Water heater not heating", description: "Hot water supply has been intermittent for three days.", specialty: "Plumbing", costKes: 12000 },
      { title: "Parking gate remote unpaired", description: "Tenant's remote no longer triggers the parking barrier.", specialty: "Security & Access", costKes: 1800 },
      { title: "Balcony door seal worn", description: "Draft and light rain coming in around the sliding door frame.", specialty: "Glazing & General", costKes: 5000 },
    ];
    // Real 3-tier severity / 5-stage status vocabulary (Maintenance Board
    // design, ADR 015 follow-up) - all 12 catalog items above are genuinely
    // reactive (tenant-reported repairs); planned/compliance get their own
    // honestly-labeled entries below rather than being force-fit into this loop.
    const maintenancePriorities = ["routine", "urgent", "critical"] as const;
    const maintenanceStatuses = ["reported", "awaiting_approval", "scheduled", "in_progress", "done"] as const;
    const sampledLeasesForMaintenance = insertedLeases.filter((l) => l.isActive).filter((_, i) => i % 2 === 0);

    const maintenanceToInsert: (typeof maintenanceRequests.$inferInsert)[] = [
      {
        entityId: groupEntity.id,
        propertyId: propComm.id,
        title: "Main generator electrical fault",
        priority: "critical",
        status: "reported",
        category: "reactive",
        description: "The main backup generator is failing to auto-start during grid blackouts. Needs urgent technician attention.",
        reportedByContactId: tenantA.id,
        createdAt: new Date(Date.now() - 2 * 86_400_000),
        estimatedCostKes: "120000.00",
      },
      {
        entityId: groupEntity.id,
        propertyId: propRes.id,
        title: "Master bathroom plumbing leak",
        priority: "urgent",
        status: "in_progress",
        category: "reactive",
        description: "Water leaking under the sink, causing dampness in the cabinets.",
        reportedByContactId: tenantB.id,
        assignedContractorId: contractorBySpecialty("Plumbing")[0]?.id ?? null,
        createdAt: new Date(Date.now() - 5 * 86_400_000),
        estimatedCostKes: "8500.00",
      },
      ...sampledLeasesForMaintenance.map((lease, idx) => {
        const item = maintenanceCatalog[idx % maintenanceCatalog.length];
        const priority = maintenancePriorities[idx % maintenancePriorities.length];
        const status = maintenanceStatuses[idx % maintenanceStatuses.length];
        const createdDaysAgo = 2 + (idx % 20);
        const isDone = status === "done";
        // Real assignment for anything past "reported" - matches a contractor
        // of the matching specialty, round-robin within that specialty pool.
        const specialtyPool = contractorBySpecialty(item.specialty);
        const assignedContractorId = status !== "reported" && specialtyPool.length > 0 ? specialtyPool[idx % specialtyPool.length].id : null;
        return {
          entityId: groupEntity.id,
          propertyId: lease.propertyId,
          title: item.title,
          description: item.description,
          priority,
          status,
          category: "reactive" as const,
          reportedByContactId: lease.tenantContactId,
          assignedContractorId,
          createdAt: new Date(Date.now() - createdDaysAgo * 86_400_000),
          dueAt: !isDone ? new Date(Date.now() + (3 + (idx % 10)) * 86_400_000) : undefined,
          resolvedAt: isDone ? new Date(Date.now() - Math.max(0, createdDaysAgo - (2 + (idx % 5))) * 86_400_000) : undefined,
          estimatedCostKes: status !== "reported" ? item.costKes.toFixed(2) : undefined,
          actualCostKes: isDone ? item.costKes.toFixed(2) : undefined,
        };
      }),
      // Planned/compliance content (ADR 015 follow-up) - honestly distinct
      // from the reactive catalog above: a real preventive-maintenance cycle
      // and two real compliance renewals, one genuinely close to its deadline
      // so the Needs Attention band has real content to surface post-reseed.
      {
        entityId: groupEntity.id,
        propertyId: propComm.id,
        title: "Quarterly generator preventive service",
        description: "Scheduled preventive service and load-bank test for the main backup generator, per the Q3 planned-works calendar.",
        priority: "routine",
        status: "scheduled",
        category: "planned",
        reportedByContactId: null,
        assignedContractorId: contractorBySpecialty("Generator & HVAC")[0]?.id ?? null,
        createdAt: new Date(Date.now() - 6 * 86_400_000),
        dueAt: new Date(Date.now() + 3 * 86_400_000),
        estimatedCostKes: "38000.00",
      },
      {
        entityId: groupEntity.id,
        propertyId: propRes.id,
        title: "Fire extinguisher service certificate renewal",
        description: "Annual fire extinguisher inspection and recharge certificate expires this week - required for the occupancy compliance file.",
        priority: "urgent",
        status: "awaiting_approval",
        category: "compliance",
        reportedByContactId: null,
        createdAt: new Date(Date.now() - 4 * 86_400_000),
        dueAt: new Date(Date.now() + 5 * 86_400_000),
        estimatedCostKes: "22000.00",
      },
      {
        entityId: groupEntity.id,
        propertyId: propComm.id,
        title: "Lift service compliance inspection",
        description: "Annual statutory lift inspection and certification - required before the certificate lapses.",
        priority: "critical",
        status: "awaiting_approval",
        category: "compliance",
        reportedByContactId: null,
        createdAt: new Date(Date.now() - 9 * 86_400_000),
        dueAt: new Date(Date.now() + 6 * 86_400_000),
        estimatedCostKes: "142000.00",
      },
    ];
    const insertedMaintenance = await db.insert(maintenanceRequests).values(maintenanceToInsert).returning();
    console.log(`Created ${insertedMaintenance.length} maintenance requests (reactive/planned/compliance) across ${sampledLeasesForMaintenance.length + 5} properties, full severity/status variety, real contractor assignment.`);
    const scheduledGeneratorService = insertedMaintenance.find((m) => m.title === "Quarterly generator preventive service")!;

    // Real, in-flight cost approvals so the Maintenance Board's "Pending Cost
    // Approvals" strip and /admin/approvals both have real content - matches
    // the exact costApprovalTierFor/submitMaintenanceCostForApproval shape
    // (relatedTable: "maintenance_requests", status: "awaiting_approval" on
    // both sides of the link), not a fabricated demo row.
    const highCostCandidates = insertedMaintenance.filter((m) => m.status === "awaiting_approval" && m.estimatedCostKes).slice(0, 3);
    if (highCostCandidates.length > 0) {
      await db.insert(approvalRequests).values(
        highCostCandidates.map((m) => ({
          entityId: groupEntity.id,
          requestType: "maintenance_cost",
          relatedTable: "maintenance_requests",
          relatedId: m.id,
          requestedById: propertyManager1User.id,
          amountKes: m.estimatedCostKes!,
          requiredApproverRole: parseFloat(m.estimatedCostKes!) > 100000 ? ("ceo" as const) : ("gm" as const),
          status: "pending" as const,
        })),
      );
      console.log(`Seeded ${highCostCandidates.length} pending maintenance cost approval(s).`);
    }

    // D2: previously a single mandate_letter document existed in the entire
    // dataset (no fileSizeBytes, no other document types) - added variety
    // across types, and a mix of real fileSizeBytes (simulating the
    // Cloudinary upload-time capture) vs. legitimately-null (pre-dating it).
    const documentsToInsert: (typeof documents.$inferInsert)[] = [
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
      },
      {
        entityId: groupEntity.id,
        propertyId: propRes.id,
        ownerContactId: landlordB.id,
        title: "Signed Management Mandate - Lavington Heights",
        type: "mandate_letter",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/mandate_lavington.pdf",
        uploadedById: financeOfficerUser.id,
        fileSizeBytes: 1_468_302,
        metadata: { status: "signed" },
        createdAt: new Date(Date.now() - 175 * 86_400_000),
      },
      {
        entityId: groupEntity.id,
        propertyId: propComm.id,
        leaseId: leaseA.id,
        ownerContactId: landlordA.id,
        title: "Executed Lease Agreement - Nexus Office Plaza",
        type: "lease_agreement",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/lease_nexus.pdf",
        uploadedById: financeOfficerUser.id,
        fileSizeBytes: 892_114,
        metadata: { status: "signed" },
        createdAt: new Date(Date.now() - 60 * 86_400_000),
      },
      {
        entityId: groupEntity.id,
        propertyId: propRes.id,
        leaseId: leaseB.id,
        ownerContactId: landlordB.id,
        title: "Executed Lease Agreement - Lavington Heights Unit 4B",
        type: "lease_agreement",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/lease_lavington.pdf",
        uploadedById: financeOfficerUser.id,
        metadata: { status: "signed" },
        createdAt: new Date(Date.now() - 58 * 86_400_000),
      },
      {
        entityId: groupEntity.id,
        propertyId: propRes.id,
        ownerContactId: landlordB.id,
        title: "Title Deed - Lavington Heights",
        type: "title_deed",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/title_lavington.pdf",
        uploadedById: financeOfficerUser.id,
        fileSizeBytes: 2_114_884,
        metadata: {},
        createdAt: new Date(Date.now() - 300 * 86_400_000),
      },
      {
        entityId: groupEntity.id,
        propertyId: propComm.id,
        leaseId: leaseA.id,
        ownerContactId: landlordA.id,
        title: "Tenant ID - Nexus Tech Solutions",
        type: "identification",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/id_nexus.pdf",
        uploadedById: financeOfficerUser.id,
        fileSizeBytes: 214_509,
        metadata: {},
        createdAt: new Date(Date.now() - 61 * 86_400_000),
      },
      {
        entityId: groupEntity.id,
        propertyId: propRes.id,
        leaseId: leaseB.id,
        ownerContactId: landlordB.id,
        title: "Rent Receipt - Lavington Heights, Current Month",
        type: "rent_receipt",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/receipt_lavington_current.pdf",
        uploadedById: financeOfficerUser.id,
        fileSizeBytes: 98_442,
        metadata: {},
        createdAt: new Date(Date.now() - 1 * 86_400_000),
      },
      {
        entityId: groupEntity.id,
        propertyId: propRes.id,
        ownerContactId: landlordB.id,
        title: "Owner Statement - Lavington Heights, Last Quarter",
        type: "statement",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/statement_lavington_q.pdf",
        uploadedById: financeOfficerUser.id,
        metadata: {},
        createdAt: new Date(Date.now() - 90 * 86_400_000),
      },
      {
        entityId: groupEntity.id,
        propertyId: pendingProp1.id,
        ownerContactId: pendingProp1.ownerContactId!,
        title: "Landlord Offer Letter - Nexus Office Plaza",
        type: "offer_letter",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/offer_nexus.pdf",
        uploadedById: propertyManager1User.id,
        fileSizeBytes: 156_720,
        metadata: {},
        createdAt: new Date(Date.now() - 200 * 86_400_000),
      },
    ];
    if (insertedLeases[5]) {
      documentsToInsert.push({
        entityId: groupEntity.id,
        propertyId: insertedLeases[5].propertyId,
        leaseId: insertedLeases[5].id,
        title: "Executed Lease Agreement",
        type: "lease_agreement",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/lease_generic_5.pdf",
        uploadedById: financeOfficerUser.id,
        fileSizeBytes: 745_003,
        metadata: { status: "signed" },
        createdAt: new Date(Date.now() - 45 * 86_400_000),
      });
    }
    if (insertedLeases[10]) {
      documentsToInsert.push({
        entityId: groupEntity.id,
        propertyId: insertedLeases[10].propertyId,
        leaseId: insertedLeases[10].id,
        title: "Rent Receipt",
        type: "rent_receipt",
        fileUrl: "https://sunland-crm.s3.amazonaws.com/documents/receipt_generic_10.pdf",
        uploadedById: financeOfficerUser.id,
        metadata: {},
        createdAt: new Date(Date.now() - 3 * 86_400_000),
      });
    }
    await db.insert(documents).values(documentsToInsert);

    console.log(`Created maintenance requests and ${documentsToInsert.length} documents.`);

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

    // Mandate lifecycle activity - previously ZERO activity_logs rows were
    // ever associatedType "property_mandate" despite ~50 real mandates now
    // existing across every status, so the Mandate File's own Activity tab
    // (built with full search/filter/pagination) had nothing real to show
    // for any mandate except by coincidence.
    const mandateActivitySeed: (typeof activityLogs.$inferInsert)[] = [];

    insertedActiveMandates.filter((_, i) => i % 6 === 0).forEach((m, idx) => {
      mandateActivitySeed.push({
        entityId: groupEntity.id,
        actorId: financeHeadUser.id,
        associatedType: "property_mandate",
        associatedId: m.id,
        action: "properties.mandate.create",
        summary: "Management mandate established and activated.",
        createdAt: daysAgoTs(150 + idx * 3),
      });
      if (m.assignedPmId) {
        mandateActivitySeed.push({
          entityId: groupEntity.id,
          actorId: gmUser.id,
          associatedType: "property_mandate",
          associatedId: m.id,
          action: "properties.mandate.assign_pm",
          summary: "Property manager assigned to this mandate.",
          createdAt: daysAgoTs(145 + idx * 3),
        });
      }
    });

    // Term-update activity for every mandate whose optional term fields were
    // actually populated (D2's "withTerms" subset) - keeps the Overview
    // tab's real term cards and the Activity tab's narrative consistent.
    insertedActiveMandates.filter((m) => m.maintenanceAuthorityKes !== null).forEach((m, idx) => {
      mandateActivitySeed.push({
        entityId: groupEntity.id,
        actorId: lineManagerUser.id,
        associatedType: "property_mandate",
        associatedId: m.id,
        action: "properties.mandate.update_terms",
        summary: "Mandate terms updated - maintenance authority, renewal type, and notice period set.",
        createdAt: hoursAgo(20 + idx * 7),
      });
    });

    // Termination reasoning for every terminated mandate.
    const terminationReasons = [
      "Landlord opted to self-manage the property.",
      "Property was sold to a new owner.",
      "Persistent service-level disputes with the landlord.",
    ];
    insertedTerminatedMandates.forEach((m, idx) => {
      mandateActivitySeed.push({
        entityId: groupEntity.id,
        actorId: gmUser.id,
        associatedType: "property_mandate",
        associatedId: m.id,
        action: "properties.mandate.terminate",
        summary: `Management mandate terminated: ${terminationReasons[idx % terminationReasons.length]}`,
        createdAt: daysAgoTs(5 + idx * 4),
      });
    });

    // Submission-for-approval activity for every pending mandate.
    [pendingMandate1, pendingMandate, ...insertedExtraPendingMandates].forEach((m, idx) => {
      mandateActivitySeed.push({
        entityId: groupEntity.id,
        actorId: propertyManager1User.id,
        associatedType: "property_mandate",
        associatedId: m.id,
        action: "properties.mandate.submit_for_approval",
        summary: "Mandate submitted and awaiting GM approval before activation.",
        createdAt: daysAgoTs(1 + idx),
      });
    });

    // Broaden lease-activity coverage beyond leaseA/leaseB: a sample of
    // terminated and expiring-soon leases, matching each one's real state
    // (previously only propComm/propRes ever had any lease activity).
    const terminatedLeaseSample = insertedLeases.filter((l) => !l.isActive).slice(0, 4);
    const expiringSoonLeaseSample = insertedLeases
      .filter((l) => l.isActive && l.propertyId !== propRes.id && l.endsAt.getTime() - Date.now() <= 30 * 86_400_000)
      .slice(0, 4);
    terminatedLeaseSample.forEach((l, idx) => {
      mandateActivitySeed.push({
        entityId: groupEntity.id,
        actorId: pmUser.id,
        associatedType: "lease",
        associatedId: l.id,
        action: "properties.lease.terminate",
        summary: "Lease terminated and unit released back to available inventory.",
        createdAt: new Date(l.endsAt.getTime() + (1 + idx) * 3_600_000),
      });
    });
    expiringSoonLeaseSample.forEach((l, idx) => {
      mandateActivitySeed.push({
        entityId: groupEntity.id,
        actorId: lineManagerUser.id,
        associatedType: "lease",
        associatedId: l.id,
        action: "properties.lease.renewal_discussion",
        summary: "Renewal discussion initiated ahead of upcoming lease expiry.",
        createdAt: hoursAgo(10 + idx * 9),
      });
    });

    // Deliberate, very-recent, type-varied batch so the Executive Dashboard's
    // global Activity Logs feed (capped to the 8 most recent entity-wide,
    // classified by keyword match on the action string - see
    // src/lib/services/dashboard.ts's activityLogs mapping) shows real
    // variety across all five classified types instead of defaulting almost
    // entirely to "system".
    const dashboardActivityVariety: (typeof activityLogs.$inferInsert)[] = [
      {
        entityId: groupEntity.id,
        actorId: pmUser.id,
        associatedType: "contact",
        associatedId: landlordA.id,
        action: "crm.contact.call_logged",
        summary: "Follow-up call logged with landlord regarding remittance schedule.",
        createdAt: hoursAgo(1),
      },
      {
        entityId: groupEntity.id,
        actorId: financeOfficerUser.id,
        associatedType: "property",
        associatedId: propComm.id,
        action: "documents.upload",
        summary: "New lease agreement document uploaded and filed.",
        createdAt: hoursAgo(3),
      },
      {
        entityId: groupEntity.id,
        actorId: financeOfficerUser.id,
        associatedType: "lease",
        associatedId: leaseB.id,
        action: "finance.transaction.record",
        summary: "Rent payment recorded and posted to the ledger.",
        createdAt: hoursAgo(5),
      },
      {
        entityId: groupEntity.id,
        actorId: lineManagerUser.id,
        associatedType: "property_mandate",
        associatedId: insertedActiveMandates[0].id,
        action: "properties.mandate.update_terms",
        summary: "Mandate terms updated - notice period and renewal type set.",
        createdAt: hoursAgo(8),
      },
      {
        entityId: groupEntity.id,
        actorId: gmUser.id,
        associatedType: "property_mandate",
        associatedId: (insertedActiveMandates[1] ?? insertedActiveMandates[0]).id,
        action: "properties.mandate.create",
        summary: "New management mandate established.",
        createdAt: hoursAgo(12),
      },
      // Real Contacts CRM "Quick Connects" touch-log feed (contactId/email/
      // whatsapp channel variety, real recent timestamps) - these are the
      // same real writeAudit rows logContactTouch() produces, not a
      // display-only illustration.
      {
        entityId: groupEntity.id,
        actorId: lineManagerUser.id,
        associatedType: "contact",
        associatedId: buyerJames.id,
        action: "crm.contact.call_logged",
        summary: `${lineManagerUser.name} called James Mwangi`,
        createdAt: hoursAgo(2),
      },
      {
        entityId: groupEntity.id,
        actorId: lineManagerUser.id,
        associatedType: "contact",
        associatedId: companyMeridian.id,
        action: "crm.contact.email_logged",
        summary: `${lineManagerUser.name} emailed Meridian Business Park Ltd`,
        createdAt: hoursAgo(4),
      },
      {
        entityId: groupEntity.id,
        actorId: lineManagerUser.id,
        associatedType: "contact",
        associatedId: buyerDaniel.id,
        action: "crm.contact.whatsapp_logged",
        summary: `${lineManagerUser.name} WhatsApp'd Daniel Kiptoo`,
        createdAt: hoursAgo(6),
      },
      {
        entityId: groupEntity.id,
        actorId: lineManagerUser.id,
        associatedType: "contact",
        associatedId: sellerSamuel.id,
        action: "crm.contact.call_logged",
        summary: `${lineManagerUser.name} called Samuel Kimani`,
        createdAt: hoursAgo(20),
      },
    ];

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
      ...mandateActivitySeed,
      ...dashboardActivityVariety,
      // Real auth events so the Account console's Security "access log" and the
      // org audit log have security-relevant content on first load (ADR 018).
      {
        entityId: null as unknown as string,
        actorId: ceoUser.id,
        associatedType: "session",
        associatedId: groupEntity.id,
        action: "auth.login",
        summary: `${ceoUser.name} signed in`,
        createdAt: hoursAgo(3),
      },
      {
        entityId: null as unknown as string,
        actorId: ceoUser.id,
        associatedType: "user",
        associatedId: ceoUser.id,
        action: "identity.security.2fa_enabled",
        summary: `${ceoUser.name} enabled two-factor authentication`,
        createdAt: hoursAgo(48),
      },
    ]);
    console.log(`Created ${3 + leaseActivitySeed.length + mandateActivitySeed.length + dashboardActivityVariety.length} activity log entries across mandates, leases, auth, and the dashboard variety batch.`);

    // Real Account-console content on first load (ADR 018): stamp the CEO's
    // password-age baseline + a couple of notification routing prefs.
    await db.update(users).set({ passwordChangedAt: hoursAgo(42 * 24), phone: "+254 722 000 118" }).where(eq(users.id, ceoUser.id));
    await db.insert(notificationPrefs).values([
      { userId: ceoUser.id, category: "remittance", inApp: true, email: true, sms: false },
      { userId: ceoUser.id, category: "maintenance", inApp: true, email: true, sms: true },
    ]).onConflictDoNothing();

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
            startDate: daysFromNow(-24),
            dueDate: daysFromNow(18),
            budgetKes: "350000.00",
            milestones: [
              { label: "Shortlist drawn up", done: true },
              { label: "First-round interviews", done: true },
              { label: "Offers issued", done: false },
            ],
          },
          {
            entityId: groupEntity.id,
            title: "Escrow Clearance: Muthaiga Estate",
            description: "Finalizing deed transfers and tax documentation.",
            department: "legal",
            status: "awaiting_review",
            assigneeIds: [legalOfficerUser.id, financeHeadUser.id],
            createdById: financeHeadUser.id,
            startDate: daysFromNow(-12),
            dueDate: daysFromNow(9),
            budgetKes: "120000.00",
            milestones: [
              { label: "Deed pack assembled", done: true },
              { label: "Tax clearance filed", done: false },
              { label: "Transfer registered", done: false },
            ],
          },
          {
            entityId: groupEntity.id,
            title: "Routine Safety Audits",
            description: "Inspecting 4 multi-family complexes in Westlands.",
            department: "ops",
            status: "planning",
            assigneeIds: [propertyManager1User.id],
            startDate: daysFromNow(3),
            dueDate: daysFromNow(14),
            budgetKes: "96500.00",
            milestones: [
              { label: "Inspector booked", done: false },
              { label: "Site walks complete", done: false },
              { label: "Findings filed", done: false },
            ],
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
            // Genuinely behind: gives the Projects Board an At Risk column
            // and the Scheduler's at-risk hero stat something real on load.
            atRisk: true,
            startDate: daysFromNow(-40),
            dueDate: daysFromNow(6),
            budgetKes: "210000.00",
            milestones: [
              { label: "Vendor scope signed", done: true },
              { label: "Parallel run", done: false },
              { label: "Cutover", done: false },
            ],
          },
          {
            entityId: groupEntity.id,
            title: "New Hire Onboarding Playbook",
            description: "Standardizing the first-week checklist across departments.",
            department: "hr",
            status: "on_hold",
            assigneeIds: [hrHeadUser.id],
            dueDate: daysFromNow(30),
            startDate: daysFromNow(-6),
            budgetKes: "40000.00",
            milestones: [
              { label: "Draft checklist", done: true },
              { label: "Department sign-off", done: false },
            ],
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
    const generatorServiceVisitStart = scheduledGeneratorService.dueAt ? scheduledGeneratorService.dueAt.getTime() : now.getTime() + 3 * 86_400_000;
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
        // Real notify-role selection so the Scheduler's role chips, reminder
        // queue and "Re-notify" action have something to act on at first load.
        notifyRoleTiers: ["superadmin", "admin"],
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
        // A deed transfer signing genuinely is a critical, sign-off-gated date.
        isCritical: true,
        notifyRoleTiers: ["superadmin", "admin", "finance"],
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
      // Real "Scheduler" link for the Maintenance Board's scheduled generator
      // service (maintenanceRequestId set) - the work order's status:
      // "scheduled" is only true because this visit genuinely exists.
      {
        entityId: groupEntity.id,
        title: `${scheduledGeneratorService.title} — Nexus Office Plaza`,
        description: "Preventive service visit for the main backup generator.",
        type: "maintenance",
        startsAt: new Date(generatorServiceVisitStart),
        endsAt: new Date(generatorServiceVisitStart + 7_200_000),
        location: "Nexus Office Plaza",
        organizerId: propertyManager1User.id,
        maintenanceRequestId: scheduledGeneratorService.id,
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
      // Real Contacts CRM "viewing" events - linked to a real lead/contact
      // (calendarEvents.contactId/leadId) so "Today's Viewings" and the Quick
      // Connects featured card have genuine, relationally-queryable content.
      {
        entityId: groupEntity.id,
        title: "Property viewing — Daniel Kiptoo",
        description: "Villa walkthrough - Karen.",
        type: "viewing",
        startsAt: new Date(now.getTime() + 4 * 3_600_000),
        endsAt: new Date(now.getTime() + 5 * 3_600_000),
        location: "Karen",
        organizerId: lineManagerUser.id,
        attendees: [{ name: "Daniel Kiptoo" }],
        contactId: buyerDaniel.id,
        leadId: leadViewing.id,
      },
      {
        entityId: groupEntity.id,
        title: "Property viewing — James Mwangi",
        description: "3BR apartment walkthrough - Kilimani.",
        type: "viewing",
        startsAt: new Date(now.getTime() + 30 * 3_600_000),
        endsAt: new Date(now.getTime() + 31 * 3_600_000),
        location: "Kilimani",
        organizerId: lineManagerUser.id,
        attendees: [{ name: "James Mwangi" }],
        contactId: buyerJames.id,
        leadId: leadInquiry.id,
      },
    ]);

    console.log("Created 9 calendar events.");

    // 12. Valuations - new-mandate acquisition pipeline (2026-07-17 repurpose).
    // Real spread across 6 of the 7 stages (mandate_signed is deliberately
    // NOT pre-seeded here - it's reached by actually converting the
    // "accepted" row below via signMandateFromValuation() during backend
    // verification, so the resulting property_mandates row is genuinely
    // real rather than a fabricated resultingMandateId). Reuses real
    // landlords (landlordA verified, landlordB unverified) and real
    // property_manager users rather than inventing new contacts.
    console.log("Step 12: Populating valuation/acquisition pipeline...");
    const valDaysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    const valuationsToInsert: (typeof valuations.$inferInsert)[] = [
      {
        entityId: groupEntity.id,
        valuationCode: "VAL-2607-A1F3",
        externalPropertyName: "Kestrel Ridge Land Parcel",
        externalLocation: "Kitengela, Kajiado",
        landlordContactId: landlordB.id,
        isLand: true,
        stage: "requested",
        stageEnteredAt: valDaysAgo(4),
        notes: "Landlord approached Front Office directly asking about management of a 2-acre parcel zoned for residential development.",
        createdAt: valDaysAgo(4),
      },
      {
        entityId: groupEntity.id,
        valuationCode: "VAL-2607-B2E4",
        externalPropertyName: "Acacia Grove Apartments",
        externalLocation: "Ruaka, Kiambu",
        landlordContactId: landlordB.id,
        assignedManagerId: propertyManager2User.id,
        isLand: false,
        stage: "site_visit",
        siteVisitAt: valDaysAgo(2),
        stageEnteredAt: valDaysAgo(9),
        createdAt: valDaysAgo(12),
      },
      {
        entityId: groupEntity.id,
        valuationCode: "VAL-2607-C3D5",
        externalPropertyName: "Baraka Heights",
        externalLocation: "Syokimau, Machakos",
        landlordContactId: landlordA.id,
        assignedManagerId: propertyManager1User.id,
        valuerId: propertyManager1User.id,
        isLand: false,
        stage: "valued",
        marketValueKes: "28500000.00",
        proposedFeeRate: "0.0900",
        methodology: "Income capitalization approach using comparable market rents for Syokimau's 2-3BR apartment segment, capped at a 9.5% yield reflecting current absorption rates along the SGR corridor.",
        comparables: [
          { name: "Comp A - same estate", pricePerSqft: 6800, adjustmentPct: -3, adjustedValueKes: 27700000 },
          { name: "Comp B - 1.2km east", pricePerSqft: 7100, adjustmentPct: 4, adjustedValueKes: 29600000 },
          { name: "Comp C - recent sale", pricePerSqft: 6950, adjustmentPct: 0, adjustedValueKes: 28500000 },
        ],
        siteVisitAt: valDaysAgo(14),
        completedAt: valDaysAgo(9),
        stageEnteredAt: valDaysAgo(9),
        createdAt: valDaysAgo(24),
      },
      {
        entityId: groupEntity.id,
        valuationCode: "VAL-2607-D4C6",
        externalPropertyName: "Palm Court Suites",
        externalLocation: "Nyali, Mombasa",
        landlordContactId: landlordA.id,
        assignedManagerId: propertyManager2User.id,
        externalValuerName: "Knight & Kale Valuers",
        isLand: false,
        stage: "offer_sent",
        marketValueKes: "41000000.00",
        proposedFeeRate: "0.0800",
        methodology: "Direct comparison against three recently transacted coastal apartment blocks within 1km, adjusted for sea-view premium and finish quality.",
        siteVisitAt: valDaysAgo(20),
        completedAt: valDaysAgo(11),
        stageEnteredAt: valDaysAgo(9),
        createdAt: valDaysAgo(28),
      },
      {
        // Deliberately aged past 21 days in "offer_sent" - the real, honest
        // input to both the "Stalled > 21 days" KPI and the acquisition-fit
        // score's freshness component (stageEnteredAt-driven, not a
        // hardcoded flag).
        entityId: groupEntity.id,
        valuationCode: "VAL-2606-E5B7",
        propertyId: insertedProps[104]?.id ?? null,
        landlordContactId: landlordB.id,
        assignedManagerId: propertyManager1User.id,
        externalValuerName: "Tysons Ltd",
        isLand: false,
        stage: "offer_sent",
        marketValueKes: "19800000.00",
        proposedFeeRate: "0.1000",
        methodology: "Rental-yield approach for an existing 8-unit walk-up, cross-checked against Tysons Ltd's internal comparable database.",
        siteVisitAt: valDaysAgo(40),
        completedAt: valDaysAgo(33),
        stageEnteredAt: valDaysAgo(33),
        createdAt: valDaysAgo(45),
      },
      {
        // Ready to be converted into a real mandate - see the E2E
        // verification note above. Has everything signMandateFromValuation()
        // requires: a landlord contact and a proposed fee rate.
        entityId: groupEntity.id,
        valuationCode: "VAL-2606-F6A8",
        externalPropertyName: "Meridian Business Park",
        externalLocation: "Upper Hill, Nairobi",
        landlordContactId: landlordA.id,
        assignedManagerId: propertyManager1User.id,
        valuerId: propertyManager1User.id,
        isLand: false,
        stage: "accepted",
        marketValueKes: "56000000.00",
        proposedFeeRate: "0.0750",
        methodology: "Income capitalization on current 94% occupancy across 12 office suites, cross-checked against two recent Upper Hill Grade-A transactions.",
        comparables: [
          { name: "Comp A - same block", pricePerSqft: 9200, adjustmentPct: -2, adjustedValueKes: 54900000 },
          { name: "Comp B - 400m away", pricePerSqft: 9600, adjustmentPct: 3, adjustedValueKes: 57700000 },
        ],
        siteVisitAt: valDaysAgo(30),
        completedAt: valDaysAgo(22),
        stageEnteredAt: valDaysAgo(6),
        createdAt: valDaysAgo(35),
      },
      {
        entityId: groupEntity.id,
        valuationCode: "VAL-2605-G7F9",
        externalPropertyName: "Riverbank Warehouse",
        externalLocation: "Athi River, Machakos",
        landlordContactId: landlordB.id,
        assignedManagerId: propertyManager2User.id,
        externalValuerName: "Knight & Kale Valuers",
        isLand: false,
        stage: "declined",
        marketValueKes: "33000000.00",
        proposedFeeRate: "0.0850",
        methodology: "Direct comparison against industrial-zoned warehouse transactions in the Athi River corridor.",
        siteVisitAt: valDaysAgo(70),
        completedAt: valDaysAgo(60),
        stageEnteredAt: valDaysAgo(50),
        notes: "Landlord opted to self-manage after reviewing the offer; declined to proceed with a mandate.",
        createdAt: valDaysAgo(75),
      },
    ];
    await db.insert(valuations).values(valuationsToInsert);
    console.log(`Created ${valuationsToInsert.length} valuations across the acquisition pipeline (requested/site_visit/valued/offer_sent x2/accepted/declined - mandate_signed reached via real conversion in backend verification).`);

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
