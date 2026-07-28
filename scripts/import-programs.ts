import "dotenv/config";

import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { estimateProgramMinutes } from "../src/lib/training-time";
import { guessEquipment, guessMovementType, guessMuscle } from "./guess-muscle";
import { readWorkbook, type PbpBlock } from "./parse-pbp";

/**
 * Imports Pure Bodybuilding Program spreadsheets into the local database as
 * custom programs.
 *
 *   npm run import:programs -- "D:/Documentos/workout"
 *
 * The source files stay wherever they are — nothing is copied into the repo.
 * This is a paid program: importing your own copy for your own use is fine,
 * committing its contents to source control and shipping them is not, which is
 * exactly why this is an importer and not a seed.
 *
 * Re-running is safe: programs are matched by name and rebuilt in place, and
 * exercises are matched before being created.
 */

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  return url;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }),
});

/** Loose enough to match "EZ-Bar Skull Crusher" to "EZ-bar skullcrusher". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Pure_Bodybuilding_-_PPL.xlsx" → { phase: 1, split: "PPL" } */
function describeFile(fileName: string): { phase: number; split: string } {
  const phase = /phase\s*2/i.test(fileName) ? 2 : 1;
  const lower = fileName.toLowerCase();
  const split = /ppl|push.?pull/.test(lower)
    ? "PPL"
    : /upper.?lower/.test(lower)
      ? "Upper / Lower"
      : /full.?body/.test(lower)
        ? "Full Body"
        : basename(fileName, extname(fileName));
  return { phase, split };
}

type Stats = { matched: number; created: string[]; demosUpgraded: number };

/**
 * How many weeks one pass through the workbook's sessions takes.
 *
 * A workbook lists a *rotation*, not a week. Nobody trains more than about six
 * times in seven days, so a longer rotation is spread across as many weeks as
 * it needs — Nippard's PPL is eight sessions (Pull/Push/Legs/Arms #1 then #2)
 * run four a week over a fortnight, not eight days a week. Storing the raw
 * count as `daysPerWeek` is what made those programs match nobody's profile.
 */
const MAX_SESSIONS_PER_WEEK = 6;

function rotationWeeks(sessions: number): number {
  return Math.max(1, Math.ceil(sessions / MAX_SESSIONS_PER_WEEK));
}

async function resolveExercise(
  name: string,
  dayLabel: string,
  restSec: number,
  repMin: number,
  repMax: number,
  demoUrl: string | null,
  userId: string,
  index: Map<string, string>,
  muscleIds: Map<string, string>,
  stats: Stats,
): Promise<string> {
  const key = normalize(name);
  const existing = index.get(key);
  if (existing) {
    stats.matched += 1;
    // The author's own demo for this exact movement beats a link this app
    // inferred from a search title — but never an athlete's own choice.
    if (demoUrl) {
      const updated = await prisma.exercise.updateMany({
        where: { id: existing, OR: [{ demoUrl: null }, { demoSource: "inferred" }] },
        data: { demoUrl, demoSource: "program" },
      });
      stats.demosUpgraded += updated.count;
    }
    return existing;
  }

  const { muscle, confident } = guessMuscle(name, dayLabel);
  const muscleGroupId = muscleIds.get(muscle) ?? muscleIds.get("chest")!;

  const created = await prisma.exercise.create({
    data: {
      nameEn: name,
      // Imported names have no translation; the athlete can rename either.
      namePt: name,
      muscleGroupId,
      equipment: guessEquipment(name),
      movementType: guessMovementType(name),
      defaultRepMin: repMin,
      defaultRepMax: repMax,
      defaultRestSec: restSec,
      demoUrl,
      demoSource: demoUrl ? "program" : null,
      isCustom: true,
      userId,
    },
  });

  index.set(key, created.id);
  stats.created.push(`${confident ? " " : "?"} ${muscle.padEnd(12)} ${name}`);
  return created.id;
}

async function importBlock(
  block: PbpBlock,
  label: string,
  userId: string,
  index: Map<string, string>,
  muscleIds: Map<string, string>,
  stats: Stats,
): Promise<string> {
  const name = `${label} · ${block.name || "Block"}`;

  const timed = block.days.map((day) =>
    day.slots.map((slot) => ({ sets: slot.workingSets, restSec: slot.restSec })),
  );

  const weeksPerRotation = rotationWeeks(block.days.length);
  const daysPerWeek = Math.ceil(block.days.length / weeksPerRotation);

  const description = [
    `Imported from your own copy of the Pure Bodybuilding Program.`,
    weeksPerRotation > 1
      ? `${block.days.length} sessions per rotation, ${daysPerWeek} a week over ${weeksPerRotation} weeks.`
      : `${block.days.length} sessions per rotation.`,
    `Weeks 1–4 run this prescription; the last week is a deload.`,
  ].join(" ");

  const fields = {
    nameEn: name,
    namePt: name,
    descEn: description,
    descPt: description,
    daysPerWeek,
    weeks: block.weeks,
    level: "advanced",
    goal: "hypertrophy",
    estimatedMinutes: estimateProgramMinutes(timed),
    isCustom: true,
    // Theirs to edit, but not written by them — see ProgramTemplate.source.
    source: "import",
    userId,
  };

  // Resolved before the transaction opens. SQLite holds a single write lock, so
  // creating an exercise through the outer client from inside `$transaction`
  // deadlocks against it.
  const exerciseIds = new Map<string, string>();
  for (const day of block.days) {
    for (const slot of day.slots) {
      if (exerciseIds.has(slot.name)) continue;
      exerciseIds.set(
        slot.name,
        await resolveExercise(
          slot.name,
          day.label,
          slot.restSec,
          slot.repMin,
          slot.repMax,
          slot.demoUrl,
          userId,
          index,
          muscleIds,
          stats,
        ),
      );
    }
  }

  const muscleByExercise = new Map(
    (
      await prisma.exercise.findMany({
        where: { id: { in: [...exerciseIds.values()] } },
        select: { id: true, muscleGroupId: true },
      })
    ).map((exercise) => [exercise.id, exercise.muscleGroupId]),
  );

  const templateId = await prisma.$transaction(async (tx) => {
    const existing = await tx.programTemplate.findFirst({
      where: { userId, isCustom: true, nameEn: name },
      select: { id: true },
    });

    const template = existing
      ? await tx.programTemplate.update({ where: { id: existing.id }, data: fields })
      : await tx.programTemplate.create({ data: fields });

    // Days and slots are rebuilt wholesale — a re-import should converge on the
    // file, not merge with whatever a previous run produced.
    await tx.programTemplateDay.deleteMany({ where: { templateId: template.id } });

    // Two bulk writes, not one per day and slot. A PPL block is 8 days and ~49
    // slots; as sequential round-trips to a hosted database that overruns
    // Prisma's 5s interactive transaction timeout well before it finishes.
    const dayRecords = await tx.programTemplateDay.createManyAndReturn({
      data: block.days.map((day, dayIndex) => ({
        templateId: template.id,
        order: dayIndex,
        labelEn: day.label,
        labelPt: day.label,
      })),
      select: { id: true, order: true },
    });

    const dayIdByOrder = new Map(dayRecords.map((row) => [row.order, row.id]));

    await tx.programTemplateSlot.createMany({
      data: block.days.flatMap((day, dayIndex) =>
        day.slots.map((slot, slotIndex) => {
          const exerciseId = exerciseIds.get(slot.name)!;
          return {
            dayId: dayIdByOrder.get(dayIndex)!,
            order: slotIndex,
            exerciseId,
            muscleGroupId: muscleByExercise.get(exerciseId)!,
            startingSets: slot.workingSets,
            repMin: slot.repMin,
            repMax: slot.repMax,
            restSec: slot.restSec,
          };
        }),
      ),
    });

    return template.id;
  });

  const slots = block.days.reduce((total, day) => total + day.slots.length, 0);
  console.log(
    `  • ${name}  —  ${block.days.length} days, ${slots} slots, ~${fields.estimatedMinutes} min`,
  );
  return templateId;
}

type ImportedBlock = { split: string; phase: number; order: number; templateId: string };

/**
 * A published program is usually several blocks meant to be run back to back.
 * They arrive here as separate templates, so they are stitched into one track
 * per split, ordered by phase and then by their position in the workbook.
 */
async function buildTracks(imported: ImportedBlock[], userId: string): Promise<void> {
  const bySplit = new Map<string, ImportedBlock[]>();
  for (const block of imported) {
    bySplit.set(block.split, [...(bySplit.get(block.split) ?? []), block]);
  }

  console.log("Tracks:");
  for (const [split, blocks] of bySplit) {
    const ordered = [...blocks].sort((a, b) => a.phase - b.phase || a.order - b.order);
    const name = `Pure Bodybuilding · ${split}`;
    const description = `${ordered.length} blocks back to back, roughly ${ordered.length * 5} weeks.`;

    const fields = {
      nameEn: name,
      namePt: name,
      descEn: description,
      descPt: description,
      isCustom: true,
      source: "import",
      userId,
    };

    await prisma.$transaction(async (tx) => {
      const existing = await tx.programTrack.findFirst({
        where: { userId, isCustom: true, nameEn: name },
        select: { id: true },
      });

      const track = existing
        ? await tx.programTrack.update({ where: { id: existing.id }, data: fields })
        : await tx.programTrack.create({ data: fields });

      await tx.programTrackEntry.deleteMany({ where: { trackId: track.id } });
      for (const [order, block] of ordered.entries()) {
        await tx.programTrackEntry.create({
          data: { trackId: track.id, order, templateId: block.templateId },
        });
      }
    });

    console.log(`  • ${name}  —  ${ordered.length} blocks`);
  }
}

/**
 * Imported programs belong to one athlete. With a single account that is
 * unambiguous, so the username is optional — but it stops being a guess the
 * moment a second person signs up, and importing someone else's paid program
 * into their library is not a mistake worth risking.
 */
async function resolveUser(username?: string): Promise<{ id: string; name: string }> {
  if (username) {
    const user = await prisma.user.findUnique({
      where: { usernameLower: username.trim().toLowerCase() },
      select: { id: true, name: true },
    });
    if (!user) throw new Error(`No user named "${username}"`);
    return user;
  }

  const users = await prisma.user.findMany({ select: { id: true, name: true, username: true } });
  if (users.length === 0) throw new Error("No accounts yet — sign up in the app before importing.");
  if (users.length > 1) {
    throw new Error(
      `Several accounts exist (${users.map((u) => u.username).join(", ")}). ` +
        `Say which: npm run import:programs -- "<folder>" <username>`,
    );
  }
  return users[0]!;
}

async function main(): Promise<void> {
  const root = process.argv[2];
  if (!root) {
    console.error(
      'Usage: npm run import:programs -- "<folder containing the .xlsx files>" [username]',
    );
    process.exitCode = 1;
    return;
  }

  const user = await resolveUser(process.argv[3]);

  const muscles = await prisma.muscleGroup.findMany({ select: { id: true, key: true } });
  const muscleIds = new Map(muscles.map((muscle) => [muscle.key, muscle.id]));

  const exercises = await prisma.exercise.findMany({
    where: { archived: false },
    select: { id: true, nameEn: true, namePt: true },
  });
  const index = new Map<string, string>();
  for (const exercise of exercises) {
    index.set(normalize(exercise.nameEn), exercise.id);
    index.set(normalize(exercise.namePt), exercise.id);
  }

  const stats: Stats = { matched: 0, created: [], demosUpgraded: 0 };
  const files = await collectWorkbooks(root);

  if (files.length === 0) {
    console.error(`No .xlsx files found under ${root}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Importing ${files.length} workbook(s) for ${user.name}…\n`);

  const imported: ImportedBlock[] = [];

  for (const file of files) {
    const { phase, split } = describeFile(basename(file));
    const blocks = await readWorkbook(file);
    console.log(`${basename(file)}  →  ${blocks.length} block(s)`);

    for (const [order, block] of blocks.entries()) {
      const templateId = await importBlock(
        block,
        `PBP P${phase} · ${split}`,
        user.id,
        index,
        muscleIds,
        stats,
      );
      imported.push({ split, phase, order, templateId });
    }
    console.log();
  }

  await buildTracks(imported, user.id);
  console.log();

  console.log(
    `Exercises: ${stats.matched} matched, ${stats.created.length} created, ` +
      `${stats.demosUpgraded} existing demos replaced with the program author's own.`,
  );
  if (stats.created.length > 0) {
    console.log(`\nCreated (muscle group is a guess; "?" means it fell back to the day name):`);
    for (const line of stats.created.sort()) console.log(`   ${line}`);
  }
}

async function collectWorkbooks(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (
        extname(entry.name).toLowerCase() === ".xlsx" &&
        // Excel's lock file for an open workbook.
        !entry.name.startsWith("~$")
      ) {
        found.push(path);
      }
    }
  }

  await walk(root);
  return found.sort();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
