import Script from "next/script";

/**
 * Google Analytics (GA4).
 *
 * Unconfigured is a supported state, like `RESEND_API_KEY` and the VAPID keys —
 * with no `NEXT_PUBLIC_GA_MEASUREMENT_ID` this renders nothing and the browser
 * never hears about Google at all, so a dev build or a fork with no analytics
 * account stays fully functional.
 *
 * `afterInteractive`: it has no business blocking the first paint of a set
 * logger, and Next defers it until just after hydration rather than competing
 * with the training data for the connection.
 */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
