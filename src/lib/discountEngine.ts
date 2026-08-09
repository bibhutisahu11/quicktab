import { CartItem, DiscountData, AppliedDiscount } from "@/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export { DAY_NAMES };

/**
 * Given a list of active discounts and the current cart, returns which
 * discounts apply and how much they save.
 *
 * @param categoryMap  Optional map of menuItemId → category name.
 *                     Required for CATEGORY-scoped discounts to work correctly.
 */
export function applyDiscounts(
  discounts: DiscountData[],
  cart: CartItem[],
  cartTotal: number,
  categoryMap?: Record<string, string>,
): AppliedDiscount[] {
  const todayDow = new Date().getDay(); // 0=Sun ... 6=Sat
  const applied: AppliedDiscount[] = [];

  for (const d of discounts) {
    if (!d.active) continue;

    // Day-of-week gate (empty daysOfWeek = every day)
    if (d.daysOfWeek.length > 0 && !d.daysOfWeek.includes(todayDow)) continue;

    // Min order gate
    if (d.minOrder && cartTotal < d.minOrder) continue;

    let eligibleSubtotal = 0;

    if (d.scope === "ALL" || d.scope === "DAYS") {
      eligibleSubtotal = cartTotal;
    } else if (d.scope === "ITEMS") {
      for (const item of cart) {
        if (d.itemIds.includes(item.menuItemId)) {
          eligibleSubtotal += item.price * item.quantity;
        }
      }
    } else if (d.scope === "CATEGORIES") {
      for (const item of cart) {
        const cat = categoryMap?.[item.menuItemId];
        if (cat && d.categories.includes(cat)) {
          eligibleSubtotal += item.price * item.quantity;
        }
      }
    }

    if (eligibleSubtotal <= 0) continue;

    const saving =
      d.type === "PERCENTAGE"
        ? Math.min((eligibleSubtotal * d.value) / 100, eligibleSubtotal)
        : Math.min(d.value, eligibleSubtotal);

    if (saving > 0) applied.push({ discount: d, saving });
  }

  return applied.sort((a, b) => b.saving - a.saving);
}

export function totalDiscount(applied: AppliedDiscount[]): number {
  return applied.reduce((s, a) => s + a.saving, 0);
}
