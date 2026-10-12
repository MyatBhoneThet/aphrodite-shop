import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/supabase")>()),
  selectOrderById: vi.fn(),
  selectProductsByIdsService: vi.fn(),
  selectProductByIdService: vi.fn(),
  selectCart: vi.fn(),
  insertCartItem: vi.fn(),
  updateCartItem: vi.fn(),
  selectPriceListById: vi.fn(),
}));

import { reorderToCart } from "../app/lib/backend";
import {
  insertCartItem,
  selectCart,
  selectOrderById,
  selectProductByIdService,
  selectProductsByIdsService,
  updateCartItem,
  type CurrentUser,
  type ProductRow,
} from "../app/lib/supabase";

const customer = {
  id: "u1",
  email: "buyer@example.com",
  role: "normal",
  accessToken: "token",
  profile: { id: "u1", email: "buyer@example.com", role: "normal", wholesale_status: "not_applied", price_list_id: null },
} as unknown as CurrentUser;

function product(id: number, overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id, name: `Product ${id}`, type: "accessory", category: "Mouse", brand: "Logi",
    price: 10_000, wholesale_price: null, image: "/p.png", model_3d: null,
    stock: "In Stock", stock_quantity: 10, specs: {}, full_specs: {}, ...overrides,
  };
}

function order(items: { product_id: number; quantity: number }[], overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    user_id: "u1",
    status: "delivered",
    order_items: items.map((item, index) => ({ id: `i${index}`, order_id: "order-1", unit_price: 1, products: null, ...item })),
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.mocked(selectOrderById).mockReset();
  vi.mocked(selectProductsByIdsService).mockReset();
  vi.mocked(selectProductByIdService).mockReset();
  vi.mocked(selectCart).mockReset().mockResolvedValue([]);
  vi.mocked(insertCartItem).mockReset().mockResolvedValue(undefined as never);
  vi.mocked(updateCartItem).mockReset().mockResolvedValue(undefined as never);
});

function stockOf(rows: ProductRow[]) {
  vi.mocked(selectProductsByIdsService).mockResolvedValue(rows);
  vi.mocked(selectProductByIdService).mockImplementation(async (id) => rows.find((row) => row.id === id) as ProductRow);
}

describe("reorderToCart (Buy again)", () => {
  it("puts every available line back in the cart with the same quantities", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(order([{ product_id: 1, quantity: 2 }, { product_id: 2, quantity: 1 }]));
    stockOf([product(1), product(2)]);

    const result = await reorderToCart(customer, "order-1");

    expect(result.added).toEqual([
      { product_id: 1, name: "Product 1", quantity: 2, requested: 2 },
      { product_id: 2, name: "Product 2", quantity: 1, requested: 1 },
    ]);
    expect(result.skipped).toEqual([]);
    expect(insertCartItem).toHaveBeenCalledWith("u1", 1, 2, "token");
  });

  it("skips and names what is sold out, unpriced or gone, and trims what is short", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(
      order([
        { product_id: 1, quantity: 1 },
        { product_id: 2, quantity: 1 },
        { product_id: 3, quantity: 1 },
        { product_id: 4, quantity: 5 },
        { product_id: 5, quantity: 1 },
      ])
    );
    stockOf([
      product(1, { stock: "Out of Stock", stock_quantity: 0 }),
      product(2, { price: 0 }),
      product(3),
      product(4, { stock_quantity: 3 }),
    ]);

    const result = await reorderToCart(customer, "order-1");

    expect(result.skipped).toEqual([
      { product_id: 1, name: "Product 1", reason: "out_of_stock" },
      { product_id: 2, name: "Product 2", reason: "price_pending" },
      { product_id: 5, name: "Product #5", reason: "unavailable" },
    ]);
    expect(result.added).toEqual([
      { product_id: 3, name: "Product 3", quantity: 1, requested: 1 },
      { product_id: 4, name: "Product 4", quantity: 3, requested: 5 },
    ]);
  });

  it("does not double up what is already in the cart past the stock", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(order([{ product_id: 1, quantity: 4 }]));
    stockOf([product(1, { stock_quantity: 4 })]);
    vi.mocked(selectCart).mockResolvedValue([
      { id: "c1", user_id: "u1", product_id: 1, quantity: 4, build_group_id: null, created_at: "", updated_at: "" },
    ] as never);

    const result = await reorderToCart(customer, "order-1");

    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual([{ product_id: 1, name: "Product 1", reason: "in_cart" }]);
  });

  it("only works for the owner's delivered orders", async () => {
    vi.mocked(selectOrderById).mockResolvedValue(order([{ product_id: 1, quantity: 1 }], { status: "shipped" }));
    await expect(reorderToCart(customer, "order-1")).rejects.toThrow(/delivered/);

    vi.mocked(selectOrderById).mockResolvedValue(order([{ product_id: 1, quantity: 1 }], { user_id: "someone-else" }));
    await expect(reorderToCart(customer, "order-1")).rejects.toThrow(/not found/i);

    vi.mocked(selectOrderById).mockResolvedValue(null as never);
    await expect(reorderToCart(customer, "missing")).rejects.toThrow(/not found/i);
  });

  it("is not available to back-office accounts", async () => {
    await expect(reorderToCart({ ...customer, role: "admin" } as CurrentUser, "order-1")).rejects.toThrow();
  });
});
