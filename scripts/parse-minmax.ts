import ExcelJS from "exceljs";

import {
  cell,
  hyperlink,
  parseReps,
  parseRest,
  parseSets,
  type PbpBlock,
  type PbpDay,
  type PbpSlot,
} from "./parse-pbp";

/**
 * Parser for the Min-Max Program spreadsheets.
 *
 * Same publisher as the Pure Bodybuilding workbooks and the same date-mangling
 * to undo, but a different sheet: one sheet per frequency, `Block n` sections
 * containing six `Week n` sections each, and every column shifted one to the
 * right of the PBP layout. Close enough to share the cell helpers, far enough
 * that sharing the row walker would be a mess of conditionals.
 *
 * **Within a block every week is identical except the RIR targets** — the sets,
 * reps, rest and exercise selection do not move. RIR is exactly what this app's
 * engine ramps for itself, so one week is the entire template and which week we
 * read does not matter.
 *
 * Nothing from the source lands in the repo. This reads a file the athlete
 * already owns, on their machine.
 */

/** 1-based, matching the sheet's own columns. */
const COL = {
  day: 2, // B — also carries "Block n" / "Week n" markers on structural rows
  exercise: 3, // C
  technique: 4, // D
  warmupSets: 5, // E
  workingSets: 6, // F
  reps: 7, // G
  firstRir: 12, // L
  lastRir: 13, // M
  rest: 14, // N
  substitution1: 15, // O
  substitution2: 16, // P
} as const;

const BLOCK = /^block\s+(\d+)/i;
const WEEK = /^week\s+(\d+)/i;
const REST_DAY = /rest day/i;
/** The three stacked header rows all repeat "Exercise" in the name column. */
const HEADER = /^exercise$/i;

export function parseWorkbook(rows: ExcelJS.Row[]): PbpBlock[] {
  const blocks: PbpBlock[] = [];

  let block: PbpBlock | null = null;
  let day: PbpDay | null = null;
  let dayLabel: string | null = null;
  let weekLabel: string | null = null;
  let weeksInBlock = 0;

  for (const row of rows) {
    const label = cell(row, COL.day)?.trim() ?? "";
    const name = cell(row, COL.exercise)?.trim() ?? "";

    const blockMatch = BLOCK.exec(label);
    if (blockMatch) {
      block = { name: `Block ${blockMatch[1]}`, weeks: 0, days: [] };
      blocks.push(block);
      day = null;
      dayLabel = null;
      weekLabel = null;
      weeksInBlock = 0;
      continue;
    }

    // A week header. Three rows carry it, so only a *change* counts.
    if (HEADER.test(name) && WEEK.test(label)) {
      if (label !== weekLabel) {
        weekLabel = label;
        weeksInBlock += 1;
        if (block) block.weeks = weeksInBlock;
        // A new week restarts the day sequence, but only the first week's
        // prescription is kept — see the note above.
        day = null;
        dayLabel = null;
      }
      continue;
    }

    if (!block || !name || REST_DAY.test(label) || REST_DAY.test(name)) continue;

    // Merged banner rows repeat their text across every column.
    if (name === label) continue;

    // Everything after week one is the same prescription at a lower RIR.
    if (weeksInBlock !== 1) continue;

    if (label && label !== dayLabel) {
      dayLabel = label;
      day = { label, slots: [] };
      block.days.push(day);
    }
    if (!day) continue;

    day.slots.push(toSlot(row, name));
  }

  // A block with no readable days is a parsing failure, not an empty block.
  return blocks.filter((entry) => entry.days.length > 0);
}

function toSlot(row: ExcelJS.Row, name: string): PbpSlot {
  const { repMin, repMax } = parseReps(cell(row, COL.reps));
  const technique = cell(row, COL.technique);

  const substitutions = [cell(row, COL.substitution1), cell(row, COL.substitution2)].filter(
    (value): value is string => Boolean(value) && !/^see notes$/i.test(value ?? ""),
  );

  return {
    name,
    // "N/A" is how the sheet says "none"; carrying it through would print it.
    technique: technique && !/^n\/?a$/i.test(technique) ? technique : null,
    warmupSets: cell(row, COL.warmupSets),
    workingSets: parseSets(cell(row, COL.workingSets)),
    repMin,
    repMax,
    restSec: parseRest(cell(row, COL.rest)),
    lastRpe: cell(row, COL.lastRir),
    substitutions,
    supersetGroup: null,
    demoUrl: hyperlink(row, COL.exercise),
  };
}

export async function readWorkbook(path: string): Promise<PbpBlock[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);

  return workbook.worksheets.flatMap((sheet) => {
    const rows: ExcelJS.Row[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => rows.push(row));
    return parseWorkbook(rows);
  });
}
