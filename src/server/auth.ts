import "server-only";

import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/lib/db";

/**
 * Username + password, sessions in an httpOnly cookie.
 *
 * Deliberately small: no provider, no JWT, no refresh dance. The cookie holds a
 * random opaque token; the database stores only its SHA-256, so a leaked dump
 * cannot be replayed as a login. Passwords are scrypt — in Node's standard
 * library, memory-hard, and one less dependency to keep patched.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SESSION_COOKIE = "m505_session";
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

// ------------------------------------------------------------- passwords

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);

  // Lengths must match before timingSafeEqual, which throws otherwise.
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

// -------------------------------------------------------------- sessions

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a session and sets the cookie. Returns nothing the caller must keep. */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.authSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    // deleteMany rather than delete: logging out twice is not an error.
    await db.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  store.delete(SESSION_COOKIE);
}

/**
 * The signed-in user and their profile, or null.
 *
 * One query, deliberately. The session row, the account it belongs to and that
 * account's profile are a join, and resolving them as three separate awaits
 * made *every request in the app* wait out three round trips before any page
 * code began — which is most of a second against a database on another
 * continent. Reaching through `user` here is the one place auth knows anything
 * about the account, and it is still the only place that knows sessions exist.
 *
 * `cache` dedupes it across one render pass, so a page with five server
 * components still makes one query.
 */
export const currentAuthUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { profile: true } } },
  });

  // Expiry is enforced here rather than trusted from the cookie, which the
  // browser owns and a caller can replay after it "expires".
  if (!session || session.expiresAt < new Date()) return null;

  // `user` is a required relation with `onDelete: Cascade`, so a session whose
  // account is gone is not a state the database can be in.
  return session.user;
});

/** Just the id, sharing the query above rather than issuing a second one. */
export const currentUserId = cache(async (): Promise<string | null> => {
  return (await currentAuthUser())?.id ?? null;
});

/** Sessions are only cleaned up opportunistically; nothing depends on it. */
export async function purgeExpiredSessions(): Promise<void> {
  await db.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
