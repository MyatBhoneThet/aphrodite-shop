import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return {
    ...original,
    selectOrderById: vi.fn(),
    insertDeliveryEvent: vi.fn(),
    updateOrderDeliveryService: vi.fn(),
    insertAuditLog: vi.fn(),
  };
});

import { MAX_DELIVERY_ATTEMPTS, recordFailedDeliveryAttempt } from "../app/lib/backend";
import { orderEmailContent } from "../app/lib/receipt-email";
import { orderMutationSchema } from "../app/lib/validation";
import {
  insertAuditLog,
  insertDeliveryEvent,
  selectOrderById,
  updateOrderDeliveryService,
  type CurrentUser,
  type OrderRow,
  type Profile,
} from "../app/lib/supabase";

function admin(): CurrentUser {
  const profile: Profile = {
    id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin",
    wholesale_status: "not_applied", price_list_id: null, phone: null,
  };
  return { id: "admin-1", email: profile.email, role: "admin", profile, accessToken: "token" };
}

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1", user_id: "user-1", status: "shipped", total_amount: 3_750_660,
    shipping_name: "Swan Yi", shipping_phone: "09420082522",
    shipping_address: "No. 9, Shwe Taung Tan Street, Yangon",
    payment_method: "cash_on_delivery", payment_status: "unpaid",
    created_at: "2026-09-16T01:00:00Z", updated_at: "2026-09-16T01:00:00Z",
    admin_order_note: null, notes: null,
    cancellation_request_status: "none", return_request_status: "none",
    profiles: { email: "customer@example.com", full_name: "Swan Yi", role: "normal" },
    delivery_events: [],
    ...overrides,
  } as unknown as OrderRow;
}

beforeEach(() => {
  vi.mocked(selectOrderById).mockReset().mockResolvedValue(order());
  vi.mocked(insertDeliveryEvent).mockReset().mockResolvedValue({} as never);
  vi.mocked(updateOrderDeliveryService).mockReset().mockResolvedValue({} as never);
  vi.mocked(insertAuditLog).mockReset().mockResolvedValue(undefined);
});

describe("recording a failed delivery attempt", () => {
  it("counts the attempt, keeps the order shipped and tells the customer in both languages", async () => {
    const result = await recordFailedDeliveryAttempt(admin(), "order-1", { reason: "no_answer" });

    expect(result).toMatchObject({ attempt: 1, maxAttempts: 3 });
    expect(vi.mocked(insertDeliveryEvent).mock.calls[0][0]).toMatchObject({
      order_id: "order-1", stage: "delivery_failed", title: "Delivery attempt 1 failed",
    });

    const detail = vi.mocked(updateOrderDeliveryService).mock.calls[0][1].delivery_status_detail ?? "";
    expect(detail).toContain("Delivery attempt failed");
    expect(detail).toContain("ပို့ဆောင်မှု မအောင်မြင်ပါ");
    expect(detail).toContain("No answer on the phone");
    expect(detail).toContain("ဖုန်း မကိုင်ပါ");
    // The status ladder is untouched: the order stays shipped and waits.
    expect(vi.mocked(updateOrderDeliveryService).mock.calls[0][1]).not.toHaveProperty("status");
  });

  it("counts earlier attempts, so the third is attempt 3 of 3", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order({
        delivery_events: [
          { stage: "delivery_failed" }, { stage: "out_for_delivery" }, { stage: "delivery_failed" },
        ] as never,
      })
    );

    const result = await recordFailedDeliveryAttempt(admin(), "order-1", { reason: "nobody_home" });

    expect(result?.attempt).toBe(3);
    expect(result?.attempt).toBe(MAX_DELIVERY_ATTEMPTS);
  });

  it("saves a planned next attempt as the new estimated arrival", async () => {
    await recordFailedDeliveryAttempt(admin(), "order-1", {
      reason: "customer_rescheduled",
      next_attempt_at: "2026-09-18T04:00:00.000Z",
      admin_note: "Customer asked for Friday morning.",
    });

    const fields = vi.mocked(updateOrderDeliveryService).mock.calls[0][1];
    expect(fields.estimated_delivery_at).toBe("2026-09-18T04:00:00.000Z");
    expect(fields.delivery_status_detail).toContain("Customer asked for Friday morning.");
    expect(vi.mocked(insertAuditLog).mock.calls[0][0].action).toBe("order.delivery.attempt_failed");
  });

  it("refuses when the order is not shipped", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(order({ status: "confirmed" }));

    await expect(
      recordFailedDeliveryAttempt(admin(), "order-1", { reason: "no_answer" })
    ).rejects.toThrow(/only be recorded while the order is shipped/);
    expect(insertDeliveryEvent).not.toHaveBeenCalled();
  });

  it("refuses a customer", async () => {
    const customer = { ...admin(), role: "normal" as const };

    await expect(
      recordFailedDeliveryAttempt(customer, "order-1", { reason: "no_answer" })
    ).rejects.toThrow();
    expect(insertDeliveryEvent).not.toHaveBeenCalled();
  });
});

describe("the admin action payload", () => {
  it("accepts a reason, an optional next attempt and a note", () => {
    expect(
      orderMutationSchema.safeParse({
        action: "delivery_attempt_failed",
        reason: "phone_off",
        next_attempt_at: "2026-09-18T04:00:00.000Z",
        admin_note: "Courier will retry Friday.",
      }).success
    ).toBe(true);
    expect(
      orderMutationSchema.safeParse({ action: "delivery_attempt_failed", reason: "no_answer" }).success
    ).toBe(true);
  });

  it("rejects an unknown reason", () => {
    expect(
      orderMutationSchema.safeParse({ action: "delivery_attempt_failed", reason: "raining" }).success
    ).toBe(false);
  });
});

describe("the we-tried-to-deliver email", () => {
  const env = { APP_URL: "https://shop.example.com" } as unknown as NodeJS.ProcessEnv;

  it("is written in English and Burmese, with the attempt and next date", () => {
    const { subject, html, text } = orderEmailContent(order(), "attempt_failed", undefined, env, {
      number: 2, max: 3, reason: "no_answer", nextAttemptAt: "2026-09-18T04:00:00.000Z",
    });

    expect(subject).toContain("Delivery attempt failed");
    for (const expected of ["No answer on the phone", "ဖုန်း မကိုင်ပါ", "Attempt 2 of 3", "ကြိုးစားမှု 2 / 3"]) {
      expect(html).toContain(expected);
      expect(text).toContain(expected);
    }
    expect(text).toContain("18 Sept 2026");
    expect(text).toContain("https://shop.example.com/orders");
  });

  it("warns, in both languages, when the last planned attempt failed", () => {
    const last = orderEmailContent(order(), "attempt_failed", undefined, env, {
      number: 3, max: 3, reason: "nobody_home",
    }).text;
    expect(last).toContain("This was the last planned attempt");
    expect(last).toContain("နောက်ဆုံးကြိုးစားမှု");

    const earlier = orderEmailContent(order(), "attempt_failed", undefined, env, {
      number: 1, max: 3, reason: "nobody_home",
    }).text;
    expect(earlier).not.toContain("This was the last planned attempt");
  });
});
