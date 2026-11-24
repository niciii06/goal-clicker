import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-url";

// Only the public start page. The tab addresses (/kader, /spiele, ...) show the same page and name it as canonical.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/` }];
}
