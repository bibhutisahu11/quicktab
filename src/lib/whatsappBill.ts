import { OrderData, OrgSettings } from "@/types";

/**
 * Opens WhatsApp with a pre-filled bill message for the given order.
 * Uses the wa.me deep-link — no API key needed, completely free.
 * Admin taps "Send" in WhatsApp to deliver it to the customer.
 */
export function sendWhatsAppBill(order: OrderData, org: OrgSettings | null) {
  const rawPhone = order.phone?.replace(/\D/g, "") ?? "";
  // Add India country code if not already present
  const to = rawPhone ? `91${rawPhone.replace(/^91/, "")}` : "";

  const orgName = org?.name ?? "Restaurant";
  const orderId = `#${order.id.slice(-6).toUpperCase()}`;
  const date = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const typeLabel = order.type === "TABLE" && order.table
    ? `Table: ${order.table.name}`
    : order.type === "PARCEL" ? "Parcel / Takeaway" : "Dine-in";

  const itemLines = order.items
    .map((i) => {
      const notes = i.notes ? ` (${i.notes})` : "";
      return `  • ${i.name}${notes} ×${i.quantity} — ₹${i.price.toFixed(0)}`;
    })
    .join("\n");

  const parcelCharge = (order as unknown as { parcelCharge?: number }).parcelCharge ?? 0;

  const subtotal = order.items.reduce((sum, item) => sum + item.price, 0);
  const discountAmt = order.discountType === "PERCENTAGE"
    ? subtotal * ((order.discount ?? 0) / 100)
    : (order.discount ?? 0);
  const amountToPay = Math.max(0, subtotal - discountAmt + parcelCharge);

  const discountLine = discountAmt > 0 ? `\n  Discount: -₹${discountAmt.toFixed(0)}` : "";
  const parcelLine = parcelCharge > 0 ? `\n  Parcel charge: +₹${parcelCharge}` : "";

  const lines = [
    `🧾 *${orgName}*`,
    ``,
    `Order: *${orderId}*`,
    `Date: ${date}`,
    `${typeLabel}`,
    `Customer: ${order.customerName}`,
    ``,
    `*Items:*`,
    itemLines,
    ``,
    `──────────────────`,
    `Subtotal: ₹${subtotal.toFixed(0)}${discountLine}${parcelLine}`,
    `*Amount to Pay: ₹${amountToPay.toFixed(0)}*`,
    `──────────────────`,
    ``,
    `Thank you for visiting us! 🙏`,
    org?.phone ? `📞 ${org.phone}` : "",
    org?.address ? `📍 ${org.address}` : "",
  ].filter(Boolean).join("\n").trim();

  const url = to
    ? `https://wa.me/${to}?text=${encodeURIComponent(lines)}`
    : `https://wa.me/?text=${encodeURIComponent(lines)}`;

  window.open(url, "_blank");
}
