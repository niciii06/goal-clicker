import type { NextConfig } from "next";
import { TAB_PATHS } from "./app/tab-routes";

// The browser only learns whether login is on, never the Neon Auth URL or a secret. A build on a host without a
// complete auth configuration tells the browser "misconfigured", and the server refuses identity (authMode()).
const hostedBuild = Boolean(process.env.NETLIFY || process.env.VERCEL || process.env.AUTH_REQUIRED === "1");
const authBuildMode = process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET ? "neon" : hostedBuild ? "misconfigured" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AUTH_MODE: authBuildMode,
    // Baked into the server bundle too: a build made on a host stays fail closed even if its runtime lacks the flags.
    GOAL_CLICKER_HOSTED_BUILD: hostedBuild ? "1" : "",
  },
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
