import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { estimateProgramMinutes, type TimedSlot } from "../src/lib/training-time";
import { PrismaClient } from "../src/generated/prisma/client";
import { EXERCISES, MUSCLES } from "./seed-data";
import { INFERRED_DEMOS } from "./seed-demos";
import { parseSlot, TEMPLATES } from "./seed-programs";
import { TRACKS } from "./seed-tracks";

/**
 * Idempotent: everything is keyed and upserted, so re-running the seed after
 * adding new exercises or programs updates in place instead of duplicating.
 * User-created content has a null `key` and is never touched here.
 */

/**
 * No fallback on purpose. This used to default to the local SQLite file; with a
 * remote database a wrong-but-plausible default seeds the wrong place, which is
 * far worse than refusing to start.
 */
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  return url;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }),
});

async function seedMuscles(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const [index, muscle] of MUSCLES.entries()) {
    const record = await prisma.muscleGroup.upsert({
      where: { key: muscle.key },
      create: {
        key: muscle.key,
        nameEn: muscle.en,
        namePt: muscle.pt,
        order: index,
        mv: muscle.mv,
        mev: muscle.mev,
        mav: muscle.mav,
        mrv: muscle.mrv,
      },
      update: {
        nameEn: muscle.en,
        namePt: muscle.pt,
        order: index,
        mv: muscle.mv,
        mev: muscle.mev,
        mav: muscle.mav,
        mrv: muscle.mrv,
      },
    });
    ids.set(muscle.key, record.id);
  }

  console.log(`  muscle groups: ${ids.size}`);
  return ids;
}

async function seedExercises(muscleIds: Map<string, string>): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let filledDemos = 0;

  for (const exercise of EXERCISES) {
    const muscleGroupId = muscleIds.get(exercise.muscle);
    if (!muscleGroupId) {
      throw new Error(`Exercise "${exercise.key}" targets unknown muscle "${exercise.muscle}"`);
    }

    const isolation = exercise.type === "isolation";
    // `demoUrl` is deliberately absent: it belongs to the athlete, and an
    // upsert that included it would wipe curated links on every re-seed.
    const data = {
      nameEn: exercise.en,
      namePt: exercise.pt,
      muscleGroupId,
      secondary: exercise.secondary?.length ? JSON.stringify(exercise.secondary) : null,
      equipment: exercise.equipment,
      movementType: exercise.type ?? "compound",
      defaultRepMin: exercise.repMin ?? (isolation ? 10 : 8),
      defaultRepMax: exercise.repMax ?? (isolation ? 15 : 12),
      defaultRestSec: exercise.rest ?? (isolation ? 45 : 75),
      sfr: exercise.sfr ?? 3,
      isCustom: false,
    };

    const inferredDemo = INFERRED_DEMOS[exercise.key];

    const record = await prisma.exercise.upsert({
      where: { key: exercise.key },
      create: {
        key: exercise.key,
        ...data,
        ...(inferredDemo ? { demoUrl: inferredDemo, demoSource: "inferred" } : {}),
      },
      update: data,
    });
    ids.set(exercise.key, record.id);

    // Backfill only. An exercise that already has a link keeps it, whether the
    // athlete chose it or a previous seed inferred it.
    if (inferredDemo) {
      filledDemos += (
        await prisma.exercise.updateMany({
          where: { key: exercise.key, demoUrl: null },
          data: { demoUrl: inferredDemo, demoSource: "inferred" },
        })
      ).count;
    }
  }

  console.log(`  exercises: ${ids.size} (${filledDemos} demo links filled)`);
  return ids;
}

async function seedTemplates(
  muscleIds: Map<string, string>,
  exerciseIds: Map<string, string>,
): Promise<void> {
  const exerciseDefaults = new Map(EXERCISES.map((exercise) => [exercise.key, exercise]));

  for (const template of TEMPLATES) {
    if (template.days.length !== template.daysPerWeek) {
      throw new Error(
        `Template "${template.key}" claims ${template.daysPerWeek} days but defines ${template.days.length}`,
      );
    }

    // Expand the compact slot specs once — both the duration estimate and the
    // rows written below read from the same resolved shape.
    const resolvedDays = template.days.map((day) =>
      day.slots.map((spec) => {
        const slot = parseSlot(spec);
        const defaults = exerciseDefaults.get(slot.exercise);
        if (!defaults) {
          throw new Error(
            `Template "${template.key}" references unknown exercise "${slot.exercise}"`,
          );
        }

        const isolation = defaults.type === "isolation";
        return {
          exercise: slot.exercise,
          muscle: defaults.muscle,
          sets: slot.sets,
          repMin: slot.repMin ?? defaults.repMin ?? (isolation ? 10 : 8),
          repMax: slot.repMax ?? defaults.repMax ?? (isolation ? 15 : 12),
          restSec: template.restSec ?? defaults.rest ?? (isolation ? 45 : 75),
        };
      }),
    );

    const timed: TimedSlot[][] = resolvedDays.map((day) =>
      day.map((slot) => ({ sets: slot.sets, restSec: slot.restSec })),
    );

    const data = {
      nameEn: template.en,
      namePt: template.pt,
      descEn: template.descEn,
      descPt: template.descPt,
      daysPerWeek: template.daysPerWeek,
      weeks: template.weeks,
      level: template.level,
      goal: template.goal,
      estimatedMinutes: estimateProgramMinutes(timed),
      isCustom: false,
    };

    const record = await prisma.programTemplate.upsert({
      where: { key: template.key },
      create: { key: template.key, ...data },
      update: data,
    });

    // Days and slots are fully rebuilt — simpler and safer than diffing, and
    // stock templates are never referenced after a mesocycle is generated.
    await prisma.programTemplateDay.deleteMany({ where: { templateId: record.id } });

    for (const [dayIndex, day] of template.days.entries()) {
      const dayRecord = await prisma.programTemplateDay.create({
        data: {
          templateId: record.id,
          order: dayIndex,
          labelEn: day.en,
          labelPt: day.pt,
        },
      });

      for (const [slotIndex, slot] of resolvedDays[dayIndex]!.entries()) {
        await prisma.programTemplateSlot.create({
          data: {
            dayId: dayRecord.id,
            order: slotIndex,
            exerciseId: exerciseIds.get(slot.exercise)!,
            muscleGroupId: muscleIds.get(slot.muscle)!,
            startingSets: slot.sets,
            repMin: slot.repMin,
            repMax: slot.repMax,
            restSec: slot.restSec,
          },
        });
      }
    }
  }

  console.log(`  programs: ${TEMPLATES.length}`);
}

async function seedTracks(): Promise<void> {
  const templateIds = new Map(
    (
      await prisma.programTemplate.findMany({
        where: { key: { not: null } },
        select: { id: true, key: true },
      })
    ).map((template) => [template.key!, template.id]),
  );

  for (const track of TRACKS) {
    const record = await prisma.programTrack.upsert({
      where: { key: track.key },
      create: {
        key: track.key,
        nameEn: track.en,
        namePt: track.pt,
        descEn: track.descEn,
        descPt: track.descPt,
      },
      update: {
        nameEn: track.en,
        namePt: track.pt,
        descEn: track.descEn,
        descPt: track.descPt,
      },
    });

    // Entries are rebuilt rather than upserted: reordering a track would
    // otherwise leave the old positions behind as duplicates.
    await prisma.programTrackEntry.deleteMany({ where: { trackId: record.id } });

    for (const [order, programKey] of track.programs.entries()) {
      const templateId = templateIds.get(programKey);
      if (!templateId) {
        throw new Error(`Track "${track.key}" references unknown program "${programKey}"`);
      }
      await prisma.programTrackEntry.create({
        data: { trackId: record.id, order, templateId },
      });
    }
  }

  console.log(`  tracks: ${TRACKS.length}`);
}

async function main(): Promise<void> {
  console.log("Seeding MesoPilot…");
  const muscleIds = await seedMuscles();
  const exerciseIds = await seedExercises(muscleIds);
  await seedTemplates(muscleIds, exerciseIds);
  await seedTracks();
  console.log("Done.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
