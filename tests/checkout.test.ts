import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// backend.ts is exercised for real; only the Supabase data layer is mocked.
vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();

  return {
    ...original,
    selectCart: vi.fn(),
    selectPriceListById: vi.fn(),
    selectTiersForProducts: vi.fn(),
    selectPercentBandsForList: vi.fn(),
    selectProductsByIdsService: vi.fn(),
    checkoutOrderRpc: vi.fn(),
    selectOrderById: vi.fn(),
    clearCart: vi.fn(),
    selectShopSetting: vi.fn(),
    updateOrderPoNumber: vi.fn(),
    selectCompanyDetails: vi.fn(),
  };
});

import { createOrder, getCart, productDTO } from "../app/lib/backend";
import { resetWholesaleRulesCache } from "../app/lib/wholesale-b2b";
import { AppError } from "../app/lib/errors";
import {
  checkoutOrderRpc,
  clearCart,
  selectCart,
  selectOrderById,
  selectShopSetting,
  selectCompanyDetails,
  updateOrderPoNumber,
  selectPriceListById,
  selectProductsByIdsService,
  selectTiersForProducts,
  selectPercentBandsForList,
  type CartItemRow,
  type CurrentUser,
  type Profile,
} from "../app/lib/supabase";

const RETAIL = 50_000;

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    email: "customer@example.com",
    full_name: "Customer",
    role: "normal",
    wholesale_status: "not_applied",
    price_list_id: null,
    phone: null,
    ...overrides,
  };
}

function user(profileOverrides: Partial<Profile> = {}): CurrentUser {
  const p = profile(profileOverrides);

  return {
    id: p.id,
    email: p.email,
    role: p.role,
    profile: p,
    accessToken: "token-abc",
  };
}

function approvedWholesaleUser() {
  return user({
    business_verified_at: "2026-09-03T00:00:00Z",
    role: "wholesale",
    wholesale_status: "approved",
    price_list_id: "list-1",
  });
}

function cartRow(overrides: Partial<CartItemRow> = {}): CartItemRow {
  return {
    id: "cart-1",
    user_id: "user-1",
    product_id: 1,
    quantity: 10,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    products: {
      id: 1,
      name: "MacBook Air M2",
      type: "laptop",
      category: "Laptop",
      brand: "Apple",
      price: RETAIL,
      wholesale_price: 45_000,
      image: "/products/macbook-air.png",
      model_3d: null,
      stock: "In Stock",
      stock_quantity: 500,
      specs: {},
      full_specs: {},
    },
    ...overrides,
  };
}

const LADDER = [
  {
    id: "t10",
    price_list_id: "list-1",
    product_id: 1,
    min_quantity: 10,
    unit_price: 48_000,
    is_active: true,
    effective_from: null,
    effective_to: null,
  },
  {
    id: "t100",
    price_list_id: "list-1",
    product_id: 1,
    min_quantity: 100,
    unit_price: 45_000,
    is_active: true,
    effective_from: null,
    effective_to: null,
  },
];

const SHIPPING = {
  shipping_name: "Customer",
  shipping_phone: "0812345678",
  shipping_address: "123 Test Road, Yangon",
  shipping_country: "Myanmar",
  shipping_state: "Yangon",
};

// Wholesale buyers pay by bank transfer first (the shop's default rule).
const WHOLESALE_SHIPPING = { ...SHIPPING, payment_method: "bank_transfer" as const, payment_account: "kbz" as const };

beforeEach(() => {
  vi.mocked(selectCart).mockReset().mockResolvedValue([cartRow()]);
  vi.mocked(selectPriceListById).mockReset().mockResolvedValue({
    id: "list-1",
    name: "Standard Wholesale",
    description: null,
    is_active: true,
  });
  vi.mocked(selectTiersForProducts).mockReset().mockResolvedValue(LADDER);
  // This list prices with fixed per-product tiers, not "% off retail" bands.
  vi.mocked(selectPercentBandsForList).mockReset().mockResolvedValue([]);
  vi.mocked(selectProductsByIdsService)
    .mockReset()
    .mockResolvedValue([cartRow().products!]);
  vi.mocked(checkoutOrderRpc)
    .mockReset()
    .mockResolvedValue({ order_id: "order-1", total_amount: 0 });
  vi.mocked(selectOrderById).mockReset().mockResolvedValue(null as never);
  vi.mocked(clearCart).mockReset();
});

describe("checkout pricing authority", () => {
  it("normal user pays retail even when tiers exist for some list", async () => {
    await createOrder(user(), SHIPPING);

    const call = vi.mocked(checkoutOrderRpc).mock.calls[0][0];
    expect(call.lines[0].unit_price).toBe(RETAIL);
    expect(call.lines[0].tier_id).toBeNull();
    // No price list is even consulted for a non-entitled user.
    expect(selectPriceListById).not.toHaveBeenCalled();
  });

  it("a retail account with a stale price list assignment still pays retail", async () => {
    await createOrder(
      user({ wholesale_status: "not_applied", price_list_id: "list-1" }),
      SHIPPING
    );

    expect(vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0].unit_price).toBe(RETAIL);
  });

  it("suspended account pays retail", async () => {
    await createOrder(
      user({
        role: "wholesale",
        wholesale_status: "suspended",
        price_list_id: "list-1",
      }),
      SHIPPING
    );

    expect(vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0].unit_price).toBe(RETAIL);
  });

  it("approved wholesale account gets its assigned price list tier", async () => {
    await createOrder(approvedWholesaleUser(), WHOLESALE_SHIPPING);

    expect(selectPriceListById).toHaveBeenCalledWith("list-1", "token-abc");

    const line = vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0];
    expect(line.unit_price).toBe(48_000);
    expect(line.tier_id).toBe("t10");
  });

  it("approved wholesale below the tier minimum pays retail", async () => {
    vi.mocked(selectCart).mockResolvedValue([cartRow({ quantity: 9 })]);

    await createOrder(approvedWholesaleUser(), WHOLESALE_SHIPPING);

    const line = vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0];
    expect(line.unit_price).toBe(RETAIL);
    expect(line.tier_id).toBeNull();
  });

  it("an inactive price list falls back to retail", async () => {
    vi.mocked(selectPriceListById).mockResolvedValue({
      id: "list-1",
      name: "Standard Wholesale",
      description: null,
      is_active: false,
    });

    await createOrder(approvedWholesaleUser(), WHOLESALE_SHIPPING);

    expect(vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0].unit_price).toBe(RETAIL);
  });

  it("ignores browser-supplied prices and totals", async () => {
    await createOrder(approvedWholesaleUser(), {
      ...WHOLESALE_SHIPPING,
      // Injected junk a malicious client might send; none of it is read.
      unit_price: 1,
      total_amount: 1,
      price: 1,
      lines: [{ product_id: 1, quantity: 10, unit_price: 1 }],
    } as never);

    const call = vi.mocked(checkoutOrderRpc).mock.calls[0][0];
    expect(call.lines[0].unit_price).toBe(48_000);
  });

  it("stores a full pricing snapshot on every line", async () => {
    await createOrder(approvedWholesaleUser(), WHOLESALE_SHIPPING);

    expect(vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0]).toEqual({
      product_id: 1,
      quantity: 10,
      unit_price: 48_000,
      retail_unit_price: RETAIL,
      price_list_id: "list-1",
      tier_id: "t10",
      tier_min_quantity: 10,
    });
  });

  it("sends structured COD details to the atomic checkout", async () => {
    await createOrder(user(), {
      shipping_name: "Customer",
      shipping_phone: "+66 81 234 5678",
      shipping_address_line1: "123 Test Road",
      shipping_address_line2: "Unit 4",
      shipping_city: "Yangon",
      shipping_state: "Yangon",
      shipping_postal_code: "10110",
      shipping_country: "Myanmar",
      payment_method: "cash_on_delivery",
    });
    expect(checkoutOrderRpc).toHaveBeenCalledWith(expect.objectContaining({
      shipping_address: "123 Test Road, Unit 4, Yangon, Yangon, 10110, Myanmar",
      payment_method: "cash_on_delivery",
    }));
  });
});

describe("checkout safety", () => {
  it("checks out only the selected cart rows and leaves the selection explicit for the transaction", async () => {
    const first = cartRow({ id: "11111111-1111-4111-8111-111111111111", quantity: 2 });
    const secondProduct = { ...cartRow().products!, id: 2, name: "Selected monitor", price: 70_000 };
    const second = cartRow({
      id: "22222222-2222-4222-8222-222222222222",
      product_id: 2,
      quantity: 1,
      products: secondProduct,
    });
    vi.mocked(selectCart).mockResolvedValue([first, second]);
    vi.mocked(selectProductsByIdsService).mockResolvedValue([secondProduct]);

    await createOrder(user(), {
      ...SHIPPING,
      selected_cart_item_ids: [second.id],
      expected_total: 70_000,
    });

    const call = vi.mocked(checkoutOrderRpc).mock.calls[0][0];
    expect(call.cart_item_ids).toEqual([second.id]);
    expect(call.lines).toEqual([expect.objectContaining({ product_id: 2, quantity: 1 })]);
  });

  it("rejects a selected cart id that does not belong to the customer", async () => {
    await expect(createOrder(user(), {
      ...SHIPPING,
      selected_cart_item_ids: ["33333333-3333-4333-8333-333333333333"],
    })).rejects.toMatchObject({ status: 409 });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("rejects foreign destinations before reading the cart", async () => {
    await expect(createOrder(user(), { ...SHIPPING, shipping_country: "Thailand" })).rejects.toMatchObject({ status: 400 });
    expect(selectCart).not.toHaveBeenCalled();
  });

  it("rejects missing country even for a legacy combined address", async () => {
    await expect(createOrder(user(), { ...SHIPPING, shipping_country: undefined })).rejects.toMatchObject({ status: 400 });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("cannot purchase unpriced products, even from an old cart", async () => {
    vi.mocked(selectProductsByIdsService).mockResolvedValue([{ ...cartRow().products!, price: 0 }]);
    await expect(createOrder(user(), SHIPPING)).rejects.toMatchObject({ status: 400 });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });
  it("rejects orders that exceed available inventory before calling the RPC", async () => {
    vi.mocked(selectCart).mockResolvedValue([
      cartRow({
        quantity: 10,
      }),
    ]);
    vi.mocked(selectProductsByIdsService).mockResolvedValue([
      { ...cartRow().products!, stock_quantity: 5 },
    ]);

    await expect(createOrder(user(), SHIPPING)).rejects.toMatchObject({
      status: 400,
    });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("returns 409 when the authoritative total differs from what the client saw", async () => {
    await expect(
      createOrder(approvedWholesaleUser(), {
        ...WHOLESALE_SHIPPING,
        expected_total: 999,
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("accepts a matching expected_total", async () => {
    await createOrder(approvedWholesaleUser(), {
      ...WHOLESALE_SHIPPING,
      expected_total: 48_000 * 10,
    });

    expect(checkoutOrderRpc).toHaveBeenCalled();
  });

  it("maps an inventory race inside the transaction to a 409 and never clears the cart itself", async () => {
    vi.mocked(checkoutOrderRpc).mockRejectedValue(
      new Error("INSUFFICIENT_STOCK:1:3")
    );

    await expect(createOrder(user(), SHIPPING)).rejects.toMatchObject({
      status: 409,
    });

    // Cart clearing happens only inside the database transaction; a failed
    // checkout must leave the cart untouched (nothing to roll back here).
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("maps a cart change during checkout to a 409", async () => {
    vi.mocked(checkoutOrderRpc).mockRejectedValue(new Error("CART_CHANGED"));

    await expect(createOrder(user(), SHIPPING)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("rejects an empty cart", async () => {
    vi.mocked(selectCart).mockResolvedValue([]);

    await expect(createOrder(user(), SHIPPING)).rejects.toBeInstanceOf(AppError);
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("rejects missing shipping details", async () => {
    await expect(
      createOrder(user(), { shipping_name: "x" })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("cart pricing (existing retail flow)", () => {
  it("normal user cart uses retail prices with no wholesale data", async () => {
    const cart = await getCart(user());

    expect(cart.items[0].pricing.unitPrice).toBe(RETAIL);
    expect(cart.items[0].lineTotal).toBe(RETAIL * 10);
    expect(cart.total).toBe(RETAIL * 10);
    expect(cart.wholesale).toBe(false);
    expect(cart.totalSavings).toBe(0);
    // Confidential fields never leak into the cart DTO for non-admins.
    expect(cart.items[0].product.wholesalePrice).toBeUndefined();
    expect(cart.items[0].product.stockQuantity).toBeUndefined();
  });

  it("approved wholesale cart applies tiers and reports savings", async () => {
    const cart = await getCart(approvedWholesaleUser());

    expect(cart.items[0].pricing.unitPrice).toBe(48_000);
    expect(cart.items[0].pricing.savings).toBe((RETAIL - 48_000) * 10);
    expect(cart.wholesale).toBe(true);
    expect(cart.totalSavings).toBe((RETAIL - 48_000) * 10);
    expect(cart.items[0].pricing.nextTier).toEqual({
      minQuantity: 100,
      unitPrice: 45_000,
      unitsAway: 90,
    });
  });
});

describe("promotional checkout", () => {
  function setPromotion(endsAt: string | null = null) {
    const row = cartRow();
    row.products!.full_specs = { promotion: { price: 40000, startsAt: null, endsAt } };
    vi.mocked(selectCart).mockResolvedValue([row]);
    vi.mocked(selectProductsByIdsService).mockResolvedValue([row.products!]);
  }
  it("uses the same sale price in cart and saved order lines", async () => {
    setPromotion();
    const cart = await getCart(user());
    expect(cart.items[0].pricing).toMatchObject({ unitPrice: 40000, retailUnitPrice: RETAIL, promotional: true });
    await createOrder(user(), { ...SHIPPING, expected_total: 400000 });
    expect(vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0]).toMatchObject({ unit_price: 40000, retail_unit_price: RETAIL, tier_id: null });
  });
  it("shows wholesale ladder prices no higher than the current offer", () => {
    const product = { id: 1, name: "Laptop", type: "laptop" as const, category: "Laptop", brand: "HP", price: RETAIL, image: "/test.png", stock: "In Stock" as const, specs: {}, fullSpecs: { promotion: { price: 40000, startsAt: null, endsAt: null } } };
    expect(productDTO(product, null, LADDER).tiers?.map(t => t.unitPrice)).toEqual([40000, 40000]);
    expect(productDTO({ ...product, fullSpecs: {} }, null, LADDER).tiers?.map(t => t.unitPrice)).toEqual([48000, 45000]);
  });
  it("does not stack the sale and wholesale discounts", async () => {
    setPromotion();
    await createOrder(approvedWholesaleUser(), WHOLESALE_SHIPPING);
    expect(vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0]).toMatchObject({ unit_price: 40000, tier_id: null, price_list_id: null });
  });
  it("rejects an outdated checkout total after a promotion expires", async () => {
    setPromotion("2020-01-01T00:00:00Z");
    await expect(createOrder(user(), { ...SHIPPING, expected_total: 400000 })).rejects.toThrow("Prices were updated");
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });
});


describe("wholesale terms at checkout", () => {
  beforeEach(() => {
    resetWholesaleRulesCache();
    vi.mocked(selectShopSetting).mockReset().mockResolvedValue(null); // shop defaults: pay first, no minimum
    vi.mocked(updateOrderPoNumber).mockReset().mockResolvedValue(undefined);
  });

  it("makes wholesale pay by bank transfer first by default", async () => {
    await expect(createOrder(approvedWholesaleUser(), SHIPPING)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/bank transfer/) });
    await expect(createOrder(approvedWholesaleUser(), { ...SHIPPING, payment_method: "mmqr", payment_account: "mmqr" })).rejects.toMatchObject({ status: 400 });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("never applies those rules to ordinary retail customers", async () => {
    await createOrder(user(), SHIPPING);
    expect(checkoutOrderRpc).toHaveBeenCalled();
  });

  it("lets the shop allow wholesale cash on delivery again", async () => {
    vi.mocked(selectShopSetting).mockResolvedValue({ min_amount: 0, min_units: 0, prepay_required: false });
    await createOrder(approvedWholesaleUser(), SHIPPING);
    expect(checkoutOrderRpc).toHaveBeenCalled();
  });

  it("enforces a minimum order amount, using the real recomputed total", async () => {
    vi.mocked(selectShopSetting).mockResolvedValue({ min_amount: 1_000_000, min_units: 0, prepay_required: true });
    await expect(createOrder(approvedWholesaleUser(), WHOLESALE_SHIPPING)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/start at MMK 1,000,000/) });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("enforces a minimum number of items", async () => {
    vi.mocked(selectShopSetting).mockResolvedValue({ min_amount: 0, min_units: 25, prepay_required: true });
    await expect(createOrder(approvedWholesaleUser(), WHOLESALE_SHIPPING)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/at least 25 items/) });
  });

  it("keeps the PO number on a wholesale order only", async () => {
    vi.mocked(checkoutOrderRpc).mockResolvedValue({ order_id: "order-9", total_amount: 480000 });
    await createOrder(approvedWholesaleUser(), { ...WHOLESALE_SHIPPING, po_number: "PO-2026-001" });
    expect(updateOrderPoNumber).toHaveBeenCalledWith("order-9", "PO-2026-001");

    vi.mocked(updateOrderPoNumber).mockClear();
    await createOrder(user(), { ...SHIPPING, po_number: "PO-X" });
    expect(updateOrderPoNumber).not.toHaveBeenCalled();
  });

  it("does not fail the order when the PO number cannot be saved", async () => {
    vi.mocked(checkoutOrderRpc).mockResolvedValue({ order_id: "order-9", total_amount: 480000 });
    vi.mocked(updateOrderPoNumber).mockRejectedValue(new Error("column does not exist"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createOrder(approvedWholesaleUser(), { ...WHOLESALE_SHIPPING, po_number: "PO-1" })).resolves.toBeTruthy();
    spy.mockRestore();
  });

  it("shows the rules on the cart", async () => {
    vi.mocked(selectShopSetting).mockResolvedValue({ min_amount: 750_000, min_units: 5, prepay_required: true });
    const cart = await getCart(approvedWholesaleUser());
    expect(cart.minimumOrder).toEqual({ minAmount: 750_000, minUnits: 5 });
    expect(cart.prepayRequired).toBe(true);
    const retail = await getCart(user());
    expect(retail.minimumOrder).toBeNull();
    expect(retail.prepayRequired).toBe(false);
  });
});

describe("optional business licence requirement", () => {
  beforeEach(() => {
    resetWholesaleRulesCache();
    vi.mocked(selectShopSetting).mockReset().mockResolvedValue(null);
  });
  afterEach(() => { delete process.env.WHOLESALE_REQUIRE_LICENCE; });

  it("is off by default: an approved account gets wholesale prices", async () => {
    expect((await getCart(approvedWholesaleUser())).wholesale).toBe(true);
  });

  it("when on, withholds wholesale prices until the licence is verified", async () => {
    process.env.WHOLESALE_REQUIRE_LICENCE = "true";
    for (const status of ["none", "pending", "rejected"] as const) {
      vi.mocked(selectCompanyDetails).mockResolvedValue({ licence_status: status } as never);
      expect((await getCart(approvedWholesaleUser())).wholesale).toBe(false);
    }
    vi.mocked(selectCompanyDetails).mockResolvedValue(null as never);
    expect((await getCart(approvedWholesaleUser())).wholesale).toBe(false);
    vi.mocked(selectCompanyDetails).mockResolvedValue({ licence_status: "verified" } as never);
    expect((await getCart(approvedWholesaleUser())).wholesale).toBe(true);
  });
});
