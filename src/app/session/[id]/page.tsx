import { notFound } from "next/navigation";

import { SessionLogger, type SessionView } from "@/components/session/session-logger";
import { db } from "@/lib/db";
import { resolveDemo } from "@/lib/demo";
import { localized } from "@/lib/i18n";
import type { EntryPlan } from "@/lib/types";
import { getPreviousPerformance, getSessionDetail } from "@/server/session";
import { getUserContext } from "@/server/user";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, locale } = await getUserContext();
  const session = await getSessionDetail(id, userId);

  if (!session) notFound();

  const previous = await getPreviousPerformance(session);

  // The whole catalogue travels with the page. Swapping a movement happens
  // when a rack is taken, which is exactly when gym wifi is worst — a picker
  // that needs a round-trip to show its options is a picker that spins.
  const catalogue = await db.exercise.findMany({
    where: { archived: false, OR: [{ isCustom: false }, { userId }] },
    include: { muscleGroup: true },
  });

  const collator = new Intl.Collator(locale === "pt" ? "pt-BR" : "en", { sensitivity: "base" });

  // Everything crossing into the client is flattened to plain values —
  // Prisma records carry Decimal/Date instances and relations the logger
  // has no use for.
  const view: SessionView = {
    id: session.id,
    label: session.label,
    week: session.week,
    totalWeeks: session.mesocycle.weeks,
    dayIndex: session.dayIndex,
    isDeload: session.isDeload,
    status: session.status as SessionView["status"],
    notes: session.notes ?? "",
    entries: session.entries.map((entry) => {
      const prior = previous.get(entry.exerciseId) ?? null;
      const decision = entry.decisions[0];
      const exerciseName = localized(entry.exercise, locale);

      return {
        id: entry.id,
        plan: entry.plan as EntryPlan,
        exerciseName,
        // Named so the row can say what it is standing in for rather than
        // just that something was swapped.
        plannedExerciseName: entry.plannedExercise
          ? localized(entry.plannedExercise, locale)
          : null,
        demo: resolveDemo(exerciseName, entry.exercise.demoUrl, locale),
        muscleGroupId: entry.muscleGroupId,
        muscleName: localized(entry.exercise.muscleGroup, locale),
        targetSets: entry.targetSets,
        repMin: entry.repMin,
        repMax: entry.repMax,
        targetRir: entry.targetRir,
        restSec: entry.restSec,
        aiNote: entry.aiNote,
        reason: decision ? (locale === "pt" ? decision.reasonPt : decision.reasonEn) : null,
        setDelta: decision?.setDelta ?? 0,
        sets: entry.sets.map((set) => ({
          id: set.id,
          order: set.order,
          weightKg: set.weightKg,
          reps: set.reps,
          rir: set.rir,
          completed: set.completed,
        })),
        previous: prior
          ? {
              week: prior.week,
              sets: prior.sets.map((set) => ({
                weightKg: set.weightKg,
                reps: set.reps,
                rir: set.rir,
              })),
            }
          : null,
      };
    }),
    catalogue: catalogue
      .map((exercise) => ({
        id: exercise.id,
        name: localized(exercise, locale),
        muscleGroupId: exercise.muscleGroupId,
        muscleName: localized(exercise.muscleGroup, locale),
      }))
      .sort((a, b) => collator.compare(a.name, b.name)),
    feedback: session.feedback.map((row) => ({
      muscleGroupId: row.muscleGroupId,
      soreness: row.soreness,
      pump: row.pump,
      workload: row.workload,
      jointPain: row.jointPain,
    })),
  };

  return <SessionLogger session={view} />;
}
