/**
 * How long a session actually takes. Rest between sets dominates — a 3-minute
 * rest on a heavy compound costs four times what a 45-second rest on lateral
 * raises does — so the estimate is built from the prescribed rest rather than
 * from an exercise count.
 */

/** Time under load plus unracking, setup and getting into position. */
const SET_WORK_SEC = 45;

/** Warm-up sets and general preparation, amortised across the session. */
const WARMUP_SEC = 300;

export type TimedSlot = { sets: number; restSec: number };

export function estimateSessionSeconds(slots: TimedSlot[]): number {
  if (slots.length === 0) return 0;
  return (
    WARMUP_SEC +
    slots.reduce((total, slot) => total + slot.sets * (slot.restSec + SET_WORK_SEC), 0)
  );
}

export function estimateSessionMinutes(slots: TimedSlot[]): number {
  return Math.round(estimateSessionSeconds(slots) / 60);
}

/**
 * A program's headline duration: the average across its training days, rounded
 * to 5 minutes because anything finer is false precision.
 */
export function estimateProgramMinutes(days: TimedSlot[][]): number {
  const withSlots = days.filter((day) => day.length > 0);
  if (withSlots.length === 0) return 0;

  const total = withSlots.reduce((sum, day) => sum + estimateSessionMinutes(day), 0);
  return Math.round(total / withSlots.length / 5) * 5;
}
