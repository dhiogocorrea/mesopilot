import { notFound } from "next/navigation";

import { SessionLogger, type SessionView } from "@/components/session/session-logger";
import { resolveDemo } from "@/lib/demo";
import { localized } from "@/lib/i18n";
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
        exerciseName,
        demo: resolveDemo(exerciseName, entry.exercise.demoUrl, locale),
        muscleName: localized(entry.exercise.muscleGroup, locale),
        targetSets: entry.targetSets,
        repMin: entry.repMin,
        repMax: entry.repMax,
        targetRir: entry.targetRir,
        restSec: entry.restSec,
        soreness: entry.soreness,
        pump: entry.pump,
        workload: entry.workload,
        jointPain: entry.jointPain,
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
  };

  return <SessionLogger session={view} />;
}
