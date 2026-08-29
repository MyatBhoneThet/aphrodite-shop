import { afterEach, describe, expect, it } from "vitest";
import { makeReceiptNumber, sendOrderReceiptEmail } from "../app/lib/receipt-email";
import type { OrderRow } from "../app/lib/supabase";

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RECEIPT_FROM_EMAIL;
});

describe("digital receipt email", () => {
  it("creates a stable human-readable receipt number", () => {
    expect(makeReceiptNumber("12345678-abcd-4000-8000-123456789012", new Date("2026-08-23T00:00:00Z")))
      .toBe("APH-20260823-12345678ABCD");
  });

  it("keeps the printable receipt working when email is not configured", async () => {
    const result = await sendOrderReceiptEmail({
      id: "order-1",
      profiles: { email: "customer@example.com", full_name: "Customer", role: "normal" },
    } as OrderRow, "APH-20260823-ORDER1");
    expect(result).toEqual({ status: "not_configured" });
  });
});
