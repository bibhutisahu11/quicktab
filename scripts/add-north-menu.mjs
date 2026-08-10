import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Find Kalinga Bites org
const org = await prisma.organization.findFirst({ where: { slug: 'kalinga-bites' } });
if (!org) { console.error('Org not found'); process.exit(1); }
console.log('Org:', org.name, org.id);

const NORTH_GRAVY = [
  { name: "Aloo Matar Dry Masala",  price: 150 },
  { name: "Veg Makhanwala",         price: 160 },
  { name: "Veg Korma",              price: 160 },
  { name: "Veg Jalfrezi",           price: 180 },
  { name: "Chana Masala",           price: 160 },
  { name: "Dal Fry",                price: 120 },
  { name: "Dal Makhani",            price: 170 },
  { name: "Aloo Methi Dry",        price: 160 },
  { name: "Aloo Mutter",           price: 180 },
  { name: "Aloo Fry",              price: 160 },
  { name: "Aloo Jeera",            price: 170 },
  { name: "Aloo Gobi",             price: 180 },
  { name: "Dum Aloo Hyderabadi",   price: 200 },
  { name: "Dum Aloo Kashmiri",     price: 200 },
  { name: "Mix Veg Curry",         price: 200 },
  { name: "Capsicum Masala",       price: 180 },
  { name: "Sri Sai Spl Curry",     price: 230 },
  { name: "Baby Corn Green Masala",price: 210 },
  { name: "Paneer Kholapuri",      price: 240 },
  { name: "Veg Do Pyaza",          price: 220 },
  { name: "Malai Mutter",          price: 180 },
  { name: "Malai Methi Mutter",    price: 220 },
  { name: "Mushroom Masala",       price: 220 },
  { name: "Channa Masala",         price: 160 },
  { name: "Mutter Masala",         price: 180 },
  { name: "Veg Pepper Masala",     price: 200 },
  { name: "Veg Makhanwala",        price: 220 },
  { name: "Stuffed Capsicum Masala", price: 200 },
];

const NORTH_SPL_GRAVY = [
  { name: "Paneer Butter Masala",   price: 249 },
  { name: "Shahi Paneer",           price: 249 },
  { name: "Paneer Kurma",           price: 249 },
  { name: "Paneer Burji",           price: 249 },
  { name: "Paneer Pasanda",         price: 249 },
  { name: "Paneer Mushroom Masala", price: 249 },
  { name: "Paneer Hyderabadi",      price: 249 },
  { name: "Paneer Tikka Masala",    price: 270 },
  { name: "Paneer Mutter Masala",   price: 249 },
  { name: "Shahi Kurma",            price: 230 },
  { name: "Dum Aloo",               price: 200 },
  { name: "Mushroom Burji",         price: 220 },
  { name: "Veg Kholapuri",          price: 230 },
  { name: "Veg Hyderabadi",         price: 230 },
  { name: "Veg Jaipuri",            price: 240 },
  { name: "Navarathna Kurma",       price: 249 },
  { name: "Kaju Masala",            price: 300 },
  { name: "Kaju Mutter",            price: 290 },
  { name: "Kaju Paneer",            price: 310 },
];

let inserted = 0;

for (const [idx, item] of NORTH_GRAVY.entries()) {
  await prisma.menuItem.create({
    data: {
      name: item.name,
      price: item.price,
      category: 'North Gravy',
      available: true,
      sortOrder: idx,
      orgId: org.id,
    }
  });
  inserted++;
}

for (const [idx, item] of NORTH_SPL_GRAVY.entries()) {
  await prisma.menuItem.create({
    data: {
      name: item.name,
      price: item.price,
      category: 'North Spl Gravy',
      available: true,
      sortOrder: idx,
      orgId: org.id,
    }
  });
  inserted++;
}

console.log(`✅ Inserted ${inserted} items (${NORTH_GRAVY.length} North Gravy + ${NORTH_SPL_GRAVY.length} North Spl Gravy)`);
await prisma.$disconnect();
