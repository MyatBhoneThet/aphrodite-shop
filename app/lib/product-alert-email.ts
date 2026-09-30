import { emailFooterHtml } from "./email-footer";
import { publicSiteUrl, sendMail, type MailContent } from "./mailer";
import { evaluateAlert, type ProductAlert } from "./product-alerts";
import { activePromotion, discountPercent, effectiveProductPrice } from "./promotions";
import {
  mapProductRow,
  selectAllProductAlerts,
  updateProductAlertBaseline,
  type ProductAlertRow,
} from "./supabase";
import type { Product } from "../data/products";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: number) {
  return `MMK ${Math.round(value).toLocaleString("en-US")}`;
}

function alertFromRow(row: ProductAlertRow): ProductAlert {
  return {
    id: row.id,
    product_id: row.product_id,
    kind: row.kind,
    baseline_price: row.baseline_price,
    baseline_stock: row.baseline_stock === "In Stock" ? "In Stock" : "Out of Stock",
    target_price: row.target_price,
    created_at: row.created_at,
  };
}

export function productPriceAlertEmailContent(
  product: Product,
  previousPrice: number,
  env: NodeJS.ProcessEnv
): MailContent {
  const currentPrice = effectiveProductPrice(product);
  const saving = Math.max(0, previousPrice - currentPrice);
  const percent = discountPercent(previousPrice, currentPrice);
  const promotion = activePromotion(product.price, product.fullSpecs?.promotion);
  const productUrl = `${publicSiteUrl(env)}/products/${product.id}`;
  const headline = promotion ? "This product is now on promotion" : "The price has dropped";
  const burmeseHeadline = promotion
    ? "ဤပစ္စည်းကို ယခု အထူးလျှော့ဈေးဖြင့် ရောင်းချနေပါသည်"
    : "ဤပစ္စည်း၏ ဈေးနှုန်း လျော့ကျသွားပါပြီ";

  const html = `<!doctype html>
  <html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:640px;margin:24px auto;background:white;border-radius:20px;overflow:hidden">
      <div style="background:#18181b;color:white;padding:24px">
        <div style="font-size:24px;font-weight:800">APHRODITE MYANMAR</div>
        <div style="margin-top:6px;color:#86efac;font-weight:700">Price alert</div>
      </div>
      <div style="padding:24px">
        <p>Hello,</p>
        <h1 style="font-size:24px;margin:8px 0">${escapeHtml(headline)}</h1>
        <p>The product you selected for price notifications is cheaper now.</p>
        <div style="margin:20px 0;padding:18px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px">
          <div style="font-size:18px;font-weight:800">${escapeHtml(product.name)}</div>
          <div style="margin-top:12px;color:#71717a;text-decoration:line-through">${escapeHtml(money(previousPrice))}</div>
          <div style="font-size:28px;font-weight:800;color:#dc2626">${escapeHtml(money(currentPrice))}</div>
          ${percent > 0 ? `<div style="margin-top:5px;font-weight:700;color:#047857">Save ${escapeHtml(money(saving))} (${percent}%)</div>` : ""}
        </div>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
        <p style="font-weight:700">${burmeseHeadline}</p>
        <p>သင် ဈေးနှုန်းစောင့်ကြည့်ရန် ရွေးထားသော ${escapeHtml(product.name)} ကို ယခု ${escapeHtml(money(currentPrice))} ဖြင့် ဝယ်ယူနိုင်ပါပြီ။</p>
        <a href="${escapeHtml(productUrl)}" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#dc2626;color:white;text-decoration:none;border-radius:999px;font-weight:700">View product</a>
      </div>
      ${emailFooterHtml()}
    </div>
  </body></html>`;

  const text = [
    `APHRODITE MYANMAR — ${headline}`,
    "",
    `${product.name} is cheaper now.`,
    `Previous price: ${money(previousPrice)}`,
    `Current price: ${money(currentPrice)}`,
    percent > 0 ? `You save ${money(saving)} (${percent}%).` : "",
    "",
    burmeseHeadline,
    `လက်ရှိဈေးနှုန်း: ${money(currentPrice)}`,
    "",
    `View product: ${productUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `${promotion ? "Promotion" : "Price drop"}: ${product.name} — Aphrodite Myanmar`,
    html,
    text,
  };
}

function stockAlertContent(product: Product, env: NodeJS.ProcessEnv): MailContent {
  const productUrl = `${publicSiteUrl(env)}/products/${product.id}`;
  const html = `<!doctype html>
  <html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:640px;margin:24px auto;background:white;border-radius:20px;overflow:hidden">
      <div style="background:#18181b;color:white;padding:24px"><div style="font-size:24px;font-weight:800">APHRODITE MYANMAR</div><div style="margin-top:6px;color:#86efac;font-weight:700">Back in stock</div></div>
      <div style="padding:24px">
        <h1 style="font-size:24px">${escapeHtml(product.name)} is available again</h1>
        <p>The product you selected for stock notifications is back in stock.</p>
        <p style="font-weight:700">သင် စောင့်ကြည့်ထားသောပစ္စည်း ပြန်လည်ရရှိပါပြီ။</p>
        <a href="${escapeHtml(productUrl)}" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#dc2626;color:white;text-decoration:none;border-radius:999px;font-weight:700">View product</a>
      </div>
      ${emailFooterHtml()}
    </div>
  </body></html>`;

  return {
    subject: `Back in stock: ${product.name} — Aphrodite Myanmar`,
    html,
    text: `${product.name} is back in stock.\n\nပစ္စည်း ပြန်လည်ရရှိပါပြီ။\n\nView product: ${productUrl}`,
  };
}

async function deliverAlert(row: ProductAlertRow, forceCurrentPromotion = false) {
  if (!row.products || !row.profiles?.email) return false;

  const product = mapProductRow(row.products);
  const alert = alertFromRow(row);
  const currentPrice = effectiveProductPrice(product);
  const isCurrentPromotion = Boolean(activePromotion(product.price, product.fullSpecs?.promotion));
  const status = evaluateAlert(alert, product);
  const shouldSend = status.triggered ||
    (forceCurrentPromotion && row.kind === "price_drop" && isCurrentPromotion);

  if (!shouldSend) return false;

  const previousPrice = forceCurrentPromotion && isCurrentPromotion
    ? product.price
    : row.baseline_price;
  const content = row.kind === "price_drop"
    ? productPriceAlertEmailContent(product, previousPrice, process.env)
    : stockAlertContent(product, process.env);
  const result = await sendMail(row.profiles.email, content, {
    idempotencyKey: `product-alert-${row.id}-${row.kind}-${currentPrice}-${product.stock}`,
  });

  if (result.status === "sent") {
    await updateProductAlertBaseline(row.id, currentPrice, product.stock);
    return true;
  }

  if (result.status === "failed") {
    console.error("[product-alerts] email failed", {
      alert_id: row.id,
      product_id: row.product_id,
      error: result.error,
    });
  }
  return false;
}

/** Sends any alerts triggered by a catalogue change, then advances their
 * baselines to prevent duplicate messages on the next synchronization. */
export async function sendTriggeredProductAlertEmails(productIds?: number[]) {
  try {
    const rows = await selectAllProductAlerts(productIds);
    let sent = 0;
    for (const row of rows) {
      if (await deliverAlert(row)) sent += 1;
    }
    return sent;
  } catch (error) {
    console.error("[product-alerts] notification scan failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/** A customer who starts watching during an active promotion receives the
 * useful notification immediately instead of waiting for another price edit. */
export async function notifySubscribedProductAlert(
  userId: string,
  productId: number,
  kind: ProductAlert["kind"]
) {
  try {
    const rows = await selectAllProductAlerts([productId]);
    const row = rows.find(
      (candidate) => candidate.user_id === userId && candidate.kind === kind
    );
    if (row) await deliverAlert(row, true);
  } catch (error) {
    console.error("[product-alerts] subscription email could not run", {
      user_id: userId,
      product_id: productId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
