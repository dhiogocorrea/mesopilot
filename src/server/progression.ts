import "server-only";

import { db } from "@/lib/db";
import { renderReasons } from "@/lib/progression/reasons";
import { isDeloadWeek, prescribe, type PerformedSet } from "@/lib/progression/engine";
import { isLowerBody } from "@/lib/muscles";
import type { MovementType, PartialFeedback, WeightUnit } from "@/lib/types";
import { getLandmarks } from "./user";

/**
 * Runs the progression engine over a completed session and writes the same day
 * of the following week. This is where the deterministic algorithm meets real
 * data; the AI layer refines the result afterwards but never replaces it.
 */

export type ProgressionSummary = {
  createdSessionId: string | null;
  blockCompleted: boolean;
  adjustments: {
    exerciseId: string;
    exerciseNameEn: string;
    exerciseNamePt: string;
    setDelta: number;
    sets: number;
    weightKg: number | null;
    loadDeltaPct: number;
    targetRir: number;
    reasonEn: string;
    reasonPt: string;
    suggestSwap: boolean;
    suggestDeload: boolean;
  }[];
};

export async function applyProgression(
  sessionId: string,
  unit: WeightUnit,
  recovery: {
    sleepQuality: number;
    stressLevel: number;
    nutritionQuality: number;
    caloricState: "deficit" | "maintenance" | "surplus";
  },
): Promise<ProgressionSummary> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      mesocycle: true,
      entries: {
        orderBy: { order: "asc" },
        include: {
          exercise: { include: { muscleGroup: true } },
          sets: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!session) throw new Error(`Session ${sessionId} not found`);

  const { mesocycle } = session;
  const nextWeek = session.week + 1;

  if (nextWeek > mesocycle.weeks) {
    await db.mesocycle.update({
      where: { id: mesocycle.id },
      data: { status: "completed", completedAt: new Date() },
    });
    return { createdSessionId: null, blockCompleted: true, adjustments: [] };
  }

  const [landmarks, weeklyVolume] = await Promise.all([
    getLandmarks(mesocycle.userId),
    weeklyVolumeByMuscle(mesocycle.id, session.week),
  ]);

  const adjustments: ProgressionSummary["adjustments"] = [];

  // The engine is pure, so every prescription is computed before the
  // transaction opens. What is left inside it is three bulk writes rather than
  // three round-trips per exercise — the difference between comfortably inside
  // Prisma's 5s transaction window and overrunning it on a hosted database.
  const prescriptions = session.entries.map((entry) => {
    const performed: PerformedSet[] = entry.sets
      .filter(
        (set) =>
          set.completed &&
          !set.isWarmup &&
          set.weightKg !== null &&
          set.reps !== null &&
          set.reps > 0,
      )
      .map((set) => ({
        weightKg: set.weightKg!,
        reps: set.reps!,
        rir: set.rir ?? entry.targetRir,
      }));

    const feedback: PartialFeedback = {
      soreness: entry.soreness as PartialFeedback["soreness"],
      pump: entry.pump as PartialFeedback["pump"],
      workload: entry.workload as PartialFeedback["workload"],
      jointPain: entry.jointPain as PartialFeedback["jointPain"],
    };

    const muscleLandmarks = landmarks.get(entry.muscleGroupId) ?? {
      mev: 8,
      mav: 16,
      mrv: 22,
    };

    const result = prescribe({
      week: nextWeek,
      totalWeeks: mesocycle.weeks,
      startRir: mesocycle.startRir,
      currentSets: entry.targetSets,
      repMin: entry.repMin,
      repMax: entry.repMax,
      feedback,
      lastSets: performed,
      weeklyVolume: weeklyVolume.get(entry.muscleGroupId) ?? entry.targetSets,
      landmarks: muscleLandmarks,
      recovery,
      movementType: entry.exercise.movementType as MovementType,
      isLowerBody: isLowerBody(entry.exercise.muscleGroup.key),
      unit,
    });

    return {
      entry,
      result,
      performed,
      feedback,
      muscleLandmarks,
      reasonEn: renderReasons(result.reasons, "en"),
      reasonPt: renderReasons(result.reasons, "pt"),
    };
  });

  for (const { entry, result, reasonEn, reasonPt } of prescriptions) {
    adjustments.push({
      exerciseId: entry.exerciseId,
      exerciseNameEn: entry.exercise.nameEn,
      exerciseNamePt: entry.exercise.namePt,
      setDelta: result.setDelta,
      sets: result.sets,
      weightKg: result.weightKg,
      loadDeltaPct: result.loadDeltaPct,
      targetRir: result.targetRir,
      reasonEn,
      reasonPt,
      suggestSwap: result.suggestSwap,
      suggestDeload: result.suggestDeload,
    });
  }

  const createdSessionId = await db.$transaction(async (tx) => {
    // Re-running a finish (double tap, retry after a network blip) must not
    // stack up duplicate weeks.
    const existing = await tx.session.findUnique({
      where: {
        mesocycleId_week_dayIndex: {
          mesocycleId: mesocycle.id,
          week: nextWeek,
          dayIndex: session.dayIndex,
        },
      },
    });
    if (existing) return existing.id;

    const nextSession = await tx.session.create({
      data: {
        mesocycleId: mesocycle.id,
        week: nextWeek,
        dayIndex: session.dayIndex,
        label: session.label,
        isDeload: isDeloadWeek(nextWeek, mesocycle.weeks),
      },
    });

    const nextEntries = await tx.sessionExercise.createManyAndReturn({
      data: prescriptions.map(({ entry, result }) => ({
        sessionId: nextSession.id,
        order: entry.order,
        exerciseId: entry.exerciseId,
        muscleGroupId: entry.muscleGroupId,
        targetSets: result.sets,
        repMin: entry.repMin,
        repMax: entry.repMax,
        targetRir: result.targetRir,
        restSec: entry.restSec,
      })),
      select: { id: true, order: true },
    });

    // Matched on `order`, which is unique per session, rather than on the
    // order rows happen to come back in.
    const entryIdByOrder = new Map(nextEntries.map((row) => [row.order, row.id]));

    // Pre-fill the prescribed load so the athlete opens the session with a
    // number to beat rather than a blank field.
    await tx.setLog.createMany({
      data: prescriptions.flatMap(({ entry, result }) =>
        Array.from({ length: result.sets }, (_, index) => ({
          sessionExerciseId: entryIdByOrder.get(entry.order)!,
          order: index,
          weightKg: result.weightKg,
        })),
      ),
    });

    await tx.progressionDecision.createMany({
      data: prescriptions.map(
        ({ entry, result, performed, feedback, muscleLandmarks, reasonEn, reasonPt }) => ({
          sessionExerciseId: entryIdByOrder.get(entry.order)!,
          sourceExerciseId: entry.id,
          source: "rule",
          setDelta: result.setDelta,
          loadDeltaPct: result.loadDeltaPct,
          targetRir: result.targetRir,
          reasonEn,
          reasonPt,
          payload: JSON.stringify({
            feedback,
            performed,
            weeklyVolume: weeklyVolume.get(entry.muscleGroupId) ?? null,
            landmarks: muscleLandmarks,
            suggestSwap: result.suggestSwap,
            suggestDeload: result.suggestDeload,
          }),
        }),
      ),
    });

    return nextSession.id;
  });

  return { createdSessionId, blockCompleted: false, adjustments };
}

/**
 * Prescribed sets per muscle group across one week of a block. This is the
 * number the MEV/MRV landmarks are defined against — a muscle's weekly dose,
 * not what any single session gave it.
 */
export async function weeklyVolumeByMuscle(
  mesocycleId: string,
  week: number,
): Promise<Map<string, number>> {
  const entries = await db.sessionExercise.findMany({
    where: { session: { mesocycleId, week } },
    select: { muscleGroupId: true, targetSets: true },
  });

  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.muscleGroupId, (totals.get(entry.muscleGroupId) ?? 0) + entry.targetSets);
  }
  return totals;
}
