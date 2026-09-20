import { describe, expect, it } from "vitest";
import { refundTracking } from "../app/lib/refund-tracking";

const NOW = Date.parse("2026-09-20T00:00:00Z");

describe("customer refund tracker", () => {
  it("maps every stored status onto one of the five customer steps", () => {
    expect(refundTracking({ status: "requested" }, NOW).step).toBe(0);
    expect(refundTracking({ status: "more_info_needed" }, NOW).step).toBe(0);
    expect(refundTracking({ status: "approved" }, NOW).step).toBe(1);
    // Staff distinguish collected from inspected; a customer only cares that
    // the shop has the item.
    expect(refundTracking({ status: "collected" }, NOW).step).toBe(2);
    expect(refundTracking({ status: "inspected" }, NOW).step).toBe(2);
    expect(refundTracking({ status: "refund_approved" }, NOW).step).toBe(3);
    expect(refundTracking({ status: "completed" }, NOW).step).toBe(4);
  });

  it("names the stage so a translated view can look it up", () => {
    expect(refundTracking({ status: "refund_approved" }, NOW)).toMatchObject({
      stage: "refund_approved",
      label: "Refund approved",
      stopped: false,
    });
  });

  it("takes a declined or cancelled request off the ladder", () => {
    for (const status of ["declined", "cancelled"]) {
      expect(refundTracking({ status }, NOW)).toMatchObject({
        stage: null,
        step: -1,
        stopped: true,
      });
    }
  });

  it("flags a refund that has passed its promised date", () => {
    const late = refundTracking(
      { status: "refund_approved", expected_refund_at: "2026-09-18T00:00:00Z" },
      NOW
    );

    expect(late.isLate).toBe(true);
    expect(late.expectedAt).toBe("2026-09-18T00:00:00Z");
  });

  it("does not call a refund late before its promised date", () => {
    expect(
      refundTracking(
        { status: "approved", expected_refund_at: "2026-09-25T00:00:00Z" },
        NOW
      ).isLate
    ).toBe(false);
  });

  it("stops calling a paid refund late once the money has gone", () => {
    const paid = refundTracking(
      {
        status: "completed",
        expected_refund_at: "2026-09-10T00:00:00Z",
        refund_sent_at: "2026-09-19T00:00:00Z",
      },
      NOW
    );

    expect(paid.step).toBe(4);
    expect(paid.isLate).toBe(false);
  });

  it("carries the delay explanation through to the customer", () => {
    expect(
      refundTracking(
        {
          status: "inspected",
          expected_refund_at: "2026-09-18T00:00:00Z",
          delay_reason: "The bank rejected the first transfer, we are resending it.",
        },
        NOW
      )
    ).toMatchObject({
      isLate: true,
      delayReason: "The bank rejected the first transfer, we are resending it.",
    });
  });

  it("says nothing about dates when none has been promised", () => {
    expect(refundTracking({ status: "requested" }, NOW)).toMatchObject({
      expectedAt: null,
      isLate: false,
      delayReason: null,
    });
  });
});
