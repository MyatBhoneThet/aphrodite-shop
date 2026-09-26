import { describe, expect, it } from "vitest";
import { cartIntentPath, readCartIntent } from "../app/lib/cart-intent";

describe("post-login cart intent", () => {
  it("round-trips the selected product and quantity through the cart URL", () => {
    const path = cartIntentPath(42, 3);

    expect(path).toBe("/cart?add=42&quantity=3");
    expect(readCartIntent(new URL(path, "https://shop.example").search)).toEqual({
      productId: 42,
      quantity: 3,
    });
  });

  it("defaults a missing quantity to one", () => {
    expect(readCartIntent("?add=7")).toEqual({ productId: 7, quantity: 1 });
  });

  it("rejects invalid product ids and quantities", () => {
    for (const search of [
      "",
      "?add=0&quantity=1",
      "?add=abc&quantity=1",
      "?add=1&quantity=0",
      "?add=1&quantity=1.5",
      "?add=1&quantity=10000",
    ]) {
      expect(readCartIntent(search)).toBeNull();
    }
  });
});
