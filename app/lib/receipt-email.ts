import { emailFooterHtml } from "./email-footer";
import {
  isUnreachableFromEmail,
  mailTransportConfig,
  publicSiteUrl,
  sendMail,
  type MailContent,
  type MailResult,
} from "./mailer";
import type { OrderRow } from "./supabase";
import { translate } from "./translations";

/**
 * Customer order emails: "Order received" at checkout, and a full paid receipt
 * when the order is delivered (cash on delivery, so that is when payment
 * happens). The admin can also send the receipt again from the order list.
 *
 * The transport (Gmail SMTP, or Resend as a fallback) lives in lib/mailer.ts,
 * shared with the password-reset email. This module only decides what an order
 * email says.
 *
 * Every function here returns a result instead of throwing. A mail problem
 * must never fail, block, or undo an order.
 */

export type OrderEmailKind = "placed" | "delivered" | "attempt_failed" | "progress";

export type OrderProgressEmailStage =
  | "verified"
  | "packed"
  | "handed_to_courier"
  | "out_for_delivery"
  | "delivered";

/** A failed delivery attempt, for the "we tried to deliver" email. */
export type DeliveryAttemptInfo = {
  number: number;
  max: number;
  reason:
    | "no_answer"
    | "phone_off"
    | "address_problem"
    | "customer_rescheduled"
    | "nobody_home";
  nextAttemptAt?: string | null;
};

// Re-exported under their original names: the mail transport moved out of this
// module, its callers did not.
export { mailTransportConfig };
export type { MailTransportConfig } from "./mailer";
export type ReceiptEmailResult = MailResult;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: process.env.RECEIPT_CURRENCY || "MMK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  try {
    // Customers read this in Myanmar; the server clock may be in another zone.
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: process.env.RECEIPT_TIME_ZONE || "Asia/Yangon",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function makeReceiptNumber(orderId: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `APH-${day}-${orderId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

/** The short form of an order id, as the site and these emails display it. */
function shortOrderCode(orderId: string) {
  return orderId.replaceAll("-", "").slice(0, 8).toLowerCase();
}

function siteUrl(env: NodeJS.ProcessEnv) {
  return publicSiteUrl(env);
}

const PAYMENT_STATUS_LABELS: Record<OrderRow["payment_status"], string> = {
  unpaid: "Not paid yet",
  collected: "Paid — cash collected",
  refunded: "Refunded",
};

const RECEIPT_NOTES = [
  "This email is your receipt and proof of payment.",
  "Returns for eligible errors, wrong items, wrong colour, wrong storage, or delivery damage must be requested within 7 days after delivery.",
];

type DetailRow = [label: string, value: string | null | undefined];

/** Drops rows without a value, so the receipt never shows an empty "Courier:". */
function compactRows(rows: (DetailRow | null)[]): [string, string][] {
  return rows.flatMap((row) =>
    row && row[1]?.trim() ? [[row[0], row[1].trim()] as [string, string]] : []
  );
}

function detailSectionHtml(title: string, rows: [string, string][]) {
  if (rows.length === 0) return "";
  return `<h3 style="margin:24px 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#71717a">${escapeHtml(title)}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:4px 16px 4px 0;color:#71717a;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0;vertical-align:top">${escapeHtml(value)}</td></tr>`
          )
          .join("")}</table>`;
}

function detailSectionText(title: string, rows: [string, string][]) {
  return rows.length === 0
    ? []
    : ["", title.toUpperCase(), ...rows.map(([label, value]) => `${label}: ${value}`)];
}

export type OrderEmailContent = MailContent;

/** Subject, HTML and plain-text body for one order email. */
export function orderEmailContent(
  order: OrderRow,
  kind: OrderEmailKind,
  receiptNumber?: string,
  env: NodeJS.ProcessEnv = process.env,
  attempt?: DeliveryAttemptInfo,
  progressStage?: OrderProgressEmailStage
): OrderEmailContent {
  const base = siteUrl(env);
  const customerName = order.profiles?.full_name || order.shipping_name || "customer";
  const items = order.order_items ?? [];
  const isReceipt = kind === "delivered";

  // Sent in English and Burmese together: the shop does not always know which
  // language a customer reads, and this message needs to be understood.
  if (kind === "attempt_failed") {
    return deliveryAttemptContent(order, base, customerName, attempt);
  }
  if (kind === "progress") {
    return orderProgressContent(order, base, customerName, progressStage ?? "verified");
  }

  const heading = isReceipt ? "Receipt — paid" : "Order received";
  const intro = isReceipt
    ? "Your order has been delivered and your cash payment was received. Thank you for shopping with Aphrodite. Please keep this receipt."
    : "Thank you for your order. We will call you to confirm the details before we send it. You pay in cash when it is delivered.";
  const totalLabel = isReceipt ? "Total paid" : "Total to pay on delivery";
  const buttonLabel = isReceipt ? "Open receipt" : "Track your order";
  // The tracking button goes to the signed-out lookup, with the order code
  // prefilled: /orders would bounce a customer without a session to the login
  // page, which is the most common moment they have no patience for one. The
  // code alone does not open the order -- /track also asks for the delivery
  // phone number -- so a forwarded email is not a tracking link for anybody.
  const buttonUrl = isReceipt
    ? `${base}/orders/${encodeURIComponent(order.id)}/receipt`
    : `${base}/track?order=${encodeURIComponent(shortOrderCode(order.id))}`;

  const subject = isReceipt
    ? `Your receipt ${receiptNumber ?? ""} — Aphrodite Myanmar`.replace("  ", " ")
    : "We received your order — Aphrodite Myanmar";

  const referenceRows = compactRows([
    isReceipt ? ["Receipt", receiptNumber] : null,
    ["Order", order.id],
    isReceipt ? ["Placed", formatDate(order.created_at)] : null,
    isReceipt ? ["Confirmed", formatDate(order.confirmed_at)] : null,
    isReceipt ? ["Delivered", formatDate(order.delivered_at)] : null,
  ]);

  // The full receipt carries everything the website receipt page shows, so
  // the email alone is enough proof of purchase.
  const customerRows = isReceipt
    ? compactRows([
        ["Name", order.shipping_name],
        ["Phone", order.shipping_phone],
        ["Email", order.profiles?.email],
        ["Delivery address", order.shipping_address],
      ])
    : [];
  const paymentRows = isReceipt
    ? compactRows([
        ["Payment method", "Cash on delivery"],
        ["Payment status", PAYMENT_STATUS_LABELS[order.payment_status]],
        ["Courier", order.courier_name],
        ["Tracking / reference", order.delivery_tracking_number],
      ])
    : [];

  const cell = "padding:10px 0;border-bottom:1px solid #eee";
  const lineRows = items
    .map((item) => {
      const name = item.products?.name ?? `Product #${item.product_id}`;
      return `<tr>
        <td style="${cell}">${escapeHtml(name)}</td>
        <td style="${cell};text-align:center">${item.quantity}</td>
        <td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(formatMoney(item.unit_price))}</td>
        <td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(formatMoney(item.unit_price * item.quantity))}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
  <html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:640px;margin:24px auto;background:white;border-radius:20px;overflow:hidden">
      <div style="background:#18181b;color:white;padding:24px">
        <div style="font-size:24px;font-weight:800">APHRODITE MYANMAR</div>
        <div style="margin-top:6px;color:#fca5a5;font-weight:700">${escapeHtml(heading)}</div>
      </div>
      <div style="padding:24px">
        <p>Hello ${escapeHtml(customerName)},</p>
        <p>${escapeHtml(intro)}</p>
        <div style="margin:20px 0;padding:16px;background:#fff1f2;border-radius:14px;line-height:1.7">
          ${referenceRows
            .map(([label, value]) => `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`)
            .join("<br>")}
        </div>
        ${detailSectionHtml("Customer", customerRows)}
        <table style="width:100%;margin-top:20px;border-collapse:collapse;font-size:14px">
          <thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${lineRows}</tbody>
        </table>
        <p style="font-size:20px;font-weight:800;text-align:right">${escapeHtml(totalLabel)}: ${escapeHtml(formatMoney(order.total_amount))}</p>
        ${
          isReceipt
            ? detailSectionHtml("Payment & delivery", paymentRows)
            : `<p><strong>Delivery address:</strong><br>${escapeHtml(order.shipping_address)}</p>`
        }
        <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#dc2626;color:white;text-decoration:none;border-radius:999px;font-weight:700">${escapeHtml(buttonLabel)}</a>
        ${
          isReceipt
            ? `<div style="margin-top:24px;font-size:12px;color:#71717a">${RECEIPT_NOTES.map(
                (note) => `<p style="margin:6px 0">${escapeHtml(note)}</p>`
              ).join("")}</div>`
            : ""
        }
      </div>
      ${emailFooterHtml()}
    </div>
  </body></html>`;

  // Plain-text alternative: some mail apps show it, and mail with only HTML is
  // more likely to be treated as spam.
  const text = [
    `APHRODITE MYANMAR — ${heading}`,
    "",
    `Hello ${customerName},`,
    intro,
    "",
    ...referenceRows.map(([label, value]) => `${label}: ${value}`),
    ...detailSectionText("Customer", customerRows),
    "",
    "ITEMS",
    ...items.map(
      (item) =>
        `${item.products?.name ?? `Product #${item.product_id}`} — ${item.quantity} × ${formatMoney(
          item.unit_price
        )} = ${formatMoney(item.unit_price * item.quantity)}`
    ),
    "",
    `${totalLabel}: ${formatMoney(order.total_amount)}`,
    ...(isReceipt
      ? detailSectionText("Payment & delivery", paymentRows)
      : [`Delivery address: ${order.shipping_address ?? ""}`]),
    "",
    `${buttonLabel}: ${buttonUrl}`,
    ...(isReceipt ? ["", ...RECEIPT_NOTES] : []),
  ].join("\n");

  return { subject, html, text };
}

const EMAIL_TIMELINE_STAGES = [
  "order_placed",
  "verified",
  "packed",
  "handed_to_courier",
  "out_for_delivery",
  "delivered",
] as const;

/** A concise bilingual status update for the customer's delivery timeline. */
function orderProgressContent(
  order: OrderRow,
  base: string,
  customerName: string,
  stage: OrderProgressEmailStage
): OrderEmailContent {
  const englishStatus = translate("en", `tracking.${stage}`);
  const burmeseStatus = translate("my", `tracking.${stage}`);
  const orderUrl = `${base}/track?order=${encodeURIComponent(shortOrderCode(order.id))}`;
  const currentIndex = EMAIL_TIMELINE_STAGES.indexOf(stage);
  const items = order.order_items ?? [];
  const deliveryRows = compactRows([
    ["Delivery address", order.shipping_address],
    ["Courier", order.courier_name],
    ["Tracking / reference", order.delivery_tracking_number],
    ["Estimated delivery", formatDate(order.estimated_delivery_at)],
  ]);

  const progressHtml = EMAIL_TIMELINE_STAGES.map((step, index) => {
    const complete = index <= currentIndex;
    return `<td style="width:16.666%;padding:8px 3px;text-align:center;vertical-align:top;color:${
      complete ? "#15803d" : "#a1a1aa"
    };font-size:11px;font-weight:${complete ? "700" : "400"}">
      <div style="height:5px;border-radius:999px;background:${complete ? "#16a34a" : "#e4e4e7"};margin-bottom:7px"></div>
      ${escapeHtml(translate("en", `tracking.${step}`))}
    </td>`;
  }).join("");

  const itemText = items.length
    ? items
        .map(
          (item) =>
            `${item.products?.name ?? `Product #${item.product_id}`} × ${item.quantity}`
        )
        .join(", ")
    : "Your order";

  const html = `<!doctype html>
  <html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:640px;margin:24px auto;background:white;border-radius:20px;overflow:hidden">
      <div style="background:#18181b;color:white;padding:24px">
        <div style="font-size:24px;font-weight:800">APHRODITE MYANMAR</div>
        <div style="margin-top:6px;color:#86efac;font-weight:700">Order update</div>
      </div>
      <div style="padding:24px">
        <p>Hello ${escapeHtml(customerName)},</p>
        <p>Your order status has been updated.</p>
        <div style="margin:20px 0;padding:18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px">
          <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:1px">Current status</div>
          <div style="font-size:24px;font-weight:800;color:#15803d;margin-top:5px">${escapeHtml(englishStatus)}</div>
          <div style="font-size:17px;font-weight:700;color:#166534;margin-top:5px">${escapeHtml(burmeseStatus)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed"><tr>${progressHtml}</tr></table>
        <div style="margin:20px 0;padding:16px;background:#fafafa;border-radius:14px;line-height:1.7">
          <strong>Order:</strong> ${escapeHtml(order.id)}<br>
          <strong>Items:</strong> ${escapeHtml(itemText)}
        </div>
        ${detailSectionHtml("Delivery", deliveryRows)}
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
        <p style="font-weight:700">အော်ဒါအခြေအနေကို အပ်ဒိတ်လုပ်ထားပါသည်။</p>
        <p>လက်ရှိအခြေအနေ — ${escapeHtml(burmeseStatus)}</p>
        <a href="${escapeHtml(orderUrl)}" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#dc2626;color:white;text-decoration:none;border-radius:999px;font-weight:700">Track your order</a>
      </div>
      ${emailFooterHtml()}
    </div>
  </body></html>`;

  const text = [
    "APHRODITE MYANMAR — Order update",
    "",
    `Hello ${customerName},`,
    "Your order status has been updated.",
    `Current status: ${englishStatus}`,
    `လက်ရှိအခြေအနေ: ${burmeseStatus}`,
    "",
    `Order: ${order.id}`,
    `Items: ${itemText}`,
    ...detailSectionText("Delivery", deliveryRows),
    "",
    `Track your order: ${orderUrl}`,
  ].join("\n");

  return {
    subject: `Order update: ${englishStatus} — Aphrodite Myanmar`,
    html,
    text,
  };
}

/** The "we tried to deliver" email, in both languages. */
function deliveryAttemptContent(
  order: OrderRow,
  base: string,
  customerName: string,
  attempt?: DeliveryAttemptInfo
): OrderEmailContent {
  const orderUrl = `${base}/orders`;
  const nextAttempt = attempt?.nextAttemptAt ? formatDate(attempt.nextAttemptAt) : "";
  const isLast = attempt ? attempt.number >= attempt.max : false;

  const block = (language: "en" | "my") => {
    const lines = [
      translate(language, "delivery.attempt.message"),
      attempt
        ? `${translate(language, "delivery.attempt.count", {
            attempt: attempt.number,
            max: attempt.max,
          })} — ${translate(language, `delivery.reason.${attempt.reason}`)}`
        : "",
      nextAttempt ? translate(language, "delivery.attempt.nextAttempt", { date: nextAttempt }) : "",
      isLast ? translate(language, "delivery.attempt.lastAttempt") : "",
    ].filter(Boolean);

    return {
      heading: translate(language, "delivery.attempt.heading"),
      lines,
    };
  };

  const english = block("en");
  const burmese = block("my");

  const html = `<!doctype html>
  <html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:640px;margin:24px auto;background:white;border-radius:20px;overflow:hidden">
      <div style="background:#18181b;color:white;padding:24px">
        <div style="font-size:24px;font-weight:800">APHRODITE MYANMAR</div>
        <div style="margin-top:6px;color:#fca5a5;font-weight:700">${escapeHtml(english.heading)}</div>
      </div>
      <div style="padding:24px">
        <p>Hello ${escapeHtml(customerName)},</p>
        ${english.lines.map((line) => `<p style="margin:10px 0">${escapeHtml(line)}</p>`).join("")}
        <div style="margin:20px 0;padding:16px;background:#fff1f2;border-radius:14px;line-height:1.7">
          <strong>Order:</strong> ${escapeHtml(order.id)}<br>
          <strong>Delivery address:</strong> ${escapeHtml(order.shipping_address)}
        </div>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
        <p style="font-weight:700">${escapeHtml(burmese.heading)}</p>
        ${burmese.lines.map((line) => `<p style="margin:10px 0">${escapeHtml(line)}</p>`).join("")}
        <a href="${escapeHtml(orderUrl)}" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#dc2626;color:white;text-decoration:none;border-radius:999px;font-weight:700">Track your order</a>
      </div>
      ${emailFooterHtml()}
    </div>
  </body></html>`;

  const text = [
    `APHRODITE MYANMAR — ${english.heading}`,
    "",
    `Hello ${customerName},`,
    ...english.lines,
    "",
    `Order: ${order.id}`,
    `Delivery address: ${order.shipping_address ?? ""}`,
    "",
    burmese.heading,
    ...burmese.lines,
    "",
    `Track your order: ${orderUrl}`,
  ].join("\n");

  return {
    subject: `${english.heading} — Aphrodite Myanmar`,
    html,
    text,
  };
}

/** Sends one order email. Never throws. */
export async function sendOrderEmail(
  order: OrderRow,
  options: {
    kind: OrderEmailKind;
    receiptNumber?: string;
    idempotencySuffix?: string;
    attempt?: DeliveryAttemptInfo;
    progressStage?: OrderProgressEmailStage;
  },
  env: NodeJS.ProcessEnv = process.env
): Promise<ReceiptEmailResult> {
  const recipient = order.profiles?.email;

  if (!recipient) return { status: "not_configured" };

  if (isUnreachableFromEmail(siteUrl(env))) {
    // Sent from a developer machine against the live database: the message
    // will arrive, but its buttons point at the sender's own computer.
    console.warn(
      "[orders] order email links point at a local address; set PUBLIC_SITE_URL",
      { order_id: order.id, base: siteUrl(env) }
    );
  }

  const content = orderEmailContent(
    order,
    options.kind,
    options.receiptNumber,
    env,
    options.attempt,
    options.progressStage
  );

  return sendMail(recipient, content, {
    // Resend drops a repeat of the same key, so a deliberate "send again"
    // needs its own.
    idempotencyKey: [options.kind, order.id, options.idempotencySuffix]
      .filter(Boolean)
      .join("-"),
    env,
  });
}

/** The paid receipt sent on delivery. Kept under its original name. */
export function sendOrderReceiptEmail(order: OrderRow, receiptNumber: string) {
  return sendOrderEmail(order, { kind: "delivered", receiptNumber });
}
