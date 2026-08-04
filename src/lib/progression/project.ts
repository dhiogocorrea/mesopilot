import { estimateSessionMinutes } from "../training-time";
import { JOINT_PAIN, PUMP, SORENESS, WORKLOAD, type PartialFeedback } from "../types";
import { allocateSets, type AllocatableExercise } from "./allocate";
import { deloadSets, isDeloadWeek, type RecoveryContext, type VolumeLandmarks } from "./engine";

/**
 * How long a program's sessions run — at the start, and at their longest.
 *
 * `ProgramTemplate.estimatedMinutes` is computed from the template's *starting*
 * sets, so it describes week 1 and nothing else. The engine then adds volume
 * every week, which means the picker was advertising the shortest a program
 * would ever be and matching the athlete's time budget against that. A program
 * that opens at 37 minutes and peaks at 68 read as a comfortable fit for an
 * hour, right up until week 3.
 *
 * The peak is projected by running the real allocator forward under the most
 * volume-hungry feedback the athlete could give. It is a ceiling, not a
 * forecast: answer anything less enthusiastic and the block stays shorter.
 */

const DEFAULT_LANDMARKS: VolumeLandmarks = { mev: 8, mav: 16, mrv: 22 };

/** Nothing outside the gym holding volume back — this is the upper bound. */
const UNLIMITED_RECOVERY: RecoveryContext = {
  sleepQuality: 5,
  stressLevel: 1,
  nutritionQuality: 5,
  caloricState: "maintenance",
};

const WANTS_MORE: PartialFeedback = {
  soreness: SORENESS.NEVER_SORE,
  pump: PUMP.LOW,
  workload: WORKLOAD.EASY,
  jointPain: JOINT_PAIN.NONE,
};

export type ProjectedSlot = {
  muscleGroupId: string;
  sets: number;
  restSec: number;
  sfr: number;
};

export type MinuteRange = {
  /** Week one, as the program is written. */
  min: number;
  /** The longest a session gets before the deload. */
  peak: number;
};

function averageMinutes(days: ProjectedSlot[][]): number {
  const withSlots = days.filter((day) => day.length > 0);
  if (withSlots.length === 0) return 0;

  const total = withSlots.reduce(
    (sum, day) => sum + estimateSessionMinutes(day.map((s) => ({ sets: s.sets, restSec: s.restSec }))),
    0,
  );
  return Math.round(total / withSlots.length / 5) * 5;
}

export function projectMinuteRange(days: ProjectedSlot[][], totalWeeks = 5): MinuteRange {
  const min = averageMinutes(days);
  let current = days.map((day) => day.map((slot) => ({ ...slot })));
  let peak = min;

  for (let week = 1; week < totalWeeks; week++) {
    if (isDeloadWeek(week + 1, totalWeeks)) {
      current = current.map((day) => day.map((s) => ({ ...s, sets: deloadSets(s.sets) })));
      continue;
    }

    // Weekly volume spans the whole rotation, so it is summed across days
    // before any single day is allowed to grow.
    const weekly = new Map<string, number>();
    for (const day of current) {
      for (const slot of day) {
        weekly.set(slot.muscleGroupId, (weekly.get(slot.muscleGroupId) ?? 0) + slot.sets);
      }
    }

    current = current.map((day) => {
      if (day.length === 0) return day;

      const exercises: AllocatableExercise[] = day.map((slot, index) => ({
        key: String(index),
        muscleGroupId: slot.muscleGroupId,
        currentSets: slot.sets,
        restSec: slot.restSec,
        sfr: slot.sfr,
      }));

      const allocation = allocateSets({
        exercises,
        muscles: [...new Set(day.map((s) => s.muscleGroupId))].map((muscleGroupId) => ({
          muscleGroupId,
          weeklyVolume: weekly.get(muscleGroupId) ?? 0,
          landmarks: DEFAULT_LANDMARKS,
          feedback: WANTS_MORE,
        })),
        recovery: UNLIMITED_RECOVERY,
        // Unbounded on purpose: this is what the program *wants* to become, and
        // it is the number the athlete's budget is then compared against.
        budgetMinutes: 0,
      });

      return day.map((slot, index) => ({
        ...slot,
        sets: allocation.byKey.get(String(index))!.sets,
      }));
    });

    peak = Math.max(peak, averageMinutes(current));
  }

  return { min, peak };
}
