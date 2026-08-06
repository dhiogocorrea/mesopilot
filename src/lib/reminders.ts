import { currentStreakWeeks, weekIndex } from "./achievements/evaluate";
import { localDay, localWeekday } from "./time";

/**
 * Deciding who is worth interrupting.
 *
 * Pure and free of Prisma, like the progression engine and for the same reason:
 * "should this person get a notification at 9pm on a Saturday" is a question
 * with edge cases, and the only way to be sure about them is to be able to ask
 * without a database and without waiting for Saturday. `src/server/reminders.ts`
 * does the reading and hands the answers here.
 *
 * Every rule is written to *under*-send. A reminder that does not arrive is a
 * missed nudge; one that arrives wrongly — a streak warning to somebody who
 * trained this morning — is what gets notifications turned off for good.
 */

/**
 * Which training week a moment belongs to *for this athlete*.
 *
 * `weekIndex` reads UTC date parts, which is right for a medal awarded on a
 * server but wrong for deciding whether someone's week is running out: at 23:00
 * on Sunday in São Paulo it is already Monday in UTC, and the athlete would be
 * warned about a week that, where they are, has not started.
 */
function localWeekIndex(at: Date, timezone: string | null): number {
  return weekIndex(new Date(`${localDay(at, timezone)}T00:00:00Z`));
}

/** A workout left open this long is not "in progress", it is forgotten. */
const ABANDONED_AFTER_HOURS = 3;

/**
 * …but not one left open so long that finishing it is nonsense. Past this the
 * sets belong to a day that has gone; reopening it later is the honest path,
 * and a nudge would only invite logging Tuesday's work on Friday.
 */
const ABANDONED_UNTIL_HOURS = 30;

export function abandonedCutoffs(now: Date): { after: Date; until: Date } {
  return {
    after: new Date(now.getTime() - ABANDONED_AFTER_HOURS * 3_600_000),
    until: new Date(now.getTime() - ABANDONED_UNTIL_HOURS * 3_600_000),
  };
}

/** Friday. Earlier than this and there is still most of a week to use. */
const STREAK_WARNING_WEEKDAY = 5;

/** One week is not a streak, and telling someone it is cheapens the word. */
const STREAK_WORTH_KEEPING = 2;

/**
 * The streak this athlete is about to lose, or null if they are not at risk.
 *
 * At risk means all of: they have a streak worth the name, they have logged
 * nothing in the current week, and the week is nearly gone. Someone who trained
 * on Monday is safe; someone whose last session was two weeks ago has already
 * lost it and does not need telling.
 */
export function streakAtRisk(
  completedAt: readonly Date[],
  now: Date,
  timezone: string | null,
): number | null {
  if (completedAt.length === 0) return null;
  if (localWeekday(now, timezone) < STREAK_WARNING_WEEKDAY) return null;

  const thisWeek = localWeekIndex(now, timezone);
  const latest = Math.max(...completedAt.map((date) => localWeekIndex(date, timezone)));

  // Already trained this week, or the streak broke a while ago.
  if (latest !== thisWeek - 1) return null;

  const streak = currentStreakWeeks(
    // `currentStreakWeeks` reads UTC parts too, so it is given dates already
    // shifted into the athlete's zone rather than the raw instants.
    completedAt.map((date) => new Date(`${localDay(date, timezone)}T00:00:00Z`)),
  );

  return streak >= STREAK_WORTH_KEEPING ? streak : null;
}

/** Long enough to be a lull rather than a rest day, short enough to still care. */
const LAPSED_AFTER_DAYS = 10;

/**
 * True when there is no block running and nothing has been logged for a while.
 *
 * Both halves matter. Someone mid-block who took a week off is resting; someone
 * with no block *and* no recent session has quietly stopped, and that is the
 * only one of these worth a nudge that says "start something".
 */
export function hasLapsed(
  hasActiveBlock: boolean,
  lastCompletedAt: Date | null,
  accountCreatedAt: Date,
  now: Date,
): boolean {
  if (hasActiveBlock) return false;

  const since = lastCompletedAt ?? accountCreatedAt;
  return now.getTime() - since.getTime() >= LAPSED_AFTER_DAYS * 86_400_000;
}
