import { NextResponse, type NextRequest } from "next/server";

import { startSession } from "@/server/auth";
import { appUrl } from "@/server/email";
import { isGoogleConfigured, linkGoogleAccount, resolveGoogleCallback } from "@/server/google";

/**
 * Where Google sends the browser back.
 *
 * Every failure lands on `/login` with a generic code. The specifics — bad
 * state, a refused token swap, a userinfo call that came back empty — are
 * server-side detail, and telling a stranger which step failed only helps them
 * work out what to try next.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const base = appUrl();
  const failed = NextResponse.redirect(new URL("/login?error=google_failed", base));

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", base));
  }

  const params = request.nextUrl.searchParams;

  // The athlete pressed cancel on Google's screen. Not an error worth shouting.
  if (params.get("error")) return NextResponse.redirect(new URL("/login", base));

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return failed;

  const identity = await resolveGoogleCallback(code, state);
  if (!identity) return failed;

  const userId = await linkGoogleAccount(identity);
  await startSession(userId);

  // Onboarding sends anyone without a profile onward; a returning athlete lands
  // on Today. Neither needs deciding here.
  return NextResponse.redirect(new URL("/", base));
}
