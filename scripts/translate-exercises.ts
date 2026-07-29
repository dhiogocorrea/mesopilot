import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { toPortuguese } from "../src/lib/i18n/exercise-names";

/**
 * Fills in Portuguese names for exercises that only have an English one.
 *
 *   npm run translate:exercises            # print what would change
 *   npm run translate:exercises -- --write # apply it
 *
 * Only touches rows where `namePt` still equals `nameEn`, which is how the
 * importer marks "no translation available" — a name the athlete has edited
 * themselves is never overwritten. Re-running is safe and idempotent.
 */

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  return url;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }),
});

async function main(): Promise<void> {
  const write = process.argv.includes("--write");

  const untranslated = await prisma.exercise.findMany({
    where: { archived: false },
    select: { id: true, nameEn: true, namePt: true },
    orderBy: { nameEn: "asc" },
  });

  const pending = untranslated.filter((row) => row.nameEn === row.namePt);
  const translated: { id: string; nameEn: string; namePt: string }[] = [];
  const missed: string[] = [];

  for (const row of pending) {
    const namePt = toPortuguese(row.nameEn);
    if (namePt && namePt !== row.nameEn) {
      translated.push({ id: row.id, nameEn: row.nameEn, namePt });
    } else {
      missed.push(row.nameEn);
    }
  }

  for (const row of translated) {
    console.log(`  ${row.nameEn.padEnd(46)} → ${row.namePt}`);
  }

  if (missed.length > 0) {
    console.log(`\nNo vocabulary for ${missed.length}; these keep their English name:`);
    for (const name of missed) console.log(`  · ${name}`);
  }

  console.log(
    `\n${translated.length} of ${pending.length} translated` +
      (write ? "" : "  (dry run — pass --write to apply)"),
  );

  if (!write || translated.length === 0) return;

  // Deliberately not one transaction: 142 updates overran Prisma's 5s
  // interactive limit against a hosted database. They are independent
  // single-column writes and the script is idempotent, so a partial run simply
  // finishes on the next one — atomicity buys nothing and costs the timeout.
  const CHUNK = 20;
  for (let index = 0; index < translated.length; index += CHUNK) {
    await Promise.all(
      translated
        .slice(index, index + CHUNK)
        .map((row) =>
          prisma.exercise.update({ where: { id: row.id }, data: { namePt: row.namePt } }),
        ),
    );
  }

  console.log(`Written ${translated.length}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
