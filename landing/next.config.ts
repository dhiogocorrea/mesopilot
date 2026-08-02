import type { NextConfig } from "next";

/**
 * The marketing site. Deployed separately from the app — meso505.com here,
 * app.meso505.com there — which is the whole reason it is its own project:
 * nothing on this page needs Prisma, an auth session or a database round trip,
 * and a static-ish page should not redeploy every time the logger changes.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
