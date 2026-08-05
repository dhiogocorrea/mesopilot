import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything else in `public/` is an icon and can be cached hard. The
        // service worker cannot: it is the one file that decides how *future*
        // notifications behave, and a browser holding a stale copy keeps running
        // last month's push handler until its cache happens to expire. The CSP
        // is here because a worker is the highest-value script on the origin —
        // it outlives navigation and it opens windows.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
