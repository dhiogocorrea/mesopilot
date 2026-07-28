import type { Experience, Goal } from "./types";

/**
 * Scores a program against what the athlete said they can actually do.
 *
 * Two of the four factors are treated as hard constraints and the other two as
 * preferences, because they fail differently: a program you cannot fit into
 * your week or your lunch break simply will not get done, whereas one aimed at
 * a different goal or level is merely a worse fit than something else.
 */

export const EXPERIENCE_ORDER: Experience[] = ["beginner", "intermediate", "advanced"];

export type ProgramFacts = {
  daysPerWeek: number;
  estimatedMinutes: number;
  level: Experience;
  goal: Goal;
};

export type TrainingPreferences = {
  daysPerWeek: number;
  sessionMinutes: number;
  experience: Experience;
  goal: Goal;
};

export type MatchFactor = "days" | "time" | "level" | "goal";

export type ProgramMatch = {
  /** 0–100. Only meaningful for ranking, never shown as a number. */
  score: number;
  /** Meets both hard constraints: it fits the week and the session slot. */
  fits: boolean;
  matched: MatchFactor[];
  /** Program days minus available days. Positive means it asks for more. */
  dayDelta: number;
  /** Program minutes minus the session budget. Positive means it runs over. */
  minuteDelta: number;
};

/**
 * A few minutes over the stated budget is not worth excluding a program for —
 * nobody's session slot is precise to the minute.
 */
const TIME_TOLERANCE_MIN = 5;

const WEIGHT = { days: 40, time: 30, level: 20, goal: 10 } as const;

export function matchProgram(
  program: ProgramFacts,
  preferences: TrainingPreferences,
): ProgramMatch {
  const dayDelta = program.daysPerWeek - preferences.daysPerWeek;
  const minuteDelta = program.estimatedMinutes - preferences.sessionMinutes;

  const matched: MatchFactor[] = [];
  let score = 0;

  if (dayDelta === 0) {
    score += WEIGHT.days;
    matched.push("days");
  } else if (Math.abs(dayDelta) === 1) {
    score += WEIGHT.days / 2;
  }

  if (minuteDelta <= TIME_TOLERANCE_MIN) {
    score += WEIGHT.time;
    matched.push("time");
  } else if (minuteDelta <= 15) {
    score += WEIGHT.time / 2;
  }

  const levelGap = Math.abs(
    EXPERIENCE_ORDER.indexOf(program.level) - EXPERIENCE_ORDER.indexOf(preferences.experience),
  );
  if (levelGap === 0) {
    score += WEIGHT.level;
    matched.push("level");
  } else if (levelGap === 1) {
    score += WEIGHT.level / 2;
  }

  if (program.goal === preferences.goal) {
    score += WEIGHT.goal;
    matched.push("goal");
  }

  return {
    score,
    fits: dayDelta === 0 && minuteDelta <= TIME_TOLERANCE_MIN,
    matched,
    dayDelta,
    minuteDelta,
  };
}

/**
 * Ranks programs best-first. Ties break on the shorter session, then on name,
 * so the order is stable between renders rather than dependent on query order.
 */
export function rankPrograms<T extends { facts: ProgramFacts; name: string }>(
  programs: T[],
  preferences: TrainingPreferences,
): (T & { match: ProgramMatch })[] {
  return programs
    .map((program) => ({ ...program, match: matchProgram(program.facts, preferences) }))
    .sort((a, b) => {
      if (b.match.score !== a.match.score) return b.match.score - a.match.score;
      if (a.facts.estimatedMinutes !== b.facts.estimatedMinutes) {
        return a.facts.estimatedMinutes - b.facts.estimatedMinutes;
      }
      return a.name.localeCompare(b.name);
    });
}
