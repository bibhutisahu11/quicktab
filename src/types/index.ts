export type OrderType = "TABLE" | "PARCEL";
export type OrderStatus = "PAYMENT_PENDING" | "PENDING" | "PREPARING" | "READY" | "DONE" | "CANCELLED";
export type UserRole = "SUPER_ADMIN" | "HOTEL_ADMIN" | "MANAGER" | "WAITER" | "KITCHEN" | "BILLER";

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
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
}

export type DiscountType = "PERCENTAGE" | "FLAT";
export type DiscountScope = "ALL" | "DAYS" | "ITEMS" | "CATEGORIES";

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

