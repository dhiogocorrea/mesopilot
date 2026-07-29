import "server-only";

import { db } from "@/lib/db";
import {
  ACHIEVEMENTS,
  achievementFor,
  localizedAchievement,
  type Achievement,
  type Tier,
} from "@/lib/achievements/catalogue";
import {
  currentStreakWeeks,
  evaluate,
  progressToward,
  type AthleteStats,
  type Award,
} from "@/lib/achievements/evaluate";
import type { Locale } from "@/lib/types";

/**
 * Wiring for the medal catalogue: gather the numbers, hand them to the pure
 * evaluator, write down whatever it says is new.
 *
 * Like the AI coach, this must never be able to lose logged work — it runs
 * after a session is already saved, and `awardAchievements` swallows its own
 * failures. A medal arriving late is a non-event; a session that failed to save
 * because a medal query timed out is not.
 */

export type UnlockedAchievement = {
  key: string;
  name: string;
  description: string;
  tier: Tier;
  points: number;
  value: number;
  unlockedAt: Date;
};

export type LockedAchievement = {
  key: string;
  name: string;
  description: string;
  tier: Tier;
  points: number;
  /** 0–1, how far the athlete is toward the threshold. */
  progress: number;
  current: number;
  threshold: number;
};

/** Every number the catalogue can be evaluated against, in one pass. */
export async function athleteStats(userId: string): Promise<AthleteStats> {
  const [sessions, blocks, tonnageKg, exercises, perfectBlocks] = await Promise.all([
    db.session.findMany({
      where: { status: "completed", mesocycle: { userId } },
      select: { completedAt: true },
    }),
    db.mesocycle.count({ where: { userId, status: "completed" } }),
    tonnageFor(userId),
    db.sessionExercise.findMany({
      where: { session: { status: "completed", mesocycle: { userId } } },
      select: { exerciseId: true },
      distinct: ["exerciseId"],
    }),
    perfectBlockCount(userId),
  ]);

  return {
    sessions: sessions.length,
    blocks,
    perfectBlocks,
    tonnageKg: Math.round(tonnageKg),
    streakWeeks: currentStreakWeeks(
      sessions
        .map((session) => session.completedAt)
        .filter((date): date is Date => date !== null),
    ),
    exercises: exercises.length,
  };
}

/**
 * Load × reps across every logged working set. Summed in the database rather
 * than by loading the sets: an athlete a year in has tens of thousands of them,
 * and this runs after every session.
 */
async function tonnageFor(userId: string): Promise<number> {
  const [row] = await db.$queryRaw<{ tonnage: number | null }[]>`
    select coalesce(sum(s."weightKg" * s."reps"), 0)::float8 as tonnage
    from "SetLog" s
    join "SessionExercise" se on se.id = s."sessionExerciseId"
    join "Session" ses on ses.id = se."sessionId"
    join "Mesocycle" m on m.id = ses."mesocycleId"
    where m."userId" = ${userId}
      and s.completed = true
      and s."isWarmup" = false
      and s."weightKg" is not null
      and s.reps is not null
  `;

  return row?.tonnage ?? 0;
}

/**
 * Completed blocks in which every generated session was finished. Counted from
 * the sessions rather than trusted from a flag, because a block can complete
 * with sessions skipped and that is exactly what this medal is about.
 */
async function perfectBlockCount(userId: string): Promise<number> {
  const blocks = await db.mesocycle.findMany({
    where: { userId, status: "completed" },
    select: { sessions: { select: { status: true } } },
  });

  return blocks.filter(
    (block) =>
      block.sessions.length > 0 &&
      block.sessions.every((session) => session.status === "completed"),
  ).length;
}

/**
 * Evaluates and persists. Returns only what was *newly* earned, so the caller
 * can show it — an empty array is the normal case.
 */
export async function awardAchievements(
  userId: string,
  locale: Locale,
): Promise<UnlockedAchievement[]> {
  try {
    const [stats, existing] = await Promise.all([
      athleteStats(userId),
      db.userAchievement.findMany({ where: { userId }, select: { key: true } }),
    ]);

    const earned = evaluate(stats, new Set(existing.map((row) => row.key)));
    if (earned.length === 0) return [];

    // `skipDuplicates` rather than a transaction: two sessions finished in
    // quick succession can both evaluate before either writes, and the unique
    // constraint on (userId, key) is the real guard.
    await db.userAchievement.createMany({
      data: earned.map((award: Award) => ({
        userId,
        key: award.key,
        points: award.points,
        value: award.value,
      })),
      skipDuplicates: true,
    });

    const now = new Date();
    return earned.flatMap((award) => {
      const achievement = achievementFor(award.key);
      return achievement ? [toUnlocked(achievement, award.value, now, locale)] : [];
    });
  } catch (error) {
    // Never let a medal cost someone their session.
    console.error("Achievement evaluation failed; training data is unaffected", error);
    return [];
  }
}

/**
 * Looks up specific medals the athlete genuinely holds.
 *
 * The session summary is told which keys to celebrate through the URL, so this
 * filters to what is actually in their collection — a hand-edited query string
 * then shows nothing rather than a medal nobody earned.
 */
export async function unlockedByKeys(
  userId: string,
  keys: readonly string[],
  locale: Locale,
): Promise<UnlockedAchievement[]> {
  if (keys.length === 0) return [];

  const rows = await db.userAchievement.findMany({
    where: { userId, key: { in: [...keys] } },
    orderBy: { unlockedAt: "asc" },
  });

  return rows.flatMap((row) => {
    const achievement = achievementFor(row.key);
    return achievement
      ? [toUnlocked(achievement, row.value, row.unlockedAt, locale, row.points)]
      : [];
  });
}

export type AchievementSummary = {
  points: number;
  unlocked: UnlockedAchievement[];
  locked: LockedAchievement[];
  stats: AthleteStats;
};

/** Everything the achievements screen needs, in one call. */
export async function achievementSummary(
  userId: string,
  locale: Locale,
): Promise<AchievementSummary> {
  const [rows, stats] = await Promise.all([
    db.userAchievement.findMany({ where: { userId }, orderBy: { unlockedAt: "desc" } }),
    athleteStats(userId),
  ]);

  const byKey = new Map(rows.map((row) => [row.key, row]));

  const unlocked = rows.flatMap((row) => {
    const achievement = achievementFor(row.key);
    return achievement
      ? [toUnlocked(achievement, row.value, row.unlockedAt, locale, row.points)]
      : [];
  });

  const locked = ACHIEVEMENTS.filter((achievement) => !byKey.has(achievement.key))
    .map((achievement) => {
      const text = localizedAchievement(achievement, locale);
      return {
        key: achievement.key,
        name: text.name,
        description: text.description,
        tier: achievement.tier,
        points: achievement.points,
        progress: progressToward(achievement, stats),
        current: stats[achievement.metric],
        threshold: achievement.threshold,
      };
    })
    // Closest to earning first: the useful order is "what could I get next".
    .sort((a, b) => b.progress - a.progress || a.threshold - b.threshold);

  return {
    // Summed from the rows, not the catalogue, so a re-priced medal never
    // changes a total someone already earned.
    points: rows.reduce((total, row) => total + row.points, 0),
    unlocked,
    locked,
    stats,
  };
}

function toUnlocked(
  achievement: Achievement,
  value: number,
  unlockedAt: Date,
  locale: Locale,
  points = achievement.points,
): UnlockedAchievement {
  const text = localizedAchievement(achievement, locale);
  return {
    key: achievement.key,
    name: text.name,
    description: text.description,
    tier: achievement.tier,
    points,
    value,
    unlockedAt,
  };
}
