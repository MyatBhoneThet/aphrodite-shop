import { describe, expect, it, vi } from "vitest";
import {
  MAX_BATCH_ORDERS,
  describeBatch,
  parseSlipIds,
  planBatchAdvance,
  runBatchAdvance,
} from "../app/admin/batch-orders";
import type { AdminOrder } from "../app/admin/types";

function order(id: string, overrides: Partial<AdminOrder> = {}, stages: string[] = []): AdminOrder {
  return {
    id,
    user_id: "u",
    status: "confirmed",
    total_amount: 1,
    shipping_name: "Name",
    shipping_phone: "09",
    shipping_address: "Addr",
    cancellation_request_status: "none",
    return_request_status: "none",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    delivery_events: stages.map((stage, index) => ({ stage, happened_at: `2026-10-01T0${index}:00:00Z` })),
    ...overrides,
  } as AdminOrder;
}

describe("planBatchAdvance", () => {
  const verified = order("a1111111-0000-4000-8000-000000000000"); // confirmed, step 1
  const packed = order("b2222222-0000-4000-8000-000000000000", {}, ["verified", "packed"]); // step 2
  const shipped = order("c3333333-0000-4000-8000-000000000000", { status: "shipped" }, ["verified", "packed", "handed_to_courier"]);
  const placed = order("d4444444-0000-4000-8000-000000000000", { status: "pending" });
  const cancelled = order("e5555555-0000-4000-8000-000000000000", { status: "cancelled" });
  const cancelAsked = order("f6666666-0000-4000-8000-000000000000", { cancellation_request_status: "requested" }, ["verified", "packed"]);

  it("lets only packed orders be handed to the courier, and says why the rest cannot", () => {
    const plan = planBatchAdvance([verified, packed, shipped, placed, cancelled, cancelAsked], "handed_to_courier");

    expect(plan.eligible.map((entry) => entry.id)).toEqual([packed.id]);
    const reasons = Object.fromEntries(plan.skipped.map((entry) => [entry.orderId.slice(0, 2), entry.reason]));
    expect(reasons.a1).toBe("Not packed yet.");
    expect(reasons.c3).toMatch(/Already/);
    expect(reasons.d4).toBe("Not packed yet.");
    expect(reasons.e5).toBe("The order is closed.");
    expect(reasons.f6).toMatch(/asked to cancel/);
  });

  it("lets only verified orders be marked packed", () => {
    const plan = planBatchAdvance([verified, packed, placed], "packed");

    expect(plan.eligible.map((entry) => entry.id)).toEqual([verified.id]);
    expect(plan.skipped.find((entry) => entry.orderId === placed.id)?.reason).toBe("Not verified yet.");
    expect(plan.skipped.find((entry) => entry.orderId === packed.id)?.reason).toMatch(/Already/);
  });
});

describe("runBatchAdvance", () => {
  const first = order("a1111111-0000-4000-8000-000000000000", {}, ["verified", "packed"]);
  const second = order("b2222222-0000-4000-8000-000000000000", {}, ["verified", "packed"]);
  const third = order("c3333333-0000-4000-8000-000000000000", {}, ["verified", "packed"]);

  it("sends one request per order and carries on after a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Verify the order first." }), { status: 409 }))
      .mockRejectedValueOnce(new TypeError("offline"));

    const outcome = await runBatchAdvance([first, second, third], "handed_to_courier", { Authorization: "x" }, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/orders/${first.id}`);
    expect(JSON.parse(String(init.body))).toEqual({ action: "advance_delivery_progress", stage: "handed_to_courier" });
    expect(outcome.done).toEqual([first.id]);
    expect(outcome.failed).toEqual([
      { orderId: second.id, error: "Verify the order first." },
      { orderId: third.id, error: "offline" },
    ]);
  });

  it("summarises what happened in one sentence", () => {
    const text = describeBatch(
      "handed_to_courier",
      { done: ["a1111111"], failed: [{ orderId: "b2222222-x", error: "Nope" }] },
      [{ orderId: "c3333333-x", reason: "Not packed yet." }]
    );
    expect(text.text).toContain("1 order marked handed to the courier.");
    expect(text.text).toContain("1 skipped: #c3333333 (Not packed yet.)");
    expect(text.text).toContain("1 failed: #b2222222 (Nope)");
    expect(text.isProblem).toBe(true);
    expect(describeBatch("packed", { done: ["x", "y"], failed: [] }, []).isProblem).toBe(false);
  });
});

describe("parseSlipIds", () => {
  it("keeps only well-formed, unique order ids and caps the list", () => {
    const good = "0f0f0f0f-0000-4000-8000-000000000001";
    expect(parseSlipIds(`${good},${good},not-an-id,,<script>`)).toEqual([good]);
    expect(parseSlipIds(null)).toEqual([]);
    const many = Array.from({ length: 80 }, (_, i) => `0f0f0f0f-0000-4000-8000-${String(i).padStart(12, "0")}`).join(",");
    expect(parseSlipIds(many)).toHaveLength(MAX_BATCH_ORDERS);
  });
});
