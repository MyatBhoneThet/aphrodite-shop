import { beforeEach, describe, expect, it, vi } from "vitest";

// backend.ts is exercised for real; only the Supabase data layer is mocked.
vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();

  return {
    ...original,
    selectCart: vi.fn(),
    selectPriceListById: vi.fn(),
    selectTiersForProducts: vi.fn(),
    checkoutOrderRpc: vi.fn(),
    selectOrderById: vi.fn(),
    clearCart: vi.fn(),
  };
});

import { createOrder, getCart } from "../app/lib/backend";
import { AppError } from "../app/lib/errors";
import {
  checkoutOrderRpc,
  clearCart,
  selectCart,
  selectOrderById,
  selectPriceListById,
  selectTiersForProducts,
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
  shipping_address: "123 Test Road, Bangkok",
};

beforeEach(() => {
  vi.mocked(selectCart).mockReset().mockResolvedValue([cartRow()]);
  vi.mocked(selectPriceListById).mockReset().mockResolvedValue({
    id: "list-1",
    name: "Standard Wholesale",
    description: null,
    is_active: true,
  });
  vi.mocked(selectTiersForProducts).mockReset().mockResolvedValue(LADDER);
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
    await createOrder(approvedWholesaleUser(), SHIPPING);

    expect(selectPriceListById).toHaveBeenCalledWith("list-1", "token-abc");

    const line = vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0];
    expect(line.unit_price).toBe(48_000);
    expect(line.tier_id).toBe("t10");
  });

  it("approved wholesale below the tier minimum pays retail", async () => {
    vi.mocked(selectCart).mockResolvedValue([cartRow({ quantity: 9 })]);

    await createOrder(approvedWholesaleUser(), SHIPPING);

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

    await createOrder(approvedWholesaleUser(), SHIPPING);

    expect(vi.mocked(checkoutOrderRpc).mock.calls[0][0].lines[0].unit_price).toBe(RETAIL);
  });

  it("ignores browser-supplied prices and totals", async () => {
    await createOrder(approvedWholesaleUser(), {
      ...SHIPPING,
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
    await createOrder(approvedWholesaleUser(), SHIPPING);

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
});

describe("checkout safety", () => {
  it("rejects orders that exceed available inventory before calling the RPC", async () => {
    vi.mocked(selectCart).mockResolvedValue([
      cartRow({
        quantity: 10,
        products: { ...cartRow().products!, stock_quantity: 5 },
      }),
    ]);

    await expect(createOrder(user(), SHIPPING)).rejects.toMatchObject({
      status: 400,
    });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("returns 409 when the authoritative total differs from what the client saw", async () => {
    await expect(
      createOrder(approvedWholesaleUser(), {
        ...SHIPPING,
        expected_total: 999,
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(checkoutOrderRpc).not.toHaveBeenCalled();
  });

  it("accepts a matching expected_total", async () => {
    await createOrder(approvedWholesaleUser(), {
      ...SHIPPING,
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
