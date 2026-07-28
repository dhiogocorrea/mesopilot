import type { MetadataRoute } from "next";

/** Lets the app be installed to the home screen and run without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MesoPilot — Adaptive hypertrophy programming",
    short_name: "MesoPilot",
    description: "Adaptive hypertrophy programming. Your next week is written from the last one.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
