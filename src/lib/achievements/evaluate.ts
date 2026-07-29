import { ACHIEVEMENTS, type Achievement, type Metric } from "./catalogue";

/**
 * Deciding which medals an athlete has earned. Pure, like the progression
 * engine: it takes numbers and returns awards, and knows nothing about Prisma.
 * That is what makes the thresholds testable without a database.
 */

export type AthleteStats = Record<Metric, number>;

export type Award = {
  key: string;
  points: number;
  /** The athlete's value for the metric at the moment it fired. */
  value: number;
};

/**
 * Everything newly earned, given what is already unlocked.
 *
 * Awards are not re-issued: `unlocked` is the guard, so this is safe to run
 * after every session. It deliberately awards *all* newly-cleared tiers rather
 * than just the next one — importing a training history, or a single enormous
 * session, can legitimately cross two at once, and silently dropping one would
 * leave a hole in the collection that nothing ever fills.
 */
export function evaluate(stats: AthleteStats, unlocked: ReadonlySet<string>): Award[] {
  const earned: Award[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked.has(achievement.key)) continue;

    const value = stats[achievement.metric];
    if (value >= achievement.threshold) {
      earned.push({ key: achievement.key, points: achievement.points, value });
    }
  }

  return earned;
}

/** How far along an athlete is, for the ones still locked. 0–1. */
export function progressToward(achievement: Achievement, stats: AthleteStats): number {
  if (achievement.threshold <= 0) return 1;
  return Math.min(1, stats[achievement.metric] / achievement.threshold);
}

/**
 * The longest run of consecutive calendar weeks containing a session, counting
 * back from the most recent one.
 *
 * Counting back from the *latest session* rather than from today means the
 * streak does not evaporate mid-week: someone who trained Monday and opens the
 * app on Sunday is still on their streak, and it only breaks once a whole week
 * passes with nothing in it. Weeks start Monday.
 */
export function currentStreakWeeks(sessionDates: readonly Date[]): number {
  if (sessionDates.length === 0) return 0;

  const weeks = new Set(sessionDates.map(weekIndex));
  const sorted = [...weeks].sort((a, b) => b - a);

  let streak = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i - 1]! - sorted[i]! !== 1) break;
    streak += 1;
  }

  return streak;
}

/** Whole weeks since the epoch, with weeks starting on Monday. */
function weekIndex(date: Date): number {
  const days = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000;
  // 1 Jan 1970 was a Thursday, so the Monday before the epoch is day -3.
  // Shifting by 3 lands every boundary on a Monday; shifting by 4 — the
  // tempting off-by-one — lands them on Sunday and splits a training week.
  return Math.floor((days + 3) / 7);
}
