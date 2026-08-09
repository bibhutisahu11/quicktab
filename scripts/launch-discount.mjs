import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const org = await prisma.organization.findFirst({ where: { slug: 'kalinga-bites' } });
if (!org) { console.error('Org not found'); process.exit(1); }
console.log('Org:', org.name);

// Remove any existing launch discount to avoid duplicates
await prisma.discount.deleteMany({
  where: { orgId: org.id, name: { contains: 'Launch Offer' } }
});

const discount = await prisma.discount.create({
  data: {
    orgId: org.id,
    name: '🚀 Grand Launch Offer — 20% OFF',
    description: 'We recently launched Biryani & Chinese! Flat 20% off on all Biryani and Chinese items. Limited time offer!',
    type: 'PERCENTAGE',
    value: 20,
    scope: 'CATEGORY',
    categories: ['Biryani Zone', 'Dum Zone', 'Fried Rice & Noodles', 'Rolls & Momos', 'Soups'],
    daysOfWeek: [],
    minOrder: 0,
    active: true,
    validFrom: new Date(),
    validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
  }
});

console.log('✅ Created discount:', discount.name, '| id:', discount.id);
console.log('   Applies to:', discount.categories.join(', '));
console.log('   Valid until:', discount.validTo.toDateString());
await prisma.$disconnect();
