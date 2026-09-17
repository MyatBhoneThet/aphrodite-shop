import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRow } from "../app/lib/supabase";

const mail = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mail.createTransport },
}));

import {
  mailTransportConfig,
  orderEmailContent,
  sendOrderEmail,
} from "../app/lib/receipt-email";
import { orderMutationSchema } from "../app/lib/validation";

const GMAIL_ENV = {
  GMAIL_USER: "aphrodite.store.mm@gmail.com",
  GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  APP_URL: "https://shop.example.com",
} as unknown as NodeJS.ProcessEnv;

const order = {
  id: "12345678-abcd-4000-8000-123456789012",
  user_id: "user-1",
  status: "delivered",
  total_amount: 4_152_660,
  shipping_name: "Swan Yi",
  shipping_address: "No. 9, Shwe Taung Tan Street, Yangon",
  delivered_at: "2026-09-14T08:00:00.000Z",
  profiles: { email: "customer@example.com", full_name: "Swan Yi", role: "normal" },
  order_items: [
    { product_id: 216, quantity: 1, unit_price: 4_152_660, products: { name: "ASUS ExpertBook P2" } },
  ],
} as unknown as OrderRow;

beforeEach(() => {
  mail.sendMail.mockReset().mockResolvedValue({ messageId: "test" });
  mail.createTransport.mockReset().mockReturnValue({ sendMail: mail.sendMail });
});

describe("send receipt again", () => {
  it("accepts the admin resend action and nothing extra with it", () => {
    expect(orderMutationSchema.safeParse({ action: "resend_receipt" }).success).toBe(true);
    expect(
      orderMutationSchema.safeParse({ action: "resend_receipt", to: "someone@example.com" }).success
    ).toBe(false);
  });

  it("gives Resend a new idempotency key for a deliberate resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const resendEnv = { RESEND_API_KEY: "re_x", RECEIPT_FROM_EMAIL: "shop@example.com" } as unknown as NodeJS.ProcessEnv;

    await sendOrderEmail(order, { kind: "delivered", receiptNumber: "APH-1" }, resendEnv);
    await sendOrderEmail(order, { kind: "delivered", receiptNumber: "APH-1", idempotencySuffix: "resend-1" }, resendEnv);

    const keys = fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers["Idempotency-Key"]);
    expect(keys[0]).toBe(`delivered-${order.id}`);
    expect(keys[1]).toBe(`delivered-${order.id}-resend-1`);
    vi.unstubAllGlobals();
  });
});

describe("mail provider selection", () => {
  it("uses Gmail when the account and App Password are set, removing the display spaces", () => {
    expect(mailTransportConfig(GMAIL_ENV)).toEqual({
      provider: "gmail",
      user: "aphrodite.store.mm@gmail.com",
      password: "abcdefghijklmnop",
      fromName: "Aphrodite Myanmar",
    });
  });

  it("prefers Gmail over Resend, falls back to Resend, and reports nothing when unset", () => {
    const resend = { RESEND_API_KEY: "re_x", RECEIPT_FROM_EMAIL: "shop@example.com" };
    expect(mailTransportConfig({ ...GMAIL_ENV, ...resend })?.provider).toBe("gmail");
    expect(mailTransportConfig(resend as unknown as NodeJS.ProcessEnv)?.provider).toBe("resend");
    expect(mailTransportConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("sending", () => {
  it("does nothing, and says so, when no mail provider is configured", async () => {
    const result = await sendOrderEmail(order, { kind: "placed" }, {} as NodeJS.ProcessEnv);
    expect(result).toEqual({ status: "not_configured" });
    expect(mail.createTransport).not.toHaveBeenCalled();
  });

  it("does nothing when the order has no customer email", async () => {
    const noEmail = { ...order, profiles: null } as unknown as OrderRow;
    const result = await sendOrderEmail(noEmail, { kind: "placed" }, GMAIL_ENV);
    expect(result).toEqual({ status: "not_configured" });
  });

  it("sends the order-received email from the shop's Gmail over SSL", async () => {
    const result = await sendOrderEmail(order, { kind: "placed" }, GMAIL_ENV);

    expect(result.status).toBe("sent");
    expect(mail.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "aphrodite.store.mm@gmail.com", pass: "abcdefghijklmnop" },
      })
    );

    const message = mail.sendMail.mock.calls[0][0];
    expect(message.from).toEqual({
      name: "Aphrodite Myanmar",
      address: "aphrodite.store.mm@gmail.com",
    });
    expect(message.to).toBe("customer@example.com");
    expect(message.subject).toMatch(/received your order/i);
    expect(message.html).toContain("Total to pay on delivery");
    expect(message.html).toContain("4,152,660");
    expect(message.text).toContain("ASUS ExpertBook P2");
  });

  it("sends the paid receipt with its receipt number on delivery", async () => {
    const result = await sendOrderEmail(
      order,
      { kind: "delivered", receiptNumber: "APH-20260914-12345678ABCD" },
      GMAIL_ENV
    );

    expect(result.status).toBe("sent");
    const message = mail.sendMail.mock.calls[0][0];
    expect(message.subject).toContain("APH-20260914-12345678ABCD");
    expect(message.html).toContain("Receipt — paid");
    expect(message.html).toContain("Total paid");
    expect(message.html).toContain("https://shop.example.com/orders/");
    expect(message.text).toContain("Receipt: APH-20260914-12345678ABCD");
  });

  it("reports a Gmail login failure clearly, never throws, and never echoes the password", async () => {
    mail.sendMail.mockRejectedValue(
      Object.assign(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"), {
        code: "EAUTH",
      })
    );

    const result = await sendOrderEmail(order, { kind: "placed" }, GMAIL_ENV);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("App Password");
      expect(result.error).not.toContain("abcdefghijklmnop");
    }
  });
});

describe("email content", () => {
  it("escapes customer-supplied text so it cannot inject HTML", () => {
    const hostile = {
      ...order,
      shipping_address: '<img src=x onerror="alert(1)">',
      profiles: { ...order.profiles, full_name: "<script>alert(1)</script>" },
    } as unknown as OrderRow;

    const { html } = orderEmailContent(hostile, "placed", undefined, GMAIL_ENV);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("makes the delivery email a full receipt, like the receipt page", () => {
    const delivered = {
      ...order,
      shipping_phone: "09420082522",
      payment_status: "collected",
      created_at: "2026-09-10T03:00:00.000Z",
      confirmed_at: "2026-09-11T03:00:00.000Z",
      courier_name: "Royal Express",
      delivery_tracking_number: "RX-778",
      order_items: [
        { product_id: 14, quantity: 2, unit_price: 1_000_000, products: { name: "Dell Latitude 3420 (256 GB SSD)" } },
      ],
      total_amount: 2_000_000,
    } as unknown as OrderRow;

    const content = orderEmailContent(delivered, "delivered", "APH-1", GMAIL_ENV);
    // Intl puts non-breaking spaces in "MMK 1,000,000"; compare as plain spaces.
    const html = content.html.replace(/[  ]/g, " ");
    const text = content.text.replace(/[  ]/g, " ");

    for (const expected of [
      "09420082522",
      "customer@example.com",
      "No. 9, Shwe Taung Tan Street, Yangon",
      "Paid — cash collected",
      "Cash on delivery",
      "Royal Express",
      "RX-778",
      "Confirmed",
    ]) {
      expect(html).toContain(expected);
      expect(text).toContain(expected);
    }
    // Unit price and line amount both appear, and dates are in Myanmar time (UTC+6:30).
    expect(text).toContain("2 × MMK 1,000,000 = MMK 2,000,000");
    expect(text).toContain("Delivered: 14 Sept 2026, 14:30");
    expect(html).toContain("proof of payment");
  });

  it("leaves out receipt details that are missing instead of showing empty rows", () => {
    const { text } = orderEmailContent(order, "delivered", "APH-1", GMAIL_ENV);
    expect(text).not.toContain("Courier:");
    expect(text).not.toContain("Phone:");
  });

  it("does not add receipt-only details to the order-received email", () => {
    const { text } = orderEmailContent(order, "placed", undefined, GMAIL_ENV);
    expect(text).not.toContain("Payment status");
    expect(text).not.toContain("proof of payment");
  });

  it("only shows the 7-day return note on the delivery receipt", () => {
    expect(orderEmailContent(order, "delivered", "APH-1", GMAIL_ENV).html).toContain("7 days after delivery");
    expect(orderEmailContent(order, "placed", undefined, GMAIL_ENV).html).not.toContain("7 days after delivery");
  });
});
