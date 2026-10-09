import { describe, expect, it } from "vitest";
import type { OrderRow } from "../app/lib/supabase";
import { orderEmailContent } from "../app/lib/receipt-email";
import { isUnreachableFromEmail, publicSiteUrl } from "../app/lib/mailer";

/**
 * Links in customer email must point at the live site even when the server
 * that sent them is a developer's laptop -- this shop's .env.local talks to
 * the production database, so a receipt sent from localhost reaches a real
 * customer carrying a link to their own machine.
 */

const order = {
  id: "cbf22014-1234-4000-8000-0123456789ab",
  status: "confirmed",
  created_at: "2026-09-20T07:14:54.000Z",
  total_amount: 4_286_660,
  payment_status: "unpaid",
  shipping_name: "Myat Bhone Thet",
  shipping_address: "22, Kyeik Wine Yeik Thar St., Mayangone",
  profiles: { email: "customer@example.com", full_name: "Myat", role: "normal" },
  order_items: [{ product_id: 1, quantity: 1, unit_price: 4_286_660, products: { name: "LATITUDE 5430" } }],
} as unknown as OrderRow;

const LIVE = "https://shop.example.com";

describe("publicSiteUrl", () => {
  it("prefers PUBLIC_SITE_URL over the OAuth callback origin", () => {
    expect(
      publicSiteUrl({
        PUBLIC_SITE_URL: LIVE,
        APP_URL: "http://localhost:3000",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(LIVE);
  });

  it("falls back to APP_URL, so production needs no new variable", () => {
    expect(
      publicSiteUrl({ APP_URL: `${LIVE}/` } as unknown as NodeJS.ProcessEnv)
    ).toBe(LIVE);
  });

  it("knows which addresses are useless in an inbox", () => {
    expect(isUnreachableFromEmail("http://localhost:3000")).toBe(true);
    expect(isUnreachableFromEmail("http://127.0.0.1:3005/track")).toBe(true);
    expect(isUnreachableFromEmail(LIVE)).toBe(false);
  });
});

describe("order email buttons", () => {
  const env = {
    PUBLIC_SITE_URL: LIVE,
    APP_URL: "http://localhost:3000",
  } as unknown as NodeJS.ProcessEnv;

  it("sends the receipt link to the live site, not to APP_URL", () => {
    const content = orderEmailContent(order, "delivered", "APH-1", env);

    expect(content.html).toContain(`${LIVE}/orders/`);
    expect(content.html).not.toContain("localhost");
  });

  it("points 'track your order' at the signed-out lookup", () => {
    const content = orderEmailContent(order, "placed", undefined, env);

    // /orders would bounce a signed-out customer to the login page.
    expect(content.html).toContain(`${LIVE}/track?order=cbf22014`);
    expect(content.html).not.toContain(`${LIVE}/orders"`);
  });
});
