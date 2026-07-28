import "server-only";

import { db } from "@/lib/db";
import { isDeloadWeek, rirForWeek, startRirFor } from "@/lib/progression/engine";
import type { Experience } from "@/lib/types";

/**
 * A mesocycle is generated one week at a time. Week 1 is laid down when the
 * block is created; every later week is written by the progression engine as
 * the week before it is completed, because next week's prescription depends on
 * feedback that does not exist yet.
 */

export type CreateMesocycleInput = {
  userId: string;
  templateId: string;
  name?: string;
  weeks?: number;
  experience?: Experience;
  /** Set when this block is one step of a track (see src/server/track.ts). */
  track?: { id: string; position: number };
};

export async function createMesocycleFromTemplate({
  userId,
  templateId,
  name,
  weeks,
  experience = "intermediate",
  track,
}: CreateMesocycleInput): Promise<string> {
  const template = await db.programTemplate.findUnique({
    where: { id: templateId },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { slots: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!template) throw new Error(`Program template ${templateId} not found`);

  const totalWeeks = weeks ?? template.weeks;
  const startRir = startRirFor(experience);

  return db.$transaction(async (tx) => {
    // Only one block runs at a time; starting a new one closes the old.
    await tx.mesocycle.updateMany({
      where: { userId, status: "active" },
      data: { status: "abandoned", completedAt: new Date() },
    });

    const mesocycle = await tx.mesocycle.create({
      data: {
        userId,
        templateId: template.id,
        trackId: track?.id ?? null,
        trackPosition: track?.position ?? null,
        name: name?.trim() || template.nameEn,
        weeks: totalWeeks,
        // Sessions written per pass, not the athlete's weekly frequency: a
        // rotation longer than a week (Nippard's eight-session PPL, run four a
        // week) still lays down all of its sessions each time round, and the
        // progress total has to count them.
        daysPerWeek: template.days.length,
        startRir,
      },
    });

    const targetRir = rirForWeek(1, totalWeeks, startRir);

    // Three bulk writes rather than one per session, exercise and set. An
    // eight-day rotation is around sixty rows; as sequential round-trips to a
    // hosted database that overran Prisma's 5s transaction timeout long before
    // it finished. Ordering is never assumed — each level is matched back to
    // its parent by a key the database returns.
    const sessions = await tx.session.createManyAndReturn({
      data: template.days.map((day) => ({
        mesocycleId: mesocycle.id,
        week: 1,
        dayIndex: day.order,
        label: day.labelEn,
        isDeload: isDeloadWeek(1, totalWeeks),
      })),
      select: { id: true, dayIndex: true },
    });

    const sessionByDay = new Map(sessions.map((session) => [session.dayIndex, session.id]));

    const entries = await tx.sessionExercise.createManyAndReturn({
      data: template.days.flatMap((day) =>
        day.slots.map((slot) => ({
          sessionId: sessionByDay.get(day.order)!,
          order: slot.order,
          exerciseId: slot.exerciseId,
          muscleGroupId: slot.muscleGroupId,
          targetSets: slot.startingSets,
          repMin: slot.repMin,
          repMax: slot.repMax,
          targetRir,
          restSec: slot.restSec,
        })),
      ),
      select: { id: true, targetSets: true },
    });

    await tx.setLog.createMany({
      data: entries.flatMap((entry) =>
        Array.from({ length: entry.targetSets }, (_, index) => ({
          sessionExerciseId: entry.id,
          order: index,
        })),
      ),
    });

    return mesocycle.id;
  });
}

export async function getActiveMesocycle(userId: string) {
  return db.mesocycle.findFirst({
    where: { userId, status: "active" },
    orderBy: { startedAt: "desc" },
    include: {
      sessions: {
        orderBy: [{ week: "asc" }, { dayIndex: "asc" }],
        include: {
          entries: {
            orderBy: { order: "asc" },
            include: {
              exercise: { include: { muscleGroup: true } },
              sets: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });
}

export type ActiveMesocycle = NonNullable<Awaited<ReturnType<typeof getActiveMesocycle>>>;
export type MesocycleSession = ActiveMesocycle["sessions"][number];

/**
 * The session the athlete should open right now: an in-progress one if they
 * walked away mid-workout, otherwise the earliest planned session.
 */
export function findCurrentSession(mesocycle: ActiveMesocycle): MesocycleSession | null {
  return (
    mesocycle.sessions.find((session) => session.status === "in_progress") ??
    mesocycle.sessions.find((session) => session.status === "planned") ??
    null
  );
}

export function mesocycleProgress(mesocycle: ActiveMesocycle): {
  done: number;
  total: number;
  currentWeek: number;
} {
  const done = mesocycle.sessions.filter((session) => session.status === "completed").length;
  const current = findCurrentSession(mesocycle);

  return {
    done,
    // Sessions for later weeks do not exist yet, so the true total comes from
    // the block's shape rather than from the rows on hand.
    total: mesocycle.weeks * mesocycle.daysPerWeek,
    currentWeek: current?.week ?? mesocycle.weeks,
  };
}

export async function abandonMesocycle(mesocycleId: string): Promise<void> {
  await db.mesocycle.update({
    where: { id: mesocycleId },
    data: { status: "abandoned", completedAt: new Date() },
  });
}

export async function listTemplates(userId: string) {
  return db.programTemplate.findMany({
    where: { OR: [{ isCustom: false }, { userId }] },
    orderBy: [{ isCustom: "asc" }, { daysPerWeek: "asc" }],
    include: {
      days: {
        orderBy: { order: "asc" },
        include: {
          slots: {
            orderBy: { order: "asc" },
            include: { exercise: true, muscleGroup: true },
          },
        },
      },
    },
  });
}

export type TemplateWithDays = Awaited<ReturnType<typeof listTemplates>>[number];
