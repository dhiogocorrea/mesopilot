import type { MetadataRoute } from "next";

/**
 * Lets the app be installed to the home screen and run without browser chrome.
 *
 * The PNGs are what make it *installable*: Chrome weighs the icon list when it
 * decides whether to fire `beforeinstallprompt`, and a 192/512 raster pair is
 * the combination every browser accepts. The SVGs stay listed first so a device
 * that prefers vector still gets one that stays sharp at any size.
 *
 * All five are generated from the same mark by `npm run icons:generate` — see
 * that script before adding an icon by hand.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meso505 — Adaptive hypertrophy programming",
    short_name: "Meso505",
    description: "Adaptive hypertrophy programming. Your next week is written from the last one.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060607",
    theme_color: "#060607",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
