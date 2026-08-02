import { NextResponse, type NextRequest } from "next/server";

import { isLocale, LOCALE_COOKIE } from "@/lib/types";

/**
 * The one thing that runs before a language is known.
 *
 * The marketing site lives on its own domain, so its EN/PT choice cannot reach
 * this app through the locale cookie — a cookie set on meso505.com is not sent
 * to app.meso505.com. It arrives as `?lang=` on the link across instead, and
 * this turns that one-off hint into the same cookie the in-app switcher writes,
 * so the first screen already renders in the language they picked on the site.
 *
 * We redirect to the same URL without the parameter rather than just setting
 * the cookie on the response: the current render reads the *incoming* request
 * cookies, which do not yet include one set here, so only a fresh request opens
 * in the new language. The redirect also keeps `?lang=` out of shared links.
 *
 * A signed-in athlete's own setting still wins — the layout prefers the account
 * row over this cookie — so following the link never overrides a saved choice.
 */
const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  if (!isLocale(lang)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.searchParams.delete("lang");

  const response = NextResponse.redirect(url);
  response.cookies.set(LOCALE_COOKIE, lang, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return response;
}

export const config = {
  // Every navigable path, but none of the internals or files with an extension:
  // the redirect only makes sense for a page a person can land on with `?lang=`.
  matcher: ["/((?!_next/|api/|.*\\.).*)"],
};
