import type { OrderRow } from "./supabase";

type ReceiptEmailResult =
  | { status: "sent"; sentAt: string }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

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
    currency: process.env.RECEIPT_CURRENCY || "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function makeReceiptNumber(orderId: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `APH-${day}-${orderId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function receiptHtml(order: OrderRow, receiptNumber: string, receiptUrl: string) {
  const lines = (order.order_items ?? [])
    .map((item) => {
      const name = item.products?.name ?? `Product #${item.product_id}`;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(name)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(formatMoney(item.unit_price * item.quantity))}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
  <html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:640px;margin:24px auto;background:white;border-radius:20px;overflow:hidden">
      <div style="background:#18181b;color:white;padding:24px">
        <div style="font-size:24px;font-weight:800">APHRODITE MYANMAR</div>
        <div style="margin-top:6px;color:#d4d4d8">Order confirmation and digital receipt</div>
      </div>
      <div style="padding:24px">
        <p>Hello ${escapeHtml(order.profiles?.full_name || order.shipping_name)},</p>
        <p>Your order has been confirmed. This is a confirmation receipt for a cash-on-delivery order; payment is collected when the order is delivered.</p>
        <div style="margin:20px 0;padding:16px;background:#fff1f2;border-radius:14px">
          <strong>Receipt:</strong> ${escapeHtml(receiptNumber)}<br>
          <strong>Order:</strong> ${escapeHtml(order.id)}
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${lines}</tbody>
        </table>
        <p style="font-size:20px;font-weight:800;text-align:right">Total due: ${escapeHtml(formatMoney(order.total_amount))}</p>
        <p><strong>Delivery address:</strong><br>${escapeHtml(order.shipping_address)}</p>
        <a href="${escapeHtml(receiptUrl)}" style="display:inline-block;margin-top:12px;padding:12px 20px;background:#dc2626;color:white;text-decoration:none;border-radius:999px;font-weight:700">Open receipt</a>
        <p style="margin-top:24px;font-size:12px;color:#71717a">Keep this email and your order number. Returns for eligible errors, wrong items, wrong colour, wrong storage, or delivery damage must be requested within 7 days after delivery.</p>
      </div>
    </div>
  </body></html>`;
}

export async function sendOrderReceiptEmail(
  order: OrderRow,
  receiptNumber: string
): Promise<ReceiptEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECEIPT_FROM_EMAIL;
  const recipient = order.profiles?.email;

  if (!apiKey || !from || !recipient) {
    return { status: "not_configured" };
  }

  const baseUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  const receiptUrl = `${baseUrl}/orders/${encodeURIComponent(order.id)}/receipt`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `receipt-${order.id}-${receiptNumber}`,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `Aphrodite order confirmed — ${receiptNumber}`,
        html: receiptHtml(order, receiptNumber, receiptUrl),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        status: "failed",
        error: `Receipt email provider returned ${response.status}: ${detail.slice(0, 300)}`,
      };
    }

    return { status: "sent", sentAt: new Date().toISOString() };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unable to send receipt email.",
    };
  }
}
