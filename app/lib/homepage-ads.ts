export const HOMEPAGE_AD_PLACEMENTS = [
  "hero",
  "before_laptops",
  "before_help",
] as const;

export type HomepageAdPlacement = (typeof HOMEPAGE_AD_PLACEMENTS)[number];

export const HOMEPAGE_AD_PLACEMENT_LABELS: Record<HomepageAdPlacement, string> = {
  hero: "Main homepage hero",
  before_laptops: "Above Laptops",
  before_help: "Above Need help choosing?",
};

export function isHomepageAdPlacement(value: unknown): value is HomepageAdPlacement {
  return typeof value === "string" && HOMEPAGE_AD_PLACEMENTS.includes(value as HomepageAdPlacement);
}

/** Existing manifest rows predate placements and always belonged to the hero. */
export function normalizeHomepageAdPlacement(value: unknown): HomepageAdPlacement {
  return isHomepageAdPlacement(value) ? value : "hero";
}
