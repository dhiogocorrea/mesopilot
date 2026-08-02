"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/types";

/**
 * Language before there is an account.
 *
 * A signed-in athlete's language lives on their `User` row; the login screen
 * has no row to read, so the choice goes in a cookie. Once signed in the row
 * wins — the cookie is only the answer to "what should this browser show
 * someone we don't know yet", and it survives sign-out so the next visit opens
 * in the language they picked.
 */

const LOCALE_COOKIE = "m505_locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getPreferredLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function setPreferredLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    // Read by the server on every render, but nothing secret — and it must
    // survive a sign-out, which clears the session cookie beside it.
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });

  revalidatePath("/", "layout");
}
