import { describe, expect, it } from "vitest";
import { isApproximatelyInMyanmar, isMyanmarCountry, normalizeMyanmarRegion } from "../app/lib/delivery-country";
import { orderInputSchema } from "../app/lib/validation";

describe("Myanmar delivery checks", () => {
  it("recognizes Yangon and Mandalay but not Bangkok, Singapore or Dhaka", () => {
    expect(isApproximatelyInMyanmar(16.8661, 96.1951)).toBe(true);
    expect(isApproximatelyInMyanmar(21.9588, 96.0891)).toBe(true);
    expect(isApproximatelyInMyanmar(13.7563, 100.5018)).toBe(false);
    expect(isApproximatelyInMyanmar(1.3521, 103.8198)).toBe(false);
    expect(isApproximatelyInMyanmar(23.8103, 90.4125)).toBe(false);
    expect(isApproximatelyInMyanmar(NaN, 95)).toBe(false);
  });
  it("normalizes supported country and region names", () => {
    expect(isMyanmarCountry(" MM ")).toBe(true);
    expect(isMyanmarCountry("Thailand")).toBe(false);
    expect(normalizeMyanmarRegion("Yangon Region")).toBe("Yangon");
    expect(normalizeMyanmarRegion("Bangkok")).toBeUndefined();
  });
  it("does not let a legacy address bypass the country requirement", () => {
    const body = { shipping_name: "Customer", shipping_phone: "09123456789", shipping_address: "123 Test Road", cod_confirmation: true, cod_contact_confirmation: true };
    expect(orderInputSchema.safeParse(body).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...body, shipping_country: "Thailand", shipping_state: "Yangon" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...body, shipping_country: "Myanmar", shipping_state: "Bangkok" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...body, shipping_country: "MM", shipping_state: "Yangon" }).success).toBe(true);
  });
  const checkout = {
    shipping_name: "Customer", shipping_phone: "09123456789",
    shipping_address: "123 Test Road", shipping_country: "Myanmar", shipping_state: "Yangon",
    cod_confirmation: true, cod_contact_confirmation: true,
  };
  const pin = { latitude: 16.8661, longitude: 96.1951, accuracy_m: null, captured_at: "2026-09-03T00:00:00.000Z" };
  it("accepts a consented manual pin without inventing accuracy", () => {
    const parsed = orderInputSchema.parse({ ...checkout, delivery_location_consent: true, delivery_location: pin });
    expect(parsed.delivery_location?.accuracy_m).toBeNull();
  });
  it("rejects foreign pins even when the written country says Myanmar", () => {
    expect(orderInputSchema.safeParse({ ...checkout, delivery_location_consent: true, delivery_location: { ...pin, latitude: 13.7563, longitude: 100.5018 } }).success).toBe(false);
  });
  it("requires explicit consent for either a device or manual pin", () => {
    expect(orderInputSchema.safeParse({ ...checkout, delivery_location: pin }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...checkout, delivery_location: { ...pin, accuracy_m: 20 } }).success).toBe(false);
  });
  it("allows a written Myanmar address for staff verification without GPS", () => {
    expect(orderInputSchema.safeParse({ ...checkout, delivery_location_consent: false, delivery_location: null }).success).toBe(true);
  });
  it("rejects invalid coordinate values", () => {
    for (const latitude of [NaN, Infinity, -91, 91]) {
      expect(orderInputSchema.safeParse({ ...checkout, delivery_location_consent: true, delivery_location: { ...pin, latitude } }).success).toBe(false);
    }
  });
});
