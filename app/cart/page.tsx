"use client";

import Link from "next/link";
import ProductPrice from "../components/ProductPrice";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Product } from "../data/products";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";
import { YANGON_TOWNSHIPS, normalizeYangonTownship } from "../lib/delivery-country";
import type { SavedAddress } from "../lib/address-book";
import DeliveryPinPicker, { type DeliveryPin } from "../components/DeliveryPinPicker";
import DeliveryEstimateBadge from "../components/DeliveryEstimateBadge";
import { estimateDelivery } from "../lib/delivery-estimate";
import { PaymentLogo, PaymentQr } from "../components/PaymentLogo";
import OrderPlacedView from "../components/OrderPlacedView";
import { useLanguage } from "../lib/language";
import {
  paymentAccountsFor,
  type PaymentAccountId,
  type PaymentMethod,
} from "../lib/payment-accounts";

type LinePricing = {
  promotional?: boolean;
  quantity: number;
  retailUnitPrice: number;
  unitPrice: number;
  lineTotal: number;
  savings: number;
  tierMinQuantity: number | null;
  label: string;
  nextTier: { minQuantity: number; unitPrice: number; unitsAway: number } | null;
  wholesaleEligible: boolean;
};

type CartLine = {
  id: string;
  product: Product;
  product_id: number;
  quantity: number;
  lineTotal: number;
  pricing: LinePricing;
};

type CartSummary = {
  items: CartLine[];
  subtotal: number;
  total: number;
  totalQuantity: number;
  retailSubtotal: number;
  totalSavings: number;
  wholesale: boolean;
};

export default function CartPage() {
  const { user, status: userStatus } = useCurrentUser();
  const { t, text } = useLanguage();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isClearingCart, setIsClearingCart] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const shippingState = "Yangon";
  const [postalCode, setPostalCode] = useState("");
  const shippingCountry = "Myanmar";
  const [notes, setNotes] = useState("");
  const [codConfirmed, setCodConfirmed] = useState(false);
  const [codContactConfirmed, setCodContactConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_delivery");
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccountId | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryPin | null>(null);
  const [addressByPhone, setAddressByPhone] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressLabel, setAddressLabel] = useState("Home");
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [addressLookupMessage, setAddressLookupMessage] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaveMessage, setAddressSaveMessage] = useState("");
  const hasPendingPrices = cart?.items.some((item) => !Number.isFinite(item.product.price) || item.product.price <= 0) ?? false;
  const savedAddressDeliveryEstimate = selectedAddressId && deliveryLocation && shippingCity
    ? estimateDelivery(deliveryLocation.latitude, deliveryLocation.longitude, shippingCity)
    : null;

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
        setShippingName((current) => current || user.full_name || "");
        setShippingPhone((current) => current || user.phone || "");
        setAddressLine1(
          (current) => current || user.shipping_address_line1 || ""
        );
        setAddressLine2(
          (current) => current || user.shipping_address_line2 || ""
        );
        setShippingCity((current) => current || normalizeYangonTownship(user.shipping_city) || "");
        setPostalCode((current) => current || user.shipping_postal_code || "");
        const addressResponse = await fetch("/api/addresses", { headers: authHeaders(), cache: "no-store" });
        if (addressResponse.ok) {
          const data = await addressResponse.json() as { addresses: SavedAddress[] };
          setSavedAddresses(data.addresses);
          const preferred = data.addresses.find((address) => address.is_default) ?? data.addresses[0];
          if (preferred) applySavedAddress(preferred);
        }
      } else if (userStatus === "ready") {
        setIsLoading(false);
      }
    }

    loadOnMount();
  }, [userStatus, user, loadCart]);

  function applySavedAddress(address: SavedAddress) {
    setSelectedAddressId(address.id);
    setShippingName(address.recipient_name);
    setShippingPhone(address.phone);
    setAddressLine1(address.address_line1);
    setAddressLine2(address.address_line2 ?? "");
    setShippingCity(address.township);
    setPostalCode(address.postal_code ?? "");
    setDeliveryLocation({
      latitude: address.latitude,
      longitude: address.longitude,
      accuracy_m: address.accuracy_m,
      captured_at: new Date().toISOString(),
    });
    setAddressByPhone(false);
    setSaveAddress(false);
  }

  async function resolvePinAddress(pin: DeliveryPin) {
    setAddressByPhone(false);
    setSelectedAddressId("");
    setSaveAddress(true);
    setIsResolvingAddress(true);
    setAddressLookupMessage("Finding the street and township from your pin…");
    try {
      const response = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(pin.latitude)}&lng=${encodeURIComponent(pin.longitude)}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = await response.json() as { address?: { address_line2?: string | null; township?: string | null; postal_code?: string | null } };
      if (response.ok && data.address) {
        if (data.address.address_line2) setAddressLine2(data.address.address_line2);
        if (data.address.township) setShippingCity(data.address.township);
        if (data.address.postal_code) setPostalCode(data.address.postal_code);
        const autofilled = [
          data.address.address_line2,
          data.address.township ? `${data.address.township} Township` : null,
          data.address.postal_code,
        ].filter(Boolean).join(" · ");
        setAddressLookupMessage(autofilled
          ? `Autofilled: ${autofilled}. Add your house or building details above.`
          : "The pin is selected, but no street details were available. Please enter them manually.");
      } else {
        setAddressLookupMessage("The pin is selected, but address lookup failed. Please choose the township and enter the street manually.");
      }
    } catch {
      setAddressLookupMessage("The pin is selected, but address lookup failed. Please choose the township and enter the street manually.");
    } finally {
      setIsResolvingAddress(false);
    }
  }

  function handlePinChange(pin: DeliveryPin | null) {
    setDeliveryLocation(pin);
    if (pin) setAddressByPhone(false);
  }

  async function persistCurrentAddress() {
    if (!deliveryLocation) throw new Error("Place and confirm the delivery pin first.");
    if (!shippingName.trim() || !shippingPhone.trim() || !addressLine1.trim() || !shippingCity) {
      throw new Error("Complete the recipient, phone, house details, and Yangon township before saving.");
    }
    if (!addressLabel.trim()) throw new Error("Give this address a label, such as Home or Office.");
    const saveResponse = await fetch("/api/addresses", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        label: addressLabel.trim(), recipient_name: shippingName.trim(), phone: shippingPhone.trim(),
        address_line1: addressLine1.trim(), address_line2: addressLine2.trim() || null,
        township: shippingCity, postal_code: postalCode.trim() || null,
        latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude,
        accuracy_m: deliveryLocation.accuracy_m, is_default: savedAddresses.length === 0,
      }),
    });
    const saved = await saveResponse.json().catch(() => null) as { address?: SavedAddress; error?: string } | null;
    if (!saveResponse.ok || !saved?.address) throw new Error(saved?.error ?? "Unable to save this address.");
    setSavedAddresses((current) => [...current, saved.address!]);
    setSelectedAddressId(saved.address.id);
    setSaveAddress(false);
    return saved.address;
  }

  async function saveAddressNow() {
    setIsSavingAddress(true);
    setAddressSaveMessage("");
    setError("");
    try {
      const saved = await persistCurrentAddress();
      setAddressSaveMessage(`${saved.label} saved${saved.is_default ? " as your default address" : ""}. The delivery estimate is now shown for every product in this order and across the store.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this address.");
    } finally {
      setIsSavingAddress(false);
    }
  }

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

  async function deleteAllCartItems() {
    if (!cart || cart.items.length === 0 || isClearingCart) return;
    if (!window.confirm(text("Remove every product from your cart? This cannot be undone."))) return;

    setError("");
    setIsClearingCart(true);
    try {
      const response = await fetch("/api/cart", {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => null) as CartSummary | { error?: string } | null;
      if (!response.ok) {
        throw new Error(data && "error" in data ? data.error : "Unable to clear your cart.");
      }
      setCart(data as CartSummary);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Unable to clear your cart.");
    } finally {
      setIsClearingCart(false);
    }
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Re-entrancy guard: the submit button is disabled while an order is in
    // flight, but a second submit can still arrive (Enter key, double
    // events). The database serializes concurrent checkouts too; this just
    // avoids ever issuing the duplicate request.
    if (isPlacingOrder) return;

    if (hasPendingPrices) {
      setError("A cart item is waiting for a confirmed price. Remove it or contact support before ordering.");
      return;
    }

    if (!deliveryLocation && !addressByPhone) {
      setError("Confirm a delivery map pin, or request written-address confirmation by phone.");
      return;
    }

    setError("");
    setIsPlacingOrder(true);

    try {
      if (saveAddress && !selectedAddressId && deliveryLocation) {
        await persistCurrentAddress();
      }
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_name: shippingName.trim(),
          shipping_phone: shippingPhone.trim(),
          shipping_address_line1: addressLine1.trim(),
          shipping_address_line2: addressLine2.trim() || null,
          shipping_city: shippingCity.trim(),
          shipping_state: shippingState.trim(),
          shipping_postal_code: postalCode.trim(),
          shipping_country: shippingCountry.trim(),
          payment_method: paymentMethod,
          payment_account: paymentMethod === "cash_on_delivery" ? null : paymentAccount,
          cod_confirmation: paymentMethod === "cash_on_delivery" ? codConfirmed : undefined,
          cod_contact_confirmation:
            paymentMethod === "cash_on_delivery" ? codContactConfirmed : undefined,
          delivery_location_consent: Boolean(deliveryLocation),
          delivery_location: deliveryLocation,
          notes: notes.trim() || null,
          // Server detects price drift against this and answers 409;
          // authoritative prices are always recomputed server-side.
          expected_total: cart?.total,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { order?: { id: string }; error?: string }
        | null;

      if (response.status === 409) {
        await loadCart();
        throw new Error(
          data?.error ??
            "Prices or stock changed while checking out. Your cart has been refreshed — please review and try again."
        );
      }

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to place order.");
      }

      setPlacedOrderId(data?.order?.id ?? null);
      setCart(null);
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
          <h1 className="text-3xl font-bold">{t("cart.loginTitle")}</h1>
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
              {text("Back to Store")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (placedOrderId) {
    return <OrderPlacedView orderId={placedOrderId} prepaid={paymentMethod !== "cash_on_delivery"} title={t("cart.orderPlaced")} />;
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-bold text-red-600">
            Aphrodite
          </Link>
          <Link href="/" className="rounded-full border px-5 py-2 text-sm">
            {text("Back to Store")}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl font-bold">{t("cart.title")}</h1>
          {cart && cart.items.length > 0 && (
            <button
              type="button"
              disabled={isClearingCart || isPlacingOrder}
              onClick={() => void deleteAllCartItems()}
              className="rounded-full border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:border-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearingCart ? text("Deleting all…") : text("Delete all")}
            </button>
          )}
        </div>
        {hasPendingPrices && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{t("cart.pendingPrices")}</p>}

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {!cart || cart.items.length === 0 ? (
          <div className="mt-8 rounded-[2rem] bg-zinc-100 p-10 text-center">
            <p className="text-lg font-semibold">{t("cart.empty")}</p>
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
                  className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-4 rounded-2xl border p-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="h-16 w-16 rounded-xl sm:h-20 sm:w-20 object-contain bg-zinc-50"
                  />

                  <div className="flex-1">
                    <p className="font-bold">{item.product.name}</p>
                    <ProductPrice price={item.product.price > 0 ? item.pricing.unitPrice : 0} regularPrice={item.pricing.retailUnitPrice} />

                    {item.product.price <= 0 ? null : (item.pricing.tierMinQuantity || item.pricing.promotional) ? (
                      <p className="mt-1 text-xs font-semibold text-green-700">
                        {item.pricing.label} · save{" "}
                        {formatCurrency(item.pricing.savings)}
                      </p>
                    ) : item.pricing.wholesaleEligible ? (
                      <p className="mt-1 text-xs font-semibold text-zinc-500">
                        {text("Retail price \u2014 below wholesale tier")}
                      </p>
                    ) : null}

                    {item.product.price > 0 && item.pricing.nextTier && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Add {item.pricing.nextTier.unitsAway} more to pay{" "}
                        {formatCurrency(item.pricing.nextTier.unitPrice)}/unit
                      </p>
                    )}

                    <DeliveryEstimateBadge estimate={savedAddressDeliveryEstimate} compact />

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity > 1
                            ? updateQuantity(item.id, item.quantity - 1)
                            : removeItem(item.id)
                        }
                        className="h-11 w-11 rounded-full border font-bold"
                        aria-label={t("detail.decrease")}
                      >
                        −
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-11 w-11 rounded-full border font-bold"
                        aria-label={t("detail.increase")}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-1 sm:block sm:text-right">
                    <p className="font-bold">{item.product.price > 0 ? formatCurrency(item.lineTotal) : text("Price pending")}</p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="mt-2 text-sm text-red-600"
                    >
                      {text("Remove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[2rem] bg-zinc-100 p-6">
              <h2 className="text-xl font-bold">{t("cart.checkout")}</h2>

              <div className="mt-4 space-y-2 text-sm">
                {!hasPendingPrices && cart.totalSavings > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-3 text-zinc-500">
                      <span>{t("cart.retailSubtotal")}</span>
                      <span className="shrink-0 whitespace-nowrap line-through">
                        {formatCurrency(cart.retailSubtotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 font-semibold text-green-700">
                      <span>{t("cart.totalSavings")}</span>
                      <span className="shrink-0 whitespace-nowrap">−{formatCurrency(cart.totalSavings)}</span>
                    </div>
                  </>
                )}

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-zinc-500">
                    {t("cart.itemCount", { count: cart.totalQuantity })}
                  </span>
                  <span className="whitespace-nowrap text-2xl font-bold">
                    {hasPendingPrices ? text("Awaiting prices") : formatCurrency(cart.total)}
                  </span>
                </div>

                <p className="text-xs text-zinc-400">
                  {text("Final prices are confirmed at checkout.")}
                </p>
              </div>

              <form onSubmit={handleCheckout} className="mt-6 space-y-4">
                {savedAddresses.length > 0 && <div>
                  <label htmlFor="saved-address" className="mb-1 block text-sm font-semibold">Saved address</label>
                  <select id="saved-address" value={selectedAddressId} onChange={(event) => {
                    const address = savedAddresses.find((item) => item.id === event.target.value);
                    if (address) applySavedAddress(address);
                    else { setSelectedAddressId(""); setSaveAddress(true); }
                  }} className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500">
                    <option value="">Use a new address</option>
                    {savedAddresses.map((address) => <option key={address.id} value={address.id}>{address.label}{address.is_default ? " (Default)" : ""} — {address.township}</option>)}
                  </select>
                  <Link href="/addresses" className="mt-2 inline-block text-xs font-semibold text-red-600">Manage my addresses →</Link>
                </div>}
                <div>
                  <label htmlFor="shipping-name" className="mb-1 block text-sm font-semibold">
                    {text("Full name")}
                  </label>
                  <input
                    id="shipping-name"
                    required
                    value={shippingName}
                    onChange={(event) => setShippingName(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label htmlFor="shipping-phone" className="mb-1 block text-sm font-semibold">
                    {text("Phone")}
                  </label>
                  <input
                    id="shipping-phone"
                    type="tel"
                    required
                    value={shippingPhone}
                    onChange={(event) => setShippingPhone(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label htmlFor="address-line-1" className="mb-1 block text-sm font-semibold">
                    {text("House number / building details")}
                  </label>
                  <input
                    id="address-line-1"
                    required
                    placeholder={text("House number, building, floor, or room")}
                    value={addressLine1}
                    onChange={(event) => setAddressLine1(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label htmlFor="address-line-2" className="mb-1 block text-sm font-semibold">
                    {text("Street / ward / landmark")}
                  </label>
                  <input
                    id="address-line-2"
                    placeholder={text("Filled automatically from your pin; you can edit it")}
                    value={addressLine2}
                    onChange={(event) => setAddressLine2(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="shipping-city" className="mb-1 block text-sm font-semibold">
                      {text("Yangon township")}
                    </label>
                    <select id="shipping-city" required value={shippingCity}
                      onChange={(event) => setShippingCity(event.target.value)}
                      className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500">
                      <option value="">{text("Select township")}</option>
                      {YANGON_TOWNSHIPS.map((township) => <option key={township} value={township}>{township}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="shipping-state" className="mb-1 block text-sm font-semibold">
                      {text("Region")}
                    </label>
                    <input id="shipping-state" readOnly value="Yangon"
                      className="w-full rounded-xl border bg-zinc-50 px-4 py-3 text-zinc-600" />
                  </div>
                  <div>
                    <label htmlFor="postal-code" className="mb-1 block text-sm font-semibold">
                      {text("Postal code (optional)")}
                    </label>
                    <input id="postal-code" value={postalCode}
                      onChange={(event) => setPostalCode(event.target.value)}
                      className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label htmlFor="shipping-country" className="mb-1 block text-sm font-semibold">
                      {text("Country")}
                    </label>
                    <input id="shipping-country" readOnly value={text(shippingCountry)}
                      className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500" />
                    <p className="mt-1 text-xs text-zinc-500">{text("Delivery is available in Yangon only.")}</p>
                  </div>
                </div>

                <DeliveryPinPicker value={deliveryLocation} onChange={handlePinChange} onPinPlaced={resolvePinAddress} addressLookupStatus={addressLookupMessage} showDeliveryEstimate />
                {isResolvingAddress && <span className="sr-only" role="status">Finding the street and township from your pin…</span>}
                {!deliveryLocation && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                  <input type="checkbox" required checked={addressByPhone} onChange={(event) => setAddressByPhone(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-red-600" />
                  <span>{t("cart.noPin")}</span>
                </label>}

                {!selectedAddressId && deliveryLocation && <fieldset className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold">
                    <input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
                    <span>Save this to My addresses{savedAddresses.length === 0 ? " as my default address" : ""}</span>
                  </label>
                  {saveAddress && <label className="mt-3 block text-sm font-semibold">Address label
                    <input required value={addressLabel} onChange={(event) => setAddressLabel(event.target.value)} placeholder="Home or Office" className="mt-1 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:border-red-500" />
                  </label>}
                  {saveAddress && <button type="button" disabled={isSavingAddress} onClick={() => void saveAddressNow()} className="mt-3 w-full rounded-full bg-zinc-950 px-4 py-3 text-sm font-bold text-white disabled:bg-zinc-400">{isSavingAddress ? "Saving address…" : savedAddresses.length === 0 ? "Save as my default address now" : "Save address now"}</button>}
                </fieldset>}
                {addressSaveMessage && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-800">✓ {addressSaveMessage}</p>}

                <fieldset className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <legend className="px-1 text-sm font-bold">{t("cart.paymentMethod")}</legend>

                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="radio" name="payment-method" value="cash_on_delivery"
                      checked={paymentMethod === "cash_on_delivery"}
                      onChange={() => { setPaymentMethod("cash_on_delivery"); setPaymentAccount(null); }}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-red-600" />
                    <span>
                      <span className="block font-semibold">{t("payment.method.cash_on_delivery")}</span>
                      <span className="block text-xs text-zinc-600">{t("payment.method.cash_on_delivery.help")}</span>
                    </span>
                  </label>

                  <label className="mt-4 flex cursor-pointer items-start gap-3">
                    <input type="radio" name="payment-method" value="bank_transfer"
                      checked={paymentMethod === "bank_transfer"}
                      onChange={() => { setPaymentMethod("bank_transfer"); setPaymentAccount("kbz"); }}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-red-600" />
                    <span>
                      <span className="block font-semibold">{t("payment.method.bank_transfer")}</span>
                      <span className="block text-xs text-zinc-600">{t("payment.method.bank_transfer.help")}</span>
                    </span>
                  </label>

                  {/* The MMQR code is for retail customers only. */}
                  {!cart?.wholesale && <label className="mt-4 flex cursor-pointer items-start gap-3">
                    <input type="radio" name="payment-method" value="mmqr"
                      checked={paymentMethod === "mmqr"}
                      onChange={() => { setPaymentMethod("mmqr"); setPaymentAccount("mmqr"); }}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-red-600" />
                    <span>
                      <span className="block font-semibold">{t("payment.method.mmqr")}</span>
                      <span className="block text-xs text-zinc-600">{t("payment.method.mmqr.help")}</span>
                    </span>
                  </label>}

                  {paymentMethod === "cash_on_delivery" ? <>
                    <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" required checked={codConfirmed} onChange={(event) => setCodConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-red-600" />
                      <span>{t("cart.codConfirmAddress")}</span>
                    </label>
                    <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" required checked={codContactConfirmed} onChange={(event) => setCodContactConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-red-600" />
                      <span>{t("cart.codConfirmPhone")}</span>
                    </label>
                  </> : <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold">
                      {t("payment.amountToTransfer")}: {formatCurrency(cart?.total ?? 0)}
                    </p>
                    {paymentAccountsFor({ wholesale: Boolean(cart?.wholesale) })
                      .filter((account) => account.method === paymentMethod)
                      .map((account) => (
                        <label key={account.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 ${paymentAccount === account.id ? "border-red-500" : "border-zinc-200"}`}>
                          <input type="radio" name="payment-account" value={account.id}
                            checked={paymentAccount === account.id}
                            onChange={() => setPaymentAccount(account.id)} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-red-600" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              {/* Images live in public/payments/. A missing file falls back to a
                                  lettered badge rather than a broken-image icon. */}
                              <PaymentLogo src={account.logo} alt={account.label} initials={account.id.toUpperCase()} />
                              <span className="font-bold">{account.label}</span>
                            </span>
                            <span className="mt-2 block text-sm">{t("payment.accountHolder")}: {account.holder}</span>
                            {account.accountNumber && <span className="mt-1 block font-mono text-lg font-bold tracking-wide">{account.accountNumber}</span>}
                            {account.qr && <span className="mt-3 block">
                              <span className="block text-sm font-semibold">{t("payment.scanQr")}</span>
                              <PaymentQr src={account.qr} alt="MMQR code for Aphrodite Myanmar" />
                            </span>}
                          </span>
                        </label>
                      ))}
                    <p className="rounded-xl bg-white p-3 text-xs text-zinc-600">{t("payment.slip.help")}</p>
                  </div>}
                </fieldset>

                <div>
                  <label htmlFor="order-notes" className="mb-1 block text-sm font-semibold">
                    {text("Notes (optional)")}
                  </label>
                  <textarea
                    id="order-notes"
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPlacingOrder || hasPendingPrices}
                  className="w-full rounded-full bg-red-600 px-5 py-4 font-semibold text-white disabled:bg-zinc-400"
                >
                  {isPlacingOrder
                    ? t("cart.placingOrder")
                    : t(`cart.place.${paymentMethod}`)}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
