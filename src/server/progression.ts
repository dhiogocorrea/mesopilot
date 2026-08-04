import "server-only";

import { db } from "@/lib/db";
import { renderReasons } from "@/lib/progression/reasons";
import { allocateSets, type AllocatableExercise } from "@/lib/progression/allocate";
import {
  isDeloadWeek,
  prescribe,
  rirForWeek,
  type PerformedSet,
  type Prescription,
} from "@/lib/progression/engine";
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

/**
 * A muscle nobody rated. Left empty rather than filled with mild values: the
 * engine treats an absent field as "no signal" and falls back to the RIR ramp,
 * which is what should happen when the question went unanswered.
 */
const UNANSWERED: PartialFeedback = {};

export async function applyProgression(
  sessionId: string,
  unit: WeightUnit,
  recovery: {
    sleepQuality: number;
    stressLevel: number;
    nutritionQuality: number;
    caloricState: "deficit" | "maintenance" | "surplus";
  },
  /** What the athlete said they have per session. Bounds volume growth. */
  sessionMinutes: number,
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
      feedback: true,
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

  // Feedback is answered once per muscle group, so every exercise that trains a
  // muscle is prescribed from that muscle's one answer. Two chest movements
  // reading the same recovery is the point: they compete for the same budget.
  const feedbackByMuscle = new Map<string, PartialFeedback>(
    session.feedback.map((row) => [
      row.muscleGroupId,
      {
        soreness: row.soreness as PartialFeedback["soreness"],
        pump: row.pump as PartialFeedback["pump"],
        workload: row.workload as PartialFeedback["workload"],
        jointPain: row.jointPain as PartialFeedback["jointPain"],
      },
    ]),
  );

  // The engine is pure, so every prescription is computed before the
  // transaction opens. What is left inside it is three bulk writes rather than
  // three round-trips per exercise — the difference between comfortably inside
  // Prisma's 5s transaction window and overrunning it on a hosted database.
  // An exercise added for today only stops here — the plan never had it, so the
  // week generated from this one does not inherit it.
  const carried = session.entries.filter((entry) => entry.plan !== "extra");

  /**
   * Sets are decided for the whole session at once, not exercise by exercise.
   * A muscle earns volume from its one feedback answer, and that has to be
   * split across however many movements trained it — asking each of them
   * separately spent the same weekly budget over and over, and the ceiling that
   * was supposed to hold at MRV did not. The allocator also prices the session
   * against the clock, so growth stops at the time the athlete actually has.
   *
   * Deload weeks skip it: the prescription there is "halve everything", which
   * has nothing to negotiate.
   */
  const allocation = isDeloadWeek(nextWeek, mesocycle.weeks)
    ? null
    : allocateSets({
        exercises: carried.map(
          (entry): AllocatableExercise => ({
            key: entry.id,
            muscleGroupId: entry.muscleGroupId,
            currentSets: entry.targetSets,
            restSec: entry.restSec,
            sfr: entry.exercise.sfr,
            frozen: entry.plan === "skipped",
          }),
        ),
        muscles: [...new Set(carried.map((entry) => entry.muscleGroupId))].map(
          (muscleGroupId) => ({
            muscleGroupId,
            weeklyVolume: weeklyVolume.get(muscleGroupId) ?? 0,
            landmarks: landmarks.get(muscleGroupId) ?? { mev: 8, mav: 16, mrv: 22 },
            feedback: feedbackByMuscle.get(muscleGroupId) ?? UNANSWERED,
          }),
        ),
        recovery,
        budgetMinutes: sessionMinutes,
      });

  const prescriptions = carried.map((entry) => {
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

    const feedback = feedbackByMuscle.get(entry.muscleGroupId) ?? UNANSWERED;

    const muscleLandmarks = landmarks.get(entry.muscleGroupId) ?? {
      mev: 8,
      mav: 16,
      mrv: 22,
    };

    // A skipped exercise is not evidence. Running the engine on it would read
    // an untouched slot as a session that produced nothing and cut its sets on
    // the strength of work that was never attempted — so it comes back exactly
    // as it was, at the new week's effort target.
    if (entry.plan === "skipped") {
      const result: Prescription = {
        sets: entry.targetSets,
        setDelta: 0,
        targetRir: rirForWeek(nextWeek, mesocycle.weeks, mesocycle.startRir),
        weightKg: null,
        loadDeltaPct: 0,
        reasons: [{ code: "skipped_last_week" }],
        suggestSwap: false,
        suggestDeload: false,
        isDeload: isDeloadWeek(nextWeek, mesocycle.weeks),
      };

      return {
        entry,
        result,
        performed,
        feedback,
        muscleLandmarks,
        reasonEn: renderReasons(result.reasons, "en"),
        reasonPt: renderReasons(result.reasons, "pt"),
      };
    }

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
      allocation: allocation?.byKey.get(entry.id),
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
        // A movement substituted for one day only leaves the plan as it was;
        // `plan` and `plannedExerciseId` are deliberately not copied, so next
        // week starts clean whatever happened in this one.
        exerciseId: entry.plannedExerciseId ?? entry.exerciseId,
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
    // A skipped exercise prescribes nothing: the muscle does not receive those
    // sets, and this number is what the landmarks are compared against.
    where: { session: { mesocycleId, week }, plan: { not: "skipped" } },
    select: { muscleGroupId: true, targetSets: true },
  });

  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.muscleGroupId, (totals.get(entry.muscleGroupId) ?? 0) + entry.targetSets);
  }
  return totals;
}
