import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import type { Locale } from "@/lib/types";
import { sendVerificationEmail } from "./email";

/**
 * Single-use links sent by email.
 *
 * Same shape as a session token: a random value goes in the link, only its
 * SHA-256 goes in the database. A dump of `EmailToken` is therefore a list of
 * dead hashes rather than a book of working links.
 */

const TOKEN_HOURS = 24;

export type EmailTokenPurpose = "verify";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh link and sends it, invalidating any earlier one for the same
 * purpose — two live links to the same inbox is one more than anybody needs,
 * and it makes "the newest email works" true.
 */
export async function issueVerificationEmail(
  userId: string,
  email: string,
  locale: Locale,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await db.$transaction([
    db.emailToken.deleteMany({ where: { userId, purpose: "verify", usedAt: null } }),
    db.emailToken.create({
      data: {
        userId,
        email,
        purpose: "verify",
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + TOKEN_HOURS * 60 * 60 * 1000),
      },
    }),
  ]);

  await sendVerificationEmail(email, token, locale);
}

export type VerifyOutcome = "verified" | "already" | "invalid";

/**
 * Consumes a verification link.
 *
 * Every failure mode collapses to "invalid" on purpose: whether a token is
 * unknown, expired, spent, or issued for an address the account no longer has
 * is not information a stranger holding a guessed token should get back.
 */
export async function consumeVerificationToken(token: string): Promise<VerifyOutcome> {
  if (!token) return "invalid";

  const row = await db.emailToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, emailLower: true, emailVerifiedAt: true } } },
  });

  if (!row || row.purpose !== "verify") return "invalid";
  if (row.usedAt) return row.user.emailVerifiedAt ? "already" : "invalid";
  if (row.expiresAt < new Date()) return "invalid";

  // The address changed after the link went out, so the link is stale.
  if (row.user.emailLower !== row.email.toLowerCase()) return "invalid";

  if (row.user.emailVerifiedAt) {
    await db.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return "already";
  }

  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  return "verified";
}
