import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GUEST_CART_KEY,
  GUEST_CART_NOTICE_KEY,
  MAX_GUEST_CART_LINES,
  addGuestLine,
  mergeGuestCart,
  parseGuestCart,
  readGuestCart,
  removeGuestLine,
  setGuestLineQuantity,
  takeGuestCartNotice,
  writeGuestCart,
} from "../app/lib/guest-cart";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guest cart lines", () => {
  it("ignores anything in storage that is not a clean list", () => {
    expect(parseGuestCart(null)).toEqual([]);
    expect(parseGuestCart("not json")).toEqual([]);
    expect(parseGuestCart('{"productId":1}')).toEqual([]);
    expect(
      parseGuestCart(
        JSON.stringify([
          { productId: 4, quantity: 2 },
          { productId: "5", quantity: 1 },
          { productId: -1, quantity: 1 },
          { productId: 1.5, quantity: 1 },
          null,
          { productId: 6, quantity: 0 },
          { productId: 7, quantity: 99_999 },
        ])
      )
    ).toEqual([
      { productId: 4, quantity: 2 },
      { productId: 6, quantity: 1 },
      { productId: 7, quantity: 9_999 },
    ]);
  });

  it("adds, changes and removes lines without duplicating a product", () => {
    let lines = addGuestLine([], 10, 1);
    lines = addGuestLine(lines, 11, 2);
    lines = addGuestLine(lines, 10, 3);
    expect(lines).toEqual([
      { productId: 10, quantity: 4 },
      { productId: 11, quantity: 2 },
    ]);

    expect(setGuestLineQuantity(lines, 11, 7)[1]).toEqual({ productId: 11, quantity: 7 });
    expect(removeGuestLine(lines, 10)).toEqual([{ productId: 11, quantity: 2 }]);
    expect(addGuestLine(lines, 0, 1)).toEqual(lines);
  });

  it("stops growing at the line limit", () => {
    let lines: ReturnType<typeof addGuestLine> = [];
    for (let id = 1; id <= MAX_GUEST_CART_LINES + 5; id += 1) lines = addGuestLine(lines, id, 1);
    expect(lines).toHaveLength(MAX_GUEST_CART_LINES);
  });

  it("round-trips through browser storage and removes the key when empty", () => {
    writeGuestCart([{ productId: 3, quantity: 2 }]);
    expect(readGuestCart()).toEqual([{ productId: 3, quantity: 2 }]);
    writeGuestCart([]);
    expect(window.localStorage.getItem(GUEST_CART_KEY)).toBeNull();
  });
});

describe("mergeGuestCart", () => {
  function json(status: number, body: unknown) {
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }

  it("adds every line to the account cart once and empties the guest cart", async () => {
    writeGuestCart([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ]);
    const fetchMock = vi.fn(() => json(200, { items: [] }));

    const result = await mergeGuestCart({ Authorization: "Bearer x" }, fetchMock as unknown as typeof fetch);

    expect(result).toEqual({ merged: 2, problems: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, firstInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(firstInit.body))).toEqual({ product_id: 1, quantity: 2 });
    expect(readGuestCart()).toEqual([]);
  });

  it("does nothing when there is no guest cart", async () => {
    const fetchMock = vi.fn();
    expect(await mergeGuestCart({}, fetchMock as unknown as typeof fetch)).toEqual({ merged: 0, problems: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a refused line once and does not retry it", async () => {
    writeGuestCart([
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 5 },
    ]);
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => json(400, { error: "Only 1 unit(s) of Mouse available." }))
      .mockImplementationOnce(() => json(200, { items: [] }));

    const result = await mergeGuestCart({}, fetchMock as unknown as typeof fetch);

    expect(result.merged).toBe(1);
    expect(result.problems).toEqual(["Only 1 unit(s) of Mouse available."]);
    expect(readGuestCart()).toEqual([]);
    expect(takeGuestCartNotice()).toEqual(["Only 1 unit(s) of Mouse available."]);
    expect(takeGuestCartNotice()).toEqual([]);
    expect(window.sessionStorage.getItem(GUEST_CART_NOTICE_KEY)).toBeNull();
  });

  it("keeps the unsent lines when the network fails", async () => {
    writeGuestCart([
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 1 },
      { productId: 3, quantity: 1 },
    ]);
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => json(200, { items: [] }))
      .mockImplementationOnce(() => Promise.reject(new TypeError("offline")));

    const result = await mergeGuestCart({}, fetchMock as unknown as typeof fetch);

    expect(result.merged).toBe(1);
    expect(readGuestCart()).toEqual([
      { productId: 2, quantity: 1 },
      { productId: 3, quantity: 1 },
    ]);
  });

  it("keeps everything when the session turns out not to be signed in", async () => {
    writeGuestCart([{ productId: 1, quantity: 1 }]);
    const fetchMock = vi.fn(() => json(401, { error: "Unauthorized" }));

    await mergeGuestCart({}, fetchMock as unknown as typeof fetch);

    expect(readGuestCart()).toEqual([{ productId: 1, quantity: 1 }]);
  });

  it("does not add the same lines twice when two pages merge at once", async () => {
    writeGuestCart([{ productId: 1, quantity: 1 }]);
    const fetchMock = vi.fn(() => json(200, { items: [] }));

    await Promise.all([
      mergeGuestCart({}, fetchMock as unknown as typeof fetch),
      mergeGuestCart({}, fetchMock as unknown as typeof fetch),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
