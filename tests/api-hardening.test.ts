import { describe, expect, it } from "vitest";

import { sanitizePagination } from "../app/lib/supabase";
import { parseProductIdParam } from "../app/lib/validation";

// Regression tests for query/path parameter hardening: route handlers turn
// query strings into numbers with Number(...), so garbage input arrives at
// the data layer as NaN. These guards keep NaN (and other junk) out of the
// PostgREST query string, where it previously caused 500s.

describe("sanitizePagination", () => {
  it("applies defaults when limit/offset are absent", () => {
    expect(sanitizePagination(null, null)).toEqual({ limit: 24, offset: 0 });
    expect(sanitizePagination(undefined, undefined)).toEqual({
      limit: 24,
      offset: 0,
    });
  });

  it("rejects NaN from unparseable query params (?limit=abc)", () => {
    expect(sanitizePagination(Number("abc"), Number("xyz"))).toEqual({
      limit: 24,
      offset: 0,
    });
  });

  it("rejects Infinity", () => {
    expect(sanitizePagination(Infinity, -Infinity)).toEqual({
      limit: 24,
      offset: 0,
    });
  });

  it("clamps the limit to the 1..100 window", () => {
    expect(sanitizePagination(0, 0).limit).toBe(1);
    expect(sanitizePagination(-5, 0).limit).toBe(1);
    expect(sanitizePagination(10_000, 0).limit).toBe(100);
  });

  it("clamps negative offsets to zero", () => {
    expect(sanitizePagination(24, -10).offset).toBe(0);
  });

  it("floors fractional values", () => {
    expect(sanitizePagination(10.9, 5.7)).toEqual({ limit: 10, offset: 5 });
  });

  it("passes through valid values", () => {
    expect(sanitizePagination(50, 100)).toEqual({ limit: 50, offset: 100 });
  });
});

describe("parseProductIdParam", () => {
  it("accepts positive integer ids", () => {
    expect(parseProductIdParam("1")).toBe(1);
    expect(parseProductIdParam("42")).toBe(42);
    expect(parseProductIdParam("007")).toBe(7);
  });

  it("rejects non-numeric ids instead of forwarding NaN to PostgREST", () => {
    expect(parseProductIdParam("abc")).toBeNull();
    expect(parseProductIdParam("1abc")).toBeNull();
    expect(parseProductIdParam("")).toBeNull();
  });

  it("rejects negative, zero, fractional, and exponent forms", () => {
    expect(parseProductIdParam("-2")).toBeNull();
    expect(parseProductIdParam("0")).toBeNull();
    expect(parseProductIdParam("1.5")).toBeNull();
    expect(parseProductIdParam("1e3")).toBeNull();
  });

  it("rejects values beyond the safe integer range", () => {
    expect(parseProductIdParam("9007199254740993")).toBeNull();
  });

  it("rejects PostgREST filter injection attempts in the id segment", () => {
    expect(parseProductIdParam("1&select=*")).toBeNull();
    expect(parseProductIdParam("1,2")).toBeNull();
  });
});
