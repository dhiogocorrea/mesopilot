import ExcelJS from "exceljs";

/**
 * Parser for the Pure Bodybuilding Program spreadsheets.
 *
 * The workbooks are a single sheet: preamble and a weak-point table at the top,
 * then `BLOCK n:` sections, each containing five `Week n` sections. Within a
 * block, weeks 1–4 carry an identical prescription and week 5 is the deload —
 * so one week is the whole template, and the app's own deload handling covers
 * the rest.
 *
 * Nothing from the source lands in the repo. This reads a file the athlete
 * already owns, on their machine, into their own database.
 */

/** 1-based, matching the sheet's own columns. */
const COL = {
  day: 1, // A
  exercise: 2, // B
  technique: 3, // C
  warmupSets: 4, // D
  workingSets: 5, // E
  reps: 6, // F
  earlyRpe: 11, // K
  lastRpe: 12, // L
  rest: 13, // M
  substitution1: 14, // N
  substitution2: 15, // O
} as const;

export type PbpSlot = {
  name: string;
  technique: string | null;
  warmupSets: string | null;
  workingSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  lastRpe: string | null;
  substitutions: string[];
  /** "A1"/"A2" prefixes mark a superset pair in the source. */
  supersetGroup: string | null;
  /** The author's demonstration video, linked from the exercise name. */
  demoUrl: string | null;
};

export type PbpDay = { label: string; slots: PbpSlot[] };
export type PbpBlock = { name: string; weeks: number; days: PbpDay[] };

/**
 * Excel silently converted rep ranges and warm-up ranges into dates: "8-10"
 * became 2024-08-10, "1-2" became 2023-01-02. The month and day *are* the
 * original range, so the damage is fully reversible — and every date in these
 * columns is a mangled range, since neither column can legitimately hold one.
 */
function unmangle(value: unknown): string | null {
  if (value instanceof Date) return `${value.getMonth() + 1}-${value.getDate()}`;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim() || null;

  if (value && typeof value === "object") {
    // Exercise names are hyperlinks; formatted cells arrive as rich text; and
    // formula cells carry their cached result. All three read as plain text.
    if ("text" in value) return unmangle((value as { text: unknown }).text);
    if ("richText" in value) {
      const parts = (value as { richText: { text?: string }[] }).richText;
      return parts.map((part) => part.text ?? "").join("").trim() || null;
    }
    if ("result" in value) return unmangle((value as { result: unknown }).result);
  }
  return null;
}

function cell(row: ExcelJS.Row, column: number): string | null {
  return unmangle(row.getCell(column).value);
}

/**
 * Each exercise name links to the program author's own demonstration of that
 * exact movement — better provenance than anything this app could infer, so it
 * is carried across as the exercise's demo.
 */
function hyperlink(row: ExcelJS.Row, column: number): string | null {
  const value = row.getCell(column).value as unknown;
  if (value && typeof value === "object" && "hyperlink" in value) {
    const url = (value as { hyperlink: unknown }).hyperlink;
    return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
  }
  return null;
}

/** "10-12" · "8" · "4, 6, 8" · "5,4,3+" · "6-8" (recovered from a date). */
export function parseReps(raw: string | null): { repMin: number; repMax: number } {
  const numbers = (raw ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length === 0) return { repMin: 8, repMax: 12 };
  // Ascending schemes ("4, 6, 8") and mechanical dropsets ("5,4,3+") flatten to
  // their span — the app prescribes one range per exercise.
  return { repMin: Math.min(...numbers), repMax: Math.max(...numbers) };
}

/** "~2-3 min" · "~0.5-1 min" · "~1 min" → seconds, rounded to something loggable. */
export function parseRest(raw: string | null): number {
  const numbers = (raw ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length === 0) return 120;
  const minutes = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  return Math.max(30, Math.round((minutes * 60) / 15) * 15);
}

/** 3 · "3" · "2 per leg". */
export function parseSets(raw: string | null): number {
  const match = /\d+/.exec(raw ?? "");
  return match ? Math.max(1, Math.min(20, Number(match[0]))) : 3;
}

const NOISE = /^(week |block |important |warm up|weak point|the pure bodybuilding|semi-deload)/i;
const REST_DAY = /rest day/i;

function isDayLabel(value: string | null): boolean {
  if (!value) return false;
  const text = value.trim();
  if (!text || NOISE.test(text)) return false;
  return !REST_DAY.test(text);
}

export function parseWorkbook(rows: ExcelJS.Row[]): PbpBlock[] {
  const blocks: PbpBlock[] = [];

  let block: PbpBlock | null = null;
  let blockFirstWeek: number | null = null;
  let week: number | null = null;
  let day: PbpDay | null = null;
  /** Tracked separately from `day` so the merge check reads plainly. */
  let dayLabel: string | null = null;

  for (const row of rows) {
    const first = cell(row, COL.day);
    const exercise = cell(row, COL.exercise);

    if (first) {
      const blockMatch = /^BLOCK\s*(\d+)\s*:?\s*(.*)$/i.exec(first);
      if (blockMatch) {
        block = { name: (blockMatch[2] ?? "").trim(), weeks: 5, days: [] };
        blocks.push(block);
        blockFirstWeek = null;
        week = null;
        day = null;
        dayLabel = null;
        continue;
      }

      const weekMatch = /^Week\s*(\d+)/i.exec(first);
      if (weekMatch) {
        week = Number(weekMatch[1]);
        // Weeks 1–4 of a block are identical, so only the first is captured.
        blockFirstWeek ??= week;
        day = null;
        dayLabel = null;
        continue;
      }

      // A rest-day marker spans the row; without this its own text arrives in
      // the exercise column and would be logged as a movement.
      if (REST_DAY.test(first)) continue;

      if (block && isDayLabel(first)) {
        const label = first.replace(/\s+/g, " ").trim();
        // The day label is merged down its whole block of rows, so every
        // exercise row repeats it. Only a *change* starts a new day.
        if (dayLabel !== label) {
          dayLabel = label;
          day = { label, slots: [] };
          if (week === blockFirstWeek) block.days.push(day);
        }
      }
    }

    if (!block || !day || week !== blockFirstWeek) continue;
    if (!exercise || exercise === "Exercise") continue;
    // Merged cells also echo the day label into column B on the header row.
    if (exercise === day.label || REST_DAY.test(exercise)) continue;

    const supersetMatch = /^([A-Z]\d):\s*(.*)$/.exec(exercise);
    const technique = cell(row, COL.technique);

    day.slots.push({
      name: (supersetMatch?.[2] ?? exercise).replace(/\s+/g, " ").trim(),
      supersetGroup: supersetMatch?.[1] ?? null,
      demoUrl: hyperlink(row, COL.exercise),
      technique: technique && technique !== "N/A" ? technique : null,
      warmupSets: cell(row, COL.warmupSets),
      workingSets: parseSets(cell(row, COL.workingSets)),
      ...parseReps(cell(row, COL.reps)),
      restSec: parseRest(cell(row, COL.rest)),
      lastRpe: cell(row, COL.lastRpe),
      substitutions: [cell(row, COL.substitution1), cell(row, COL.substitution2)].filter(
        (value): value is string => Boolean(value) && value !== "N/A",
      ),
    });
  }

  // A block with no populated days means the layout drifted from what this
  // parser expects; surfacing it beats importing an empty program.
  return blocks.filter((entry) => entry.days.some((d) => d.slots.length > 0));
}

export async function readWorkbook(path: string): Promise<PbpBlock[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`${path} has no worksheets`);

  const rows: ExcelJS.Row[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => rows.push(row));
  return parseWorkbook(rows);
}
