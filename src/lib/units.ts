import type { WeightUnit } from "./types";

const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Storage is always kg; this converts for display. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : kgToLb(kg);
}

/** Converts a user-entered number in their preferred unit back to storage kg. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : lbToKg(value);
}

/**
 * Smallest jump you can actually make on the equipment. Barbells move in pairs
 * of plates so the bar increment is double the smallest plate; dumbbells and
 * stacks step in their own fixed sizes.
 */
export function smallestIncrementKg(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : lbToKg(5);
}

/** Rounds a computed target load onto something you can actually load. */
export function roundToIncrement(kg: number, unit: WeightUnit): number {
  const step = smallestIncrementKg(unit);
  return Math.round(kg / step) * step;
}

/** 60 -> "60", 62.5 -> "62.5", null -> "—". */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg === null || kg === undefined) return "—";
  const rounded = Math.round(fromKg(kg, unit) * 100) / 100;
  return String(rounded);
}

/** Epley one-rep max, used to compare sets done at different loads and reps. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * Stimulative reps in a set. Only the last ~5 reps before failure drive
 * hypertrophy, so a set taken to 3 RIR contributes 2 of them regardless of how
 * many total reps were performed. Lets the engine compare sets across loads.
 */
const STIMULATIVE_WINDOW = 5;

export function effectiveReps(reps: number, rir: number): number {
  return Math.max(0, Math.min(reps, STIMULATIVE_WINDOW - rir));
}
