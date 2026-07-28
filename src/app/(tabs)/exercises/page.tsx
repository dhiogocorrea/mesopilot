import { ExerciseLibrary } from "@/components/exercise-library";
import { ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { resolveDemo } from "@/lib/demo";
import { createTranslator, localized } from "@/lib/i18n";
import { getUserContext } from "@/server/user";

export default async function ExercisesPage() {
  const { userId, locale } = await getUserContext();
  const t = createTranslator(locale);

  const [exercises, muscles] = await Promise.all([
    db.exercise.findMany({
      where: { archived: false, OR: [{ isCustom: false }, { userId }] },
      include: { muscleGroup: true },
    }),
    db.muscleGroup.findMany({ orderBy: { order: "asc" } }),
  ]);

  // Sorted here rather than in the query: the visible name is whichever of
  // nameEn/namePt the locale picks, so ordering by a column would come out
  // alphabetical in the wrong language. `localeCompare` also puts "Ênfase"
  // where a reader expects it instead of after Z.
  const collator = new Intl.Collator(locale === "pt" ? "pt-BR" : "en", { sensitivity: "base" });
  const rows = [...exercises].sort((a, b) =>
    collator.compare(localized(a, locale), localized(b, locale)),
  );

  return (
    <>
      <ScreenHeader
        title={t("exercises.title")}
        meta={t("exercises.count", { count: exercises.length })}
      />
      <ExerciseLibrary
        exercises={rows.map((exercise) => {
          const name = localized(exercise, locale);
          return {
            id: exercise.id,
            name,
            muscleId: exercise.muscleGroupId,
            muscleName: localized(exercise.muscleGroup, locale),
            equipment: exercise.equipment,
            movementType: exercise.movementType,
            repMin: exercise.defaultRepMin,
            repMax: exercise.defaultRepMax,
            isCustom: exercise.isCustom,
            demoUrl: exercise.demoUrl,
            demoUnverified: exercise.demoSource === "inferred",
            // Resolved here because the fallback search needs the localised
            // name, which the client would otherwise have to re-derive.
            demo: resolveDemo(name, exercise.demoUrl, locale),
          };
        })}
        muscles={muscles.map((muscle) => ({
          id: muscle.id,
          key: muscle.key,
          name: localized(muscle, locale),
        }))}
      />
    </>
  );
}
