import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const org = await prisma.organization.findFirst({ where: { slug: 'kalinga-bites' } });
if (!org) { console.error('Org not found'); process.exit(1); }
console.log('Org:', org.name, org.id);

// ── Full Kalinga Bites Menu ────────────────────────────────────────────────
const MENU = [

  // ── Breakfast Delights ───────────────────────────────────────────────────
  { cat: 'Breakfast Delights', name: 'Dahibara Aloodum',            price: 50  },
  { cat: 'Breakfast Delights', name: 'Mitha Dahibara',              price: 50  },
  { cat: 'Breakfast Delights', name: 'Bara (Vada)',                  price: 15  },
  { cat: 'Breakfast Delights', name: 'Ghuguni',                     price: 10  },
  { cat: 'Breakfast Delights', name: 'Gulgula',                     price: 15  },
  { cat: 'Breakfast Delights', name: 'Kakara Pitha',                price: 25  },
  { cat: 'Breakfast Delights', name: 'Aloo Chop',                   price: 15  },
  { cat: 'Breakfast Delights', name: 'Chakuli Pitha',               price: 30  },
  { cat: 'Breakfast Delights', name: 'Upma',                        price: 50  },
  { cat: 'Breakfast Delights', name: 'Puri',                        price: 50  },
  { cat: 'Breakfast Delights', name: 'Poha',                        price: 50  },
  { cat: 'Breakfast Delights', name: 'Aloo Paratha',                price: 70  },
  { cat: 'Breakfast Delights', name: 'Gobi Paratha',                price: 80  },
  { cat: 'Breakfast Delights', name: 'Paneer Paratha',              price: 110 },
  { cat: 'Breakfast Delights', name: 'Triangular Paratha',          price: 25  },
  { cat: 'Breakfast Delights', name: 'Chole Bhature (2 pcs)',       price: 100 },

  // ── Evening Snacks ───────────────────────────────────────────────────────
  { cat: 'Evening Snacks', name: 'Samosa (Bharta)',                  price: 15  },
  { cat: 'Evening Snacks', name: 'Samosa (Cut Aloo)',               price: 20  },
  { cat: 'Evening Snacks', name: 'Nimki',                           price: 25  },
  { cat: 'Evening Snacks', name: 'Onion Pakodi',                    price: 40  },
  { cat: 'Evening Snacks', name: 'Aloo Pakodi',                     price: 30  },
  { cat: 'Evening Snacks', name: 'Chicken Pakoda (Odisha Style)',   price: 120 },
  { cat: 'Evening Snacks', name: 'Cabbage Pakoda',                  price: 50  },
  { cat: 'Evening Snacks', name: 'Cabbage Chicken Pakoda',          price: 100 },
  { cat: 'Evening Snacks', name: 'Chakuli Mutton',                  price: 250 },
  { cat: 'Evening Snacks', name: 'Jianta Mutton Ghugni',            price: 70  },

  // ── Non-Veg Starters ─────────────────────────────────────────────────────
  { cat: 'Non-Veg Starters', name: 'Bali Prawn (6 pcs)',            price: 230 },
  { cat: 'Non-Veg Starters', name: 'Butter Garlic Prawn',           price: 250 },
  { cat: 'Non-Veg Starters', name: 'Prawn Lemon',                   price: 250 },
  { cat: 'Non-Veg Starters', name: 'Prawn Manchurian Dry',          price: 250 },
  { cat: 'Non-Veg Starters', name: 'Prawn Koliwada',                price: 250 },
  { cat: 'Non-Veg Starters', name: 'Prawn 65 (10 pcs)',             price: 250 },
  { cat: 'Non-Veg Starters', name: 'Fish Chilly',                   price: 250 },
  { cat: 'Non-Veg Starters', name: 'Fish Apollo',                   price: 280 },
  { cat: 'Non-Veg Starters', name: 'Fish Koliwada',                 price: 270 },
  { cat: 'Non-Veg Starters', name: 'Fish 65',                       price: 260 },
  { cat: 'Non-Veg Starters', name: 'Veg American Chapsy',           price: 180 },
  { cat: 'Non-Veg Starters', name: 'Chicken American Chapsy',       price: 220 },
  { cat: 'Non-Veg Starters', name: 'Chicken Manchurian Dry',        price: 200 },
  { cat: 'Non-Veg Starters', name: 'Chicken Manchurian Semi Gravy', price: 220 },
  { cat: 'Non-Veg Starters', name: 'Chicken Manchurian Gravy',      price: 250 },
  { cat: 'Non-Veg Starters', name: 'Chicken Chilly Dry',            price: 220 },
  { cat: 'Non-Veg Starters', name: 'Chicken Chilly Semi Gravy',     price: 240 },
  { cat: 'Non-Veg Starters', name: 'Chicken Chilly Gravy',          price: 260 },
  { cat: 'Non-Veg Starters', name: 'Roasted Chilly Chicken',        price: 240 },
  { cat: 'Non-Veg Starters', name: 'Chicken Crispy (8 pcs)',        price: 240 },
  { cat: 'Non-Veg Starters', name: 'Cream Chicken (8 pcs)',         price: 250 },
  { cat: 'Non-Veg Starters', name: 'Garlic Chicken',                price: 210 },
  { cat: 'Non-Veg Starters', name: 'Lemon Chicken',                 price: 200 },
  { cat: 'Non-Veg Starters', name: 'Butter Garlic Chicken',         price: 220 },
  { cat: 'Non-Veg Starters', name: 'Chicken Finger (8 pcs)',        price: 240 },
  { cat: 'Non-Veg Starters', name: 'Thread Chicken',                price: 260 },
  { cat: 'Non-Veg Starters', name: 'Hunan Chicken (10 pcs)',        price: 240 },
  { cat: 'Non-Veg Starters', name: 'Basil Chicken (8 pcs)',         price: 240 },
  { cat: 'Non-Veg Starters', name: 'Spinach Chicken (10 pcs)',      price: 240 },
  { cat: 'Non-Veg Starters', name: 'French Chicken',                price: 240 },
  { cat: 'Non-Veg Starters', name: 'Chicken Pepper Dry (10 pcs)',   price: 250 },
  { cat: 'Non-Veg Starters', name: 'Chicken Pepper Wings (10 pcs)', price: 240 },
  { cat: 'Non-Veg Starters', name: 'Sweet Chilly Chicken (10 pcs)', price: 210 },
  { cat: 'Non-Veg Starters', name: 'Chicken Kabab (8 pcs)',         price: 180 },
  { cat: 'Non-Veg Starters', name: 'Chicken Lollipop (6 pcs)',      price: 240 },
  { cat: 'Non-Veg Starters', name: 'Chicken Spring Roll (2 pcs)',   price: 160 },
  { cat: 'Non-Veg Starters', name: 'Chicken Satay (6 pcs)',         price: 260 },
  { cat: 'Non-Veg Starters', name: 'Chicken Pakoda',                price: 180 },
  { cat: 'Non-Veg Starters', name: 'Dragon Chicken (8 pcs)',        price: 250 },
  { cat: 'Non-Veg Starters', name: 'Honey Chilly Chicken (8 pcs)',  price: 220 },
  { cat: 'Non-Veg Starters', name: 'Chicken 65 (10 pcs)',           price: 240 },
  { cat: 'Non-Veg Starters', name: 'Chicken 55 (10 pcs)',           price: 240 },
  { cat: 'Non-Veg Starters', name: 'Chicken Apollo (10 pcs)',       price: 270 },
  { cat: 'Non-Veg Starters', name: 'Fancy Chicken (8 pcs)',         price: 240 },
  { cat: 'Non-Veg Starters', name: 'Egg Manchurian (8 pcs)',        price: 160 },
  { cat: 'Non-Veg Starters', name: 'Egg Chilly (8 pcs)',            price: 180 },

  // ── Dosa Corner ──────────────────────────────────────────────────────────
  { cat: 'Dosa Corner', name: 'Idli (3 pcs)',                        price: 50  },
  { cat: 'Dosa Corner', name: 'Idli Vada',                           price: 50  },
  { cat: 'Dosa Corner', name: 'Khali Dosa',                          price: 80  },
  { cat: 'Dosa Corner', name: 'Plain Dosa',                          price: 50  },
  { cat: 'Dosa Corner', name: 'Neer Dosa',                           price: 80  },
  { cat: 'Dosa Corner', name: 'Masala Dosa',                         price: 80  },
  { cat: 'Dosa Corner', name: 'Butter Plain Dosa',                   price: 75  },
  { cat: 'Dosa Corner', name: 'Butter Masala Dosa',                  price: 90  },
  { cat: 'Dosa Corner', name: 'Ghee Masala Dosa',                    price: 100 },
  { cat: 'Dosa Corner', name: 'Ghee Roast Dosa',                     price: 80  },
  { cat: 'Dosa Corner', name: 'Mysore Masala Dosa',                  price: 100 },
  { cat: 'Dosa Corner', name: 'Spring Dosa',                         price: 100 },
  { cat: 'Dosa Corner', name: 'Open Butter Masala Dosa',             price: 90  },
  { cat: 'Dosa Corner', name: 'Cheese Plain Dosa',                   price: 80  },
  { cat: 'Dosa Corner', name: 'Cheese Masala Dosa',                  price: 100 },
  { cat: 'Dosa Corner', name: 'Paneer Plain Dosa',                   price: 90  },
  { cat: 'Dosa Corner', name: 'Paneer Masala Dosa',                  price: 110 },
  { cat: 'Dosa Corner', name: 'Paper Plain Dosa',                    price: 90  },
  { cat: 'Dosa Corner', name: 'Paper Masala Dosa',                   price: 100 },
  { cat: 'Dosa Corner', name: 'Paper Butter Plain Dosa',             price: 110 },
  { cat: 'Dosa Corner', name: 'Paper Butter Masala Dosa',            price: 120 },
  { cat: 'Dosa Corner', name: 'Ghee Paper Plain',                    price: 140 },
  { cat: 'Dosa Corner', name: 'Ghee Paper Masala',                   price: 150 },
  { cat: 'Dosa Corner', name: 'Rava Dosa',                           price: 80  },
  { cat: 'Dosa Corner', name: 'Rava Masala Dosa',                    price: 90  },
  { cat: 'Dosa Corner', name: 'Rava Onion Dosa',                     price: 100 },
  { cat: 'Dosa Corner', name: 'Rava Onion Masala Dosa',              price: 90  },
  { cat: 'Dosa Corner', name: 'Pudi Ghee Dosa',                      price: 80  },
  { cat: 'Dosa Corner', name: 'Pudi Ghee Masala Dosa',               price: 100 },
  { cat: 'Dosa Corner', name: 'Ghee Set Dosa',                       price: 80  },
  { cat: 'Dosa Corner', name: 'Ghee Mysore Masala',                  price: 120 },
  { cat: 'Dosa Corner', name: 'Set Dosa',                            price: 60  },
  { cat: 'Dosa Corner', name: 'Onion Uttappa',                       price: 80  },
  { cat: 'Dosa Corner', name: 'Tomato Uttappa',                      price: 80  },

  // ── Rolls & Momos ────────────────────────────────────────────────────────
  { cat: 'Rolls & Momos', name: 'Paneer Roll',                       price: 100 },
  { cat: 'Rolls & Momos', name: 'Egg Roll',                          price: 80  },
  { cat: 'Rolls & Momos', name: 'Chicken Roll',                      price: 100 },
  { cat: 'Rolls & Momos', name: 'Egg Chicken Roll',                  price: 120 },
  { cat: 'Rolls & Momos', name: 'Double Egg Chicken Roll',           price: 140 },
  { cat: 'Rolls & Momos', name: 'Egg Chicken Cheese Roll',           price: 150 },
  { cat: 'Rolls & Momos', name: 'Veg Momos (Steamed, 6 pcs)',        price: 80  },
  { cat: 'Rolls & Momos', name: 'Chicken Momos (Steamed, 6 pcs)',    price: 100 },
  { cat: 'Rolls & Momos', name: 'Veg Fried Momos (6 pcs)',           price: 100 },
  { cat: 'Rolls & Momos', name: 'Chicken Fried Momos (6 pcs)',       price: 120 },
  { cat: 'Rolls & Momos', name: 'Paneer Momos (Steamed, 6 pcs)',     price: 100 },
  { cat: 'Rolls & Momos', name: 'Paneer Fried Momos (6 pcs)',        price: 120 },

  // ── Soups ────────────────────────────────────────────────────────────────
  { cat: 'Soups', name: 'Hot & Sour Veg',                            price: 120 },
  { cat: 'Soups', name: 'Veg Manchow',                               price: 130 },
  { cat: 'Soups', name: 'Cream of Mushroom',                         price: 140 },
  { cat: 'Soups', name: 'Sweet Corn Soup',                           price: 140 },
  { cat: 'Soups', name: 'Veg Clear Soup',                            price: 150 },
  { cat: 'Soups', name: 'Palak Soup',                                price: 120 },
  { cat: 'Soups', name: 'Tomato Soup',                               price: 100 },
  { cat: 'Soups', name: 'French Onion Soup',                         price: 130 },
  { cat: 'Soups', name: 'Lemon Coriander Soup',                      price: 120 },
  { cat: 'Soups', name: 'Hot & Sour Chicken',                        price: 140 },
  { cat: 'Soups', name: 'Chicken Manchow',                           price: 140 },
  { cat: 'Soups', name: 'Cream of Chicken',                          price: 140 },
  { cat: 'Soups', name: 'Chicken Sweet Corn',                        price: 140 },
  { cat: 'Soups', name: 'Chicken Clear Soup',                        price: 120 },
  { cat: 'Soups', name: 'Chicken Yang Chow Soup',                    price: 160 },

  // ── Fried Rice & Noodles ─────────────────────────────────────────────────
  { cat: 'Fried Rice & Noodles', name: 'Veg Fried Rice',             price: 100 },
  { cat: 'Fried Rice & Noodles', name: 'Mushroom Fried Rice',        price: 130 },
  { cat: 'Fried Rice & Noodles', name: 'Paneer Fried Rice',          price: 130 },
  { cat: 'Fried Rice & Noodles', name: 'Egg Fried Rice',             price: 130 },
  { cat: 'Fried Rice & Noodles', name: 'Chicken Fried Rice',         price: 150 },
  { cat: 'Fried Rice & Noodles', name: 'Mixed Fried Rice',           price: 180 },
  { cat: 'Fried Rice & Noodles', name: 'Schezwan Veg Fried Rice',    price: 110 },
  { cat: 'Fried Rice & Noodles', name: 'Schezwan Chicken Fried Rice',price: 160 },
  { cat: 'Fried Rice & Noodles', name: 'Veg Noodles',                price: 130 },
  { cat: 'Fried Rice & Noodles', name: 'Veg Schezwan Noodles',       price: 150 },
  { cat: 'Fried Rice & Noodles', name: 'Veg Hakka Noodles',          price: 150 },
  { cat: 'Fried Rice & Noodles', name: 'Veg Hongkong Noodles',       price: 150 },
  { cat: 'Fried Rice & Noodles', name: 'Veg Singapore Noodles',      price: 140 },
  { cat: 'Fried Rice & Noodles', name: 'Veg Paneer Noodles',         price: 200 },
  { cat: 'Fried Rice & Noodles', name: 'Veg Mushroom Noodles',       price: 190 },
  { cat: 'Fried Rice & Noodles', name: 'Veg Mix Noodles',            price: 210 },
  { cat: 'Fried Rice & Noodles', name: 'Egg Noodles',                price: 150 },
  { cat: 'Fried Rice & Noodles', name: 'Chicken Noodles',            price: 180 },
  { cat: 'Fried Rice & Noodles', name: 'Chicken Hakka Noodles',      price: 200 },
  { cat: 'Fried Rice & Noodles', name: 'Chicken Schezwan Noodles',   price: 210 },
  { cat: 'Fried Rice & Noodles', name: 'Chicken Hongkong Noodles',   price: 210 },
  { cat: 'Fried Rice & Noodles', name: 'Chicken Singapore Noodles',  price: 220 },
  { cat: 'Fried Rice & Noodles', name: 'Nonveg Mix Noodles',         price: 250 },

  // ── Biryani Zone ─────────────────────────────────────────────────────────
  { cat: 'Biryani Zone', name: 'Chicken Dum Biryani',                price: 200 },
  { cat: 'Biryani Zone', name: 'Chicken Fry Piece Biryani',          price: 210 },
  { cat: 'Biryani Zone', name: 'Lollypop Biryani',                   price: 210 },
  { cat: 'Biryani Zone', name: 'Boneless Biryani',                   price: 170 },
  { cat: 'Biryani Zone', name: 'Tikka Biryani',                      price: 130 },
  { cat: 'Biryani Zone', name: 'Kalmi Biryani',                      price: 130 },
  { cat: 'Biryani Zone', name: 'Kabab Biryani',                      price: 250 },
  { cat: 'Biryani Zone', name: 'Fish Biryani',                       price: 110 },
  { cat: 'Biryani Zone', name: 'Prawns Biryani',                     price: 250 },
  { cat: 'Biryani Zone', name: 'Mutton Biryani',                     price: 230 },
  { cat: 'Biryani Zone', name: 'Chicken Family Pack Biryani (Serves 3)', price: 510 },
  { cat: 'Biryani Zone', name: 'Mutton Family Pack Biryani (Serves 3)',  price: 650 },
  { cat: 'Biryani Zone', name: 'Egg Biryani',                        price: 170 },
  { cat: 'Biryani Zone', name: 'Veg Biryani',                        price: 170 },
  { cat: 'Biryani Zone', name: 'Mushroom Biryani',                   price: 190 },
  { cat: 'Biryani Zone', name: 'Paneer Biryani',                     price: 210 },
  { cat: 'Biryani Zone', name: 'Biryani Rice',                       price: 110 },

  // ── Dum Zone ─────────────────────────────────────────────────────────────
  { cat: 'Dum Zone', name: 'Veg Dum Biryani',                        price: 150 },
  { cat: 'Dum Zone', name: 'Paneer Dum Biryani',                     price: 170 },
  { cat: 'Dum Zone', name: 'Egg Dum Biryani',                        price: 170 },
  { cat: 'Dum Zone', name: 'Chicken Dum Biryani',                    price: 180 },
  { cat: 'Dum Zone', name: 'Chicken Chilli Biryani',                 price: 200 },
  { cat: 'Dum Zone', name: 'Chicken 65 Biryani',                     price: 200 },
  { cat: 'Dum Zone', name: 'Steam Rice',                             price: 60  },
  { cat: 'Dum Zone', name: 'Jeera Rice',                             price: 70  },
  { cat: 'Dum Zone', name: 'Ghee Rice',                              price: 70  },
  { cat: 'Dum Zone', name: 'Veg Pulao',                              price: 100 },
  { cat: 'Dum Zone', name: 'Kashmiri Pulao',                         price: 110 },

  // ── Breads ───────────────────────────────────────────────────────────────
  { cat: 'Breads', name: 'Butter Roti',                              price: 60  },
  { cat: 'Breads', name: 'Fulka',                                    price: 15  },
  { cat: 'Breads', name: 'Butter Fulka',                             price: 20  },
  { cat: 'Breads', name: 'Roomali Roti',                             price: 70  },
  { cat: 'Breads', name: 'Naan',                                     price: 70  },
  { cat: 'Breads', name: 'Butter Naan',                              price: 80  },
  { cat: 'Breads', name: 'Garlic Butter Naan',                       price: 90  },
  { cat: 'Breads', name: 'Malabar Paratha',                          price: 50  },
  { cat: 'Breads', name: 'Tandoor Plain Paratha',                    price: 70  },
  { cat: 'Breads', name: 'Stuffed Paratha',                          price: 80  },
  { cat: 'Breads', name: 'Methi Kulcha',                             price: 70  },
  { cat: 'Breads', name: 'Stuffed Kulcha',                           price: 80  },

  // ── Egg Zone ─────────────────────────────────────────────────────────────
  { cat: 'Egg Zone', name: 'Egg Roast',                              price: 150 },
  { cat: 'Egg Zone', name: 'Egg Masala / Kadai',                     price: 150 },
  { cat: 'Egg Zone', name: 'Egg Potato Curry',                       price: 140 },
  { cat: 'Egg Zone', name: 'Egg Burji',                              price: 140 },
  { cat: 'Egg Zone', name: 'Omlet',                                  price: 70  },
  { cat: 'Egg Zone', name: 'Boiled Egg (2 pcs)',                     price: 50  },
  { cat: 'Egg Zone', name: 'Egg Tadka Half',                         price: 140 },
  { cat: 'Egg Zone', name: 'Egg Tadka Full',                         price: 200 },
  { cat: 'Egg Zone', name: 'Egg Chicken Tadka Half',                 price: 160 },
  { cat: 'Egg Zone', name: 'Egg Chicken Tadka Full',                 price: 220 },

  // ── Sweets ───────────────────────────────────────────────────────────────
  { cat: 'Sweets', name: 'Chhenapoda Sugar (per Kg)',                price: 650 },
  { cat: 'Sweets', name: 'Chhenapoda Jaggery (per Kg)',              price: 700 },
  { cat: 'Sweets', name: 'Pahala Rasagola',                          price: 25  },
  { cat: 'Sweets', name: 'White Rasagola',                           price: 25  },
  { cat: 'Sweets', name: 'White Rasagola Big',                       price: 30  },
  { cat: 'Sweets', name: 'Chhena Steam',                             price: 60  },
  { cat: 'Sweets', name: 'Chhena Tadia',                             price: 40  },
  { cat: 'Sweets', name: 'Chhena Jhilli',                            price: 40  },
  { cat: 'Sweets', name: 'Malpua',                                   price: 40  },
  { cat: 'Sweets', name: 'Rasmalai',                                 price: 60  },
  { cat: 'Sweets', name: 'Labanglata',                               price: 30  },
  { cat: 'Sweets', name: 'Feni / Khaja',                             price: 30  },
  { cat: 'Sweets', name: 'Chitrakoot',                               price: 40  },
  { cat: 'Sweets', name: 'Gulab Jamun Roll',                         price: 40  },
  { cat: 'Sweets', name: 'Milk Sandwich',                            price: 50  },
  { cat: 'Sweets', name: 'Milk Cake',                                price: 30  },
  { cat: 'Sweets', name: 'Rabdi',                                    price: 60  },
  { cat: 'Sweets', name: 'Mitha Dahi (Sweet Curd)',                  price: 40  },
  { cat: 'Sweets', name: 'Gulab Jamun',                              price: 25  },

  // ── Beverages ────────────────────────────────────────────────────────────
  { cat: 'Beverages', name: 'Lime Soda',                             price: 50  },
  { cat: 'Beverages', name: 'Fresh Lime Water',                      price: 40  },
  { cat: 'Beverages', name: 'Soft Drink (Small)',                    price: 20  },
  { cat: 'Beverages', name: 'Soft Drink (Big 600ml)',                price: 40  },
  { cat: 'Beverages', name: 'Water Bottle (Small)',                  price: 10  },
  { cat: 'Beverages', name: 'Water Bottle (Big)',                    price: 20  },
];

// Fetch existing items to skip duplicates
const existing = await prisma.menuItem.findMany({
  where: { orgId: org.id },
  select: { name: true, category: true },
});
const existingSet = new Set(existing.map(e => `${e.category}::${e.name.toLowerCase()}`));

const toInsert = MENU.filter(i => !existingSet.has(`${i.cat}::${i.name.toLowerCase()}`));
console.log(`Total: ${MENU.length} | Already exist: ${MENU.length - toInsert.length} | Inserting: ${toInsert.length}`);

// Group by category for sorted sortOrder
const byCat = {};
for (const item of toInsert) {
  if (!byCat[item.cat]) byCat[item.cat] = [];
  byCat[item.cat].push(item);
}

let inserted = 0;
for (const [cat, items] of Object.entries(byCat)) {
  for (const [idx, item] of items.entries()) {
    await prisma.menuItem.create({
      data: { name: item.name, price: item.price, category: cat, available: true, sortOrder: idx, orgId: org.id }
    });
    inserted++;
  }
  console.log(`  ✓ ${cat}: ${items.length} items`);
}

console.log(`\n✅ Done! ${inserted} new items added across ${Object.keys(byCat).length} categories`);
await prisma.$disconnect();
