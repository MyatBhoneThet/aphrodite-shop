"use client";

import Link from "next/link";
import ProductPrice from "../components/ProductPrice";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { readCartIntent } from "../lib/cart-intent";

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
  build_group_id: string | null;
  build_name: string | null;
  lineTotal: number;
  pricing: LinePricing;
};

type CartEntry = {
  id: string;
  name: string;
  items: CartLine[];
  isBuild: boolean;
  quantity: number;
  lineTotal: number;
};

const CHECKOUT_SELECTION_KEY = "aphrodite.checkout.selected-cart-items.v1";

function groupCartEntries(items: CartLine[]): CartEntry[] {
  const entries = new Map<string, CartEntry>();
  for (const item of items) {
    const id = item.build_group_id ? `build:${item.build_group_id}` : `item:${item.id}`;
    const existing = entries.get(id);
    if (existing) {
      existing.items.push(item);
      existing.lineTotal += item.lineTotal;
      continue;
    }
    entries.set(id, {
      id,
      name: item.build_name || item.product.name,
      items: [item],
      isBuild: Boolean(item.build_group_id),
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    });
  }
  return [...entries.values()];
}

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
  const pathname = usePathname();
  const router = useRouter();
  const checkoutMode = pathname === "/checkout";
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
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectionReady, setSelectionReady] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const houseInputRef = useRef<HTMLInputElement>(null);
  const cartIntentHandledRef = useRef(false);
  const cartEntries = useMemo(() => groupCartEntries(cart?.items ?? []), [cart]);
  const selectedItems = useMemo(
    () => (cart?.items ?? []).filter((item) => selectedItemIds.has(item.id)),
    [cart, selectedItemIds]
  );
  const selectedEntries = useMemo(
    () => cartEntries.filter((entry) => entry.items.some((item) => selectedItemIds.has(item.id))),
    [cartEntries, selectedItemIds]
  );
  const displayedEntryCount = checkoutMode ? selectedEntries.length : cartEntries.length;
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const selectedRetailSubtotal = selectedItems.reduce(
    (sum, item) => sum + item.pricing.retailUnitPrice * item.quantity,
    0
  );
  const selectedSavings = selectedItems.reduce((sum, item) => sum + item.pricing.savings, 0);
  const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasPendingPrices = selectedItems.some((item) => !Number.isFinite(item.product.price) || item.product.price <= 0);
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
        let cartLoadedFromIntent = false;

        if (!checkoutMode && !cartIntentHandledRef.current) {
          const intent = readCartIntent(window.location.search);

          if (intent) {
            // Mark and clean the one-time intent before the request. This
            // prevents React Strict Mode or a refresh from adding it twice.
            cartIntentHandledRef.current = true;
            window.history.replaceState(window.history.state, "", "/cart");

            const response = await fetch("/api/cart", {
              method: "POST",
              headers: {
                ...authHeaders(),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                product_id: intent.productId,
                quantity: intent.quantity,
              }),
            });
            const data = (await response.json().catch(() => null)) as
              | CartSummary
              | { error?: string }
              | null;

            if (response.ok && data && "items" in data) {
              setCart(data);
              setIsLoading(false);
              cartLoadedFromIntent = true;
            } else {
              setError(
                data && "error" in data
                  ? data.error ?? "Unable to add this product to your cart."
                  : "Unable to add this product to your cart."
              );
            }
          }
        }

        if (!cartLoadedFromIntent) await loadCart();
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
  }, [userStatus, user, loadCart, checkoutMode]);

  useEffect(() => {
    if (!cart) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const available = new Set(cart.items.map((item) => item.id));
      if (!selectionReady) {
        if (checkoutMode) {
          try {
            const stored = JSON.parse(window.sessionStorage.getItem(CHECKOUT_SELECTION_KEY) ?? "[]") as unknown;
            const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string" && available.has(id)) : [];
            setSelectedItemIds(new Set(ids));
          } catch {
            setSelectedItemIds(new Set());
          }
        } else {
          setSelectedItemIds(available);
        }
        setSelectionReady(true);
        return;
      }
      setSelectedItemIds((current) => new Set([...current].filter((id) => available.has(id))));
    });
    return () => { active = false; };
  }, [cart, checkoutMode, selectionReady]);

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

  async function updateBuildQuantity(buildGroupId: string, quantity: number) {
    setError("");
    const response = await fetch(`/api/cart/build/${buildGroupId}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const data = await response.json().catch(() => null) as CartSummary | { error?: string } | null;
    if (!response.ok) {
      setError(data && "error" in data ? data.error ?? "Unable to update this PC build." : "Unable to update this PC build.");
      return;
    }
    setCart(data as CartSummary);
  }

  async function removeBuild(buildGroupId: string) {
    setError("");
    const response = await fetch(`/api/cart/build/${buildGroupId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await response.json().catch(() => null) as CartSummary | { error?: string } | null;
    if (!response.ok) {
      setError(data && "error" in data ? data.error ?? "Unable to remove this PC build." : "Unable to remove this PC build.");
      return;
    }
    setCart(data as CartSummary);
  }

  function toggleEntry(entry: CartEntry) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      const allSelected = entry.items.every((item) => next.has(item.id));
      for (const item of entry.items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  function toggleAllEntries() {
    if (!cart) return;
    setSelectedItemIds(
      selectedItemIds.size === cart.items.length
        ? new Set()
        : new Set(cart.items.map((item) => item.id))
    );
  }

  function continueToCheckout() {
    if (selectedItemIds.size === 0) {
      setError("Select at least one product or PC build to check out.");
      return;
    }
    window.sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify([...selectedItemIds]));
    router.push("/checkout");
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

    if (!shippingPhone.trim()) {
      setError("Phone number is required.");
      phoneInputRef.current?.focus();
      return;
    }
    if (!addressLine1.trim()) {
      setError("House number or building details are required.");
      houseInputRef.current?.focus();
      return;
    }
    if (selectedItemIds.size === 0) {
      setError("Return to your cart and select at least one item.");
      return;
    }

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
          selected_cart_item_ids: [...selectedItemIds],
          // Server detects price drift against this and answers 409;
          // authoritative prices are always recomputed server-side.
          expected_total: selectedTotal,
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
      window.sessionStorage.removeItem(CHECKOUT_SELECTION_KEY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to place order.");
    } finally {
      setIsPlacingOrder(false);
    }
  }

  function renderCartEntry(entry: CartEntry) {
    const selected = entry.items.every((item) => selectedItemIds.has(item.id));
    const firstItem = entry.items[0];
    const buildGroupId = firstItem.build_group_id;
    const customizeHref = entry.isBuild
      ? `/pc-builder/customize?${new URLSearchParams({
          parts: entry.items.map((item) => item.product_id).join(","),
          name: entry.name,
        }).toString()}`
      : null;

    if (entry.isBuild && buildGroupId) {
      return <article key={entry.id} className={`rounded-3xl border p-5 transition ${selected || checkoutMode ? "border-red-200 bg-red-50/40" : "border-zinc-200 bg-white"}`}>
        <div className="flex items-start gap-3">
          {!checkoutMode && <input type="checkbox" checked={selected} onChange={() => toggleEntry(entry)} aria-label={`Select ${entry.name}`} className="mt-1 h-5 w-5 shrink-0 accent-red-600" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">{text("Complete PC package")}</p>
                <h2 className="mt-1 text-xl font-black">{entry.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{entry.items.length} {text("items in one package")} · {entry.quantity} {text(entry.quantity === 1 ? "PC build" : "PC builds")}</p>
              </div>
              <p className="text-lg font-black">{formatCurrency(entry.lineTotal)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.items.map((item) => <div key={item.id} className="group relative">
                <img src={item.product.image} alt={item.product.name} title={item.product.name} className="h-14 w-14 rounded-xl border bg-white object-contain p-1" />
              </div>)}
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-bold text-zinc-700">{text("View package components")}</summary>
              <ul className="mt-2 space-y-1 text-zinc-600">{entry.items.map((item) => <li key={item.id}>• {item.product.name} × {item.quantity}</li>)}</ul>
            </details>
            {!checkoutMode && <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => entry.quantity > 1 ? void updateBuildQuantity(buildGroupId, entry.quantity - 1) : void removeBuild(buildGroupId)} className="h-10 w-10 rounded-full border bg-white font-bold" aria-label={text("Decrease PC quantity")}>−</button>
              <span className="min-w-8 text-center font-bold">{entry.quantity}</span>
              <button type="button" onClick={() => void updateBuildQuantity(buildGroupId, entry.quantity + 1)} className="h-10 w-10 rounded-full border bg-white font-bold" aria-label={text("Increase PC quantity")}>+</button>
              <Link href={customizeHref!} className="ml-1 rounded-full bg-zinc-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-600">{text("Customize build")}</Link>
              <Link href="/pc-builder" className="rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold hover:border-red-500 hover:text-red-600">{text("Choose another build")}</Link>
              <button type="button" onClick={() => void removeBuild(buildGroupId)} className="ml-auto text-sm font-bold text-red-600">{text("Remove package")}</button>
            </div>}
          </div>
        </div>
      </article>;
    }

    const item = firstItem;
    return <article key={entry.id} className={`grid items-center gap-3 rounded-2xl border p-4 transition ${checkoutMode ? "grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(0,1fr)_auto]" : "grid-cols-[auto_4rem_minmax(0,1fr)] sm:grid-cols-[auto_5rem_minmax(0,1fr)_auto]"} ${selected || checkoutMode ? "border-red-200" : "border-zinc-200"}`}>
      {!checkoutMode && <input type="checkbox" checked={selected} onChange={() => toggleEntry(entry)} aria-label={`Select ${item.product.name}`} className="h-5 w-5 accent-red-600" />}
      <img src={item.product.image} alt={item.product.name} className="h-16 w-16 rounded-xl bg-zinc-50 object-contain sm:h-20 sm:w-20" />
      <div className="min-w-0">
        <p className="font-bold">{item.product.name}</p>
        <ProductPrice price={item.product.price > 0 ? item.pricing.unitPrice : 0} regularPrice={item.pricing.retailUnitPrice} />
        {item.product.price > 0 && (item.pricing.tierMinQuantity || item.pricing.promotional) && <p className="mt-1 text-xs font-semibold text-green-700">{item.pricing.label} · {text("save")} {formatCurrency(item.pricing.savings)}</p>}
        {item.product.price > 0 && item.pricing.nextTier && !checkoutMode && <p className="mt-1 text-xs text-zinc-500">{text("Add")} {item.pricing.nextTier.unitsAway} {text("more to pay")} {formatCurrency(item.pricing.nextTier.unitPrice)}/{text("unit")}</p>}
        <DeliveryEstimateBadge estimate={savedAddressDeliveryEstimate} compact />
        {!checkoutMode && <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={() => item.quantity > 1 ? void updateQuantity(item.id, item.quantity - 1) : void removeItem(item.id)} className="h-10 w-10 rounded-full border font-bold" aria-label={t("detail.decrease")}>−</button>
          <span className="w-8 text-center">{item.quantity}</span>
          <button type="button" onClick={() => void updateQuantity(item.id, item.quantity + 1)} className="h-10 w-10 rounded-full border font-bold" aria-label={t("detail.increase")}>+</button>
        </div>}
      </div>
      <div className={`${checkoutMode ? "col-span-2" : "col-span-3"} flex items-center justify-between gap-3 sm:col-span-1 sm:block sm:text-right`}>
        <p className="font-bold">{item.product.price > 0 ? formatCurrency(item.lineTotal) : text("Price pending")}</p>
        {!checkoutMode && <button type="button" onClick={() => void removeItem(item.id)} className="mt-2 text-sm text-red-600">{text("Remove")}</button>}
      </div>
    </article>;
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
          <Link href={checkoutMode ? "/cart" : "/"} className="rounded-full border px-5 py-2 text-sm">
            {checkoutMode ? text("Back to cart") : text("Back to Store")}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold">{checkoutMode ? text("Checkout") : t("cart.title")}</h1>
            {displayedEntryCount > 0 && <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold text-zinc-600">{displayedEntryCount} {text(displayedEntryCount === 1 ? "item" : "items")}</span>}
          </div>
          {!checkoutMode && cart && cart.items.length > 0 && (
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
              {!checkoutMode && <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-bold">
                  <input type="checkbox" checked={selectedItemIds.size === cart.items.length} onChange={toggleAllEntries} className="h-5 w-5 accent-red-600" />
                  {text("Select all")}
                </label>
                <span className="text-sm text-zinc-500">{selectedEntries.length} {text("selected")}</span>
              </div>}
              {(checkoutMode ? selectedEntries : cartEntries).map(renderCartEntry)}
              {checkoutMode && selectedEntries.length === 0 && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
                <p className="font-bold">{text("No cart items are selected for checkout.")}</p>
                <Link href="/cart" className="mt-4 inline-block rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white">{text("Return to cart")}</Link>
              </div>}
            </div>

            <div className="rounded-[2rem] bg-zinc-100 p-6">
              <h2 className="text-xl font-bold">{t("cart.checkout")}</h2>

              <div className="mt-4 space-y-2 text-sm">
                {!hasPendingPrices && selectedSavings > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-3 text-zinc-500">
                      <span>{t("cart.retailSubtotal")}</span>
                      <span className="shrink-0 whitespace-nowrap line-through">
                        {formatCurrency(selectedRetailSubtotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 font-semibold text-green-700">
                      <span>{t("cart.totalSavings")}</span>
                      <span className="shrink-0 whitespace-nowrap">−{formatCurrency(selectedSavings)}</span>
                    </div>
                  </>
                )}

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-zinc-500">
                    {t("cart.itemCount", { count: selectedQuantity })}
                  </span>
                  <span className="whitespace-nowrap text-2xl font-bold">
                    {hasPendingPrices ? text("Awaiting prices") : formatCurrency(selectedTotal)}
                  </span>
                </div>

                <p className="text-xs text-zinc-400">
                  {text("Final prices are confirmed at checkout.")}
                </p>
              </div>

              {!checkoutMode ? <button type="button" onClick={continueToCheckout} disabled={selectedItemIds.size === 0 || hasPendingPrices} className="mt-6 w-full rounded-full bg-red-600 px-5 py-4 font-bold text-white disabled:bg-zinc-400">{text("Checkout selected items")}</button> : <form onSubmit={handleCheckout} className="mt-6 space-y-4">
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
                    {text("Phone")} <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={phoneInputRef}
                    id="shipping-phone"
                    type="tel"
                    required
                    value={shippingPhone}
                    onChange={(event) => setShippingPhone(event.target.value)}
                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <fieldset className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
                  <legend className="px-2 text-base font-black">{text("Billing address")}</legend>
                  <div>
                    <label htmlFor="address-line-1" className="mb-1 block text-sm font-semibold">
                      {text("House number / building details")} <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      ref={houseInputRef}
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
                    <p className="mb-1 block text-sm font-semibold">
                      {text("Region")}
                    </p>
                    <div id="shipping-state" className="w-full rounded-xl border bg-zinc-100 px-4 py-3 font-semibold text-zinc-600" aria-label="Region: Yangon">Yangon</div>
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
                    <p className="mb-1 block text-sm font-semibold">
                      {text("Country")}
                    </p>
                    <div id="shipping-country" className="w-full rounded-xl border bg-zinc-100 px-4 py-3 font-semibold text-zinc-600" aria-label="Country: Myanmar">{text(shippingCountry)}</div>
                    <p className="mt-1 text-xs text-zinc-500">{text("Delivery is available in Yangon only.")}</p>
                  </div>
                  </div>

                  <div>
                    <label htmlFor="order-notes" className="mb-1 block text-sm font-semibold">
                      {text("Delivery notes (optional)")}
                    </label>
                    <textarea id="order-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={text("Gate, floor, landmark, or courier instructions")} className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-red-500" />
                  </div>
                </fieldset>

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
                      {t("payment.amountToTransfer")}: {formatCurrency(selectedTotal)}
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

                <button
                  type="submit"
                  disabled={isPlacingOrder || hasPendingPrices}
                  className="w-full rounded-full bg-red-600 px-5 py-4 font-semibold text-white disabled:bg-zinc-400"
                >
                  {isPlacingOrder
                    ? t("cart.placingOrder")
                    : t(`cart.place.${paymentMethod}`)}
                </button>
              </form>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
