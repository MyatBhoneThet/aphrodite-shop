import { describe, expect, it } from "vitest";

import { orderNextStep, nextStepLabels, type NextStepOrder } from "../app/lib/next-step";

const TOTAL = 500_000;

function order(overrides: Partial<NextStepOrder> = {}): NextStepOrder {
  return {
    status: "pending",
    total_amount: TOTAL,
    payment_method: "bank_transfer",
    payment_status: "unpaid",
    payment_verification_status: "pending",
    payment_slips: [],
    ...overrides,
  };
}

const slip = [{ id: "slip-1" }];

describe("what happens next: prepaid orders", () => {
  it("asks for the receipt, with the full total, before any slip arrives", () => {
    const step = orderNextStep(order());

    expect(step.key).toBe("pay_now");
    expect(step.tone).toBe("action");
    expect(step.amount).toBe(TOTAL);
  });

  it("switches to waiting once a slip is uploaded, and names no amount", () => {
    const step = orderNextStep(order({ payment_slips: slip }));

    expect(step.key).toBe("checking_payment");
    expect(step.tone).toBe("waiting");
    expect(step.amount).toBeNull();
  });

  it("asks for a new receipt after a rejection", () => {
    const step = orderNextStep(
      order({ payment_verification_status: "rejected", payment_slips: slip })
    );

    expect(step.key).toBe("pay_again");
    expect(step.amount).toBe(TOTAL);
  });

  it("confirms payment and stops asking for anything", () => {
    const step = orderNextStep(
      order({ payment_verification_status: "verified", payment_slips: slip })
    );

    expect(step.key).toBe("payment_confirmed");
    expect(step.tone).toBe("waiting");
    expect(step.amount).toBeNull();
  });

  it("reports preparing once a verified order is confirmed", () => {
    const step = orderNextStep(
      order({ status: "confirmed", payment_verification_status: "verified", payment_slips: slip })
    );

    expect(step.key).toBe("preparing");
  });

  it("reports the courier once a verified order ships", () => {
    const step = orderNextStep(
      order({ status: "shipped", payment_verification_status: "verified", payment_slips: slip })
    );

    expect(step.key).toBe("on_the_way");
  });
});

describe("what happens next: payment corrections", () => {
  it("shows only the difference when part of the money arrived", () => {
    const step = orderNextStep(
      order({
        payment_verification_status: "correction_requested",
        payment_amount_received: 300_000,
        payment_slips: slip,
      })
    );

    expect(step.key).toBe("pay_remaining");
    expect(step.tone).toBe("action");
    // The remainder, NOT the order total: this is the whole point.
    expect(step.amount).toBe(200_000);
    expect(step.outstanding).toBe(200_000);
  });

  it("asks for a clearer slip, and names no amount, when nothing was counted", () => {
    const step = orderNextStep(
      order({
        payment_verification_status: "correction_requested",
        payment_amount_received: null,
        payment_slips: slip,
      })
    );

    expect(step.key).toBe("fix_slip");
    // Naming a figure here would be a guess: nothing has been counted.
    expect(step.amount).toBeNull();
  });

  it("treats a counted zero as unreadable rather than as a short payment", () => {
    const step = orderNextStep(
      order({
        payment_verification_status: "correction_requested",
        payment_amount_received: 0,
        payment_slips: slip,
      })
    );

    expect(step.key).toBe("fix_slip");
  });

  it("tells an over-payer what is coming back, and does not ask for money", () => {
    const step = orderNextStep(
      order({
        payment_verification_status: "correction_requested",
        payment_amount_received: 550_000,
        payment_slips: slip,
      })
    );

    expect(step.key).toBe("overpaid");
    expect(step.tone).toBe("waiting");
    expect(step.amount).toBe(50_000);
    expect(step.outstanding).toBe(0);
  });

  it("never reports a negative remainder", () => {
    const step = orderNextStep(
      order({
        payment_verification_status: "correction_requested",
        payment_amount_received: 900_000,
        payment_slips: slip,
      })
    );

    expect(step.outstanding).toBe(0);
    expect(step.overpaid).toBe(400_000);
  });
});

describe("what happens next: cash on delivery", () => {
  it("names the exact cash to have ready", () => {
    const step = orderNextStep(
      order({ payment_method: "cash_on_delivery", payment_verification_status: "not_required" })
    );

    expect(step.key).toBe("prepare_cash");
    expect(step.tone).toBe("action");
    expect(step.amount).toBe(TOTAL);
  });

  it("keeps asking for the cash right up to the door", () => {
    const step = orderNextStep(
      order({
        status: "shipped",
        payment_method: "cash_on_delivery",
        payment_verification_status: "not_required",
      })
    );

    expect(step.key).toBe("prepare_cash");
    expect(step.amount).toBe(TOTAL);
  });

  it("stops asking for cash once it has been collected", () => {
    const step = orderNextStep(
      order({
        status: "shipped",
        payment_method: "cash_on_delivery",
        payment_status: "collected",
        payment_verification_status: "not_required",
      })
    );

    expect(step.key).toBe("on_the_way");
    expect(step.amount).toBeNull();
  });
});

describe("what happens next: after delivery and closed orders", () => {
  const delivered = (deliveredAt: string) =>
    order({
      status: "delivered",
      payment_method: "cash_on_delivery",
      payment_status: "collected",
      payment_verification_status: "not_required",
      delivered_at: deliveredAt,
    });

  it("offers the return window inside 7 days", () => {
    const now = Date.parse("2026-09-17T00:00:00Z");
    const step = orderNextStep(delivered("2026-09-15T00:00:00Z"), now);

    expect(step.key).toBe("delivered_window");
    expect(step.tone).toBe("done");
  });

  it("closes the order once the window has passed", () => {
    const now = Date.parse("2026-09-30T00:00:00Z");
    const step = orderNextStep(delivered("2026-09-15T00:00:00Z"), now);

    expect(step.key).toBe("delivered_done");
  });

  it("says nothing is owed on a cancelled order", () => {
    const step = orderNextStep(order({ status: "cancelled" }));

    expect(step.key).toBe("cancelled");
    expect(step.tone).toBe("stopped");
    expect(step.amount).toBeNull();
  });

  it("asks for refund details after a collected prepaid order is cancelled", () => {
    const step = orderNextStep(
      order({ status: "cancelled", payment_status: "collected", cancellation_refund_status: "details_required" })
    );

    expect(step.key).toBe("refund_details");
    expect(step.tone).toBe("action");
    expect(step.amount).toBe(TOTAL);
  });

  it("shows refund pending after the customer provides bank information", () => {
    const step = orderNextStep(
      order({ status: "cancelled", payment_status: "collected", cancellation_refund_status: "pending" })
    );

    expect(step.key).toBe("refund_pending");
    expect(step.tone).toBe("waiting");
  });

  it("shows the cancellation refund as complete after money is sent", () => {
    const step = orderNextStep(
      order({ status: "cancelled", payment_status: "refunded", cancellation_refund_status: "sent" })
    );

    expect(step.key).toBe("refund_sent");
    expect(step.tone).toBe("done");
  });

  it("reports a returned order as stopped", () => {
    expect(orderNextStep(order({ status: "returned" })).key).toBe("returned");
  });

  it("does not chase payment on a cancelled order", () => {
    // The order is closed: asking for money would be wrong even though the
    // payment never completed.
    const step = orderNextStep(order({ status: "cancelled", payment_verification_status: "pending" }));

    expect(step.key).toBe("cancelled");
  });
});

describe("every step has an English label", () => {
  it("labels whatever key is returned", () => {
    const step = orderNextStep(order());
    expect(step.label).toBe(nextStepLabels[step.key]);
  });
});
