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

const SESSION_COOKIE = "mp_session";
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
 * The signed-in user's id, or null. `cache` dedupes it across one render pass
 * so a page with five server components still makes one query.
 */
export const currentUserId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { userId: true, expiresAt: true },
  });

  // Expiry is enforced here rather than trusted from the cookie, which the
  // browser owns and a caller can replay after it "expires".
  if (!session || session.expiresAt < new Date()) return null;

  return session.userId;
});

/** Sessions are only cleaned up opportunistically; nothing depends on it. */
export async function purgeExpiredSessions(): Promise<void> {
  await db.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
