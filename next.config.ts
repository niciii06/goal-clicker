import type { NextConfig } from "next";
import { TAB_PATHS } from "./app/tab-routes";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The account browser test builds a second copy with test login settings next to the normal build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Every tab has its own address (/kader, /spiele, ...) and they all serve the one game page.
  async rewrites() {
    return Object.values(TAB_PATHS).map((source) => ({ source, destination: "/" }));
  },
  // The same response headers the former Cloudflare Worker added to every response.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "x-content-type-options", value: "nosniff" },
        { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};

export default nextConfig;
