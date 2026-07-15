"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Product } from "../data/products";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";

type CartLine = {
  id: string;
  product: Product;
  product_id: number;
  quantity: number;
  lineTotal: number;
};

type CartSummary = {
  items: CartLine[];
  subtotal: number;
  total: number;
  totalQuantity: number;
};

export default function CartPage() {
  const { user, status: userStatus } = useCurrentUser();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");

  const loadCart = useCallback(async () => {
    setIsLoading(true);

    const response = await fetch("/api/cart", { headers: authHeaders() });

    if (response.ok) {
      setCart((await response.json()) as CartSummary);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    async function loadOnMount() {
      if (userStatus === "ready" && user) {
        await loadCart();
      } else if (userStatus === "ready") {
        setIsLoading(false);
      }
    }

    loadOnMount();
  }, [userStatus, user, loadCart]);

  async function updateQuantity(id: string, quantity: number) {
    setError("");

    const response = await fetch(`/api/cart/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to update quantity.");
      return;
    }

    setCart((await response.json()) as CartSummary);
  }

  async function removeItem(id: string) {
    setError("");

    const response = await fetch(`/api/cart/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to remove item.");
      return;
    }

    setCart((await response.json()) as CartSummary);
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPlacingOrder(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_name: shippingName.trim(),
          shipping_phone: shippingPhone.trim(),
          shipping_address: shippingAddress.trim(),
          notes: notes.trim() || null,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { order?: { id: string }; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to place order.");
      }

      setPlacedOrderId(data?.order?.id ?? null);
      setCart({ items: [], subtotal: 0, total: 0, totalQuantity: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to place order.");
    } finally {
      setIsPlacingOrder(false);
    }
  }

  if (userStatus === "checking" || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-950">
        Loading your cart...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center text-zinc-950">
        <div>
          <h1 className="text-3xl font-bold">Login to view your cart</h1>
          <p className="mt-3 text-zinc-500">
            You need an account to add items to a cart and check out.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
            >
              Login
            </Link>
            <Link href="/" className="rounded-full border px-6 py-3 font-semibold">
              Back to Store
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (placedOrderId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-center text-zinc-950">
        <div>
          <p className="text-5xl">🎉</p>
          <h1 className="mt-4 text-3xl font-bold">Order placed</h1>
          <p className="mt-3 text-zinc-500">
            Order #{placedOrderId.slice(0, 8)} has been received and is now
            pending confirmation.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/orders"
              className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
            >
              View my orders
            </Link>
            <Link href="/" className="rounded-full border px-6 py-3 font-semibold">
              Continue shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-bold text-red-600">
            Aphrodite
          </Link>
          <Link href="/" className="rounded-full border px-5 py-2 text-sm">
            Back to Store
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-4xl font-bold">Your Cart</h1>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {!cart || cart.items.length === 0 ? (
          <div className="mt-8 rounded-[2rem] bg-zinc-100 p-10 text-center">
            <p className="text-lg font-semibold">Your cart is empty.</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border p-4"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="h-20 w-20 rounded-xl object-contain bg-zinc-50"
                  />

                  <div className="flex-1">
                    <p className="font-bold">{item.product.name}</p>
                    <p className="text-sm text-zinc-500">
                      {formatCurrency(item.lineTotal / item.quantity)} each
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity > 1
                            ? updateQuantity(item.id, item.quantity - 1)
                            : removeItem(item.id)
                        }
                        className="h-8 w-8 rounded-full border font-bold"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-8 w-8 rounded-full border font-bold"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(item.lineTotal)}</p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="mt-2 text-sm text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[2rem] bg-zinc-100 p-6">
              <h2 className="text-xl font-bold">Checkout</h2>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-zinc-500">
                  {cart.totalQuantity} item(s)
                </span>
                <span className="text-2xl font-bold">
                  {formatCurrency(cart.total)}
                </span>
              </div>

              <form onSubmit={handleCheckout} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Full name
                  </label>
                  <input
                    required
                    value={shippingName}
                    onChange={(event) => setShippingName(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Phone
                  </label>
                  <input
                    required
                    value={shippingPhone}
                    onChange={(event) => setShippingPhone(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Shipping address
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={shippingAddress}
                    onChange={(event) => setShippingAddress(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPlacingOrder}
                  className="w-full rounded-full bg-red-600 px-5 py-4 font-semibold text-white disabled:bg-zinc-400"
                >
                  {isPlacingOrder ? "Placing order..." : "Place order"}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
