/**
 * Best-effort muscle group for an imported exercise name.
 *
 * Order is load-bearing and the rules are deliberately not alphabetical:
 * "Leg Press Calf Press" contains "leg press", "Seated Leg Curl" contains
 * "curl", and "Cable Triceps Kickback" contains "kickback". The more specific
 * pattern has to be tested first in each of those pairs.
 *
 * Everything here is a guess. The importer reports what it created and which
 * muscle it assigned so the wrong ones can be corrected in the app.
 */

type Rule = { muscle: string; patterns: RegExp[] };

const RULES: Rule[] = [
  // Beats "leg press" (quads) and "curl" (biceps).
  { muscle: "calves", patterns: [/\bcalf\b/, /\bcalves\b/, /donkey/] },
  {
    muscle: "hamstrings",
    patterns: [/leg curl/, /hamstring/, /\brdl\b/, /romanian/, /stiff.?leg/, /nordic/, /good morning/, /hyperextension/],
  },
  // Beats the glutes' "kickback".
  {
    muscle: "triceps",
    patterns: [/triceps/, /pressdown/, /skull ?crusher/, /french press/, /katana/, /\bdip\b/, /overhead cable ext/, /pushdown/],
  },
  {
    muscle: "glutes",
    patterns: [/glute/, /hip thrust/, /abduction/, /adduction/, /hip ext/, /kickback/, /sumo/],
  },
  { muscle: "forearms", patterns: [/wrist/, /forearm/, /reverse curl/, /zottman/] },
  // After hamstrings' "leg curl" and forearms' "reverse curl".
  { muscle: "biceps", patterns: [/curl/, /preacher/, /bayesian/, /chin.?up/] },
  { muscle: "rear_delts", patterns: [/rear delt/, /reverse (pec|fly|flye)/, /face pull/, /rear.?felt/] },
  { muscle: "side_delts", patterns: [/lateral raise/, /y-?raise/, /upright row/, /lateral fly/] },
  {
    muscle: "front_delts",
    patterns: [/shoulder press/, /overhead press/, /military/, /arnold/, /front raise/, /shoulder/],
  },
  { muscle: "traps", patterns: [/shrug/, /\btrap\b/] },
  {
    muscle: "back",
    patterns: [/\blat\b/, /lat[- ]/, /pulldown/, /pull.?down/, /pull.?up/, /pull.?around/, /pull.?in/, /pullover/, /prayer/, /\brow\b/, /deadlift/, /pull.?over/],
  },
  {
    muscle: "chest",
    // Qualified press patterns only — a bare /press/ would steal "Leg Press".
    patterns: [/bench/, /chest press/, /\bpec\b/, /pec deck/, /\bfly\b/, /\bflye\b/, /crossover/, /push.?up/, /incline.*press/, /decline.*press/],
  },
  {
    muscle: "quads",
    patterns: [/squat/, /leg press/, /leg extension/, /lunge/, /step.?up/, /sissy/, /\bhack\b/, /split squat/, /leg ext/],
  },
  {
    muscle: "abs",
    patterns: [/crunch/, /ab wheel/, /rollout/, /leg raise/, /plank/, /knee raise/, /sit.?up/, /hollow/, /\bab\b/],
  },
];

/** Falls back to the day's own name when the exercise gives nothing away. */
const DAY_FALLBACK: { pattern: RegExp; muscle: string }[] = [
  { pattern: /pull/i, muscle: "back" },
  { pattern: /push/i, muscle: "chest" },
  { pattern: /leg|lower/i, muscle: "quads" },
  { pattern: /arm/i, muscle: "biceps" },
  { pattern: /chest/i, muscle: "chest" },
  { pattern: /back/i, muscle: "back" },
  { pattern: /shoulder/i, muscle: "side_delts" },
  { pattern: /upper/i, muscle: "chest" },
];

export function guessMuscle(exerciseName: string, dayLabel: string): { muscle: string; confident: boolean } {
  const name = exerciseName.toLowerCase();

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(name))) {
      return { muscle: rule.muscle, confident: true };
    }
  }

  for (const fallback of DAY_FALLBACK) {
    if (fallback.pattern.test(dayLabel)) return { muscle: fallback.muscle, confident: false };
  }

  return { muscle: "chest", confident: false };
}

const COMPOUND = [
  /press/, /squat/, /row/, /deadlift/, /pull.?up/, /chin.?up/, /pulldown/, /lunge/, /\bdip\b/, /hip thrust/, /step.?up/,
];

export function guessMovementType(exerciseName: string): "compound" | "isolation" {
  const name = exerciseName.toLowerCase();
  // A pressdown is an elbow-only movement despite reading as a "press".
  if (/pressdown|pushdown|leg press calf/.test(name)) return "isolation";
  return COMPOUND.some((pattern) => pattern.test(name)) ? "compound" : "isolation";
}

const EQUIPMENT_RULES: { equipment: string; pattern: RegExp }[] = [
  { equipment: "cable", pattern: /cable|pulldown|pressdown|pushdown|rope|crossover|prayer/ },
  { equipment: "machine", pattern: /machine|pec deck|leg press|leg extension|leg curl|hack|smith|assisted|hyperextension/ },
  { equipment: "dumbbell", pattern: /\bdb\b|dumbbell/ },
  { equipment: "barbell", pattern: /barbell|\bbar\b|ez-?bar|snatch-?grip|\brdl\b|deadlift|bench press/ },
  { equipment: "bodyweight", pattern: /push.?up|pull.?up|chin.?up|\bdip\b|plank|rollout|leg raise|nordic|sissy/ },
];

export function guessEquipment(exerciseName: string): string {
  const name = exerciseName.toLowerCase();
  // Smith is a machine even though the name says "bar".
  if (/smith/.test(name)) return "smith";
  for (const rule of EQUIPMENT_RULES) {
    if (rule.pattern.test(name)) return rule.equipment;
  }
  return "machine";
}
