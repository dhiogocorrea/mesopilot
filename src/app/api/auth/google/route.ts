import { NextResponse } from "next/server";

import { googleAuthorizeUrl, isGoogleConfigured } from "@/server/google";

/** Starts the Google flow. A GET so it can be a plain link, not a form. */
export async function GET(): Promise<NextResponse> {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", requestBase()));
  }

  return NextResponse.redirect(await googleAuthorizeUrl());
}

function requestBase(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}
