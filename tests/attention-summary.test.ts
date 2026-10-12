import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectAttentionOrdersService: vi.fn(),
  selectOrderIdsWithSlipsService: vi.fn(),
  countOpenItemReturnsService: vi.fn(),
}));

import { getAttentionSummary } from "../app/lib/backend";
import {
  countOpenItemReturnsService,
  selectAttentionOrdersService,
  selectOrderIdsWithSlipsService,
  type AttentionOrderRow,
  type CurrentUser,
} from "../app/lib/supabase";

const asUser = (role: string) => ({ id: "u", email: "a@b.c", role, accessToken: "t", profile: { id: "u", role } }) as unknown as CurrentUser;

function row(id: string, overrides: Partial<AttentionOrderRow> = {}): AttentionOrderRow {
  return {
    id,
    status: "pending",
    payment_method: "cash_on_delivery",
    payment_verification_status: null,
    cancellation_request_status: "none",
    return_request_status: "none",
    cancellation_refund_status: "none",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(selectAttentionOrdersService).mockReset();
  vi.mocked(selectOrderIdsWithSlipsService).mockReset().mockResolvedValue(new Set());
  vi.mocked(countOpenItemReturnsService).mockReset().mockResolvedValue(0);
});

describe("getAttentionSummary", () => {
  it("counts slips to check, unpaid transfers, orders to ship, returns and refunds", async () => {
    vi.mocked(selectAttentionOrdersService).mockResolvedValue([
      row("slip-1", { payment_method: "bank_transfer", payment_verification_status: "pending" }),
      row("slip-2", { payment_method: "mmqr", payment_verification_status: "pending" }),
      row("nopay-1", { payment_method: "bank_transfer", payment_verification_status: "pending" }),
      row("corr-1", { payment_method: "bank_transfer", payment_verification_status: "correction_requested" }),
      row("ship-1", { status: "confirmed" }),
      row("ship-2", { status: "confirmed", payment_method: "bank_transfer", payment_verification_status: "verified" }),
      row("cancel-1", { status: "pending", cancellation_request_status: "requested" }),
      row("ret-1", { status: "delivered", return_request_status: "approved" }),
      row("refund-1", { status: "cancelled", cancellation_refund_status: "pending" }),
    ]);
    vi.mocked(selectOrderIdsWithSlipsService).mockResolvedValue(new Set(["slip-1", "slip-2"]));
    vi.mocked(countOpenItemReturnsService).mockResolvedValue(3);

    const summary = await getAttentionSummary(asUser("admin"));

    expect(summary).toEqual({
      slipsToCheck: 2,
      awaitingPayment: 1,
      toShip: 2,
      // cancellation request + approved legacy return + 3 item returns
      openReturns: 5,
      refundsToSend: 1,
    });
  });

  it("gives staff only the orders they can pack and ship", async () => {
    vi.mocked(selectAttentionOrdersService).mockResolvedValue([
      row("ship-1", { status: "confirmed" }),
      row("slip-1", { payment_method: "bank_transfer", payment_verification_status: "pending" }),
      row("ret-1", { status: "delivered", return_request_status: "requested" }),
    ]);

    const summary = await getAttentionSummary(asUser("staff"));

    expect(summary).toEqual({ slipsToCheck: 0, awaitingPayment: 0, toShip: 1, openReturns: 0, refundsToSend: 0 });
    expect(selectOrderIdsWithSlipsService).not.toHaveBeenCalled();
  });

  it("is closed to customers", async () => {
    await expect(getAttentionSummary(asUser("normal"))).rejects.toThrow();
  });

  it("still answers when the slips table is unavailable", async () => {
    vi.mocked(selectAttentionOrdersService).mockResolvedValue([
      row("p1", { payment_method: "bank_transfer", payment_verification_status: "pending" }),
    ]);
    vi.mocked(selectOrderIdsWithSlipsService).mockRejectedValue(new Error("relation missing"));
    vi.mocked(countOpenItemReturnsService).mockRejectedValue(new Error("down"));

    const summary = await getAttentionSummary(asUser("admin"));

    expect(summary.slipsToCheck).toBe(0);
    expect(summary.awaitingPayment).toBe(1);
    expect(summary.openReturns).toBe(0);
  });
});
