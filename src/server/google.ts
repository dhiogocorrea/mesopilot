import "server-only";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { appUrl } from "./email";

/**
 * Sign in with Google, hand-rolled.
 *
 * The whole flow is: send them to Google with a random `state`, get a code
 * back, swap it for an access token over TLS using our client secret, then ask
 * Google who it belongs to. Because the token comes straight from Google on a
 * connection only we could have opened, there is no ID token signature to
 * verify — which removes the part of OAuth that is easy to get subtly wrong.
 *
 * A library would also have replaced the session mechanism in `auth.ts`, which
 * already works and is a page long. This adds a provider, not a framework.
 */

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

const STATE_COOKIE = "m505_oauth_state";
const STATE_MINUTES = 10;

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}

/**
 * Where to send the browser, having first stashed a random `state` in a
 * short-lived cookie. Google echoes `state` back, and the callback refuses
 * anything that does not match — which is what stops a third party feeding us
 * a code they obtained elsewhere.
 */
export async function googleAuthorizeUrl(): Promise<string> {
  const state = randomBytes(24).toString("base64url");

  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MINUTES * 60,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    // Ask every time rather than silently reusing a session on a shared device.
    prompt: "select_account",
  });

  return `${AUTHORIZE}?${params.toString()}`;
}

export type GoogleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

/** Validates `state`, swaps the code, and returns who Google says this is. */
export async function resolveGoogleCallback(
  code: string,
  state: string,
): Promise<GoogleIdentity | null> {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!expected || !state || expected !== state) return null;

  const tokenResponse = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) return null;
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) return null;

  const infoResponse = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!infoResponse.ok) return null;

  const info = (await infoResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  if (!info.sub) return null;

  return {
    sub: info.sub,
    email: info.email ?? null,
    emailVerified: info.email_verified === true,
    name: info.name ?? null,
  };
}

/**
 * Finds or creates the account behind a Google identity.
 *
 * Matching is on the provider's `sub`, never on the email alone: addresses
 * change hands, and "same address" is not "same person". An email match is
 * used only to *link* Google to an account that already proved it owns that
 * address — otherwise a Google account whose address happens to match someone
 * else's unverified one would take it over.
 */
export async function linkGoogleAccount(identity: GoogleIdentity): Promise<string> {
  const existing = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: identity.sub } },
    select: { userId: true },
  });
  if (existing) return existing.userId;

  const emailLower = identity.email?.toLowerCase() ?? null;

  if (emailLower && identity.emailVerified) {
    const owner = await db.user.findUnique({
      where: { emailLower },
      select: { id: true, emailVerifiedAt: true },
    });

    if (owner?.emailVerifiedAt) {
      await db.oAuthAccount.create({
        data: {
          userId: owner.id,
          provider: "google",
          providerAccountId: identity.sub,
          email: identity.email,
        },
      });
      return owner.id;
    }

    // Address taken by an account that never proved it owns it. Linking would
    // hand that account over; a new one is the safe answer.
    if (owner) return createGoogleUser(identity, null);
  }

  return createGoogleUser(identity, emailLower);
}

async function createGoogleUser(
  identity: GoogleIdentity,
  emailLower: string | null,
): Promise<string> {
  const username = await availableUsername(identity.email, identity.name);

  const user = await db.user.create({
    data: {
      name: identity.name?.trim() || username,
      username,
      usernameLower: username.toLowerCase(),
      // Google already proved the address, so there is nothing to re-verify.
      email: emailLower ? identity.email : null,
      emailLower,
      emailVerifiedAt: emailLower && identity.emailVerified ? new Date() : null,
      passwordHash: null,
      oauthAccounts: {
        create: {
          provider: "google",
          providerAccountId: identity.sub,
          email: identity.email,
        },
      },
    },
    select: { id: true },
  });

  return user.id;
}

/**
 * A username derived from what Google gave us, with a numeric suffix if taken.
 * The athlete can change it in Settings; this only has to be unique and not
 * embarrassing.
 */
async function availableUsername(email: string | null, name: string | null): Promise<string> {
  const base =
    (email?.split("@")[0] ?? name ?? "athlete")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 24) || "athlete";

  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}${suffix}`;
    if (candidate.length < 3) continue;

    const taken = await db.user.findUnique({
      where: { usernameLower: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `athlete${randomBytes(4).toString("hex")}`;
}
