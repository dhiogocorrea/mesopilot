import type { Metadata, Viewport } from "next";

import { Analytics } from "@/components/analytics";
import { I18nProvider } from "@/lib/i18n/provider";
import { getPreferredLocale } from "@/server/locale";
import { getOptionalUserContext } from "@/server/user";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meso505",
  description: "Adaptive hypertrophy programming. Your next week is written from the last one.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Meso505" },
};

/**
 * Every screen renders from the athlete's own database rows — there is no
 * static content here. Without this, `next build` prerenders the tab pages and
 * ships whatever the database held at build time.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#060607",
  width: "device-width",
  initialScale: 1,
  // The app is a set logger, not a document — pinch-zooming it only ever
  // happens by accident with wet hands.
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Optional on purpose: this layout wraps the login screen too, and a version
  // that redirected when signed out would redirect /login to itself forever.
  const [context, preferred] = await Promise.all([
    getOptionalUserContext(),
    getPreferredLocale(),
  ]);

  // The account's own setting wins; the cookie only answers for a browser we
  // have not identified yet.
  const locale = context?.locale ?? preferred;
  const unit = context?.unit ?? "kg";

  return (
    <html lang={locale === "pt" ? "pt-BR" : "en"} className="h-full antialiased">
      {/* No background here: `html` already paints the canvas in globals.css,
          and a second one on `body` is not merely redundant. Body's background
          paints *after* negative z-index descendants, so it covered every
          `-z-10` layer in the tree — glows, and the illustrations behind the
          landing page's phones. */}
      <body className="min-h-full text-ink">
        <I18nProvider locale={locale} unit={unit}>
          {children}
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
