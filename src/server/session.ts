import "server-only";

import { db } from "@/lib/db";

/**
 * Scoped by owner, not just by id. The logger route is `/session/[id]`, so the
 * id is whatever the URL says — filtering on the mesocycle's user is what makes
 * a guessed id a 404 instead of a window into someone else's training.
 */
export async function getSessionDetail(sessionId: string, userId: string) {
  return db.session.findFirst({
    where: { id: sessionId, mesocycle: { userId } },
    include: {
      mesocycle: true,
      entries: {
        orderBy: { order: "asc" },
        include: {
          exercise: { include: { muscleGroup: true } },
          sets: { orderBy: { order: "asc" } },
          decisions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof getSessionDetail>>>;
export type SessionEntry = SessionDetail["entries"][number];

export type PreviousPerformance = {
  week: number;
  completedAt: Date | null;
  sets: { weightKg: number | null; reps: number | null; rir: number | null }[];
};

/**
 * What the athlete did the last time they performed each exercise in this
 * session, so the logger can show a number to beat. Keyed by exerciseId.
 */
export async function getPreviousPerformance(
  session: SessionDetail,
): Promise<Map<string, PreviousPerformance>> {
  const exerciseIds = session.entries.map((entry) => entry.exerciseId);
  if (exerciseIds.length === 0) return new Map();

  const priorEntries = await db.sessionExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      session: {
        mesocycleId: session.mesocycleId,
        status: "completed",
        // Strictly before this session in block order.
        OR: [
          { week: { lt: session.week } },
          { week: session.week, dayIndex: { lt: session.dayIndex } },
        ],
      },
    },
    orderBy: [{ session: { week: "desc" } }, { session: { dayIndex: "desc" } }],
    include: {
      session: { select: { week: true, completedAt: true } },
      sets: { orderBy: { order: "asc" } },
    },
  });

  const latest = new Map<string, PreviousPerformance>();
  for (const entry of priorEntries) {
    // Ordered newest-first, so the first hit per exercise is the one we want.
    if (latest.has(entry.exerciseId)) continue;

    const logged = entry.sets.filter((set) => set.completed && !set.isWarmup);
    if (logged.length === 0) continue;

    latest.set(entry.exerciseId, {
      week: entry.session.week,
      completedAt: entry.session.completedAt,
      sets: logged.map((set) => ({
        weightKg: set.weightKg,
        reps: set.reps,
        rir: set.rir,
      })),
    });
  }

  return latest;
}

/** Total kg moved in a session — a rough but honest measure of work done. */
export function sessionTonnage(session: SessionDetail): number {
  return session.entries.reduce((total, entry) => {
    return (
      total +
      entry.sets.reduce((sum, set) => {
        if (!set.completed || set.weightKg === null || set.reps === null) return sum;
        return sum + set.weightKg * set.reps;
      }, 0)
    );
  }, 0);
}

export function countLoggedSets(session: SessionDetail): number {
  return session.entries.reduce(
    (total, entry) => total + entry.sets.filter((set) => set.completed).length,
    0,
  );
}

/** An exercise needs feedback once its sets are done but the questions are not. */
export function needsFeedback(entry: SessionEntry): boolean {
  const hasLoggedSets = entry.sets.some((set) => set.completed);
  return hasLoggedSets && entry.workload === null;
}
