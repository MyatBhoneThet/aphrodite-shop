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

/**
 * Other spellings of the same township. OpenStreetMap, Google and the
 * government use different romanisations ("Kamaryut" / "Kamayut",
 * "Hlaingtharya" / "Hlaing Tharyar"), and the pin lookup returns whichever the
 * map volunteers typed. Keys are written the way they are compared: lowercase
 * letters only (see townshipKey).
 */
const TOWNSHIP_ALIASES: Record<string, (typeof YANGON_TOWNSHIPS)[number]> = {
  kamaryut: "Kamayut",
  kamarut: "Kamayut",
  mayangone: "Mayangon",
  hlaingtharya: "Hlaing Tharyar",
  hlaingthaya: "Hlaing Tharyar",
  hlaingtharyar: "Hlaing Tharyar",
  hlainthaya: "Hlaing Tharyar",
  botahtaung: "Botataung",
  botahtaungtownship: "Botataung",
  shwepyithar: "Shwepyitha",
  shwepyitar: "Shwepyitha",
  tarmwe: "Tamwe",
  northokkalarpa: "North Okkalapa",
  southokkalarpa: "South Okkalapa",
  okkalapanorth: "North Okkalapa",
  okkalapasouth: "South Okkalapa",
  mingalardon: "Mingaladon",
  mingalartaungnyunt: "Mingala Taungnyunt",
  mingalataungnyunt: "Mingala Taungnyunt",
  twantay: "Twante",
  kyimyindaing: "Kyeemyindaing",
  kyeemyindine: "Kyeemyindaing",
  seikkyikanaungto: "Seikgyikanaungto",
  seikgyikanaungto: "Seikgyikanaungto",
  kayan: "Khayan",
  syriam: "Thanlyin",
  thingangyoun: "Thingangyun",
  dagonseikkan: "Dagon Seikkan",
  htantapin: "Htantabin",
  cocoislands: "Cocokyun",
  cocoisland: "Cocokyun",
  ahlon: "Ahlone",
  lathar: "Latha",
};

/** Letters only, lowercase, accents removed: "Hlaing Tharyar" and "hlaing-tharyar" compare equal. */
function townshipKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const TOWNSHIP_BY_KEY = new Map<string, (typeof YANGON_TOWNSHIPS)[number]>([
  ...YANGON_TOWNSHIPS.map((township) => [townshipKey(township), township] as const),
  ...Object.entries(TOWNSHIP_ALIASES),
]);

/**
 * Maps whatever a person or a map service wrote to one of the townships we
 * deliver to, or undefined. Case, spacing, hyphens, a trailing "Township" and
 * a bracketed part ("Hlaingtharya (East)") are ignored. Districts are NOT
 * townships: "Kyauktada District" deliberately does not match "Kyauktada".
 */
export function normalizeYangonTownship(value: string | null | undefined) {
  if (!value) return undefined;
  const withoutBrackets = value.replace(/\s*[([].*?[)\]]\s*/g, " ");
  const cleaned = withoutBrackets.trim().replace(/\s+(township|မြို့နယ်)$/i, "");
  return TOWNSHIP_BY_KEY.get(townshipKey(cleaned));
}

/** The first of several map-service fields that names a township we deliver to. */
export function pickYangonTownship(candidates: (string | null | undefined)[]) {
  for (const candidate of candidates) {
    const township = normalizeYangonTownship(candidate);
    if (township) return township;
  }
  return undefined;
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
