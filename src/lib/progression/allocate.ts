import { estimateSessionMinutes } from "../training-time";
import type { PartialFeedback } from "../types";
import {
  clampSets,
  earnedSetDelta,
  MIN_SETS,
  type RecoveryContext,
  type VolumeLandmarks,
} from "./engine";
import type { Reason } from "./reasons";

/**
 * Who gets the sets a muscle earned.
 *
 * The engine decides how much volume a *muscle* has earned from its one
 * feedback answer. That number then has to be split across however many
 * exercises trained it, and the split is what this file is for. Doing it per
 * exercise instead — asking "should this movement get another set?" four times
 * with the same weekly figure — let each one independently conclude there was
 * room, and a muscle at 20 of its 22-set ceiling walked away with 25.
 *
 * Three bounds apply, and the athlete is told which one bound them:
 *
 *   - **recovery** — MRV, already enforced by `earnedSetDelta`
 *   - **time** — what is left of the session they said they had
 *   - **per exercise** — a movement does not absorb a whole muscle's growth
 *
 * Sets are handed out by stimulus-to-fatigue ratio, highest first, and taken
 * back lowest first. That is what `Exercise.sfr` has always been for.
 */

export type AllocatableExercise = {
  /** Opaque handle back to the caller's row. */
  key: string;
  muscleGroupId: string;
  currentSets: number;
  restSec: number;
  /** Stimulus-to-fatigue ratio, 1..5. Higher is a better set to spend. */
  sfr: number;
  /**
   * Carried over untouched — a skipped entry. It still costs time, because it
   * is still in the session, but it neither earns nor surrenders sets.
   */
  frozen?: boolean;
};

export type MuscleContext = {
  muscleGroupId: string;
  /** Sets this muscle already gets across the whole week, before any change. */
  weeklyVolume: number;
  landmarks: VolumeLandmarks;
  feedback: PartialFeedback;
};

export type AllocationInput = {
  exercises: AllocatableExercise[];
  muscles: MuscleContext[];
  recovery: RecoveryContext;
  /** The athlete's declared session budget. 0 or less means unbounded. */
  budgetMinutes: number;
};

export type AllocatedExercise = {
  key: string;
  sets: number;
  delta: number;
  reasons: Reason[];
  suggestSwap: boolean;
  /** This exercise's *muscle* is at MRV — carried per row, not per session. */
  suggestDeload: boolean;
};

export type Allocation = {
  byKey: Map<string, AllocatedExercise>;
  /** Any muscle hit MRV — the block should deload. */
  suggestDeload: boolean;
  /** What the session will now take, at the allocated set counts. */
  estimatedMinutes: number;
  /** Sets the clock refused that recovery would have allowed. */
  setsWithheldForTime: number;
};

/**
 * Highest stimulus-to-fatigue first. Ties go to the exercise carrying fewer
 * sets, which spreads a muscle's growth rather than piling it onto one
 * movement, then to the key so the result never depends on row order.
 */
function byGrowthPriority(a: AllocatableExercise, b: AllocatableExercise): number {
  if (a.sfr !== b.sfr) return b.sfr - a.sfr;
  if (a.currentSets !== b.currentSets) return a.currentSets - b.currentSets;
  return a.key.localeCompare(b.key);
}

function sessionMinutes(
  exercises: AllocatableExercise[],
  sets: Map<string, number>,
): number {
  return estimateSessionMinutes(
    exercises.map((exercise) => ({
      sets: sets.get(exercise.key) ?? exercise.currentSets,
      restSec: exercise.restSec,
    })),
  );
}

export function allocateSets(input: AllocationInput): Allocation {
  const { exercises, muscles, recovery, budgetMinutes } = input;

  const sets = new Map(exercises.map((exercise) => [exercise.key, exercise.currentSets]));
  const reasons = new Map<string, Reason[]>(exercises.map((exercise) => [exercise.key, []]));
  const swaps = new Set<string>();
  const deloads = new Set<string>();
  let suggestDeload = false;

  // Which exercises this session gave to each muscle. A muscle the athlete
  // trained on another day is not this session's to adjust.
  const movable = exercises.filter((exercise) => !exercise.frozen);

  for (const muscle of muscles) {
    const mine = movable
      .filter((exercise) => exercise.muscleGroupId === muscle.muscleGroupId)
      .sort(byGrowthPriority);
    if (mine.length === 0) continue;

    const earned = earnedSetDelta({
      feedback: muscle.feedback,
      weeklyVolume: muscle.weeklyVolume,
      landmarks: muscle.landmarks,
      recovery,
    });

    suggestDeload ||= earned.suggestDeload;

    // The muscle's story is the same for every movement that trained it —
    // feedback was answered once, about the muscle.
    for (const exercise of mine) {
      reasons.get(exercise.key)!.push(...earned.reasons);
      if (earned.suggestSwap) swaps.add(exercise.key);
      if (earned.suggestDeload) deloads.add(exercise.key);
    }

    if (earned.delta > 0) grow(mine, sets, earned.delta);
    else if (earned.delta < 0) shrink(mine, sets, -earned.delta);
  }

  // ------------------------------------------------------------ the clock
  //
  // Time never cuts into what the athlete was already doing — a session that
  // was over budget in week 1 is the program they chose, and shortening it
  // here would be a silent edit rather than a constraint. It only refuses
  // *growth*, which is the thing that would have crept past the hour.
  let withheld = 0;
  if (budgetMinutes > 0) {
    const grown = () =>
      movable
        .filter((exercise) => (sets.get(exercise.key) ?? 0) > exercise.currentSets)
        // Give back in the reverse of the order it was handed out.
        .sort((a, b) => byGrowthPriority(b, a));

    while (sessionMinutes(exercises, sets) > budgetMinutes) {
      const candidates = grown();
      if (candidates.length === 0) break;

      const giveBack = candidates[0]!;
      sets.set(giveBack.key, sets.get(giveBack.key)! - 1);
      withheld += 1;

      const list = reasons.get(giveBack.key)!;
      if (!list.some((reason) => reason.code === "time_capped")) {
        list.push({ code: "time_capped", params: { minutes: budgetMinutes } });
      }
    }
  }

  const byKey = new Map<string, AllocatedExercise>();
  for (const exercise of exercises) {
    const final = sets.get(exercise.key)!;
    const delta = final - exercise.currentSets;
    const list = reasons.get(exercise.key)!;

    // A muscle that earned volume, on a movement that did not receive any:
    // without this the row explains why there is room for more while showing
    // the same number as last week.
    if (
      delta === 0 &&
      !exercise.frozen &&
      !list.some((reason) => reason.code === "time_capped") &&
      list.some((reason) => reason.code === "recovered_fully" || reason.code === "low_pump") &&
      muscleGrew(exercise, exercises, sets)
    ) {
      list.push({ code: "volume_went_elsewhere" });
    }

    byKey.set(exercise.key, {
      key: exercise.key,
      sets: final,
      delta,
      reasons: list,
      suggestSwap: swaps.has(exercise.key),
      suggestDeload: deloads.has(exercise.key),
    });
  }

  return {
    byKey,
    suggestDeload,
    estimatedMinutes: sessionMinutes(exercises, sets),
    setsWithheldForTime: withheld,
  };
}

/** Did any *other* movement on this muscle gain a set this week? */
function muscleGrew(
  exercise: AllocatableExercise,
  all: AllocatableExercise[],
  sets: Map<string, number>,
): boolean {
  return all.some(
    (other) =>
      other.key !== exercise.key &&
      other.muscleGroupId === exercise.muscleGroupId &&
      (sets.get(other.key) ?? 0) > other.currentSets,
  );
}

/**
 * Hands out `amount` sets one at a time, best movement first and wrapping
 * around. One pass per set rather than dumping the muscle's whole allowance on
 * its top lift — five sets of one row is not what "add volume to back" means.
 */
function grow(ordered: AllocatableExercise[], sets: Map<string, number>, amount: number): void {
  let remaining = amount;

  while (remaining > 0) {
    let placed = false;

    for (const exercise of ordered) {
      if (remaining === 0) break;

      const current = sets.get(exercise.key)!;
      const next = clampSets(current, 1);
      if (next === current) continue; // at its own ceiling

      sets.set(exercise.key, next);
      remaining -= 1;
      placed = true;
    }

    // Every movement is capped; the muscle cannot absorb the rest.
    if (!placed) break;
  }
}

/** Takes sets back worst-movement-first, never below the floor. */
function shrink(ordered: AllocatableExercise[], sets: Map<string, number>, amount: number): void {
  let remaining = amount;
  const worstFirst = [...ordered].reverse();

  while (remaining > 0) {
    let removed = false;

    for (const exercise of worstFirst) {
      if (remaining === 0) break;

      const current = sets.get(exercise.key)!;
      if (current <= MIN_SETS) continue;

      sets.set(exercise.key, current - 1);
      remaining -= 1;
      removed = true;
    }

    if (!removed) break;
  }
}
