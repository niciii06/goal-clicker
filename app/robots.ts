import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-url";

// Search engines may read the public page; the API and the login callback hold no public content. Every crawler
// gets the same rules; nothing private has an address of its own (accounts, saves and co-op worlds live behind
// the API, which needs a session).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
