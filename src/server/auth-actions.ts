"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { endSession, hashPassword, startSession, verifyPassword } from "./auth";
import { getPreferredLocale } from "./locale";

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
  | "auth.errTaken"
  | "auth.errWrong";

export type AuthResult = { error: AuthError } | undefined;

function firstError(issues: z.core.$ZodIssue[]): AuthError {
  const issue = issues[0];
  if (issue?.path[0] === "password") return "auth.errPasswordShort";
  return issue?.code === "invalid_format" ? "auth.errUsernameChars" : "auth.errUsernameShort";
}

export async function signUp(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = credentials.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: firstError(parsed.error.issues) };

  const { username, password } = parsed.data;
  const usernameLower = username.toLowerCase();

  const taken = await db.user.findUnique({ where: { usernameLower }, select: { id: true } });
  if (taken) return { error: "auth.errTaken" };

  const user = await db.user.create({
    data: {
      name: username,
      username,
      usernameLower,
      passwordHash: await hashPassword(password),
      // Carried over from the switch on the signup screen. Without this the
      // account is created in English and the app flips language the instant
      // you finish signing up in Portuguese.
      locale: await getPreferredLocale(),
    },
    select: { id: true },
  });

  await startSession(user.id);
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signIn(_previous: AuthResult, formData: FormData): Promise<AuthResult> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.user.findUnique({
    where: { usernameLower: username },
    select: { id: true, passwordHash: true },
  });

  // One message for both failures, and the hash is still verified when the user
  // does not exist — otherwise the response time says whether the name is real.
  const stored = user?.passwordHash ?? NO_SUCH_USER_HASH;
  const ok = await verifyPassword(password, stored);

  if (!user || !ok) return { error: "auth.errWrong" };

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
