import "server-only";

import { db } from "@/lib/db";
import { abandonedCutoffs, hasLapsed, streakAtRisk } from "@/lib/reminders";

/**
 * Finding everyone who is due a scheduled reminder.
 *
 * Reads only. The rules themselves are in `src/lib/reminders.ts`, pure and
 * tested; this file's whole job is to hand them the right rows and stay cheap
 * doing it — the database is on another continent, so this is two queries, not
 * two per athlete.
 *
 * Only athletes with a registered device are considered at all. There is no
 * point computing a reminder with nowhere to go, and it keeps the work bounded
 * by the number of people who opted in rather than by the size of the table.
 */

export type Candidate = {
  userId: string;
  timezone: string | null;
};

export type AbandonedCandidate = Candidate & { label: string };
export type StreakCandidate = Candidate & { weeks: number };

/**
 * How far back the streak window reaches. A streak longer than this is reported
 * short, which is a cosmetic loss inside one message; loading every session an
 * athlete has ever logged, on every cron tick, is not.
 */
const STREAK_HISTORY_WEEKS = 26;

export async function findReminderCandidates(now: Date): Promise<{
  abandoned: AbandonedCandidate[];
  streaks: StreakCandidate[];
  lapsed: Candidate[];
}> {
  const { after, until } = abandonedCutoffs(now);

  const [openSessions, athletes] = await Promise.all([
    db.session.findMany({
      where: {
        status: "in_progress",
        startedAt: { lt: after, gt: until },
        mesocycle: { user: { pushDevices: { some: {} } } },
      },
      select: {
        label: true,
        mesocycle: { select: { userId: true, user: { select: { timezone: true } } } },
      },
    }),

    db.user.findMany({
      where: { pushDevices: { some: {} } },
      select: {
        id: true,
        timezone: true,
        createdAt: true,
        mesocycles: {
          select: {
            status: true,
            sessions: {
              where: {
                status: "completed",
                completedAt: {
                  gte: new Date(now.getTime() - STREAK_HISTORY_WEEKS * 7 * 86_400_000),
                },
              },
              select: { completedAt: true },
            },
          },
        },
      },
    }),
  ]);

  const abandoned = openSessions.map((session) => ({
    userId: session.mesocycle.userId,
    timezone: session.mesocycle.user.timezone,
    label: session.label,
  }));

  const streaks: StreakCandidate[] = [];
  const lapsed: Candidate[] = [];

  for (const athlete of athletes) {
    const completed = athlete.mesocycles
      .flatMap((mesocycle) => mesocycle.sessions)
      .map((session) => session.completedAt)
      .filter((date): date is Date => date !== null);

    const weeks = streakAtRisk(completed, now, athlete.timezone);
    if (weeks !== null) {
      streaks.push({ userId: athlete.id, timezone: athlete.timezone, weeks });
    }

    const hasActive = athlete.mesocycles.some((mesocycle) => mesocycle.status === "active");
    const latest = completed.reduce<Date | null>(
      (newest, date) => (newest === null || date > newest ? date : newest),
      null,
    );

    if (hasLapsed(hasActive, latest, athlete.createdAt, now)) {
      lapsed.push({ userId: athlete.id, timezone: athlete.timezone });
    }
  }

  return { abandoned, streaks, lapsed };
}
