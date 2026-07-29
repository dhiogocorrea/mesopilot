import { basename, extname } from "node:path";

import type { PbpBlock } from "./parse-pbp";
import { readWorkbook as readPbp } from "./parse-pbp";
import { readWorkbook as readMinMax } from "./parse-minmax";

/**
 * Which parser a workbook needs, and what to call what comes out of it.
 *
 * Chosen by filename because that is the only thing available before opening
 * the file, and both publishers name their exports predictably. A workbook that
 * matches nothing falls back to the Pure Bodybuilding layout, which is the one
 * that fails loudly — it yields no blocks rather than nonsense ones.
 */

export type Family = "pbp" | "minmax";

export type Reader = {
  family: Family;
  readWorkbook: (path: string) => Promise<PbpBlock[]>;
  /** Groups blocks from different files into one track. */
  trackKey: string;
  /** Human name for the track these blocks belong to. */
  trackName: string;
  /** Prefix for each block's own name. */
  blockLabel: string;
  /** The published program these blocks came from, named in the description. */
  programName: string;
  /** Orders blocks within a track when several files contribute to one. */
  phase: number;
};

export function readerFor(path: string): Reader {
  const file = basename(path, extname(path));

  if (/min.?max/i.test(file)) {
    // "The_Min-Max_Program_4x" → the 4x and 5x variants are separate tracks:
    // they are alternative frequencies, not consecutive phases.
    const frequency = /(\d)\s*x/i.exec(file)?.[1] ?? "?";
    return {
      family: "minmax",
      readWorkbook: readMinMax,
      trackKey: `minmax_${frequency}x`,
      trackName: `The Min-Max Program · ${frequency}x`,
      blockLabel: `Min-Max ${frequency}x`,
      programName: "The Min-Max Program",
      phase: 1,
    };
  }

  const phase = /phase\s*2/i.test(file) ? 2 : 1;
  const lower = file.toLowerCase();
  const split = /ppl|push.?pull/.test(lower)
    ? "PPL"
    : /upper.?lower/.test(lower)
      ? "Upper / Lower"
      : /full.?body/.test(lower)
        ? "Full Body"
        : file;

  return {
    family: "pbp",
    readWorkbook: readPbp,
    trackKey: `pbp_${split}`,
    trackName: `Pure Bodybuilding · ${split}`,
    blockLabel: `PBP P${phase} · ${split}`,
    programName: "the Pure Bodybuilding Program",
    phase,
  };
}
