"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { isSafeDemoUrl } from "@/lib/demo";
import { stringifyJson } from "@/lib/json";
import { rirForWeek } from "@/lib/progression/engine";
import { estimateProgramMinutes } from "@/lib/training-time";
import {
  CALORIC_STATES,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOALS,
  LOCALES,
  MOVEMENT_TYPES,
  WEIGHT_UNITS,
} from "@/lib/types";
import { coachSession } from "./coach";
import { abandonMesocycle, createMesocycleFromTemplate } from "./mesocycle";
import {
  assertCanUseExercise,
  assertCanUseTemplate,
  assertCanUseTrack,
  assertOwnsExercise,
  assertOwnsMesocycle,
  assertOwnsSession,
  assertOwnsSessionExercise,
  assertOwnsSetLog,
} from "./ownership";
import { applyProgression } from "./progression";
import { getUserContext } from "./user";

/**
 * Every mutation in the app. Inputs are validated with zod because these are
 * public HTTP endpoints, not just internal functions.
 */

// ------------------------------------------------------------- settings

const settingsSchema = z.object({
  locale: z.enum(LOCALES),
  unit: z.enum(WEIGHT_UNITS),
  name: z.string().trim().min(1).max(60).optional(),
});

export async function updateSettings(input: z.infer<typeof settingsSchema>): Promise<void> {
  const data = settingsSchema.parse(input);
  const { userId } = await getUserContext();

  await db.user.update({
    where: { id: userId },
    data: { locale: data.locale, unit: data.unit, ...(data.name ? { name: data.name } : {}) },
  });

  revalidatePath("/", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  sex: z.enum(["male", "female", "other"]).nullish(),
  birthDate: z.string().nullish(),
  heightCm: z.number().min(80).max(260).nullish(),
  bodyweightKg: z.number().min(25).max(400).nullish(),
  experience: z.enum(EXPERIENCE_LEVELS),
  primaryGoal: z.enum(GOALS),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionMinutes: z.number().int().min(15).max(240),
  sleepQuality: z.number().int().min(1).max(5),
  stressLevel: z.number().int().min(1).max(5),
  nutritionQuality: z.number().int().min(1).max(5),
  caloricState: z.enum(CALORIC_STATES),
  injuries: z.array(z.string().trim().min(1)).default([]),
  equipment: z.array(z.enum(EQUIPMENT)).default([]),
});

export async function saveProfile(input: z.infer<typeof profileSchema>): Promise<void> {
  const data = profileSchema.parse(input);
  const { userId } = await getUserContext();

  const profileData = {
    sex: data.sex ?? null,
    birthDate: data.birthDate ? new Date(data.birthDate) : null,
    heightCm: data.heightCm ?? null,
    bodyweightKg: data.bodyweightKg ?? null,
    experience: data.experience,
    primaryGoal: data.primaryGoal,
    daysPerWeek: data.daysPerWeek,
    sessionMinutes: data.sessionMinutes,
    sleepQuality: data.sleepQuality,
    stressLevel: data.stressLevel,
    nutritionQuality: data.nutritionQuality,
    caloricState: data.caloricState,
    injuries: stringifyJson(data.injuries),
    equipment: stringifyJson(data.equipment),
  };

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { name: data.name } }),
    db.profile.upsert({
      where: { userId },
      create: { userId, ...profileData },
      update: profileData,
    }),
  ]);

  revalidatePath("/", "layout");
}

// ----------------------------------------------------------- mesocycles

const createBlockSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().max(80).optional(),
  weeks: z.number().int().min(2).max(12).optional(),
  /** Present when the block is a step of a track rather than a one-off. */
  trackId: z.string().min(1).optional(),
  trackPosition: z.number().int().min(0).optional(),
});

export async function createBlock(input: z.infer<typeof createBlockSchema>): Promise<void> {
  const data = createBlockSchema.parse(input);
  const { userId, experience } = await getUserContext();

  await assertCanUseTemplate(data.templateId, userId);
  if (data.trackId) await assertCanUseTrack(data.trackId, userId);

  await createMesocycleFromTemplate({
    userId,
    templateId: data.templateId,
    name: data.name,
    weeks: data.weeks,
    experience,
    track:
      data.trackId && data.trackPosition !== undefined
        ? { id: data.trackId, position: data.trackPosition }
        : undefined,
  });

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Start the block that follows the one just finished. The position is read
 * from the track rather than trusted from the client, so a stale page cannot
 * skip a step.
 */
const startTrackStepSchema = z.object({
  trackId: z.string().min(1),
  /** The position to start; the entry at this index supplies the template. */
  position: z.number().int().min(0),
});

export async function startTrackStep(input: z.infer<typeof startTrackStepSchema>): Promise<void> {
  const data = startTrackStepSchema.parse(input);
  const { userId, experience } = await getUserContext();

  await assertCanUseTrack(data.trackId, userId);

  const entry = await db.programTrackEntry.findFirst({
    where: { trackId: data.trackId, order: data.position },
    include: { template: true },
  });
  if (!entry) throw new Error("That track step no longer exists");

  await createMesocycleFromTemplate({
    userId,
    templateId: entry.templateId,
    name: entry.template.nameEn,
    experience,
    track: { id: data.trackId, position: entry.order },
  });

  revalidatePath("/", "layout");
  redirect("/");
}

// ------------------------------------------------------ custom programs

const customProgramSchema = z.object({
  /** Present when editing an existing custom program. */
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(80),
  level: z.enum(EXPERIENCE_LEVELS),
  goal: z.enum(GOALS),
  weeks: z.number().int().min(2).max(12),
  days: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        slots: z
          .array(
            z.object({
              exerciseId: z.string().min(1),
              sets: z.number().int().min(1).max(20),
              repMin: z.number().int().min(1).max(50),
              repMax: z.number().int().min(1).max(60),
              restSec: z.number().int().min(15).max(600),
            }),
          )
          .min(1),
      }),
    )
    .min(1)
    // Not 7: a rotation is not a calendar week. Push/Pull/Legs/Arms run twice
    // is an 8-day cycle, and several published programs are built that way.
    .max(10),
});

export type CustomProgramInput = z.infer<typeof customProgramSchema>;

/**
 * Creates or replaces a user-authored program. Days and slots are rewritten
 * wholesale rather than diffed — a template is small, and any mesocycle already
 * generated from it copied its own rows at creation time, so editing here never
 * disturbs a block in progress.
 */
export async function saveCustomProgram(input: CustomProgramInput): Promise<string> {
  const data = customProgramSchema.parse(input);
  const { userId } = await getUserContext();

  for (const day of data.days) {
    for (const slot of day.slots) {
      if (slot.repMax < slot.repMin) {
        throw new Error("Maximum reps must be at least the minimum");
      }
    }
  }

  // Resolve each exercise's muscle group here; the client only sends ids. The
  // filter is also the authorisation check — someone else's custom exercise is
  // simply not found, and the count test below rejects the whole program.
  const exerciseIds = [...new Set(data.days.flatMap((day) => day.slots.map((s) => s.exerciseId)))];
  const exercises = await db.exercise.findMany({
    where: { id: { in: exerciseIds }, OR: [{ isCustom: false }, { userId }] },
    select: { id: true, muscleGroupId: true },
  });
  const muscleByExercise = new Map(exercises.map((e) => [e.id, e.muscleGroupId]));

  if (muscleByExercise.size !== exerciseIds.length) {
    throw new Error("Custom program references an unknown exercise");
  }

  const estimatedMinutes = estimateProgramMinutes(
    data.days.map((day) => day.slots.map((slot) => ({ sets: slot.sets, restSec: slot.restSec }))),
  );

  const fields = {
    nameEn: data.name,
    namePt: data.name,
    descEn: "",
    descPt: "",
    daysPerWeek: data.days.length,
    weeks: data.weeks,
    level: data.level,
    goal: data.goal,
    estimatedMinutes,
    isCustom: true,
    userId,
  };

  const templateId = await db.$transaction(async (tx) => {
    let id = data.id;

    if (id) {
      // Scope the update to this user's own custom programs so an id from the
      // client cannot be used to overwrite a stock template.
      const existing = await tx.programTemplate.findFirst({
        where: { id, isCustom: true, userId },
        select: { id: true },
      });
      if (!existing) throw new Error("Custom program not found");

      await tx.programTemplate.update({ where: { id }, data: fields });
      await tx.programTemplateDay.deleteMany({ where: { templateId: id } });
    } else {
      const created = await tx.programTemplate.create({ data: fields });
      id = created.id;
    }

    for (const [dayIndex, day] of data.days.entries()) {
      const dayRecord = await tx.programTemplateDay.create({
        data: { templateId: id, order: dayIndex, labelEn: day.label, labelPt: day.label },
      });

      for (const [slotIndex, slot] of day.slots.entries()) {
        await tx.programTemplateSlot.create({
          data: {
            dayId: dayRecord.id,
            order: slotIndex,
            exerciseId: slot.exerciseId,
            muscleGroupId: muscleByExercise.get(slot.exerciseId)!,
            startingSets: slot.sets,
            repMin: slot.repMin,
            repMax: slot.repMax,
            restSec: slot.restSec,
          },
        });
      }
    }

    return id;
  });

  revalidatePath("/plan/new");
  revalidatePath("/plan");
  return templateId;
}

export async function deleteCustomProgram(templateId: string): Promise<void> {
  const id = z.string().min(1).parse(templateId);
  const { userId } = await getUserContext();

  // Blocks already generated from it survive: Mesocycle.templateId is SetNull.
  await db.programTemplate.deleteMany({ where: { id, isCustom: true, userId } });

  revalidatePath("/plan/new");
  redirect("/plan/new");
}

export async function endBlock(mesocycleId: string): Promise<void> {
  const id = z.string().min(1).parse(mesocycleId);
  const { userId } = await getUserContext();

  await assertOwnsMesocycle(id, userId);
  await abandonMesocycle(id);

  revalidatePath("/", "layout");
  redirect("/");
}

// -------------------------------------------------------------- session

export async function startSession(sessionId: string): Promise<void> {
  const id = z.string().min(1).parse(sessionId);
  const { userId } = await getUserContext();
  await assertOwnsSession(id, userId);

  await db.session.update({
    where: { id },
    data: { status: "in_progress", startedAt: new Date() },
  });

  revalidatePath(`/session/${id}`);
  revalidatePath("/");
}

const logSetSchema = z.object({
  setId: z.string().min(1),
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(200).nullable(),
  rir: z.number().int().min(0).max(10).nullable(),
  completed: z.boolean(),
});

export async function logSet(input: z.infer<typeof logSetSchema>): Promise<void> {
  const data = logSetSchema.parse(input);
  const { userId } = await getUserContext();
  await assertOwnsSetLog(data.setId, userId);

  const set = await db.setLog.update({
    where: { id: data.setId },
    data: {
      weightKg: data.weightKg,
      reps: data.reps,
      rir: data.rir,
      completed: data.completed,
      loggedAt: data.completed ? new Date() : null,
    },
    select: { sessionExercise: { select: { sessionId: true } } },
  });

  revalidatePath(`/session/${set.sessionExercise.sessionId}`);
}

export async function addSet(sessionExerciseId: string): Promise<void> {
  const id = z.string().min(1).parse(sessionExerciseId);
  const { userId } = await getUserContext();
  await assertOwnsSessionExercise(id, userId);

  const entry = await db.sessionExercise.findUnique({
    where: { id },
    include: { sets: { orderBy: { order: "desc" }, take: 1 } },
  });
  if (!entry) throw new Error(`Session exercise ${id} not found`);

  const last = entry.sets[0];

  await db.$transaction([
    db.setLog.create({
      data: {
        sessionExerciseId: id,
        order: (last?.order ?? -1) + 1,
        // Carry the working load forward so the row opens pre-filled.
        weightKg: last?.weightKg ?? null,
      },
    }),
    db.sessionExercise.update({
      where: { id },
      data: { targetSets: { increment: 1 } },
    }),
  ]);

  revalidatePath(`/session/${entry.sessionId}`);
}

export async function removeSet(setId: string): Promise<void> {
  const id = z.string().min(1).parse(setId);
  const { userId } = await getUserContext();
  await assertOwnsSetLog(id, userId);

  const set = await db.setLog.findUnique({
    where: { id },
    include: { sessionExercise: { select: { id: true, sessionId: true, targetSets: true } } },
  });
  if (!set) return;

  await db.$transaction([
    db.setLog.delete({ where: { id } }),
    db.sessionExercise.update({
      where: { id: set.sessionExercise.id },
      data: { targetSets: Math.max(1, set.sessionExercise.targetSets - 1) },
    }),
  ]);

  revalidatePath(`/session/${set.sessionExercise.sessionId}`);
}

const feedbackSchema = z.object({
  sessionExerciseId: z.string().min(1),
  soreness: z.number().int().min(0).max(3),
  pump: z.number().int().min(0).max(2),
  workload: z.number().int().min(0).max(3),
  jointPain: z.number().int().min(0).max(2),
});

export async function saveFeedback(input: z.infer<typeof feedbackSchema>): Promise<void> {
  const data = feedbackSchema.parse(input);
  const { userId } = await getUserContext();
  await assertOwnsSessionExercise(data.sessionExerciseId, userId);

  const entry = await db.sessionExercise.update({
    where: { id: data.sessionExerciseId },
    data: {
      soreness: data.soreness,
      pump: data.pump,
      workload: data.workload,
      jointPain: data.jointPain,
    },
    select: { sessionId: true },
  });

  revalidatePath(`/session/${entry.sessionId}`);
}

export async function saveSessionNotes(sessionId: string, notes: string): Promise<void> {
  const id = z.string().min(1).parse(sessionId);
  const { userId } = await getUserContext();
  await assertOwnsSession(id, userId);

  await db.session.update({
    where: { id },
    data: { notes: z.string().max(2000).parse(notes) },
  });

  revalidatePath(`/session/${id}`);
}

/**
 * Closes the session, runs the progression engine to lay down the same day of
 * next week, then asks the AI coach to review it. The coach is best-effort —
 * a failure there must never lose the athlete's logged work.
 */
export async function finishSession(sessionId: string): Promise<void> {
  const id = z.string().min(1).parse(sessionId);
  const { userId, unit, recovery } = await getUserContext();
  await assertOwnsSession(id, userId);

  await db.session.update({
    where: { id },
    data: { status: "completed", completedAt: new Date() },
  });

  const summary = await applyProgression(id, unit, recovery);

  if (summary.createdSessionId) {
    try {
      await coachSession(id, summary.createdSessionId);
    } catch (error) {
      console.error("AI coach review failed; keeping algorithmic prescription", error);
    }
  }

  revalidatePath("/", "layout");
  redirect(`/session/${id}/summary`);
}

// ------------------------------------------------------------ exercises

const exerciseSchema = z.object({
  nameEn: z.string().trim().min(1).max(80),
  namePt: z.string().trim().min(1).max(80),
  muscleGroupId: z.string().min(1),
  secondary: z.array(z.string()).default([]),
  equipment: z.enum(EQUIPMENT),
  movementType: z.enum(MOVEMENT_TYPES),
  defaultRepMin: z.number().int().min(1).max(50),
  defaultRepMax: z.number().int().min(1).max(60),
  defaultRestSec: z.number().int().min(15).max(600),
  notes: z.string().trim().max(500).optional(),
});

export async function createExercise(input: z.infer<typeof exerciseSchema>): Promise<void> {
  const data = exerciseSchema.parse(input);
  const { userId } = await getUserContext();

  if (data.defaultRepMax < data.defaultRepMin) {
    throw new Error("Maximum reps must be at least the minimum");
  }

  await db.exercise.create({
    data: {
      nameEn: data.nameEn,
      namePt: data.namePt,
      muscleGroupId: data.muscleGroupId,
      secondary: stringifyJson(data.secondary),
      equipment: data.equipment,
      movementType: data.movementType,
      defaultRepMin: data.defaultRepMin,
      defaultRepMax: data.defaultRepMax,
      defaultRestSec: data.defaultRestSec,
      notes: data.notes ?? null,
      isCustom: true,
      userId,
    },
  });

  revalidatePath("/exercises");
}

const demoSchema = z.object({
  exerciseId: z.string().min(1),
  /** Empty string clears it and restores the name-based search fallback. */
  demoUrl: z.string().trim().max(500),
});

export async function setExerciseDemo(input: z.infer<typeof demoSchema>): Promise<void> {
  const data = demoSchema.parse(input);
  const { userId } = await getUserContext();

  // Own exercises only. `demoUrl` is a column on the shared stock row, so
  // letting anyone write it would rewrite the library for every account —
  // curating the seeded links needs a per-user override, not this.
  await assertOwnsExercise(data.exerciseId, userId);

  if (data.demoUrl && !isSafeDemoUrl(data.demoUrl)) {
    throw new Error("Demo link must be an http or https URL");
  }

  await db.exercise.update({
    where: { id: data.exerciseId },
    data: {
      demoUrl: data.demoUrl || null,
      // Anything set here was chosen deliberately, so it stops being flagged
      // as unverified and the seed will never fill over it.
      demoSource: data.demoUrl ? "user" : null,
    },
  });

  revalidatePath("/exercises");
  revalidatePath("/", "layout");
}

export async function archiveExercise(exerciseId: string): Promise<void> {
  const id = z.string().min(1).parse(exerciseId);
  const { userId } = await getUserContext();

  // Same reason as the demo link: `archived` is on the shared row, so this can
  // only ever apply to an exercise the athlete created.
  await assertOwnsExercise(id, userId);

  await db.exercise.update({ where: { id }, data: { archived: true } });
  revalidatePath("/exercises");
}

/** Swaps one exercise for another inside a single upcoming session. */
export async function swapSessionExercise(
  sessionExerciseId: string,
  exerciseId: string,
): Promise<void> {
  const entryId = z.string().min(1).parse(sessionExerciseId);
  const nextExerciseId = z.string().min(1).parse(exerciseId);
  const { userId } = await getUserContext();

  await Promise.all([
    assertOwnsSessionExercise(entryId, userId),
    assertCanUseExercise(nextExerciseId, userId),
  ]);

  const [entry, exercise] = await Promise.all([
    db.sessionExercise.findUnique({ where: { id: entryId } }),
    db.exercise.findUnique({ where: { id: nextExerciseId } }),
  ]);

  if (!entry || !exercise) throw new Error("Exercise swap target not found");

  await db.$transaction([
    db.sessionExercise.update({
      where: { id: entryId },
      data: {
        exerciseId: exercise.id,
        muscleGroupId: exercise.muscleGroupId,
        repMin: exercise.defaultRepMin,
        repMax: exercise.defaultRepMax,
        restSec: exercise.defaultRestSec,
      },
    }),
    // The new movement has its own loads, so clear the carried-over numbers.
    db.setLog.updateMany({
      where: { sessionExerciseId: entryId, completed: false },
      data: { weightKg: null },
    }),
  ]);

  revalidatePath(`/session/${entry.sessionId}`);
}

export async function addExerciseToSession(
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  const id = z.string().min(1).parse(sessionId);
  const nextExerciseId = z.string().min(1).parse(exerciseId);
  const { userId } = await getUserContext();

  await Promise.all([
    assertOwnsSession(id, userId),
    assertCanUseExercise(nextExerciseId, userId),
  ]);

  const [session, exercise] = await Promise.all([
    db.session.findUnique({
      where: { id },
      include: {
        mesocycle: true,
        entries: { orderBy: { order: "desc" }, take: 1 },
      },
    }),
    db.exercise.findUnique({ where: { id: nextExerciseId } }),
  ]);

  if (!session || !exercise) throw new Error("Cannot add exercise to session");

  const entry = await db.sessionExercise.create({
    data: {
      sessionId: id,
      order: (session.entries[0]?.order ?? -1) + 1,
      exerciseId: exercise.id,
      muscleGroupId: exercise.muscleGroupId,
      targetSets: 3,
      repMin: exercise.defaultRepMin,
      repMax: exercise.defaultRepMax,
      targetRir: rirForWeek(session.week, session.mesocycle.weeks, session.mesocycle.startRir),
      restSec: exercise.defaultRestSec,
    },
  });

  await db.setLog.createMany({
    data: Array.from({ length: 3 }, (_, index) => ({
      sessionExerciseId: entry.id,
      order: index,
    })),
  });

  revalidatePath(`/session/${id}`);
}

export async function removeExerciseFromSession(sessionExerciseId: string): Promise<void> {
  const id = z.string().min(1).parse(sessionExerciseId);
  const { userId } = await getUserContext();
  await assertOwnsSessionExercise(id, userId);

  const entry = await db.sessionExercise.findUnique({
    where: { id },
    select: { sessionId: true },
  });
  if (!entry) return;

  await db.sessionExercise.delete({ where: { id } });
  revalidatePath(`/session/${entry.sessionId}`);
}
