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
  EDIT_SCOPES,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOALS,
  LOCALES,
  MOVEMENT_TYPES,
  WEIGHT_UNITS,
} from "@/lib/types";
import { awardAchievements } from "./achievements";
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
import { applyProgression, carryForwardSession } from "./progression";
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
  assertSessionOpen((await assertOwnsSetLog(data.setId, userId)).status);

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
  assertSessionOpen((await assertOwnsSessionExercise(id, userId)).status);

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
  assertSessionOpen((await assertOwnsSetLog(id, userId)).status);

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

// ------------------------------------------- editing a session in progress

/**
 * A completed session is history: its numbers have already been read by the
 * progression engine, which wrote next week from them. Editing one in place
 * would leave the two disagreeing with nothing to notice, so every writer
 * closes here and `reopenSession` is the only way back in.
 */
const SESSION_CLOSED = "errors.sessionClosed";

/**
 * Skipped is closed too. Its lane has already been carried into next week, so
 * logging into it would file real numbers against a day the block has moved
 * past — `reopenSession` is the way back in, exactly as it is for a finished
 * one.
 */
function assertSessionOpen(status: string): void {
  if (status === "completed" || status === "skipped") throw new Error(SESSION_CLOSED);
}

/**
 * The plan is the sessions themselves: next week is generated from this week's
 * entries, so anything changed in the logger changes the block unless the row
 * is marked otherwise. `scope` is what the athlete is asked, and these three
 * actions are the only writers of `plan` / `plannedExerciseId`.
 *
 * All three refuse once a set has been ticked on the entry. Substituting a
 * movement under logged numbers would file those numbers against a lift that
 * never did them, and `getPreviousPerformance` keys on the exercise — the
 * corrupted comparison then outlives the session. Finished work is added to,
 * not rewritten.
 */

async function loadEditableEntry(sessionExerciseId: string, userId: string) {
  assertSessionOpen((await assertOwnsSessionExercise(sessionExerciseId, userId)).status);

  const entry = await db.sessionExercise.findUnique({
    where: { id: sessionExerciseId },
    include: { sets: { select: { completed: true } } },
  });
  if (!entry) throw new Error(`Session exercise ${sessionExerciseId} not found`);
  if (entry.sets.some((set) => set.completed)) throw new Error("errors.entryLogged");

  return entry;
}

const swapExerciseSchema = z.object({
  sessionExerciseId: z.string().min(1),
  exerciseId: z.string().min(1),
  scope: z.enum(EDIT_SCOPES),
});

/**
 * Substitute one movement for another in a session already under way — the
 * rack is taken, the cable station is busy.
 *
 * Only within the same muscle group. The slot carries a muscle's volume, and
 * that volume is what the engine reasons about; letting a chest slot become a
 * biceps one would silently move a week's sets between two landmarks.
 */
export async function swapSessionExercise(input: z.infer<typeof swapExerciseSchema>): Promise<void> {
  const data = swapExerciseSchema.parse(input);
  const { userId } = await getUserContext();

  const entry = await loadEditableEntry(data.sessionExerciseId, userId);
  await assertCanUseExercise(data.exerciseId, userId);

  const replacement = await db.exercise.findUnique({
    where: { id: data.exerciseId },
    select: { muscleGroupId: true },
  });
  if (!replacement) throw new Error(`Exercise ${data.exerciseId} not found`);
  if (replacement.muscleGroupId !== entry.muscleGroupId) throw new Error("errors.wrongMuscle");

  // Swapping back to what the plan says is not a second substitution — it is
  // the athlete undoing the first one.
  const restored = data.exerciseId === entry.plannedExerciseId;

  await db.$transaction([
    db.sessionExercise.update({
      where: { id: entry.id },
      // Only which movement fills the slot changes. Sets, reps, RIR and rest
      // are the plan's prescription for this muscle, and leaving them alone is
      // what makes a one-off swap exactly reversible next week.
      data: {
        exerciseId: data.exerciseId,
        plannedExerciseId:
          data.scope === "forward" || restored
            ? null
            : // A second swap in one session still owes the plan its original.
              (entry.plannedExerciseId ?? entry.exerciseId),
      },
    }),
    // The new movement has its own loads, so clear the carried-over numbers.
    db.setLog.updateMany({
      where: { sessionExerciseId: entry.id, completed: false },
      data: { weightKg: null },
    }),
  ]);

  revalidatePath(`/session/${entry.sessionId}`);
}

const addExerciseSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  scope: z.enum(EDIT_SCOPES),
});

/** Append an exercise to a session in progress, with its own set rows. */
export async function addExerciseToSession(
  input: z.infer<typeof addExerciseSchema>,
): Promise<void> {
  const data = addExerciseSchema.parse(input);
  const { userId } = await getUserContext();

  assertSessionOpen((await assertOwnsSession(data.sessionId, userId)).status);
  await assertCanUseExercise(data.exerciseId, userId);

  const [session, exercise] = await Promise.all([
    db.session.findUnique({
      where: { id: data.sessionId },
      include: {
        mesocycle: { select: { weeks: true, startRir: true } },
        entries: { orderBy: { order: "desc" }, take: 1, select: { order: true } },
      },
    }),
    db.exercise.findUnique({ where: { id: data.exerciseId } }),
  ]);

  if (!session) throw new Error(`Session ${data.sessionId} not found`);
  if (!exercise) throw new Error(`Exercise ${data.exerciseId} not found`);

  // The effort target belongs to the week, not to the movement: an exercise
  // added on week 4 is done at week 4's RIR like everything beside it.
  const targetRir = rirForWeek(session.week, session.mesocycle.weeks, session.mesocycle.startRir);
  const targetSets = 3;

  await db.sessionExercise.create({
    data: {
      sessionId: session.id,
      order: (session.entries[0]?.order ?? -1) + 1,
      exerciseId: exercise.id,
      muscleGroupId: exercise.muscleGroupId,
      plan: data.scope === "forward" ? "planned" : "extra",
      targetSets,
      repMin: exercise.defaultRepMin,
      repMax: exercise.defaultRepMax,
      targetRir,
      restSec: exercise.defaultRestSec,
      sets: { create: Array.from({ length: targetSets }, (_, index) => ({ order: index })) },
    },
  });

  revalidatePath(`/session/${session.id}`);
}

const removeExerciseSchema = z.object({
  sessionExerciseId: z.string().min(1),
  scope: z.enum(EDIT_SCOPES),
});

/**
 * Drop an exercise from today. Scoped to the session it stays in the plan and
 * comes back next week, which is why the row is marked rather than deleted;
 * scoped forward there is nothing left to carry, so the row goes.
 */
export async function removeExerciseFromSession(
  input: z.infer<typeof removeExerciseSchema>,
): Promise<void> {
  const data = removeExerciseSchema.parse(input);
  const { userId } = await getUserContext();

  const entry = await loadEditableEntry(data.sessionExerciseId, userId);

  if (data.scope === "forward" || entry.plan === "extra") {
    // Nothing to carry: either the athlete is removing it from the block, or
    // it was only ever added for today and has no plan to return to.
    await db.sessionExercise.delete({ where: { id: entry.id } });
  } else {
    await db.sessionExercise.update({ where: { id: entry.id }, data: { plan: "skipped" } });
  }

  revalidatePath(`/session/${entry.sessionId}`);
}

/** Put a skipped exercise back into today's session. */
export async function restoreExerciseToSession(sessionExerciseId: string): Promise<void> {
  const id = z.string().min(1).parse(sessionExerciseId);
  const { userId } = await getUserContext();
  assertSessionOpen((await assertOwnsSessionExercise(id, userId)).status);

  const entry = await db.sessionExercise.update({
    where: { id },
    data: { plan: "planned" },
    select: { sessionId: true },
  });

  revalidatePath(`/session/${entry.sessionId}`);
}

const feedbackSchema = z.object({
  sessionId: z.string().min(1),
  muscleGroupId: z.string().min(1),
  soreness: z.number().int().min(0).max(3),
  pump: z.number().int().min(0).max(2),
  workload: z.number().int().min(0).max(3),
  jointPain: z.number().int().min(0).max(2),
});

/**
 * One answer per muscle group per session. Re-answering overwrites rather than
 * adding a second row — the athlete changing their mind about how sore their
 * chest was is a correction, not a new data point.
 */
export async function saveFeedback(input: z.infer<typeof feedbackSchema>): Promise<void> {
  const data = feedbackSchema.parse(input);
  const { userId } = await getUserContext();
  assertSessionOpen((await assertOwnsSession(data.sessionId, userId)).status);

  const answers = {
    soreness: data.soreness,
    pump: data.pump,
    workload: data.workload,
    jointPain: data.jointPain,
  };

  await db.sessionMuscleFeedback.upsert({
    where: {
      sessionId_muscleGroupId: {
        sessionId: data.sessionId,
        muscleGroupId: data.muscleGroupId,
      },
    },
    create: { sessionId: data.sessionId, muscleGroupId: data.muscleGroupId, ...answers },
    update: { ...answers, answeredAt: new Date() },
  });

  revalidatePath(`/session/${data.sessionId}`);
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
  const { userId, locale, unit, recovery, preferences } = await getUserContext();
  await assertOwnsSession(id, userId);

  await db.session.update({
    where: { id },
    data: { status: "completed", completedAt: new Date() },
  });

  const summary = await applyProgression(id, unit, recovery, preferences.sessionMinutes);

  if (summary.createdSessionId) {
    try {
      await coachSession(id, summary.createdSessionId);
    } catch (error) {
      console.error("AI coach review failed; keeping algorithmic prescription", error);
    }
  }

  // After the session is saved and the block has had its chance to complete, so
  // "finish a block" can fire on the session that finished it. Swallows its own
  // failures for the same reason the coach does.
  const earned = await awardAchievements(userId, locale);

  revalidatePath("/", "layout");

  // Carried in the URL rather than in a store: the summary re-renders on a
  // refresh and a back-navigation, and the page re-checks every key against
  // what the athlete actually holds before showing it.
  const query = earned.length > 0 ? `?earned=${earned.map((a) => a.key).join(",")}` : "";
  redirect(`/session/${id}/summary${query}`);
}

// ---------------------------------------- undoing a completed session

const reopenSchema = z.object({
  sessionId: z.string().min(1),
  /** Also wipe what was logged, for a session that should never have existed. */
  clear: z.boolean(),
});

/**
 * Puts a finished session back in play — a mistyped load, a session finished by
 * accident.
 *
 * Deleting one instead is not on offer, and the reason is structural: the block
 * is a chain, and each session is written by finishing the one before it. Week 3
 * Day 1 exists *because* Week 2 Day 1 was completed. Removing a link would leave
 * that day with no way to ever produce another session, so reopening rewinds the
 * chain rather than cutting it, and `clear` covers "this never happened".
 *
 * The week this session produced is deleted, because finishing again writes it
 * afresh from the corrected numbers. That is only safe while nothing has been
 * logged against it — a correction is not worth someone else's real sets, so
 * once next week is under way this refuses and says why.
 *
 * Achievements are deliberately **not** revoked; see `awardAchievements`.
 */
/**
 * "I am not doing this one."
 *
 * A missed day is a real thing and the app had no way to say it: the session sat
 * `planned` forever, Today kept offering it, and jumping past it from the plan
 * stalled that day's lane for the rest of the block. This marks it skipped and —
 * the important half — writes next week's version of the same day anyway, so the
 * chain survives a gap in it.
 *
 * Refused once anything is logged, like every other edit that would file numbers
 * against work that did not happen. A session with sets in it is not skipped; it
 * is unfinished, and `reopenSession(clear)` is the honest way to empty it.
 */
export async function skipSession(sessionId: string): Promise<void> {
  const id = z.string().min(1).parse(sessionId);
  const { userId } = await getUserContext();
  const { status } = await assertOwnsSession(id, userId);

  if (status === "completed") throw new Error("errors.sessionClosed");
  if (status === "skipped") return;

  const logged = await db.setLog.count({
    where: { sessionExercise: { sessionId: id }, completed: true },
  });
  if (logged > 0) throw new Error("errors.sessionStarted");

  await db.session.update({
    where: { id },
    data: { status: "skipped", startedAt: null, completedAt: null },
  });

  // Outside the update on purpose: this writes a whole week of rows and would
  // otherwise sit inside a transaction long enough to matter against a hosted
  // database. Both halves are idempotent, so a retry cannot duplicate a week.
  await carryForwardSession(id);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function reopenSession(input: z.infer<typeof reopenSchema>): Promise<void> {
  const data = reopenSchema.parse(input);
  const { userId } = await getUserContext();
  const { mesocycleId, week, status } = await assertOwnsSession(data.sessionId, userId);
  // Skipped counts too: changing your mind about a missed day should put it
  // back, and the machinery below — delete the week this one generated, unless
  // it is already underway — is exactly what that needs.
  if (status !== "completed" && status !== "skipped") return;

  const session = await db.session.findUnique({
    where: { id: data.sessionId },
    select: { dayIndex: true, mesocycle: { select: { weeks: true, status: true } } },
  });
  if (!session) throw new Error(`Session ${data.sessionId} not found`);

  const generated = await db.session.findUnique({
    where: {
      mesocycleId_week_dayIndex: { mesocycleId, week: week + 1, dayIndex: session.dayIndex },
    },
    select: {
      id: true,
      status: true,
      entries: { select: { sets: { select: { completed: true } } } },
    },
  });

  const nextIsUnderway =
    generated !== null &&
    (generated.status !== "planned" ||
      generated.entries.some((entry) => entry.sets.some((set) => set.completed)));

  if (nextIsUnderway) throw new Error("errors.nextStarted");

  await db.$transaction(async (tx) => {
    // Cascades its entries, their sets and the decisions that explained them.
    if (generated) await tx.session.delete({ where: { id: generated.id } });

    // A skipped session was never underway, so it can only go back to planned —
    // resuming one would present an empty session as a workout in progress.
    const restored = status === "skipped" || data.clear ? "planned" : "in_progress";

    await tx.session.update({
      where: { id: data.sessionId },
      data: {
        status: restored,
        completedAt: null,
        ...(restored === "planned" ? { startedAt: null } : {}),
      },
    });

    if (data.clear) {
      await tx.sessionMuscleFeedback.deleteMany({ where: { sessionId: data.sessionId } });
      await tx.setLog.updateMany({
        where: { sessionExercise: { sessionId: data.sessionId } },
        // The prescribed load stays: it is the plan for the session, not a
        // record of it, and blanking it would make a reset session harder to
        // start than a fresh one.
        data: { reps: null, rir: null, completed: false, loggedAt: null },
      });
    }

    // The block is marked completed by whichever final-week session is finished
    // first, so reopening one has to put it back into play — otherwise the
    // athlete is left with an active-looking session inside a closed block.
    if (week >= session.mesocycle.weeks && session.mesocycle.status === "completed") {
      await tx.mesocycle.update({
        where: { id: mesocycleId },
        data: { status: "active", completedAt: null },
      });
    }
  });

  revalidatePath("/", "layout");
  redirect(`/session/${data.sessionId}`);
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

// ------------------------------------------------------------------ danger zone

/**
 * Wipes all training history for the current user: every mesocycle (and the
 * sessions / sets / feedback that cascade from it), personal volume landmarks,
 * achievements, and custom programs / tracks. The account, profile, exercises,
 * auth sessions, and friends are kept.
 */
export async function resetTrainingData(): Promise<void> {
  const { userId } = await getUserContext();

  await db.$transaction([
    // Mesocycles cascade-delete Sessions → SessionExercises → SetLogs,
    // SessionMuscleFeedback and SessionExercisePlan rows.
    db.mesocycle.deleteMany({ where: { userId } }),
    // Per-user volume calibration learned from the deleted sessions.
    db.userMuscleLandmark.deleteMany({ where: { userId } }),
    // Medals that were awarded for the deleted history.
    db.userAchievement.deleteMany({ where: { userId } }),
    // Custom programs & tracks the athlete created themselves.
    db.programTemplate.deleteMany({ where: { userId, isCustom: true } }),
    db.programTrack.deleteMany({ where: { userId, isCustom: true } }),
  ]);

  revalidatePath("/", "layout");
  redirect("/");
}

