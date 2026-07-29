/**
 * English → Brazilian Portuguese for exercise names.
 *
 * The seeded library is translated by hand in `prisma/seed-data.ts`. This exists
 * for *imported* exercises, which arrive with only an English name — the
 * importer used to copy it into `namePt`, so a Portuguese athlete read a
 * library half in English.
 *
 * Gym names are compositional — `[modifiers] [equipment] [movement]` — so this
 * composes rather than lists: a vocabulary of movements, equipment and
 * modifiers, reassembled in Portuguese word order with the adjectives agreeing
 * with the head noun's gender. That way the next imported program is mostly
 * translated the moment it lands, instead of needing another hundred rows of
 * lookup table.
 *
 * The vocabulary is generic gym Portuguese. It is deliberately not a list of
 * any particular program's exercises, which is also why it can live here.
 *
 * `null` means "no better than the English" — callers keep the original rather
 * than inventing something.
 */

type Gender = "m" | "f";
type Head = { pt: string; gender: Gender };

/**
 * Movement names, matched against the *end* of the string, longest first — so
 * "Lat Pulldown" wins over "Pulldown" and "Preacher Curl" over "Curl".
 */
const HEADS: Record<string, Head> = {
  // Pull
  "lat pulldown": { pt: "Puxada", gender: "f" },
  pulldown: { pt: "Puxada", gender: "f" },
  "lat pull-in": { pt: "Puxada", gender: "f" },
  "lat pull-around": { pt: "Puxada", gender: "f" },
  "lat prayer": { pt: "Pullover na polia", gender: "m" },
  "pull-up": { pt: "Barra fixa", gender: "f" },
  "chin-up": { pt: "Barra fixa supinada", gender: "f" },
  row: { pt: "Remada", gender: "f" },
  shrug: { pt: "Encolhimento", gender: "m" },
  "shrug-in": { pt: "Encolhimento", gender: "m" },
  "face pull": { pt: "Face pull", gender: "m" },
  "dead hang": { pt: "Pendurado na barra", gender: "m" },

  // Push
  "bench press": { pt: "Supino", gender: "m" },
  "chest press": { pt: "Supino", gender: "m" },
  "shoulder press": { pt: "Desenvolvimento", gender: "m" },
  "overhead press": { pt: "Desenvolvimento", gender: "m" },
  "french press": { pt: "Tríceps francês", gender: "m" },
  "jm press": { pt: "JM press", gender: "m" },
  press: { pt: "Supino", gender: "m" },
  pushup: { pt: "Flexão de braço", gender: "f" },
  dip: { pt: "Paralelas", gender: "f" },
  flye: { pt: "Crucifixo", gender: "m" },
  "pec deck": { pt: "Voador", gender: "m" },
  "pec flye": { pt: "Crucifixo", gender: "m" },
  crossover: { pt: "Crossover", gender: "m" },

  // Arms
  "preacher curl": { pt: "Rosca scott", gender: "f" },
  "scott curl": { pt: "Rosca scott", gender: "f" },
  "hammer curl": { pt: "Rosca martelo", gender: "f" },
  "wrist curl": { pt: "Rosca de punho", gender: "f" },
  "stretch-curl": { pt: "Rosca alongada", gender: "f" },
  "short-head curl": { pt: "Rosca cabeça curta", gender: "f" },
  curl: { pt: "Rosca", gender: "f" },
  "wrist extension": { pt: "Extensão de punho", gender: "f" },
  "triceps extension": { pt: "Extensão de tríceps", gender: "f" },
  "triceps pressdown": { pt: "Tríceps na polia", gender: "m" },
  "triceps press": { pt: "Tríceps na polia", gender: "m" },
  "triceps kickback": { pt: "Tríceps coice", gender: "m" },
  pressdown: { pt: "Tríceps na polia", gender: "m" },
  "skull crusher": { pt: "Tríceps testa", gender: "m" },

  // Delts
  "lateral raise": { pt: "Elevação lateral", gender: "f" },
  "y-raise": { pt: "Elevação em Y", gender: "f" },
  "front raise": { pt: "Elevação frontal", gender: "f" },
  "reverse flye": { pt: "Crucifixo inverso", gender: "m" },

  // Legs
  squat: { pt: "Agachamento", gender: "m" },
  "split squat": { pt: "Agachamento búlgaro", gender: "m" },
  "leg press": { pt: "Leg press", gender: "m" },
  "calf press": { pt: "Panturrilha no leg press", gender: "f" },
  "calf raise": { pt: "Elevação de panturrilha", gender: "f" },
  "calf jumps": { pt: "Saltos de panturrilha", gender: "m" },
  "leg curl": { pt: "Mesa flexora", gender: "f" },
  "leg extension": { pt: "Cadeira extensora", gender: "f" },
  "leg raise": { pt: "Elevação de pernas", gender: "f" },
  lunge: { pt: "Afundo", gender: "m" },
  "reverse lunge": { pt: "Afundo reverso", gender: "m" },
  rdl: { pt: "Levantamento terra romeno", gender: "m" },
  deadlift: { pt: "Levantamento terra", gender: "m" },
  "hip thrust": { pt: "Elevação pélvica", gender: "f" },
  "hip abduction": { pt: "Abdução de quadril", gender: "f" },
  "hip adduction": { pt: "Adução de quadril", gender: "f" },
  "glute-ham raise": { pt: "Flexora nórdica", gender: "f" },
  hyperextension: { pt: "Hiperextensão lombar", gender: "f" },

  // Core
  crunch: { pt: "Abdominal", gender: "m" },
  "russian twists": { pt: "Abdominal russo", gender: "m" },
  "dragon flag": { pt: "Dragon flag", gender: "m" },
  "stomach vacuums": { pt: "Vacuum abdominal", gender: "m" },
};

/** Equipment becomes a prepositional phrase, which sits right after the head. */
const EQUIPMENT: Record<string, string> = {
  cable: "no cabo",
  "high-cable": "na polia alta",
  "high cable": "na polia alta",
  "dual-cable": "com dois cabos",
  db: "com halteres",
  dumbbell: "com halteres",
  barbell: "com barra",
  "ez-bar": "com barra W",
  "straight-bar": "com barra reta",
  machine: "na máquina",
  "smith machine": "no Smith",
  smith: "no Smith",
  "t-bar": "cavalinho",
  rope: "com corda",
  "cable rope": "com corda no cabo",
  "medicine ball": "com bola medicinal",
  "roman chair": "na cadeira romana",
  "leg press": "no leg press",
  "belt": "com cinto",
};

/** Adjectives and adverbial phrases. Two forms where Portuguese inflects. */
const MODIFIERS: Record<string, { m: string; f: string }> = {
  seated: { m: "sentado", f: "sentada" },
  standing: { m: "em pé", f: "em pé" },
  lying: { m: "deitado", f: "deitada" },
  kneeling: { m: "ajoelhado", f: "ajoelhada" },
  "half-kneeling": { m: "semi-ajoelhado", f: "semi-ajoelhada" },
  incline: { m: "inclinado", f: "inclinada" },
  "low incline": { m: "pouco inclinado", f: "pouco inclinada" },
  "low-incline": { m: "pouco inclinado", f: "pouco inclinada" },
  decline: { m: "declinado", f: "declinada" },
  flat: { m: "reto", f: "reta" },
  "bent-over": { m: "curvado", f: "curvada" },
  "lean-back": { m: "inclinado para trás", f: "inclinada para trás" },
  "chest-supported": { m: "com apoio no peito", f: "com apoio no peito" },
  assisted: { m: "assistido", f: "assistida" },
  paused: { m: "com pausa", f: "com pausa" },
  weighted: { m: "com peso", f: "com peso" },
  alternating: { m: "alternado", f: "alternada" },
  "1-arm": { m: "unilateral", f: "unilateral" },
  "single-arm": { m: "unilateral", f: "unilateral" },
  "single-leg": { m: "unilateral", f: "unilateral" },
  "close-grip": { m: "pegada fechada", f: "pegada fechada" },
  "wide-grip": { m: "pegada aberta", f: "pegada aberta" },
  "neutral-grip": { m: "pegada neutra", f: "pegada neutra" },
  "reverse-grip": { m: "pegada inversa", f: "pegada inversa" },
  "snatch-grip": { m: "pegada de arranco", f: "pegada de arranco" },
  overhand: { m: "pegada pronada", f: "pegada pronada" },
  overhead: { m: "acima da cabeça", f: "acima da cabeça" },
  deficit: { m: "com déficit", f: "com déficit" },
  "bottom-half": { m: "meia amplitude", f: "meia amplitude" },
  "slow-eccentric": { m: "com excêntrica lenta", f: "com excêntrica lenta" },
  "super-rom": { m: "amplitude ampliada", f: "amplitude ampliada" },
  "super-stretch": { m: "alongado", f: "alongada" },
  reverse: { m: "inverso", f: "inversa" },
  concentration: { m: "concentrado", f: "concentrada" },
  cheat: { m: "com impulso", f: "com impulso" },
  cuffed: { m: "com caneleira", f: "com caneleira" },
  "cross-body": { m: "cruzado", f: "cruzada" },
  "arms-extended": { m: "com braços estendidos", f: "com braços estendidos" },
  "rear delt": { m: "para deltoide posterior", f: "para deltoide posterior" },
  "lat-focused": { m: "focada no dorsal", f: "focada no dorsal" },
  sissy: { m: "sissy", f: "sissy" },
  bayesian: { m: "bayesiano", f: "bayesiana" },
  "super-bayesian": { m: "bayesiano", f: "bayesiana" },
  zottman: { m: "Zottman", f: "Zottman" },
  "modified zottman": { m: "Zottman modificado", f: "Zottman modificada" },
  "inverse zottman": { m: "Zottman inverso", f: "Zottman inversa" },
  kelso: { m: "Kelso", f: "Kelso" },
  meadows: { m: "Meadows", f: "Meadows" },
  pendlay: { m: "Pendlay", f: "Pendlay" },
  hack: { m: "hack", f: "hack" },
  hammer: { m: "martelo", f: "martelo" },
  diverging: { m: "divergente", f: "divergente" },
  bulgarian: { m: "búlgaro", f: "búlgara" },
  katana: { m: "katana", f: "katana" },
  moto: { m: "moto", f: "moto" },
  "n1-style": { m: "estilo N1", f: "estilo N1" },
  "constant tension": { m: "tensão constante", f: "tensão constante" },
  "elbows-out": { m: "cotovelos abertos", f: "cotovelos abertos" },
  "dual-handle": { m: "com dois punhos", f: "com dois punhos" },
  "behind-the-back": { m: "por trás do corpo", f: "por trás do corpo" },
  "45°": { m: "45°", f: "45°" },
};

/** Whole names that do not decompose, or that read badly when they do. */
const OVERRIDES: Record<string, string> = {
  "squat (your choice)": "Agachamento (à sua escolha)",
  "belt squat": "Agachamento no cinto",
  "sissy squat": "Agachamento sissy",
  "dead hang (optional)": "Pendurado na barra (opcional)",
  "dragon flag": "Dragon flag",
  "stomach vacuums": "Vacuum abdominal",
  "medicine ball russian twists": "Abdominal russo com bola",
  "cable crossover ladder": "Crossover no cabo em escada",
  "leg press calf press": "Panturrilha no leg press",
  "roman chair leg raise": "Elevação de pernas na cadeira romana",
  "glute-ham raise": "Flexora nórdica",
  "weak point exercise 1": "Exercício de ponto fraco 1",
  "weak point exercise 2": "Exercício de ponto fraco 2",
  "assisted pull-up": "Barra fixa assistida",
  "wide-grip pull-up": "Barra fixa pegada aberta",
  "bottom-2/3 constant tension preacher curl": "Rosca scott tensão constante (2/3 inferiores)",
  "chest-supported t-bar row + kelso shrug":
    "Remada cavalinho com apoio no peito + encolhimento Kelso",
  "inverse db zottman curl": "Rosca Zottman invertida com halteres",
  "triceps diverging pressdown": "Tríceps na polia divergente",
  // "Tríceps na polia" already says cable; "no cabo" on top of it stutters.
  "cable triceps pressdown": "Tríceps na polia",
  "cable triceps press": "Tríceps na polia",
};

/** Parentheticals worth carrying across; anything else is dropped. */
const NOTES: Record<string, string> = {
  optional: "opcional",
  "w/ integrated partials": "com parciais integradas",
  "mechanical dropset": "dropset mecânico",
  amrap: "máximo de repetições",
  bar: "barra",
  "wide grip": "pegada aberta",
  "long rope or 2 ropes": "corda longa ou 2 cordas",
  "mid-back + lats": "meio das costas + dorsais",
};

const HEAD_KEYS = Object.keys(HEADS).sort((a, b) => b.length - a.length);
const EQUIPMENT_KEYS = Object.keys(EQUIPMENT).sort((a, b) => b.length - a.length);
const MODIFIER_KEYS = Object.keys(MODIFIERS).sort((a, b) => b.length - a.length);

export function toPortuguese(nameEn: string): string | null {
  const trimmed = nameEn.trim();
  if (!trimmed) return null;

  // "Superset A1: Assisted Pull-Up" — the label is structure, not a name.
  const supersetMatch = /^superset\s+([a-z]\d):\s*(.+)$/i.exec(trimmed);
  const prefix = supersetMatch ? `Superset ${supersetMatch[1]!.toUpperCase()}: ` : "";
  const withoutPrefix = supersetMatch ? supersetMatch[2]! : trimmed;

  // Checked against the whole name first: an override may deliberately include
  // its parenthetical, and stripping it first would stop that ever matching.
  const whole = OVERRIDES[withoutPrefix.toLowerCase()];
  if (whole) return prefix + whole;

  // Trailing "(...)" is a note about how to do it, not part of the name.
  const noteMatch = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(withoutPrefix);
  const core = (noteMatch ? noteMatch[1]! : withoutPrefix).trim();
  const note = noteMatch ? NOTES[noteMatch[2]!.trim().toLowerCase()] : undefined;

  const translated = OVERRIDES[core.toLowerCase()] ?? compose(core);
  if (!translated) return null;

  return prefix + translated + (note ? ` (${note})` : "");
}

function compose(core: string): string | null {
  const lower = core.toLowerCase();

  const headKey = HEAD_KEYS.find(
    (key) => lower === key || lower.endsWith(` ${key}`) || lower.endsWith(`-${key}`),
  );
  if (!headKey) return null;

  const head = HEADS[headKey]!;
  let rest = lower.slice(0, lower.length - headKey.length).replace(/[\s-]+$/, "").trim();

  const equipment: string[] = [];
  const modifiers: string[] = [];

  // Longest-first so "smith machine" is not read as "machine", and
  // "low incline" not as "incline".
  let guard = 0;
  while (rest && guard < 12) {
    guard += 1;

    const equipmentKey = EQUIPMENT_KEYS.find(
      (key) => rest === key || rest.endsWith(` ${key}`) || rest.startsWith(`${key} `),
    );
    if (equipmentKey) {
      equipment.push(EQUIPMENT[equipmentKey]!);
      rest = strip(rest, equipmentKey);
      continue;
    }

    const modifierKey = MODIFIER_KEYS.find(
      (key) => rest === key || rest.endsWith(` ${key}`) || rest.startsWith(`${key} `),
    );
    if (modifierKey) {
      modifiers.push(MODIFIERS[modifierKey]![head.gender]);
      rest = strip(rest, modifierKey);
      continue;
    }

    break;
  }

  // Something in the name was not vocabulary — better to leave the English
  // alone than to ship a half-translated name.
  if (rest) return null;

  // Bare adjectives hug the noun; prepositional phrases trail. Portuguese reads
  // "Rosca alternada com halteres", not "Rosca com halteres alternada" — and
  // "Remada na máquina com apoio no peito", not the other way round.
  const ordered = modifiers.reverse();
  const adjectives = ordered.filter((word) => !isPrepositional(word));
  const phrases = ordered.filter((word) => isPrepositional(word));

  return [head.pt, ...adjectives, ...equipment, ...phrases].join(" ");
}

/**
 * Anything starting with a preposition belongs after the equipment:
 * Portuguese reads "Remada na máquina com apoio no peito", never "Remada com
 * apoio no peito na máquina".
 */
const PREPOSITIONS = ["com", "por", "acima", "em pé", "para"];

function isPrepositional(word: string): boolean {
  return PREPOSITIONS.some(
    (preposition) => word === preposition || word.startsWith(`${preposition} `),
  );
}

function strip(rest: string, key: string): string {
  return rest
    .replace(new RegExp(`(^|\\s)${escape(key)}(\\s|$)`), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
