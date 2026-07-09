import fs from 'fs';

let content = fs.readFileSync('src/db/seed.ts', 'utf-8');

// Add avatars
content = content.replace(
  /email: "ceo@sunlandre.co.ke",\s*passwordHash: hashedPass,\s*name: "Paul Amos",\s*role: "ceo",\s*title: "Chief Executive Officer",\s*primaryEntityId: groupEntity.id,/g,
  'email: "ceo@sunlandre.co.ke", passwordHash: hashedPass, name: "Paul Amos", role: "ceo", title: "Chief Executive Officer", avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80", primaryEntityId: groupEntity.id,'
);

content = content.replace(
  /email: "gm@sunlandre.co.ke",\s*passwordHash: hashedPass,\s*name: "Grace Mutua",\s*role: "general_manager",\s*title: "General Manager",\s*primaryEntityId: groupEntity.id,/g,
  'email: "gm@sunlandre.co.ke", passwordHash: hashedPass, name: "Grace Mutua", role: "general_manager", title: "General Manager", avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80", primaryEntityId: groupEntity.id,'
);

content = content.replace(
  /email: "finance.head@sunlandre.co.ke",\s*passwordHash: hashedPass,\s*name: "Dennis Munge",\s*role: "finance_head",\s*title: "Head of Finance",\s*primaryEntityId: groupEntity.id,/g,
  'email: "finance.head@sunlandre.co.ke", passwordHash: hashedPass, name: "Dennis Munge", role: "finance_head", title: "Head of Finance", avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80", primaryEntityId: groupEntity.id,'
);

content = content.replace(
  /email: "sales1@sunlandre.co.ke",\s*passwordHash: hashedPass,\s*name: "Kevin Mbugua",\s*role: "property_manager",\s*title: "Senior Broker",\s*primaryEntityId: commEntity.id,/g,
  'email: "sales1@sunlandre.co.ke", passwordHash: hashedPass, name: "Kevin Mbugua", role: "property_manager", title: "Senior Broker", avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80", primaryEntityId: commEntity.id,'
);

content = content.replace(
  /email: "sales2@sunlandre.co.ke",\s*passwordHash: hashedPass,\s*name: "Lucy Kariuki",\s*role: "property_manager",\s*title: "Sales Agent",\s*primaryEntityId: resEntity.id,/g,
  'email: "sales2@sunlandre.co.ke", passwordHash: hashedPass, name: "Lucy Kariuki", role: "property_manager", title: "Sales Agent", avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80", primaryEntityId: resEntity.id,'
);


// Replace the propsToInsert static array to include media
const propertiesSearchStr = `    const propsToInsert = [
        {
          entityId: groupEntity.id,
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
        },
    ];`;

const propertiesReplacementStr = `    const propsToInsert: any[] = [
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
          media: [
            { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80", alt: "Living room", isPrimary: true },
            { url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80", alt: "Bedroom" },
          ]
        },
    ];`;

content = content.replace(propertiesSearchStr, propertiesReplacementStr);

// Replace the property loop
const loopSearchStr = `    for (let i = 2; i <= 15; i++) {
        propsToInsert.push({
          entityId: groupEntity.id,
          propertyCode: \`PROP-AUTO-\${i.toString().padStart(3, '0')}\`,
          name: \`Premium Listing \${i} \${i % 2 === 0 ? 'Apartments' : 'Plaza'}\`,
          propertyType: i % 2 === 0 ? "Apartment" : "Commercial Office",
          listingType: i % 3 === 0 ? "Sale" : "Rental",
          status: i % 4 === 0 ? "occupied" : "available",
          location: i % 2 === 0 ? "Kilimani, Nairobi" : "Nairobi CBD",
          ownerContactId: i % 2 === 0 ? landlordB.id : landlordA.id,
          monthlyRentKes: (Math.floor(Math.random() * 20) * 10000 + 50000).toString() + ".00",
          sizeSqft: Math.floor(Math.random() * 2000) + 1000,
        });
    }`;

const loopReplacementStr = `    const propertyTypes = ["Apartment", "Commercial", "House", "Villa", "Land"];
    const typeImages: Record<string, string[]> = {
      "Apartment": [
        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1de2d9d0d9?w=800&q=80"
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
        "https://images.unsplash.com/photo-1629016943072-0bf0eeefbb36?w=800&q=80"
      ]
    };
    const secondaryImages = [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80"
    ];

    for (let i = 2; i <= 20; i++) {
        const type = propertyTypes[i % propertyTypes.length];
        const primaryImg = typeImages[type][i % typeImages[type].length];
        const secImg = secondaryImages[i % secondaryImages.length];

        propsToInsert.push({
          entityId: groupEntity.id,
          propertyCode: \`PROP-AUTO-\${i.toString().padStart(3, '0')}\`,
          name: \`Premium \${type} \${i}\`,
          propertyType: type,
          listingType: i % 3 === 0 ? "Sale" : "Rental",
          status: i % 4 === 0 ? "occupied" : "available",
          location: i % 2 === 0 ? "Kilimani, Nairobi" : "Nairobi CBD",
          ownerContactId: i % 2 === 0 ? landlordB.id : landlordA.id,
          monthlyRentKes: (Math.floor(Math.random() * 20) * 10000 + 50000).toString() + ".00",
          sizeSqft: Math.floor(Math.random() * 2000) + 1000,
          media: [
            { url: primaryImg, alt: \`\${type} exterior view\`, isPrimary: true },
            { url: secImg, alt: "Interior view" }
          ]
        });
    }`;

content = content.replace(loopSearchStr, loopReplacementStr);

fs.writeFileSync('src/db/seed.ts', content, 'utf-8');
console.log('Done');
