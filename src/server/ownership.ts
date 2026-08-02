import "server-only";

import { db } from "@/lib/db";

/**
 * Ownership guards for the ids that arrive from the client.
 *
 * Every server action is a public HTTP endpoint. Validating the *shape* of an
 * id says nothing about whose it is, and until the app grew accounts it did not
 * have to — there was one owner. Now a bare `where: { id }` is an IDOR: guess a
 * cuid and you are writing into someone else's training log.
 *
 * These throw rather than return null. A caller that forgets to check a return
 * value still fails closed, and nothing legitimate ever passes an id the signed
 * -in athlete does not own — so the message stays deliberately vague.
 */

const DENIED = "Not found";

/**
 * Session → Mesocycle → User. Returns the mesocycle a session belongs to, and
 * its status: a completed session is history, and every writer needs to know
 * that without paying for a second read.
 */
export async function assertOwnsSession(
  sessionId: string,
  userId: string,
): Promise<{ mesocycleId: string; week: number; status: string }> {
  const session = await db.session.findFirst({
    where: { id: sessionId, mesocycle: { userId } },
    select: { mesocycleId: true, week: true, status: true },
  });

  if (!session) throw new Error(DENIED);
  return session;
}

/** SessionExercise → Session → Mesocycle → User. */
export async function assertOwnsSessionExercise(
  entryId: string,
  userId: string,
): Promise<{ sessionId: string; status: string }> {
  const entry = await db.sessionExercise.findFirst({
    where: { id: entryId, session: { mesocycle: { userId } } },
    select: { sessionId: true, session: { select: { status: true } } },
  });

  if (!entry) throw new Error(DENIED);
  return { sessionId: entry.sessionId, status: entry.session.status };
}

/** SetLog → SessionExercise → Session → Mesocycle → User. */
export async function assertOwnsSetLog(
  setId: string,
  userId: string,
): Promise<{ sessionExerciseId: string; sessionId: string; status: string }> {
  const set = await db.setLog.findFirst({
    where: { id: setId, sessionExercise: { session: { mesocycle: { userId } } } },
    select: {
      sessionExerciseId: true,
      sessionExercise: { select: { sessionId: true, session: { select: { status: true } } } },
    },
  });

  if (!set) throw new Error(DENIED);
  return {
    sessionExerciseId: set.sessionExerciseId,
    sessionId: set.sessionExercise.sessionId,
    status: set.sessionExercise.session.status,
  };
}

export async function assertOwnsMesocycle(mesocycleId: string, userId: string): Promise<void> {
  const found = await db.mesocycle.findFirst({
    where: { id: mesocycleId, userId },
    select: { id: true },
  });

  if (!found) throw new Error(DENIED);
}

/**
 * Readable rather than owned: stock content has no user, and every athlete may
 * put it in their own sessions. Only a *custom* exercise is private.
 */
export async function assertCanUseExercise(exerciseId: string, userId: string): Promise<void> {
  const found = await db.exercise.findFirst({
    where: { id: exerciseId, OR: [{ isCustom: false }, { userId }] },
    select: { id: true },
  });

  if (!found) throw new Error(DENIED);
}

/** Same rule for programs: stock is everyone's, custom is its author's. */
export async function assertCanUseTemplate(templateId: string, userId: string): Promise<void> {
  const found = await db.programTemplate.findFirst({
    where: { id: templateId, OR: [{ isCustom: false }, { userId }] },
    select: { id: true },
  });

  if (!found) throw new Error(DENIED);
}

export async function assertCanUseTrack(trackId: string, userId: string): Promise<void> {
  const found = await db.programTrack.findFirst({
    where: { id: trackId, OR: [{ isCustom: false }, { userId }] },
    select: { id: true },
  });

  if (!found) throw new Error(DENIED);
}

/** Editing an exercise, unlike using one, requires having created it. */
export async function assertOwnsExercise(exerciseId: string, userId: string): Promise<void> {
  const found = await db.exercise.findFirst({
    where: { id: exerciseId, isCustom: true, userId },
    select: { id: true },
  });

  if (!found) throw new Error(DENIED);
}
