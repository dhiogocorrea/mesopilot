import { createHash, timingSafeEqual } from "node:crypto";

import { isReasonableHour } from "@/lib/time";
import type { ScheduledNotificationKind } from "@/lib/types";
import { notify } from "@/server/notify";
import { findReminderCandidates } from "@/server/reminders";

/**
 * The one thing in this app that runs when nobody is using it.
 *
 * A plain authenticated HTTP endpoint rather than anything platform-specific:
 * Vercel Cron drives it today, but so could a GitHub Action, Supabase's
 * `pg_cron` with `pg_net`, or a bare `curl` from anywhere. Nothing about the
 * schedule lives in the code.
 *
 * Two rules it exists to keep:
 *
 *   - **It never sees a request context.** No cookies, no `getUserContext()` —
 *     every function it calls takes a `userId`. That is exactly why `notify()`
 *     was built not to read the request, and why `coachSession()` could not be
 *     reused here.
 *   - **It cannot send at 3am.** Candidates are filtered by the hour where the
 *     *athlete* is, so a global schedule still lands locally.
 */

// Reads the database on every call and must never be prerendered or cached.
export const dynamic = "force-dynamic";

// `web-push` needs `node:crypto` and `https`. On the edge runtime this route
// would fail at import, and it would fail only in production.
export const runtime = "nodejs";

/**
 * Constant-time bearer check.
 *
 * Both sides are hashed first so `timingSafeEqual` always gets equal lengths —
 * it throws otherwise, and the length of the thrown error is itself a signal.
 * Same discipline `src/server/auth.ts` applies to session tokens.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  // Unset means the endpoint is closed, not open. A scheduler that has not been
  // configured yet must not leave a way to make the app send to everyone.
  if (!secret) return false;

  const offered = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  return timingSafeEqual(
    createHash("sha256").update(offered).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export async function GET(request: Request): Promise<Response> {
  // 404, not 401: an endpoint that answers differently to a wrong key is an
  // endpoint that confirms it exists.
  if (!authorised(request)) return new Response("Not found", { status: 404 });

  const now = new Date();
  const { abandoned, streaks, lapsed } = await findReminderCandidates(now);

  // At most one reminder per athlete per run, most actionable first. Someone
  // who left a workout open, whose streak is going, and who has no block
  // running is having a bad week; three notifications about it is piling on.
  const claimed = new Set<string>();
  const attempted: Record<ScheduledNotificationKind, number> = {
    "session.abandoned": 0,
    "streak.atRisk": 0,
    "training.lapsed": 0,
  };

  const take = (userId: string, timezone: string | null, kind: ScheduledNotificationKind) => {
    if (claimed.has(userId)) return false;
    if (!isReasonableHour(now, timezone)) return false;
    claimed.add(userId);
    attempted[kind] += 1;
    return true;
  };

  for (const candidate of abandoned) {
    if (take(candidate.userId, candidate.timezone, "session.abandoned")) {
      await notify(candidate.userId, "session.abandoned", { label: candidate.label });
    }
  }

  for (const candidate of streaks) {
    if (take(candidate.userId, candidate.timezone, "streak.atRisk")) {
      await notify(candidate.userId, "streak.atRisk", { weeks: candidate.weeks });
    }
  }

  for (const candidate of lapsed) {
    if (take(candidate.userId, candidate.timezone, "training.lapsed")) {
      await notify(candidate.userId, "training.lapsed", {});
    }
  }

  // "attempted", not "sent": `notify()` still declines anything muted or already
  // sent today, and it deliberately reports nothing back. Overstating this in a
  // log is how you end up debugging the wrong end of a delivery problem.
  return Response.json({
    ok: true,
    at: now.toISOString(),
    considered: {
      abandoned: abandoned.length,
      streaks: streaks.length,
      lapsed: lapsed.length,
    },
    attempted,
  });
}
