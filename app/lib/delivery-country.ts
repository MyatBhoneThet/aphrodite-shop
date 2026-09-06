import boundary from "../data/myanmar-boundary.json";

export const MYANMAR_REGIONS = [
  "Ayeyarwady", "Bago", "Chin", "Kachin", "Kayah", "Kayin", "Magway",
  "Mandalay", "Mon", "Naypyidaw", "Rakhine", "Sagaing", "Shan",
  "Tanintharyi", "Yangon",
] as const;

export function isMyanmarCountry(country: string | null | undefined) {
  return ["myanmar", "mm", "mmr", "burma", "မြန်မာ", "မြန်မာနိုင်ငံ"].includes(country?.trim().toLowerCase() ?? "");
}

export function normalizeMyanmarRegion(region: string | null | undefined) {
  const value = region?.trim().replace(/\s+(region|state|union territory)$/i, "").toLowerCase();
  return MYANMAR_REGIONS.find((name) => name.toLowerCase() === value);
}

function inRing(longitude: number, latitude: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > latitude) !== (yj > latitude) && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Approximate geographic guidance, never identity verification. Simplified
// country boundaries and browser GPS can be inaccurate near borders/islands.
export function isApproximatelyInMyanmar(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return boundary.coordinates.some((polygon) =>
    inRing(longitude, latitude, polygon[0]) &&
    !polygon.slice(1).some((hole) => inRing(longitude, latitude, hole))
  );
}
