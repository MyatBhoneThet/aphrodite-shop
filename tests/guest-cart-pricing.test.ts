import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../app/lib/supabase")>();
  return { ...original, selectProductsByIds: vi.fn() };
});

import { getGuestCart } from "../app/lib/backend";
import { selectProductsByIds, type ProductRow } from "../app/lib/supabase";

function row(id: number, overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id,
    name: `Product ${id}`,
    type: "accessory",
    category: "Mouse",
    brand: "Logi",
    price: 10_000 * id,
    wholesale_price: 1,
    image: "/p.png",
    model_3d: null,
    stock: "In Stock",
    stock_quantity: 99,
    specs: {},
    full_specs: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(selectProductsByIds).mockReset();
});

describe("getGuestCart", () => {
  it("prices a browser cart at retail, with guest line ids and no admin fields", async () => {
    vi.mocked(selectProductsByIds).mockResolvedValue([row(1), row(2)]);

    const cart = await getGuestCart([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
      { productId: 1, quantity: 1 },
    ]);

    expect(selectProductsByIds).toHaveBeenCalledWith([1, 2]);
    expect(cart.items.map((item) => [item.id, item.quantity])).toEqual([
      ["guest-1", 3],
      ["guest-2", 1],
    ]);
    expect(cart.total).toBe(10_000 * 3 + 20_000);
    expect(cart.wholesale).toBe(false);
    expect(cart.prepayRequired).toBe(false);
    expect(JSON.stringify(cart)).not.toContain("wholesalePrice");
    expect(JSON.stringify(cart)).not.toContain("stockQuantity");
  });

  it("leaves out products that no longer exist", async () => {
    vi.mocked(selectProductsByIds).mockResolvedValue([row(1)]);

    const cart = await getGuestCart([
      { productId: 1, quantity: 1 },
      { productId: 404, quantity: 1 },
    ]);

    expect(cart.items.map((item) => item.product_id)).toEqual([1]);
  });
});

describe("POST /api/cart/guest", () => {
  async function call(body: unknown, ip = "203.0.113.9") {
    const { POST } = await import("../app/api/cart/guest/route");
    const { NextRequest } = await import("next/server");
    return POST(
      new NextRequest("http://localhost/api/cart/guest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify(body),
      })
    );
  }

  it("prices a valid cart without any login", async () => {
    vi.mocked(selectProductsByIds).mockResolvedValue([row(7)]);

    const response = await call({ items: [{ product_id: 7, quantity: 2 }] });
    const data = (await response.json()) as { total: number };

    expect(response.status).toBe(200);
    expect(data.total).toBe(140_000);
  });

  it("rejects malformed carts", async () => {
    expect((await call({ items: [{ product_id: -3, quantity: 1 }] })).status).toBe(400);
    expect((await call({ items: [{ product_id: 3, quantity: 0 }] })).status).toBe(400);
    expect((await call({ nope: true })).status).toBe(400);
  });

  it("is rate limited per address", async () => {
    vi.mocked(selectProductsByIds).mockResolvedValue([]);
    let last = 200;
    for (let index = 0; index < 70; index += 1) {
      last = (await call({ items: [] }, "198.51.100.77")).status;
    }
    expect(last).toBe(429);
  });
});
