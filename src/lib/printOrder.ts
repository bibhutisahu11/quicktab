import { OrderData, OrgSettings } from "@/types";

// ── helpers ────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function logoHtml(url: string | null | undefined) {
  if (!url) return "";
  return `<img src="${esc(url)}" alt="logo"
    style="max-height:130px;max-width:260px;width:100%;object-fit:contain;display:block;margin:0 auto 10px;filter:contrast(1.4) brightness(0.85);" />`;
}

/** Receipt number: DDMM-SERIAL  e.g. 2807-A3F9 */
function receiptNo(orderId: string, createdAt: string) {
  const d = new Date(createdAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const serial = orderId.slice(-4).toUpperCase();
  return `${dd}${mm}-${serial}`;
}

// ── thermal receipt CSS ────────────────────────────────────────────────────────
// Rules for thermal printers:
//  • Courier New — fixed-width keeps columns aligned
//  • Font sizes 15-16px base, 18-20px for headings
//  • Pure black (#000) — grays print faint / invisible on thermal
//  • Generous line-height (1.5) for readability
//  • 80mm page width; fallback 58mm via @page
//  • No shadows, no colors other than black on white

const thermalCss = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { margin:0 !important; padding:0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    width: 56mm;
    max-width: 56mm;
    margin: 0 !important;
    padding: 2px 1mm 4px 0;
    color: #000;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: 700; }
  .hotel-name {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .tagline {
    font-size: 13px;
    font-weight: 700;
    margin-top: 1px;
  }
  .meta {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.4;
    text-align: center;
  }
  .order-type-badge {
    font-size: 17px;
    font-weight: 900;
    text-align: center;
    letter-spacing: 1px;
    border: 2px solid #000;
    padding: 2px 4px;
    margin: 4px 0 3px;
    text-transform: uppercase;
  }
  hr.divider {
    border: none;
    border-top: 2px dashed #000;
    margin: 5px 0;
  }
  hr.solid {
    border: none;
    border-top: 2px solid #000;
    margin: 5px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    font-size: 20px;
    line-height: 1.45;
  }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  col.col-item { width: auto; }
  col.col-qty  { width: 22px; }
  col.col-amt  { width: 48px; }
  th {
    font-size: 12px;
    font-weight: 700;
    border-bottom: 2px solid #000;
    padding-bottom: 2px;
    overflow: hidden;
  }
  th.left  { text-align: left; }
  th.right { text-align: right; }
  th.center{ text-align: center; }
  td {
    font-size: 13px;
    font-weight: 700;
    padding: 2px 0;
    vertical-align: top;
    overflow: hidden;
    word-break: break-word;
  }
  td.qty { text-align: center; }
  td.amt { text-align: right; white-space: nowrap; }
  .total-row td {
    font-weight: 900;
    font-size: 18px;
    padding-top: 5px;
    border-top: 2px solid #000;
  }
  .discount-row td {
    font-size: 17px;
    padding-top: 3px;
  }
  .footer-text {
    font-size: 17px;
    margin-top: 8px;
    text-align: center;
    font-weight: 700;
  }
  @media print {
    html, body {
      width: 56mm !important;
      margin: 0 !important;
      padding-left: 0 !important;
    }
    @page {
      margin: 0 !important;
      size: 58mm auto;
    }
  }
`;

// ── single order receipt ───────────────────────────────────────────────────────

export function printOrder(order: OrderData, org?: Partial<OrgSettings> | null) {
  const hotelName  = org?.name ?? "My Hotel";
  const tagline    = org?.tagline ?? "";
  const footer     = org?.footerText ?? "Thank you for your order!";
  const gst        = org?.gstNumber ?? "";
  const fssai      = org?.fssaiNumber ?? "";
  const orgAddress = org?.address ?? "";
  const orgPhone   = org?.phone ?? "";
  const orgEmail   = org?.email ?? "";

  const d = new Date(order.createdAt);
  const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  const isDineIn = order.type === "TABLE";
  const tableName = order.table?.name ?? "?";

  const itemRows = order.items
    .map((item) => {
      const lineTotal = Number(item.price) || 0;
      const amtStr = lineTotal === 0 ? "FREE" : `&#8377;${lineTotal.toFixed(0)}`;
      return `
      <tr>
        <td>${esc(item.name)}${item.notes ? `<br/><span style="font-size:11px;">* ${esc(item.notes)}</span>` : ""}</td>
        <td class="qty">x${item.quantity}</td>
        <td class="amt">${amtStr}</td>
      </tr>`;
    })
    .join("");

  const metaLines = [
    orgAddress ? `<div>${esc(orgAddress)}</div>` : "",
    orgPhone   ? `<div>Tel: ${esc(orgPhone)}</div>` : "",
    orgEmail   ? `<div>${esc(orgEmail)}</div>` : "",
    gst        ? `<div>GST: ${esc(gst)}</div>` : "",
    fssai      ? `<div>FSSAI: ${esc(fssai)}</div>` : "",
  ].filter(Boolean).join("");

  const discountLine = order.discountAmount && order.discountAmount > 0
    ? `<tr class="discount-row"><td colspan="2">Discount</td><td class="amt">-&#8377;${order.discountAmount.toFixed(0)}</td></tr>`
    : "";
  const parcelLine = (order as { parcelCharge?: number }).parcelCharge && (order as { parcelCharge?: number }).parcelCharge! > 0
    ? `<tr class="discount-row"><td colspan="2">Parcel Charge</td><td class="amt">+&#8377;${(order as { parcelCharge?: number }).parcelCharge!.toFixed(0)}</td></tr>`
    : "";

  const payMethod = (order as { paymentMethod?: string }).paymentMethod ?? "UPI";
  const paymentLine = `<div class="row" style="font-size:13px;font-weight:600;margin-top:3px;">
    <span>Payment:</span><span>${payMethod === "CASH" ? "Cash" : "UPI"}</span>
  </div>`;
  const utrLine = order.upiUtr
    ? `<div class="row" style="font-size:12px;margin-top:1px;"><span>UTR:</span><span>${esc(order.upiUtr)}</span></div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Receipt ${receiptNo(order.id, order.createdAt)}</title>
  <style>${thermalCss}</style>
</head>
<body>
  ${logoHtml(org?.logoUrl)}
  <div class="center hotel-name">${esc(hotelName)}</div>
  ${tagline   ? `<div class="center tagline">${esc(tagline)}</div>` : ""}
  ${metaLines ? `<div class="meta" style="margin-top:3px;">${metaLines}</div>` : ""}
  <hr class="divider"/>

  <!-- Order type badge -->
  <div class="order-type-badge">
    ${isDineIn ? `🍽️ DINE-IN &nbsp;|&nbsp; Table: ${esc(tableName)}` : "📦 PARCEL / TAKEAWAY"}
  </div>

  <div class="row" style="margin-top:3px;font-size:13px;">
    <span class="bold">Rcpt# ${receiptNo(order.id, order.createdAt)}</span>
    <span>${timeStr}</span>
  </div>
  <div style="font-size:14px;margin-top:1px;">${dateStr}</div>
  <hr class="divider"/>

  <div style="font-size:14px;font-weight:700;">Customer: ${esc(order.customerName)}</div>
  ${order.phone           ? `<div style="font-size:14px;font-weight:700;">Ph: ${esc(order.phone)}</div>` : ""}
  ${order.deliveryAddress ? `<div style="font-size:13px;font-weight:700;">Addr: ${esc(order.deliveryAddress)}</div>` : ""}
  ${order.notes           ? `<div style="font-size:13px;font-style:italic;margin-top:1px;">Note: ${esc(order.notes)}</div>` : ""}
  <hr class="divider"/>

  <table>
    <colgroup>
      <col class="col-item"/>
      <col class="col-qty"/>
      <col class="col-amt"/>
    </colgroup>
    <thead>
      <tr>
        <th class="left">Item</th>
        <th class="center">Qty</th>
        <th class="right">Amt</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      ${discountLine}
      ${parcelLine}
      <tr class="total-row">
        <td colspan="2">TOTAL</td>
        <td class="amt">&#8377;${Number(order.total).toFixed(0)}</td>
      </tr>
    </tfoot>
  </table>

  <hr class="divider"/>
  ${paymentLine}
  ${utrLine}
  <div class="footer-text">${esc(footer)}</div>
  <div style="text-align:center;font-size:12px;margin-top:4px;">*** Thank You — Visit Again ***</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=240,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 350);
}

// ── all orders day report (A4 landscape, not thermal) ─────────────────────────

export function printAllOrders(
  orders: OrderData[],
  org?: Partial<OrgSettings> | null,
  date?: string
) {
  const hotelName  = org?.name ?? "My Hotel";
  const tagline    = org?.tagline ?? "";
  const footer     = org?.footerText ?? "";
  const gst        = org?.gstNumber ? `GST: ${org.gstNumber}` : "";
  const fssai      = org?.fssaiNumber ? `FSSAI: ${org.fssaiNumber}` : "";
  const label      = date ?? new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const grandTotal = orders.reduce((s, o) => s + o.total, 0);

  const subheader = [gst, fssai, org?.address, org?.phone, org?.email].filter(Boolean).join("  ·  ");

  const orderRows = orders
    .map(
      (o) => `
      <tr>
        <td>${receiptNo(o.id, o.createdAt)}</td>
        <td>${esc(o.customerName)}</td>
        <td>${esc(o.phone ?? "—")}</td>
        <td>${o.type === "TABLE" ? esc(o.table?.name ?? "Table") : "Parcel"}</td>
        <td>${o.items.map((i) => `${esc(i.name)} ×${i.quantity}`).join(", ")}</td>
        <td style="text-align:right;">&#8377;${o.total.toFixed(0)}</td>
        <td>${o.status}</td>
        <td>${new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Orders — ${esc(label)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; padding: 16px; color: #000; font-size: 13px; line-height: 1.5; }
    .header { display:flex; align-items:center; gap:14px; margin-bottom:4px; }
    .header img { max-height:56px; max-width:110px; object-fit:contain; }
    h1 { font-size:20px; font-weight:700; margin:0; }
    .tagline { font-size:13px; color:#444; margin-top:2px; }
    .subheader { font-size:12px; color:#333; margin: 6px 0 14px; }
    .summary-line { font-size:14px; margin-bottom:14px; }
    table { width:100%; border-collapse:collapse; }
    th {
      background:#000; color:#fff;
      padding: 7px 8px; font-size:13px; text-align:left;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    td { padding: 6px 8px; font-size:13px; border-bottom: 1px solid #ccc; vertical-align:top; }
    tr:nth-child(even) td { background:#f5f5f5; }
    .grand-total { margin-top:14px; font-weight:700; font-size:15px; }
    .footer { margin-top:18px; font-size:12px; color:#555; text-align:center; }
    @media print {
      body { padding: 8px; }
      @page { margin: 10mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${org?.logoUrl ? `<img src="${esc(org.logoUrl)}" alt="logo"/>` : ""}
    <div>
      <h1>${esc(hotelName)}</h1>
      ${tagline ? `<div class="tagline">${esc(tagline)}</div>` : ""}
    </div>
  </div>
  ${subheader ? `<div class="subheader">${esc(subheader)}</div>` : ""}
  <div class="summary-line">
    <strong>${esc(label)}</strong> &nbsp;·&nbsp; ${orders.length} orders &nbsp;·&nbsp; Total: &#8377;${grandTotal.toFixed(0)}
  </div>
  <table>
    <thead>
      <tr>
        <th>Order #</th><th>Customer</th><th>Phone</th><th>Table</th>
        <th>Items</th><th style="text-align:right;">Amount</th><th>Status</th><th>Time</th>
      </tr>
    </thead>
    <tbody>${orderRows}</tbody>
  </table>
  <div class="grand-total">Grand Total: &#8377;${grandTotal.toFixed(0)}</div>
  ${footer ? `<div class="footer">${esc(footer)}</div>` : ""}
</body>
</html>`;

  const win = window.open("", "_blank", "width=1100,height=750");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}
