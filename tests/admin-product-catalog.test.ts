import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProductCatalog } from "../app/admin/product-catalog";

afterEach(() => vi.unstubAllGlobals());

describe("admin product catalog", () => {
  it("loads past the API's 100-product limit until it reaches the last batch", async () => {
    const products = Array.from({ length: 205 }, (_, index) => ({ id: index + 1 }));
    const fetchPage = vi.fn(async (url: string) => {
      const params = new URL(url, "http://localhost").searchParams;
      const offset = Number(params.get("offset"));
      const limit = Number(params.get("limit"));
      return Response.json({ products: products.slice(offset, offset + limit) });
    });
    vi.stubGlobal("fetch", fetchPage);
    const { signal } = new AbortController();

    expect(await loadProductCatalog(signal)).toEqual(products);
    expect(fetchPage.mock.calls.map(([url]) => url)).toEqual([
      "/api/products?limit=100&offset=0",
      "/api/products?limit=100&offset=100",
      "/api/products?limit=100&offset=200",
    ]);
  });

  it("reports a later batch failure without returning an incomplete catalog", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(Response.json({ products: Array.from({ length: 100 }, (_, id) => ({ id })) }))
      .mockResolvedValueOnce(Response.json({ error: "Could not load products." }, { status: 503 }));
    vi.stubGlobal("fetch", fetchPage);

    await expect(loadProductCatalog(new AbortController().signal)).rejects.toThrow("Could not load products.");
  });
});
