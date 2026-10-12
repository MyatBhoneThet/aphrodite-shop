import type { MetadataRoute } from "next";
import { publicSiteUrl } from "./lib/site-url";

/**
 * Search engines may read the storefront. Accounts, carts, orders, the admin
 * area and the API are private pages with nothing useful to index.
 */
export default function robots(): MetadataRoute.Robots {
  const site = publicSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/cart",
        "/checkout",
        "/orders",
        "/settings",
        "/notifications",
        "/addresses",
        "/wishlist",
        "/company",
        "/location",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/track",
      ],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
