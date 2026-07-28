import { notFound } from "next/navigation";

import { ProgramBuilder, type BuilderDay, type ExerciseChoice } from "@/components/program-builder";
import { ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { createTranslator, localized, localizedLabel } from "@/lib/i18n";
import type { Experience, Goal } from "@/lib/types";
import { requireProfile } from "@/server/user";

/**
 * `?from=<templateId>` seeds the builder from an existing program — duplicating
 * and tweaking a proven split is a far more common starting point than a blank
 * page. `?edit=<templateId>` reopens one of the user's own programs.
 */
export default async function CustomProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; edit?: string }>;
}) {
  const { userId, locale, experience, preferences } = await requireProfile();
  const { from, edit } = await searchParams;
  const t = createTranslator(locale);

  const sourceId = edit ?? from;
  const source = sourceId
    ? await db.programTemplate.findFirst({
        where: edit
          ? { id: edit, isCustom: true, userId }
          : { id: from, OR: [{ isCustom: false }, { userId }] },
        include: {
          days: {
            orderBy: { order: "asc" },
            include: {
              slots: { orderBy: { order: "asc" }, include: { exercise: true } },
            },
          },
        },
      })
    : null;

  if (sourceId && !source) notFound();

  const exercises = await db.exercise.findMany({
    where: { archived: false, OR: [{ isCustom: false }, { userId }] },
    orderBy: [{ muscleGroup: { order: "asc" } }, { nameEn: "asc" }],
    include: { muscleGroup: true },
  });

  const choices: ExerciseChoice[] = exercises.map((exercise) => ({
    id: exercise.id,
    name: localized(exercise, locale),
    muscleName: localized(exercise.muscleGroup, locale),
    repMin: exercise.defaultRepMin,
    repMax: exercise.defaultRepMax,
    restSec: exercise.defaultRestSec,
  }));

  const days: BuilderDay[] = source
    ? source.days.map((day) => ({
        key: day.id,
        label: localizedLabel(day, locale),
        slots: day.slots.map((slot) => ({
          key: slot.id,
          exerciseId: slot.exerciseId,
          name: localized(slot.exercise, locale),
          sets: slot.startingSets,
          repMin: slot.repMin,
          repMax: slot.repMax,
          restSec: slot.restSec,
        })),
      }))
    : [];

  const editing = Boolean(edit);

  return (
    <>
      <ScreenHeader
        title={editing ? t("builder.editTitle") : t("builder.newTitle")}
        meta={t("builder.subtitle")}
      />
      <ProgramBuilder
        exercises={choices}
        initial={{
          // Duplicating keeps the source's shape but not its identity, so the
          // original stays untouched.
          id: editing ? source!.id : undefined,
          name: source ? (editing ? localized(source, locale) : `${localized(source, locale)} ✎`) : "",
          level: (source?.level as Experience) ?? experience,
          goal: (source?.goal as Goal) ?? preferences.goal,
          weeks: source?.weeks ?? 5,
          days,
        }}
      />
    </>
  );
}
