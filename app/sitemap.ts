import type { MetadataRoute } from "next";
import { selectProductIdsForSitemap } from "./lib/supabase";
import { publicSiteUrl } from "./lib/site-url";

// Built on request, never at deploy time: the product list comes from the
// database, which a build cannot (and should not) reach. It is one small
// query, made only when a search engine asks.
export const dynamic = "force-dynamic";

const PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/catalog/laptops", priority: 0.9, changeFrequency: "daily" },
  { path: "/catalog/accessories", priority: 0.9, changeFrequency: "daily" },
  { path: "/catalog/pc-parts", priority: 0.9, changeFrequency: "daily" },
  { path: "/find-my-laptop", priority: 0.7, changeFrequency: "monthly" },
  { path: "/pc-builder", priority: 0.7, changeFrequency: "monthly" },
  { path: "/delivery-area", priority: 0.5, changeFrequency: "monthly" },
  { path: "/returns", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicSiteUrl();
  const pages = PAGES.map((page) => ({
    url: `${site}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  try {
    const ids = await selectProductIdsForSitemap();
    return [
      ...pages,
      ...ids.map((id) => ({
        url: `${site}/products/${id}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch (error) {
    // Better a sitemap with only the main pages than a failing /sitemap.xml.
    console.error("[sitemap] product list unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return pages;
  }
}
