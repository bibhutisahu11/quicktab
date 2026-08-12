export type OrderType = "TABLE" | "PARCEL";
export type OrderStatus = "PAYMENT_PENDING" | "PENDING" | "PREPARING" | "READY" | "DONE" | "CANCELLED";
export type UserRole = "SUPER_ADMIN" | "HOTEL_ADMIN" | "MANAGER" | "WAITER" | "KITCHEN" | "BILLER";

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;      // per-item spice/instruction note (also stores weight e.g. "60g")
  customGrams?: number; // for weight-based items: the total grams ordered
}

export interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  imageUrl: string | null;
  available: boolean;
  sortOrder: number;
  unit: string | null;  // e.g. "100g" — each +1 in cart = 1 unit
}

/** How to display quantity in the cart for a given unit */
export function formatQty(qty: number, unit: string | null | undefined): string {
  if (!unit || unit === "piece") return `${qty}`;
  // Weight units: multiply qty by the numeric part
  const match = unit.match(/^(\d+)(g|kg|ml|l)$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const suffix = match[2].toLowerCase();
    const total = num * qty;
    return `${total}${suffix}`;
  }
  return `${qty} × ${unit}`;
}

export interface TableData {
  id: string;
  name: string;
  qrToken: string;
  capacity: number;
  active: boolean;
}

export interface OrderItemData {
  id: string;
  name: string;
  price: number;
  quantity: number;
  menuItemId: string;
  notes?: string | null;
}

export type DiscountType = "PERCENTAGE" | "FLAT";
export type DiscountScope = "ALL" | "DAYS" | "ITEMS" | "CATEGORIES" | "CATEGORY";

export interface DiscountData {
  id: string;
  name: string;
  description: string | null;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  itemIds: string[];
  categories: string[];
  daysOfWeek: number[];
  minOrder: number | null;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
}

export interface AppliedDiscount {
  discount: DiscountData;
  saving: number;
}

export interface OrderData {
  id: string;
  orgId: string;
  type: OrderType;
  tableId: string | null;
  table: TableData | null;
  customerName: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  status: OrderStatus;
  discountAmount: number;
  total: number;
  paymentId: string | null;
  upiUtr: string | null;
  paymentScreenshot: string | null;
  paymentVerified: boolean;
  nudgeCount: number;
  nudgedAt: string | null;
  isRepeatDiner: boolean;
  items: OrderItemData[];
  createdAt: string;
  updatedAt: string;
}

export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  fssaiNumber: string | null;
  tagline: string | null;
  footerText: string | null;
  upiId: string | null;
  active: boolean;
}

export interface StaffMember {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

export interface OrgData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  active: boolean;
  createdAt: string;
}

