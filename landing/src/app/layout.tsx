import type { Metadata, Viewport } from "next";

import { detectLocale } from "@/lib/copy";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://meso505.com"),
  title: "Meso505 — Adaptive hypertrophy programming",
  description:
    "Your next training week is written from your last one. Meso505 runs Renaissance Periodization autoregulation over the sets you actually logged.",
  openGraph: {
    title: "Meso505 — Adaptive hypertrophy programming",
    description:
      "Your next training week is written from your last one. Volume climbs when you recover, and backs off when you don't.",
    url: "https://meso505.com",
    siteName: "Meso505",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  // Kept in step with `--color-canvas` in globals.css. A status bar a few
  // values off the page is the sort of seam you only notice on a phone.
  themeColor: "#060607",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await detectLocale();

  return (
    <html lang={locale === "pt" ? "pt-BR" : "en"} className="h-full antialiased">
      {/* No background here: `html` already paints the canvas in globals.css,
          and body's background paints *after* negative z-index descendants, so
          a second one covers every `-z-10` layer in the tree. */}
      <body className="min-h-full text-ink">{children}</body>
    </html>
  );
}
