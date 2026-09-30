export type CartIntent = {
  productId: number;
  quantity: number;
};

const MAX_CART_QUANTITY = 9_999;

/**
 * Builds the in-app destination used when a guest asks to add a product.
 * The cart page consumes these values after authentication and then removes
 * them from the address bar so a refresh cannot add the product twice.
 */
export function cartIntentPath(productId: number, quantity: number) {
  const params = new URLSearchParams({
    add: String(productId),
    quantity: String(quantity),
  });

  return `/cart?${params.toString()}`;
}

/** Only positive integers accepted by the cart API are allowed through. */
export function readCartIntent(search: string): CartIntent | null {
  const params = new URLSearchParams(search);
  const productId = Number(params.get("add"));
  const quantity = Number(params.get("quantity") ?? "1");

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    quantity > MAX_CART_QUANTITY
  ) {
    return null;
  }

  return { productId, quantity };
}
