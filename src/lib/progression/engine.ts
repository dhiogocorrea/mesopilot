import { formatWeight, roundToIncrement, smallestIncrementKg } from "../units";
import {
  JOINT_PAIN,
  PUMP,
  SORENESS,
  WORKLOAD,
  type CaloricState,
  type Experience,
  type MovementType,
  type PartialFeedback,
  type WeightUnit,
} from "../types";
import type { Reason } from "./reasons";

/**
 * Deterministic autoregulation, modelled on Renaissance Periodization.
 *
 * Two independent decisions are made after every completed exercise:
 *   1. how many SETS to prescribe next time  — driven by recovery feedback
 *   2. how much LOAD to prescribe next time  — driven by logged performance
 *
 * Everything here is a pure function so it can be unit tested and so the AI
 * layer can be handed the same inputs and asked to second-guess the output.
 */

// ------------------------------------------------------------------ RIR

/** The last week of a mesocycle is always a deload. */
export function isDeloadWeek(week: number, totalWeeks: number): boolean {
  return week >= totalWeeks;
}

export function trainingWeeks(totalWeeks: number): number {
  return Math.max(1, totalWeeks - 1);
}

/**
 * Reps-in-reserve target for a given week. Starts at `startRir` and ramps
 * linearly to 0 on the final training week, so effort climbs as the block
 * accumulates fatigue. Deload weeks sit well clear of failure.
 */
export function rirForWeek(week: number, totalWeeks: number, startRir: number): number {
  if (isDeloadWeek(week, totalWeeks)) return startRir + 1;

  const training = trainingWeeks(totalWeeks);
  if (training <= 1) return 0;

  const clampedWeek = Math.min(Math.max(week, 1), training);
  const ratio = (training - clampedWeek) / (training - 1);
  return Math.round(startRir * ratio);
}

export function startRirFor(experience: Experience): number {
  // Advanced lifters judge proximity to failure accurately and tolerate the
  // harder work; beginners need more margin because their RIR estimates drift.
  return experience === "advanced" ? 2 : 3;
}

// -------------------------------------------------------------- set math

export type VolumeLandmarks = {
  mev: number;
  mav: number;
  mrv: number;
};

export type RecoveryContext = {
  sleepQuality: number; // 1..5
  stressLevel: number; // 1..5
  nutritionQuality: number; // 1..5
  caloricState: CaloricState;
};

/** True when life outside the gym is not supporting extra volume right now. */
export function isRecoveryCompromised(ctx: RecoveryContext): boolean {
  return (
    ctx.sleepQuality <= 2 ||
    ctx.stressLevel >= 4 ||
    ctx.nutritionQuality <= 2 ||
    ctx.caloricState === "deficit"
  );
}

export type SetDecisionInput = {
  currentSets: number;
  feedback: PartialFeedback;
  /** Sets this muscle group is already getting across the whole week. */
  weeklyVolume: number;
  landmarks: VolumeLandmarks;
  recovery: RecoveryContext;
};

export type SetDecision = {
  sets: number;
  delta: number;
  reasons: Reason[];
  /** The exercise is hurting a joint and should be replaced. */
  suggestSwap: boolean;
  /** Weekly volume has hit the ceiling; the block should end. */
  suggestDeload: boolean;
};

const MAX_SETS_ADDED_PER_SESSION = 2;
export const MIN_SETS = 1;
export const MAX_SETS_PER_EXERCISE = 8;

/** The set change a *muscle* earned, before it is split across exercises. */
export type SetDelta = {
  delta: number;
  reasons: Reason[];
  suggestSwap: boolean;
  suggestDeload: boolean;
};

/**
 * How many sets this muscle group has earned, from its one feedback answer.
 *
 * Deliberately knows nothing about exercises. Feedback is per muscle, the
 * landmarks are per muscle, and the ceiling that matters — MRV — is a weekly
 * total for the muscle; asking this question once per *exercise* is what let
 * four back movements each independently decide there was room for one more
 * set. `allocate.ts` takes this number and decides who gets it.
 */
export function earnedSetDelta(input: Omit<SetDecisionInput, "currentSets">): SetDelta {
  const { feedback, weeklyVolume, landmarks, recovery } = input;
  const reasons: Reason[] = [];

  const hasFeedback =
    feedback.soreness !== undefined ||
    feedback.pump !== undefined ||
    feedback.workload !== undefined;

  if (!hasFeedback) {
    reasons.push({ code: "no_feedback" });
    return { delta: 0, reasons, suggestSwap: false, suggestDeload: false };
  }

  let score = 0;

  // Recovery signal: did the muscle bounce back before we hit it again?
  switch (feedback.soreness) {
    case SORENESS.NEVER_SORE:
      score += 1;
      reasons.push({ code: "recovered_fully" });
      break;
    case SORENESS.HEALED_A_WHILE_AGO:
      score += 1;
      reasons.push({ code: "recovered_fully" });
      break;
    case SORENESS.HEALED_JUST_ON_TIME:
      reasons.push({ code: "recovered_in_time" });
      break;
    case SORENESS.STILL_SORE:
      score -= 1;
      reasons.push({ code: "still_sore" });
      break;
  }

  // Stimulus signal: a poor pump means the muscle was under-stimulated.
  switch (feedback.pump) {
    case PUMP.LOW:
      score += 1;
      reasons.push({ code: "low_pump" });
      break;
    case PUMP.AMAZING:
      reasons.push({ code: "great_pump" });
      break;
  }

  // Fatigue signal: how much the session actually cost.
  switch (feedback.workload) {
    case WORKLOAD.EASY:
      score += 1;
      reasons.push({ code: "workload_easy" });
      break;
    case WORKLOAD.PUSHED_LIMITS:
      reasons.push({ code: "workload_high" });
      break;
    case WORKLOAD.TOO_MUCH:
      score -= 1;
      reasons.push({ code: "workload_too_much" });
      break;
  }

  let delta = Math.max(-1, Math.min(MAX_SETS_ADDED_PER_SESSION, score));
  let suggestSwap = false;

  // Joint pain is a safety brake and overrides the stimulus arithmetic.
  if (feedback.jointPain === JOINT_PAIN.A_LOT) {
    delta = Math.min(delta, -1);
    suggestSwap = true;
    reasons.push({ code: "joint_pain_high" });
  } else if (feedback.jointPain === JOINT_PAIN.SOME) {
    delta = Math.min(delta, 0);
    reasons.push({ code: "joint_pain_some" });
  }

  // Poor sleep/stress/nutrition means the extra sets will not be recovered.
  if (delta > 1 && isRecoveryCompromised(recovery)) {
    delta = 1;
    reasons.push({ code: "recovery_context_poor" });
  }

  // Finally, respect the weekly volume landmarks for the muscle group.
  const projectedWeekly = weeklyVolume + delta;
  let suggestDeload = false;

  if (delta > 0 && projectedWeekly > landmarks.mrv) {
    delta = Math.max(0, landmarks.mrv - weeklyVolume);
    suggestDeload = true;
    reasons.push({ code: "at_mrv" });
  } else if (delta > 1 && projectedWeekly > landmarks.mav) {
    delta = 1;
    reasons.push({ code: "approaching_mrv" });
  } else if (delta <= 0 && weeklyVolume < landmarks.mev && !suggestSwap) {
    // A bad week should never strand the muscle below its minimum effective
    // dose. Hold rather than cut; nudge up if we were only holding. Joint pain
    // is exempt — that cut is protective and stands.
    delta = delta < 0 ? 0 : 1;
    reasons.push({ code: "below_mev" });
  }

  return { delta, reasons, suggestSwap, suggestDeload };
}

/**
 * One exercise's set count, when it is the only thing training its muscle.
 *
 * Retained because that case is real — a muscle with a single movement in the
 * session — and because it is the shape the engine's tests describe. Anything
 * with several exercises on one muscle must go through `allocateSets` instead,
 * or each of them spends the same weekly budget over again.
 */
export function decideSets(input: SetDecisionInput): SetDecision {
  const { currentSets } = input;
  const { delta, reasons, suggestSwap, suggestDeload } = earnedSetDelta(input);

  const sets = clampSets(currentSets, delta);
  return { sets, delta: sets - currentSets, reasons, suggestSwap, suggestDeload };
}

/**
 * The per-exercise floor and ceiling. The ceiling stops volume climbing past
 * what is productive, but it must not force a cut on a program that
 * deliberately starts above it — 10x10 protocols progress by adding load, not
 * sets, so the ceiling yields to whatever the exercise already carries.
 */
export function clampSets(currentSets: number, delta: number): number {
  const ceiling = Math.max(MAX_SETS_PER_EXERCISE, currentSets);
  return Math.min(ceiling, Math.max(MIN_SETS, currentSets + delta));
}

/** Deloads cut volume roughly in half — enough to shed fatigue, not fitness. */
export function deloadSets(lastSets: number): number {
  return Math.max(MIN_SETS, Math.ceil(lastSets / 2));
}

// ------------------------------------------------------------- load math

export type PerformedSet = {
  weightKg: number;
  reps: number;
  rir: number;
};

export type LoadDecisionInput = {
  /** Working sets from the most recent time this exercise was performed. */
  lastSets: PerformedSet[];
  repMin: number;
  repMax: number;
  /** RIR the athlete is being asked for next session. */
  nextTargetRir: number;
  movementType: MovementType;
  /** Lower-body compounds move in bigger absolute jumps than arm isolation. */
  isLowerBody: boolean;
  unit: WeightUnit;
};

export type LoadDecision = {
  weightKg: number | null;
  deltaPct: number;
  reasons: Reason[];
};

const DELOAD_LOAD_FACTOR = 0.6;

function progressionPct(movementType: MovementType, isLowerBody: boolean): number {
  if (movementType === "isolation") return 0.025;
  return isLowerBody ? 0.05 : 0.03;
}

/**
 * Picks the reference set — the heaviest working set, since that is what the
 * athlete's capacity is actually anchored to. Ties break toward more reps.
 */
/** Loads in reasons are rendered for a human, so they carry their unit. */
function displayLoad(kg: number, unit: WeightUnit): string {
  return `${formatWeight(kg, unit)} ${unit}`;
}

function referenceSet(sets: PerformedSet[]): PerformedSet | null {
  const working = sets.filter((set) => set.reps > 0 && set.weightKg > 0);
  if (working.length === 0) return null;

  return working.reduce((best, set) => {
    if (set.weightKg > best.weightKg) return set;
    if (set.weightKg === best.weightKg && set.reps > best.reps) return set;
    return best;
  });
}

export function decideLoad(input: LoadDecisionInput): LoadDecision {
  const { lastSets, repMin, repMax, nextTargetRir, movementType, isLowerBody, unit } = input;

  const reference = referenceSet(lastSets);
  if (!reference) {
    return { weightKg: null, deltaPct: 0, reasons: [{ code: "no_history" }] };
  }

  // Dropping the RIR target buys roughly one rep per point of RIR, so project
  // what the athlete would manage at the same load under next week's target.
  const projectedReps = reference.reps + (reference.rir - nextTargetRir);

  const pct = progressionPct(movementType, isLowerBody);
  const step = smallestIncrementKg(unit);

  if (projectedReps > repMax) {
    const raw = reference.weightKg * (1 + pct);
    const weightKg = Math.max(
      reference.weightKg + step,
      roundToIncrement(raw, unit),
    );
    return {
      weightKg,
      deltaPct: (weightKg - reference.weightKg) / reference.weightKg,
      reasons: [
        {
          code: "load_increase",
          params: {
            from: displayLoad(reference.weightKg, unit),
            to: displayLoad(weightKg, unit),
          },
        },
      ],
    };
  }

  if (projectedReps < repMin) {
    const raw = reference.weightKg * (1 - pct);
    const weightKg = Math.max(step, Math.min(reference.weightKg - step, roundToIncrement(raw, unit)));
    return {
      weightKg,
      deltaPct: (weightKg - reference.weightKg) / reference.weightKg,
      reasons: [{ code: "load_decrease", params: { to: displayLoad(weightKg, unit) } }],
    };
  }

  return {
    weightKg: reference.weightKg,
    deltaPct: 0,
    reasons: [{ code: "load_hold", params: { to: displayLoad(reference.weightKg, unit) } }],
  };
}

export function deloadLoad(lastWeightKg: number | null, unit: WeightUnit): number | null {
  if (lastWeightKg === null) return null;
  return roundToIncrement(lastWeightKg * DELOAD_LOAD_FACTOR, unit);
}

// ------------------------------------------------------------- composite

export type PrescriptionInput = {
  week: number;
  totalWeeks: number;
  startRir: number;
  currentSets: number;
  repMin: number;
  repMax: number;
  feedback: PartialFeedback;
  lastSets: PerformedSet[];
  weeklyVolume: number;
  landmarks: VolumeLandmarks;
  recovery: RecoveryContext;
  movementType: MovementType;
  isLowerBody: boolean;
  unit: WeightUnit;
  /**
   * Set count already decided for this exercise by `allocateSets`, which sees
   * the whole session and can therefore honour the muscle's weekly ceiling and
   * the athlete's clock. Omit it only when this exercise is the sole movement
   * training its muscle; without it, sets are decided here in isolation.
   */
  allocation?: SetDelta & { sets: number };
};

export type Prescription = {
  sets: number;
  setDelta: number;
  targetRir: number;
  weightKg: number | null;
  loadDeltaPct: number;
  reasons: Reason[];
  suggestSwap: boolean;
  suggestDeload: boolean;
  isDeload: boolean;
};

/**
 * What to do next time for one exercise. `week` is the week being prescribed,
 * not the week just completed.
 */
export function prescribe(input: PrescriptionInput): Prescription {
  const targetRir = rirForWeek(input.week, input.totalWeeks, input.startRir);
  const deload = isDeloadWeek(input.week, input.totalWeeks);

  if (deload) {
    const reference = referenceSet(input.lastSets);
    return {
      sets: deloadSets(input.currentSets),
      setDelta: deloadSets(input.currentSets) - input.currentSets,
      targetRir,
      weightKg: deloadLoad(reference?.weightKg ?? null, input.unit),
      loadDeltaPct: -(1 - DELOAD_LOAD_FACTOR),
      reasons: [{ code: "deload_week" }],
      suggestSwap: false,
      suggestDeload: false,
      isDeload: true,
    };
  }

  const setDecision: SetDecision = input.allocation
    ? { ...input.allocation, delta: input.allocation.sets - input.currentSets }
    : decideSets({
        currentSets: input.currentSets,
        feedback: input.feedback,
        weeklyVolume: input.weeklyVolume,
        landmarks: input.landmarks,
        recovery: input.recovery,
      });

  const loadDecision = decideLoad({
    lastSets: input.lastSets,
    repMin: input.repMin,
    repMax: input.repMax,
    nextTargetRir: targetRir,
    movementType: input.movementType,
    isLowerBody: input.isLowerBody,
    unit: input.unit,
  });

  return {
    sets: setDecision.sets,
    setDelta: setDecision.delta,
    targetRir,
    weightKg: loadDecision.weightKg,
    loadDeltaPct: loadDecision.deltaPct,
    reasons: [...setDecision.reasons, ...loadDecision.reasons],
    suggestSwap: setDecision.suggestSwap,
    suggestDeload: setDecision.suggestDeload,
    isDeload: false,
  };
}
