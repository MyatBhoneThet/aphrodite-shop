import boundary from "../data/myanmar-boundary.json";

export const MYANMAR_REGIONS = [
  "Ayeyarwady", "Bago", "Chin", "Kachin", "Kayah", "Kayin", "Magway",
  "Mandalay", "Mon", "Naypyidaw", "Rakhine", "Sagaing", "Shan",
  "Tanintharyi", "Yangon",
] as const;

export const YANGON_TOWNSHIPS = [
  "Ahlone", "Bahan", "Botataung", "Cocokyun", "Dagon", "Dagon Seikkan",
  "Dala", "Dawbon", "East Dagon", "Hlaing", "Hlaing Tharyar",
  "Hlegu", "Hmawbi", "Htantabin", "Insein", "Kamayut", "Kawhmu",
  "Khayan", "Kungyangon", "Kyauktada", "Kyauktan", "Kyeemyindaing",
  "Lanmadaw", "Latha", "Mayangon", "Mingala Taungnyunt",
  "Mingaladon", "North Dagon", "North Okkalapa", "Pabedan", "Pazundaung",
  "Sanchaung", "Seikgyikanaungto", "Seikkan", "Shwepyitha",
  "South Dagon", "South Okkalapa", "Tamwe", "Taikkyi", "Thaketa",
  "Thanlyin", "Thingangyun", "Thongwa", "Twante", "Yankin",
] as const;

export type YangonTownship = (typeof YANGON_TOWNSHIPS)[number];

export function normalizeYangonTownship(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .replace(/\s+(township|မြို့နယ်)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return YANGON_TOWNSHIPS.find((township) => township.toLowerCase() === normalized);
}

// Delivery is intentionally limited to Yangon Region. This generous bounding
// box includes the region's outer townships; the written township remains the
// authoritative dispatch field because map data is approximate near borders.
export function isApproximatelyInYangon(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= 15.65 && latitude <= 17.85 &&
    longitude >= 95.65 && longitude <= 96.95;
}

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
