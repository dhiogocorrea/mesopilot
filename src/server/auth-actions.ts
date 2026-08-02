"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { endSession, hashPassword, startSession, verifyPassword } from "./auth";
import { issueVerificationEmail } from "./email-tokens";
import { getPreferredLocale } from "./locale";
import { getUserContext } from "./user";

/**
 * Sign-up, sign-in, sign-out. These are the only actions that may run without
 * a session, which is why they live apart from `actions.ts` — everything in
 * there begins with `getUserContext()` and is meant to.
 */

const credentials = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    // Anything that reads as an id: no spaces, no case traps, no lookalikes.
    .regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

/**
 * A dictionary key, not a sentence. These surface on the login screen, which
 * now has its own language switch — a hardcoded English string there would be
 * the one bit of the page that ignored it.
 */
export type AuthError =
  | "auth.errUsernameShort"
  | "auth.errUsernameChars"
  | "auth.errPasswordShort"
  | "auth.errEmail"
  | "auth.errEmailTaken"
  | "auth.errTaken"
  | "auth.errWrong";

export type AuthResult = { error: AuthError } | undefined;

function firstError(issues: z.core.$ZodIssue[]): AuthError {
  const issue = issues[0];
  if (issue?.path[0] === "password") return "auth.errPasswordShort";
  if (issue?.path[0] === "email") return "auth.errEmail";
  return issue?.code === "invalid_format" ? "auth.errUsernameChars" : "auth.errUsernameShort";
}

export async function signUp(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = credentials.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: firstError(parsed.error.issues) };

  const { username, email, password } = parsed.data;
  const usernameLower = username.toLowerCase();
  const locale = await getPreferredLocale();

  const [takenName, takenEmail] = await Promise.all([
    db.user.findUnique({ where: { usernameLower }, select: { id: true } }),
    db.user.findUnique({ where: { emailLower: email }, select: { id: true } }),
  ]);
  if (takenName) return { error: "auth.errTaken" };
  if (takenEmail) return { error: "auth.errEmailTaken" };

  const user = await db.user.create({
    data: {
      name: username,
      username,
      usernameLower,
      email,
      emailLower: email,
      passwordHash: await hashPassword(password),
      // Carried over from the switch on the signup screen. Without this the
      // account is created in English and the app flips language the instant
      // you finish signing up in Portuguese.
      locale,
    },
    select: { id: true },
  });

  await startSession(user.id);

  // Best-effort: the account exists and works whether or not the mail server
  // is reachable, and the athlete can ask for another link from Settings.
  try {
    await issueVerificationEmail(user.id, email, locale);
  } catch (error) {
    console.error("Verification email failed to send; the account is fine", error);
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signIn(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const identifier = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Username or email — people remember one or the other, and which one they
  // typed is not a thing worth making them choose on a login form.
  const user = await db.user.findFirst({
    where: identifier.includes("@") ? { emailLower: identifier } : { usernameLower: identifier },
    select: { id: true, passwordHash: true },
  });

  // One message for both failures, and the hash is still verified when the user
  // does not exist — otherwise the response time says whether the name is real.
  // A Google-only account has no password; treated exactly like a wrong one so
  // the form does not disclose how somebody else signs in.
  const stored = user?.passwordHash ?? NO_SUCH_USER_HASH;
  const ok = await verifyPassword(password, stored);

  if (!user || !user.passwordHash || !ok) return { error: "auth.errWrong" };

  await startSession(user.id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut(): Promise<void> {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * A real scrypt hash of a value nobody can log in with, so the failure path for
 * an unknown username costs the same as a wrong password.
 */
const NO_SUCH_USER_HASH =
  "00000000000000000000000000000000:" +
  "b6c0b3b0a0b0d3d5e0d0b0e0e0f0a0b0c0d0e0f0a0b0c0d0e0f0a0b0c0d0e0f0" +
  "a0b0c0d0e0f0a0b0c0d0e0f0a0b0c0d0e0f0a0b0c0d0e0f0a0b0c0d0e0f0a0b0";

/**
 * Sends the verification link again, for the athlete already signed in.
 *
 * Rate-limited by the token table itself: issuing invalidates the previous
 * link, so the worst a repeated tap achieves is a newer email.
 */
export async function resendVerification(): Promise<{ sent: boolean }> {
  const { userId, locale } = await getUserContext();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  });

  if (!user?.email || user.emailVerifiedAt) return { sent: false };

  try {
    await issueVerificationEmail(userId, user.email, locale);
    return { sent: true };
  } catch (error) {
    console.error("Could not resend the verification email", error);
    return { sent: false };
  }
}
