/**
 * A cart for visitors who have not logged in yet.
 *
 * It lives in the browser only (localStorage): product id + quantity, nothing
 * else. Prices, stock and wholesale rules are never trusted from here -- the
 * cart page asks the server (/api/cart/guest) to price these lines, and when
 * the visitor logs in the lines are added to their real cart through the
 * normal /api/cart endpoint, which enforces stock again.
 */
export type GuestCartLine = { productId: number; quantity: number };

export const GUEST_CART_KEY = "aphrodite.guestCart.v1";
export const GUEST_CART_NOTICE_KEY = "aphrodite.guestCart.notice.v1";
export const GUEST_CART_EVENT = "aphrodite:guest-cart";
export const MAX_GUEST_CART_LINES = 30;
const MAX_QUANTITY = 9_999;

function cleanQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
}

function validProductId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Tolerant on purpose: whatever is in storage, the result is a safe list. */
export function parseGuestCart(raw: string | null | undefined): GuestCartLine[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const merged = new Map<number, number>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const { productId, quantity } = entry as Partial<GuestCartLine>;
    if (!validProductId(productId)) continue;
    merged.set(productId, cleanQuantity((merged.get(productId) ?? 0) + cleanQuantity(quantity)));
    if (merged.size >= MAX_GUEST_CART_LINES) break;
  }

  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

export function addGuestLine(lines: GuestCartLine[], productId: number, quantity: number): GuestCartLine[] {
  if (!validProductId(productId)) return lines;

  const existing = lines.find((line) => line.productId === productId);
  if (existing) {
    return lines.map((line) =>
      line.productId === productId
        ? { productId, quantity: cleanQuantity(line.quantity + cleanQuantity(quantity)) }
        : line
    );
  }
  if (lines.length >= MAX_GUEST_CART_LINES) return lines;

  return [...lines, { productId, quantity: cleanQuantity(quantity) }];
}

export function setGuestLineQuantity(lines: GuestCartLine[], productId: number, quantity: number): GuestCartLine[] {
  return lines.map((line) =>
    line.productId === productId ? { productId, quantity: cleanQuantity(quantity) } : line
  );
}

export function removeGuestLine(lines: GuestCartLine[], productId: number): GuestCartLine[] {
  return lines.filter((line) => line.productId !== productId);
}

// ---------------------------------------------------------------------------
// Browser storage. Every access is wrapped: private windows and blocked site
// data make localStorage throw, and the shop must keep working without it.
// ---------------------------------------------------------------------------

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readGuestCart(): GuestCartLine[] {
  try {
    return parseGuestCart(storage()?.getItem(GUEST_CART_KEY));
  } catch {
    return [];
  }
}

export function writeGuestCart(lines: GuestCartLine[]) {
  try {
    const store = storage();
    if (!store) return;
    if (lines.length === 0) store.removeItem(GUEST_CART_KEY);
    else store.setItem(GUEST_CART_KEY, JSON.stringify(lines));
  } catch {
    // Storage is full or blocked: the in-memory list the page holds still works.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(GUEST_CART_EVENT));
}

export function clearGuestCart() {
  writeGuestCart([]);
}

export function subscribeGuestCart(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(GUEST_CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(GUEST_CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Raw string snapshot for useSyncExternalStore (stable between unchanged reads). */
export function guestCartSnapshot() {
  try {
    return storage()?.getItem(GUEST_CART_KEY) ?? "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Moving the guest cart into the account cart after login.
// ---------------------------------------------------------------------------

export type MergeResult = { merged: number; problems: string[] };

let mergeInFlight: Promise<MergeResult> | null = null;

/**
 * Adds every guest line to the signed-in customer's real cart.
 *
 * The lines are taken out of storage *before* any request goes out, so two
 * pages loading at once (or a second tab) cannot add them twice. A network
 * failure puts the unsent lines back; a refusal from the server (out of
 * stock, price pending) is reported once and dropped, not retried forever.
 */
export function mergeGuestCart(
  headers: Record<string, string> = {},
  fetchImpl: typeof fetch = fetch
): Promise<MergeResult> {
  if (mergeInFlight) return mergeInFlight;

  const lines = readGuestCart();
  if (lines.length === 0) return Promise.resolve({ merged: 0, problems: [] });

  clearGuestCart();

  mergeInFlight = (async () => {
    const problems: string[] = [];
    let merged = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      try {
        const response = await fetchImpl("/api/cart", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: line.productId, quantity: line.quantity }),
        });

        if (response.ok) {
          merged += 1;
          continue;
        }
        if (response.status === 401) {
          // Not actually signed in: nothing was added, so keep everything.
          writeGuestCart(lines.slice(index));
          break;
        }

        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        problems.push(body?.error ?? "One product could not be added to your cart.");
      } catch {
        writeGuestCart(lines.slice(index));
        break;
      }
    }

    if (problems.length > 0) {
      try {
        window.sessionStorage.setItem(GUEST_CART_NOTICE_KEY, JSON.stringify(problems.slice(0, 5)));
      } catch {
        // The notice is a courtesy; losing it is fine.
      }
    }

    return { merged, problems };
  })().finally(() => {
    mergeInFlight = null;
  });

  return mergeInFlight;
}

/** Reads and clears the "some items could not be moved" notice, once. */
export function takeGuestCartNotice(): string[] {
  try {
    const raw = window.sessionStorage.getItem(GUEST_CART_NOTICE_KEY);
    if (!raw) return [];
    window.sessionStorage.removeItem(GUEST_CART_NOTICE_KEY);
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
