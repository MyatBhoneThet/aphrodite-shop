import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/backend", async (importOriginal) => ({
  // assertPaymentSlipFile stays real: it is the rule under test.
  ...(await importOriginal<typeof import("../app/lib/backend")>()),
  authenticate: vi.fn(),
  createOrder: vi.fn(),
  addPaymentSlip: vi.fn(),
  getOrders: vi.fn(),
  notifyOrderPlaced: vi.fn(),
  notifyOrderPlacedInApp: vi.fn(),
}));

// after() only exists inside a real request; run its callback straight away.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    void task();
  },
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/orders/route";
import { addPaymentSlip, authenticate, createOrder } from "../app/lib/backend";

const base = {
  shipping_name: "Swan Yi",
  shipping_phone: "09765109321",
  shipping_address_line1: "190/18 Preme condo",
  shipping_city: "Hlaing",
  shipping_state: "Yangon",
  shipping_country: "Myanmar",
};
const cod = { ...base, payment_method: "cash_on_delivery", cod_confirmation: true, cod_contact_confirmation: true };
const bank = { ...base, payment_method: "bank_transfer", payment_account: "kbz" };

function json(body: unknown) {
  return new NextRequest("https://shop.test/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function form(order: unknown, slip?: File) {
  const data = new FormData();
  data.set("order", JSON.stringify(order));
  if (slip) data.set("slip", slip);
  return new NextRequest("https://shop.test/api/orders", { method: "POST", body: data });
}

const png = () => new File([new Uint8Array([1, 2, 3])], "slip.png", { type: "image/png" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(authenticate).mockResolvedValue({ id: "u1", role: "normal" } as never);
  vi.mocked(createOrder).mockResolvedValue({ id: "order-1" } as never);
  vi.mocked(addPaymentSlip).mockResolvedValue({ id: "slip-1" } as never);
});

describe("a bank transfer or MMQR order needs its slip first", () => {
  it("refuses a prepaid order sent without a slip, and creates nothing", async () => {
    const response = await POST(json(bank));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/slip/i);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("refuses a form with no file in it", async () => {
    const response = await POST(form(bank));
    expect(response.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("refuses a file that is not a JPG, PNG, WebP or PDF, before creating the order", async () => {
    const response = await POST(form(bank, new File(["x"], "slip.gif", { type: "image/gif" })));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/JPG, PNG, WebP or PDF/);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("refuses a slip over 10 MB", async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "slip.png", { type: "image/png" });
    const response = await POST(form(bank, big));
    expect(response.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("creates the order and saves the slip with it", async () => {
    const response = await POST(form({ ...bank, payment_method: "mmqr", payment_account: "mmqr" }, png()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ order: { id: "order-1" }, slipSaved: true });
    expect(addPaymentSlip).toHaveBeenCalledWith(expect.anything(), "order-1", expect.any(File), null);
  });

  it("still creates the order if saving the slip fails, and says so", async () => {
    vi.mocked(addPaymentSlip).mockRejectedValue(new Error("storage down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(form(bank, png()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.slipSaved).toBe(false);
  });
});

describe("cash on delivery is unchanged", () => {
  it("needs no slip", async () => {
    const response = await POST(json(cod));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ slipSaved: true });
    expect(addPaymentSlip).not.toHaveBeenCalled();
  });
});
