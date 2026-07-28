import type { Experience, Goal } from "../src/lib/types";

/**
 * The stock program library.
 *
 * Slots use a compact `"exercise_key:sets"` form, optionally with a rep range
 * (`"back_squat:4:4-6"`) when the program wants something other than the
 * exercise's default — strength blocks pull the ranges down, for instance.
 * Written out as objects this file would be several thousand lines; the point
 * of the shorthand is that a whole program stays readable at a glance.
 *
 * Starting set counts are deliberately conservative: a block should begin near
 * each muscle's MEV and let the autoregulation engine add volume from there.
 */

/** `"exercise_key:sets"` or `"exercise_key:sets:min-max"`. */
export type SlotSpec = string;

export type TemplateDaySeed = {
  en: string;
  pt: string;
  slots: SlotSpec[];
};

export type TemplateSeed = {
  key: string;
  en: string;
  pt: string;
  descEn: string;
  descPt: string;
  daysPerWeek: number;
  weeks: number;
  level: Experience;
  goal: Goal;
  /** Overrides every slot's rest. Short rests are what make a program dense. */
  restSec?: number;
  days: TemplateDaySeed[];
};

export type ParsedSlot = {
  exercise: string;
  sets: number;
  repMin?: number;
  repMax?: number;
};

export function parseSlot(spec: SlotSpec): ParsedSlot {
  const [exercise, setsRaw, repRange] = spec.split(":");
  const sets = Number.parseInt(setsRaw ?? "", 10);

  if (!exercise || !Number.isFinite(sets)) {
    throw new Error(`Malformed slot spec: "${spec}"`);
  }

  if (!repRange) return { exercise, sets };

  const [minRaw, maxRaw] = repRange.split("-");
  const repMin = Number.parseInt(minRaw ?? "", 10);
  const repMax = Number.parseInt(maxRaw ?? "", 10);

  if (!Number.isFinite(repMin) || !Number.isFinite(repMax) || repMax < repMin) {
    throw new Error(`Malformed rep range in slot spec: "${spec}"`);
  }

  return { exercise, sets, repMin, repMax };
}

/** Arnold's six lifts, run unchanged in every session of the week. */
const GOLDEN_SIX: SlotSpec[] = [
  "back_squat:4:8-12",
  "barbell_bench_press:3:8-12",
  "chin_up:3:6-12",
  "overhead_press:4:8-12",
  "barbell_curl:3:8-12",
  "decline_crunch:3:15-25",
];

export const TEMPLATES: TemplateSeed[] = [
  // ------------------------------------------------------------- 2 days

  {
    key: "full_body_2",
    en: "Full Body 2x",
    pt: "Corpo Inteiro 2x",
    descEn:
      "Two sessions covering everything. The realistic floor for making progress when the week is genuinely full.",
    descPt:
      "Dois treinos cobrindo tudo. O mínimo realista para progredir quando a semana está de verdade cheia.",
    daysPerWeek: 2,
    weeks: 5,
    level: "beginner",
    goal: "general",
    days: [
      {
        en: "Full Body A",
        pt: "Corpo Inteiro A",
        slots: [
          "back_squat:3",
          "barbell_bench_press:3",
          "seated_cable_row:3",
          "lying_leg_curl:2",
          "dumbbell_lateral_raise:2",
          "plank:2",
        ],
      },
      {
        en: "Full Body B",
        pt: "Corpo Inteiro B",
        slots: [
          "romanian_deadlift:3",
          "lat_pulldown:3",
          "dumbbell_shoulder_press:3",
          "leg_press:2",
          "ez_bar_curl:2",
          "triceps_pushdown:2",
        ],
      },
    ],
  },
  {
    key: "strength_minimal_2",
    en: "Minimalist Strength 2x",
    pt: "Força Minimalista 2x",
    descEn:
      "Four barbell lifts, twice a week, heavy. Nothing here is optional, which is the point.",
    descPt:
      "Quatro exercícios de barra, duas vezes por semana, pesado. Nada aqui é opcional — essa é a ideia.",
    daysPerWeek: 2,
    weeks: 5,
    level: "intermediate",
    goal: "strength",
    days: [
      {
        en: "Squat & Press",
        pt: "Agachamento e Supino",
        slots: ["back_squat:4:4-6", "barbell_bench_press:4:4-6", "barbell_row:4:5-8", "plank:2"],
      },
      {
        en: "Pull & Overhead",
        pt: "Puxada e Desenvolvimento",
        slots: [
          "conventional_deadlift:3:3-5",
          "overhead_press:4:4-6",
          "pull_up:4:5-8",
          "hanging_leg_raise:3",
        ],
      },
    ],
  },

  // ------------------------------------------------------------- 3 days

  {
    key: "full_body_3",
    en: "Full Body 3x",
    pt: "Corpo Inteiro 3x",
    descEn:
      "Every muscle three times a week. The highest-frequency option and the best return for limited gym days.",
    descPt:
      "Todos os músculos três vezes por semana. A opção de maior frequência e o melhor retorno para poucos dias de academia.",
    daysPerWeek: 3,
    weeks: 5,
    level: "beginner",
    goal: "hypertrophy",
    days: [
      {
        en: "Full Body A",
        pt: "Corpo Inteiro A",
        slots: [
          "back_squat:3",
          "barbell_bench_press:3",
          "seated_cable_row:3",
          "lying_leg_curl:2",
          "dumbbell_lateral_raise:2",
          "standing_calf_raise:2",
        ],
      },
      {
        en: "Full Body B",
        pt: "Corpo Inteiro B",
        slots: [
          "romanian_deadlift:3",
          "lat_pulldown:3",
          "incline_dumbbell_press:3",
          "leg_press:2",
          "ez_bar_curl:2",
          "triceps_pushdown:2",
        ],
      },
      {
        en: "Full Body C",
        pt: "Corpo Inteiro C",
        slots: [
          "hack_squat:3",
          "dumbbell_shoulder_press:3",
          "chest_supported_row:3",
          "pec_deck:2",
          "face_pull:2",
          "hanging_leg_raise:2",
        ],
      },
    ],
  },
  {
    key: "full_body_express_3",
    en: "Full Body Express 3x",
    pt: "Corpo Inteiro Express 3x",
    descEn:
      "Machine-led, short rests, in and out in around half an hour. Built for lunch breaks, not for personal records.",
    descPt:
      "Focado em máquinas, descansos curtos, entra e sai em meia hora. Feito para o intervalo do almoço, não para recordes.",
    daysPerWeek: 3,
    weeks: 5,
    level: "beginner",
    goal: "general",
    restSec: 45,
    days: [
      {
        en: "Express A",
        pt: "Express A",
        slots: [
          "goblet_squat:2",
          "machine_chest_press:2",
          "seated_cable_row:2",
          "dumbbell_lateral_raise:2",
        ],
      },
      {
        en: "Express B",
        pt: "Express B",
        slots: ["leg_press:2", "incline_dumbbell_press:2", "lat_pulldown:2", "cable_curl:2"],
      },
      {
        en: "Express C",
        pt: "Express C",
        slots: [
          "romanian_deadlift:2",
          "machine_shoulder_press:2",
          "machine_row:2",
          "triceps_pushdown:2",
        ],
      },
    ],
  },
  {
    key: "barbell_strength_3",
    en: "Barbell Strength 3x",
    pt: "Força com Barra 3x",
    descEn:
      "Squat, press, pull, repeat. Low reps and long rests to build the base every other program stands on.",
    descPt:
      "Agachar, empurrar, puxar, repetir. Poucas reps e descansos longos para construir a base de todos os outros programas.",
    daysPerWeek: 3,
    weeks: 5,
    level: "beginner",
    goal: "strength",
    days: [
      {
        en: "Strength A",
        pt: "Força A",
        slots: ["back_squat:3:4-6", "barbell_bench_press:3:4-6", "barbell_row:3:5-8", "plank:3"],
      },
      {
        en: "Strength B",
        pt: "Força B",
        slots: [
          "front_squat:3:4-6",
          "overhead_press:3:4-6",
          "conventional_deadlift:2:3-5",
          "hanging_leg_raise:3",
        ],
      },
      {
        en: "Strength C",
        pt: "Força C",
        slots: ["back_squat:3:4-6", "incline_barbell_press:3:5-8", "pull_up:3:5-8", "ab_wheel:3"],
      },
    ],
  },
  {
    key: "ppl_3",
    en: "Push / Pull / Legs 3x",
    pt: "Empurrar / Puxar / Pernas 3x",
    descEn:
      "The classic split at one round per week. Each muscle gets one hard, complete session.",
    descPt:
      "A divisão clássica em uma rodada por semana. Cada músculo recebe um treino pesado e completo.",
    daysPerWeek: 3,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Push",
        pt: "Empurrar",
        slots: [
          "barbell_bench_press:3",
          "dumbbell_shoulder_press:3",
          "incline_dumbbell_press:3",
          "dumbbell_lateral_raise:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Pull",
        pt: "Puxar",
        slots: [
          "barbell_row:3",
          "lat_pulldown:3",
          "seated_cable_row:3",
          "face_pull:3",
          "ez_bar_curl:3",
        ],
      },
      {
        en: "Legs",
        pt: "Pernas",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "lying_leg_curl:3",
          "standing_calf_raise:3",
          "hanging_leg_raise:3",
        ],
      },
    ],
  },
  {
    key: "upper_lower_full_3",
    en: "Upper / Lower / Full 3x",
    pt: "Superior / Inferior / Completo 3x",
    descEn:
      "Upper, lower, then a full-body day that tops up whatever the first two left short.",
    descPt:
      "Superior, inferior e um dia completo que fecha o que os dois primeiros deixaram faltando.",
    daysPerWeek: 3,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Upper",
        pt: "Superior",
        slots: [
          "barbell_bench_press:3",
          "barbell_row:3",
          "dumbbell_shoulder_press:3",
          "lat_pulldown:3",
          "ez_bar_curl:2",
          "triceps_pushdown:2",
        ],
      },
      {
        en: "Lower",
        pt: "Inferior",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "seated_leg_curl:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Full Body",
        pt: "Corpo Inteiro",
        slots: [
          "incline_dumbbell_press:3",
          "chest_supported_row:3",
          "hack_squat:3",
          "cable_lateral_raise:3",
          "hammer_curl:2",
          "overhead_cable_extension:2",
        ],
      },
    ],
  },
  {
    key: "lean_circuit_3",
    en: "Lean Circuit 3x",
    pt: "Circuito de Definição 3x",
    descEn:
      "Short rests and full-body days to keep the heart rate up while you hold onto muscle in a deficit.",
    descPt:
      "Descansos curtos e treinos de corpo inteiro para manter o ritmo alto e preservar músculo em déficit.",
    daysPerWeek: 3,
    weeks: 5,
    level: "beginner",
    goal: "fatloss",
    restSec: 45,
    days: [
      {
        en: "Circuit A",
        pt: "Circuito A",
        slots: [
          "goblet_squat:3",
          "push_up:3",
          "seated_cable_row:3",
          "walking_lunge:3",
          "plank:3",
        ],
      },
      {
        en: "Circuit B",
        pt: "Circuito B",
        slots: [
          "leg_press:3",
          "incline_dumbbell_press:3",
          "lat_pulldown:3",
          "hip_thrust:3",
          "decline_crunch:3",
        ],
      },
      {
        en: "Circuit C",
        pt: "Circuito C",
        slots: [
          "romanian_deadlift:3",
          "machine_chest_press:3",
          "machine_row:3",
          "dumbbell_lateral_raise:3",
          "hanging_leg_raise:3",
        ],
      },
    ],
  },

  {
    key: "golden_six_3",
    en: "Golden Six 3x",
    pt: "Golden Six 3x",
    descEn:
      "The same six barbell lifts every session, three times a week. The routine Arnold Schwarzenegger used and recommended in his early years — six movements, twenty sets, nothing clever.",
    descPt:
      "Os mesmos seis exercícios de barra em todo treino, três vezes por semana. A rotina que Arnold Schwarzenegger usava e recomendava no início da carreira — seis movimentos, vinte séries, nada de complicado.",
    daysPerWeek: 3,
    weeks: 5,
    level: "beginner",
    goal: "hypertrophy",
    restSec: 105,
    days: [
      {
        en: "Session 1",
        pt: "Treino 1",
        slots: GOLDEN_SIX,
      },
      { en: "Session 2", pt: "Treino 2", slots: GOLDEN_SIX },
      { en: "Session 3", pt: "Treino 3", slots: GOLDEN_SIX },
    ],
  },
  {
    key: "german_volume_3",
    en: "German Volume Training 3x",
    pt: "German Volume Training 3x",
    descEn:
      "Ten sets of ten on one lift per muscle, at around 60% of your max, with 90 seconds of rest. Popularised by strength coach Charles Poliquin. Brutal and not meant to be run year-round — progress by adding load, never sets.",
    descPt:
      "Dez séries de dez em um exercício por músculo, com cerca de 60% do seu máximo e 90 segundos de descanso. Popularizado pelo treinador Charles Poliquin. Brutal e não feito para o ano todo — a progressão vem da carga, nunca de mais séries.",
    daysPerWeek: 3,
    weeks: 5,
    level: "advanced",
    goal: "hypertrophy",
    restSec: 90,
    days: [
      {
        en: "Chest & Back",
        pt: "Peito e Costas",
        slots: [
          "barbell_bench_press:10:10-10",
          "barbell_row:10:10-10",
          "pec_deck:3:10-12",
          "straight_arm_pulldown:3:10-12",
        ],
      },
      {
        en: "Legs & Abs",
        pt: "Pernas e Abdômen",
        slots: [
          "back_squat:10:10-10",
          "lying_leg_curl:10:10-10",
          "standing_calf_raise:3:15-20",
          "hanging_leg_raise:3:10-15",
        ],
      },
      {
        en: "Arms & Shoulders",
        pt: "Braços e Ombros",
        slots: [
          "triceps_dip:10:10-10",
          "incline_dumbbell_curl:10:10-10",
          "dumbbell_lateral_raise:3:12-15",
          "reverse_pec_deck:3:12-15",
        ],
      },
    ],
  },

  // ------------------------------------------------------------- 4 days

  {
    key: "chest_tri_back_bi_4",
    en: "Chest & Triceps / Back & Biceps 4x",
    pt: "Peito e Tríceps / Costas e Bíceps 4x",
    descEn:
      "The classic pairing split: push muscles together, pull muscles together, then legs and shoulders. Arms get worked twice — once heavy alongside the big lifts, once directly.",
    descPt:
      "A divisão clássica por pares: músculos de empurrar juntos, de puxar juntos, depois pernas e ombros. Os braços trabalham duas vezes — uma pesado junto dos compostos e outra direto.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Chest & Triceps",
        pt: "Peito e Tríceps",
        slots: [
          "barbell_bench_press:4",
          "incline_dumbbell_press:3",
          "pec_deck:3",
          "close_grip_bench:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Back & Biceps",
        pt: "Costas e Bíceps",
        slots: [
          "barbell_row:4",
          "lat_pulldown:3",
          "seated_cable_row:3",
          "ez_bar_curl:3",
          "incline_dumbbell_curl:3",
        ],
      },
      {
        en: "Legs",
        pt: "Pernas",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "lying_leg_curl:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Shoulders & Abs",
        pt: "Ombros e Abdômen",
        slots: [
          "overhead_press:4",
          "dumbbell_lateral_raise:4",
          "reverse_pec_deck:3",
          "face_pull:3",
          "hanging_leg_raise:3",
        ],
      },
    ],
  },
  {
    key: "hit_one_set_4",
    en: "One Set to Failure 4x",
    pt: "Uma Série até a Falha 4x",
    descEn:
      "High-intensity training: very few sets, each taken to absolute failure, one pass per muscle group per week. The split Dorian Yates built six Mr. Olympia titles on. Logged here as a warm-up plus one all-out set.",
    descPt:
      "Treino de alta intensidade: pouquíssimas séries, cada uma até a falha total, uma passada por grupo muscular por semana. A divisão com que Dorian Yates conquistou seis títulos de Mr. Olympia. Registrada aqui como um aquecimento mais uma série máxima.",
    daysPerWeek: 4,
    weeks: 5,
    level: "advanced",
    goal: "hypertrophy",
    restSec: 180,
    days: [
      {
        en: "Shoulders, Traps & Triceps",
        pt: "Ombros, Trapézio e Tríceps",
        slots: [
          "machine_shoulder_press:2:6-10",
          "dumbbell_lateral_raise:2:8-12",
          "reverse_pec_deck:2:8-12",
          "barbell_shrug:2:8-12",
          "close_grip_bench:2:6-10",
          "triceps_pushdown:2:8-12",
        ],
      },
      {
        en: "Back & Rear Delts",
        pt: "Costas e Deltoide Posterior",
        slots: [
          "lat_pulldown:2:6-10",
          "barbell_row:2:6-10",
          "seated_cable_row:2:8-12",
          "rear_delt_fly:2:8-12",
          "conventional_deadlift:2:5-8",
        ],
      },
      {
        en: "Chest & Biceps",
        pt: "Peito e Bíceps",
        slots: [
          "incline_barbell_press:2:6-10",
          "machine_chest_press:2:8-12",
          "pec_deck:2:8-12",
          "ez_bar_curl:2:6-10",
          "incline_dumbbell_curl:2:8-12",
        ],
      },
      {
        en: "Legs",
        pt: "Pernas",
        slots: [
          "leg_extension:2:10-15",
          "leg_press:2:8-12",
          "hack_squat:2:8-12",
          "lying_leg_curl:2:8-12",
          "standing_calf_raise:2:10-15",
        ],
      },
    ],
  },
  {
    key: "power_hypertrophy_ul_4",
    en: "Power & Hypertrophy Upper / Lower 4x",
    pt: "Força e Hipertrofia Superior / Inferior 4x",
    descEn:
      "Two heavy days in the 3–5 rep range and two volume days in the 8–15 range, split upper and lower. Known in the lifting community as PHUL. Strength and size without picking one.",
    descPt:
      "Dois dias pesados na faixa de 3–5 reps e dois dias de volume na faixa de 8–15, divididos em superior e inferior. Conhecido na comunidade como PHUL. Força e tamanho sem precisar escolher.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "strength",
    days: [
      {
        en: "Upper Power",
        pt: "Superior Pesado",
        slots: [
          "barbell_bench_press:4:3-5",
          "barbell_row:4:3-5",
          "incline_dumbbell_press:3:6-10",
          "lat_pulldown:3:6-10",
          "overhead_press:3:5-8",
          "ez_bar_curl:3:6-10",
          "skull_crusher:3:6-10",
        ],
      },
      {
        en: "Lower Power",
        pt: "Inferior Pesado",
        slots: [
          "back_squat:4:3-5",
          "conventional_deadlift:4:3-5",
          "leg_press:3:8-12",
          "lying_leg_curl:3:6-10",
          "standing_calf_raise:4:10-15",
        ],
      },
      {
        en: "Upper Hypertrophy",
        pt: "Superior Hipertrofia",
        slots: [
          "incline_barbell_press:3:8-12",
          "chest_supported_row:3:8-12",
          "pec_deck:3:12-15",
          "seated_cable_row:3:12-15",
          "dumbbell_lateral_raise:3:12-20",
          "incline_dumbbell_curl:3:12-15",
          "triceps_pushdown:3:12-15",
        ],
      },
      {
        en: "Lower Hypertrophy",
        pt: "Inferior Hipertrofia",
        slots: [
          "front_squat:3:8-12",
          "walking_lunge:3:8-12",
          "leg_extension:3:12-15",
          "seated_leg_curl:3:12-15",
          "seated_calf_raise:4:12-20",
        ],
      },
    ],
  },
  {
    key: "upper_lower_4",
    en: "Upper / Lower 4x",
    pt: "Superior / Inferior 4x",
    descEn:
      "Four days split between upper and lower body. Twice-weekly frequency per muscle — the sweet spot for most lifters.",
    descPt:
      "Quatro dias divididos entre superiores e inferiores. Frequência de duas vezes por semana por músculo — o ponto ideal para a maioria.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "barbell_bench_press:3",
          "barbell_row:3",
          "dumbbell_shoulder_press:3",
          "lat_pulldown:3",
          "dumbbell_lateral_raise:3",
          "ez_bar_curl:2",
          "triceps_pushdown:2",
        ],
      },
      {
        en: "Lower A",
        pt: "Inferior A",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "lying_leg_curl:3",
          "standing_calf_raise:3",
          "hanging_leg_raise:3",
        ],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "incline_dumbbell_press:3",
          "chest_supported_row:3",
          "machine_chest_press:3",
          "seated_cable_row:3",
          "cable_lateral_raise:3",
          "reverse_pec_deck:3",
          "incline_dumbbell_curl:2",
          "overhead_cable_extension:2",
        ],
      },
      {
        en: "Lower B",
        pt: "Inferior B",
        slots: [
          "hack_squat:4",
          "hip_thrust:3",
          "seated_leg_curl:3",
          "leg_extension:3",
          "seated_calf_raise:3",
          "cable_crunch:3",
        ],
      },
    ],
  },
  {
    key: "push_pull_4",
    en: "Push / Pull 4x",
    pt: "Empurrar / Puxar 4x",
    descEn:
      "Legs ride along with the pattern they share — squats on push days, hinges on pull days. Simple to sequence.",
    descPt:
      "As pernas acompanham o padrão que compartilham — agachamento nos dias de empurrar, levantamento terra nos de puxar. Fácil de organizar.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Push A",
        pt: "Empurrar A",
        slots: [
          "barbell_bench_press:4",
          "back_squat:3",
          "dumbbell_shoulder_press:3",
          "dumbbell_lateral_raise:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Pull A",
        pt: "Puxar A",
        slots: [
          "barbell_row:4",
          "romanian_deadlift:3",
          "pull_up:3",
          "face_pull:3",
          "ez_bar_curl:3",
        ],
      },
      {
        en: "Push B",
        pt: "Empurrar B",
        slots: [
          "incline_barbell_press:4",
          "leg_press:3",
          "machine_shoulder_press:3",
          "cable_lateral_raise:3",
          "skull_crusher:3",
        ],
      },
      {
        en: "Pull B",
        pt: "Puxar B",
        slots: [
          "lat_pulldown:4",
          "lying_leg_curl:3",
          "chest_supported_row:3",
          "reverse_pec_deck:3",
          "incline_dumbbell_curl:3",
        ],
      },
    ],
  },
  {
    key: "upper_lower_strength_4",
    en: "Upper / Lower Strength 4x",
    pt: "Força Superior / Inferior 4x",
    descEn:
      "Each half of the body gets one heavy day and one volume day. Long rests — budget the time honestly.",
    descPt:
      "Cada metade do corpo tem um dia pesado e um de volume. Descansos longos — reserve o tempo de verdade.",
    daysPerWeek: 4,
    weeks: 5,
    level: "advanced",
    goal: "strength",
    days: [
      {
        en: "Upper Heavy",
        pt: "Superior Pesado",
        slots: [
          "barbell_bench_press:4:3-5",
          "barbell_row:4:4-6",
          "overhead_press:3:4-6",
          "pull_up:3:5-8",
          "close_grip_bench:3:6-8",
        ],
      },
      {
        en: "Lower Heavy",
        pt: "Inferior Pesado",
        slots: [
          "back_squat:4:3-5",
          "conventional_deadlift:3:3-5",
          "leg_press:3:6-10",
          "lying_leg_curl:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Upper Volume",
        pt: "Superior Volume",
        slots: [
          "incline_dumbbell_press:4:6-10",
          "chest_supported_row:4:8-12",
          "dumbbell_shoulder_press:3:8-12",
          "cable_lateral_raise:3",
          "ez_bar_curl:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Lower Volume",
        pt: "Inferior Volume",
        slots: [
          "front_squat:4:6-10",
          "romanian_deadlift:4:6-10",
          "leg_extension:3",
          "seated_leg_curl:3",
          "seated_calf_raise:3",
          "cable_crunch:3",
        ],
      },
    ],
  },
  {
    key: "torso_limbs_4",
    en: "Torso / Limbs 4x",
    pt: "Tronco / Membros 4x",
    descEn:
      "Chest and back together, then legs and arms together. Spreads the load differently to upper/lower and suits people whose arms lag.",
    descPt:
      "Peito e costas juntos, depois pernas e braços juntos. Distribui a carga diferente do superior/inferior e serve para quem tem braços atrasados.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Torso A",
        pt: "Tronco A",
        slots: [
          "barbell_bench_press:4",
          "barbell_row:4",
          "dumbbell_shoulder_press:3",
          "lat_pulldown:3",
          "cable_crunch:3",
        ],
      },
      {
        en: "Limbs A",
        pt: "Membros A",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "ez_bar_curl:3",
          "triceps_pushdown:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Torso B",
        pt: "Tronco B",
        slots: [
          "incline_dumbbell_press:4",
          "chest_supported_row:4",
          "pec_deck:3",
          "reverse_pec_deck:3",
          "hanging_leg_raise:3",
        ],
      },
      {
        en: "Limbs B",
        pt: "Membros B",
        slots: [
          "hack_squat:4",
          "seated_leg_curl:3",
          "incline_dumbbell_curl:3",
          "overhead_cable_extension:3",
          "seated_calf_raise:3",
        ],
      },
    ],
  },
  {
    key: "upper_lower_express_4",
    en: "Upper / Lower Express 4x",
    pt: "Superior / Inferior Express 4x",
    descEn:
      "Four short sessions instead of two long ones. Same weekly work, easier to actually turn up for.",
    descPt:
      "Quatro treinos curtos em vez de dois longos. O mesmo trabalho semanal, muito mais fácil de cumprir.",
    daysPerWeek: 4,
    weeks: 5,
    level: "beginner",
    goal: "general",
    restSec: 45,
    days: [
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "machine_chest_press:3",
          "seated_cable_row:3",
          "dumbbell_lateral_raise:2",
          "cable_curl:2",
        ],
      },
      {
        en: "Lower A",
        pt: "Inferior A",
        slots: ["leg_press:3", "lying_leg_curl:3", "standing_calf_raise:2", "plank:2"],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "incline_dumbbell_press:3",
          "lat_pulldown:3",
          "reverse_pec_deck:2",
          "triceps_pushdown:2",
        ],
      },
      {
        en: "Lower B",
        pt: "Inferior B",
        slots: ["hack_squat:3", "romanian_deadlift:3", "leg_extension:2", "cable_crunch:2"],
      },
    ],
  },
  {
    key: "lean_upper_lower_4",
    en: "Lean Upper / Lower 4x",
    pt: "Definição Superior / Inferior 4x",
    descEn:
      "Enough volume to keep the muscle you have while dieting, with rests short enough to stay warm.",
    descPt:
      "Volume suficiente para manter o músculo durante a dieta, com descansos curtos o bastante para não esfriar.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "fatloss",
    restSec: 45,
    days: [
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "incline_dumbbell_press:3",
          "seated_cable_row:3",
          "dumbbell_shoulder_press:3",
          "lat_pulldown:3",
          "triceps_pushdown:2",
          "ez_bar_curl:2",
        ],
      },
      {
        en: "Lower A",
        pt: "Inferior A",
        slots: [
          "back_squat:3",
          "romanian_deadlift:3",
          "walking_lunge:3",
          "lying_leg_curl:3",
          "hanging_leg_raise:3",
        ],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "machine_chest_press:3",
          "chest_supported_row:3",
          "cable_lateral_raise:3",
          "face_pull:3",
          "cable_curl:2",
          "overhead_cable_extension:2",
        ],
      },
      {
        en: "Lower B",
        pt: "Inferior B",
        slots: [
          "leg_press:3",
          "hip_thrust:3",
          "bulgarian_split_squat:3",
          "seated_leg_curl:3",
          "cable_crunch:3",
        ],
      },
    ],
  },
  {
    key: "glute_focus_4",
    en: "Glute & Leg Focus 4x",
    pt: "Foco em Glúteos e Pernas 4x",
    descEn:
      "Two dedicated lower-body days with glutes leading, plus two shorter upper days to keep the rest ticking over.",
    descPt:
      "Dois dias dedicados a pernas com glúteos na frente, mais dois dias curtos de superiores para manter o resto em dia.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Glutes & Hamstrings",
        pt: "Glúteos e Posteriores",
        slots: [
          "hip_thrust:4",
          "romanian_deadlift:4",
          "bulgarian_split_squat:3",
          "hip_abduction:3",
          "cable_kickback:3",
        ],
      },
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "incline_dumbbell_press:3",
          "seated_cable_row:3",
          "dumbbell_lateral_raise:3",
          "ez_bar_curl:2",
          "triceps_pushdown:2",
        ],
      },
      {
        en: "Quads & Calves",
        pt: "Quadríceps e Panturrilhas",
        slots: [
          "back_squat:4",
          "leg_press:3",
          "lying_leg_curl:3",
          "leg_extension:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "machine_chest_press:3",
          "lat_pulldown:3",
          "reverse_pec_deck:3",
          "cable_curl:2",
          "overhead_cable_extension:2",
        ],
      },
    ],
  },

  // ------------------------------------------------------------- 5 days

  {
    key: "bro_split_5",
    en: "Body Part Split 5x",
    pt: "Divisão por Grupo 5x",
    descEn:
      "One muscle group per day with high per-session volume. Low frequency, so every session has to count.",
    descPt:
      "Um grupo muscular por dia com alto volume por sessão. Baixa frequência, então cada treino precisa valer.",
    daysPerWeek: 5,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Chest",
        pt: "Peito",
        slots: [
          "barbell_bench_press:4",
          "incline_dumbbell_press:4",
          "machine_chest_press:3",
          "pec_deck:3",
          "cable_fly_low_high:3",
        ],
      },
      {
        en: "Back",
        pt: "Costas",
        slots: [
          "barbell_row:4",
          "pull_up:3",
          "lat_pulldown:3",
          "seated_cable_row:3",
          "straight_arm_pulldown:3",
          "barbell_shrug:3",
        ],
      },
      {
        en: "Legs",
        pt: "Pernas",
        slots: [
          "back_squat:4",
          "romanian_deadlift:4",
          "leg_press:3",
          "lying_leg_curl:3",
          "leg_extension:3",
          "standing_calf_raise:4",
        ],
      },
      {
        en: "Shoulders",
        pt: "Ombros",
        slots: [
          "overhead_press:4",
          "dumbbell_lateral_raise:4",
          "cable_lateral_raise:3",
          "reverse_pec_deck:4",
          "face_pull:3",
        ],
      },
      {
        en: "Arms",
        pt: "Braços",
        slots: [
          "ez_bar_curl:4",
          "close_grip_bench:4",
          "incline_dumbbell_curl:3",
          "overhead_cable_extension:3",
          "hammer_curl:3",
          "triceps_pushdown:3",
        ],
      },
    ],
  },
  {
    key: "chest_tri_back_bi_5",
    en: "Chest & Triceps / Back & Biceps 5x",
    pt: "Peito e Tríceps / Costas e Bíceps 5x",
    descEn:
      "The pairing split stretched over five days, with a dedicated arm day at the end of the week. The default routine of commercial gyms everywhere, and popular for a reason.",
    descPt:
      "A divisão por pares esticada em cinco dias, com um dia dedicado a braços no fim da semana. A rotina padrão das academias do mundo inteiro — e popular por um motivo.",
    daysPerWeek: 5,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Chest & Triceps",
        pt: "Peito e Tríceps",
        slots: [
          "barbell_bench_press:4",
          "incline_dumbbell_press:3",
          "machine_chest_press:3",
          "cable_fly_high_low:3",
          "triceps_pushdown:3",
          "overhead_cable_extension:2",
        ],
      },
      {
        en: "Back & Biceps",
        pt: "Costas e Bíceps",
        slots: [
          "barbell_row:4",
          "pull_up:3",
          "seated_cable_row:3",
          "straight_arm_pulldown:3",
          "ez_bar_curl:3",
          "hammer_curl:2",
        ],
      },
      {
        en: "Legs",
        pt: "Pernas",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "lying_leg_curl:3",
          "leg_extension:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Shoulders & Abs",
        pt: "Ombros e Abdômen",
        slots: [
          "overhead_press:4",
          "dumbbell_lateral_raise:4",
          "reverse_pec_deck:3",
          "barbell_shrug:3",
          "cable_crunch:3",
        ],
      },
      {
        en: "Arms",
        pt: "Braços",
        slots: [
          "preacher_curl:3",
          "skull_crusher:3",
          "cable_curl:3",
          "triceps_dip:3",
          "reverse_curl:2",
          "wrist_curl:2",
        ],
      },
    ],
  },
  {
    key: "power_hypertrophy_adaptive_5",
    en: "Power & Hypertrophy 5x",
    pt: "Força e Hipertrofia 5x",
    descEn:
      "Two heavy power days followed by three high-volume days, hitting every muscle twice a week. Devised by powerlifter and bodybuilder Dr. Layne Norton, who called it PHAT.",
    descPt:
      "Dois dias pesados de força seguidos de três dias de alto volume, atingindo cada músculo duas vezes por semana. Criado pelo powerlifter e fisiculturista Dr. Layne Norton, que o chamou de PHAT.",
    daysPerWeek: 5,
    weeks: 5,
    level: "advanced",
    goal: "strength",
    days: [
      {
        en: "Upper Power",
        pt: "Superior Pesado",
        slots: [
          "barbell_row:3:3-5",
          "pull_up:2:6-10",
          "barbell_bench_press:3:3-5",
          "incline_dumbbell_press:2:6-10",
          "overhead_press:3:6-10",
          "ez_bar_curl:3:6-10",
          "skull_crusher:3:6-10",
        ],
      },
      {
        en: "Lower Power",
        pt: "Inferior Pesado",
        slots: [
          "back_squat:3:3-5",
          "hack_squat:2:6-10",
          "romanian_deadlift:3:5-8",
          "leg_extension:2:6-10",
          "standing_calf_raise:4:8-12",
        ],
      },
      {
        en: "Back & Shoulders",
        pt: "Costas e Ombros",
        slots: [
          "barbell_row:3:8-12",
          "lat_pulldown:3:8-12",
          "seated_cable_row:3:8-12",
          "straight_arm_pulldown:2:12-15",
          "dumbbell_lateral_raise:3:12-20",
          "reverse_pec_deck:3:12-20",
        ],
      },
      {
        en: "Lower Hypertrophy",
        pt: "Inferior Hipertrofia",
        slots: [
          "front_squat:3:8-12",
          "leg_press:3:12-15",
          "leg_extension:3:15-20",
          "lying_leg_curl:3:10-15",
          "seated_calf_raise:4:12-20",
        ],
      },
      {
        en: "Chest & Arms",
        pt: "Peito e Braços",
        slots: [
          "incline_dumbbell_press:3:8-12",
          "machine_chest_press:3:12-15",
          "pec_deck:3:15-20",
          "cable_curl:3:12-15",
          "preacher_curl:2:12-15",
          "triceps_pushdown:3:12-15",
          "overhead_cable_extension:2:12-15",
        ],
      },
    ],
  },
  {
    key: "ppl_upper_lower_5",
    en: "Push / Pull / Legs + Upper / Lower 5x",
    pt: "PPL + Superior / Inferior 5x",
    descEn:
      "A full PPL round, then two mixed days to lift frequency without a sixth session.",
    descPt:
      "Uma rodada completa de PPL e mais dois dias mistos para elevar a frequência sem um sexto treino.",
    daysPerWeek: 5,
    weeks: 5,
    level: "advanced",
    goal: "hypertrophy",
    days: [
      {
        en: "Push",
        pt: "Empurrar",
        slots: [
          "barbell_bench_press:4",
          "dumbbell_shoulder_press:3",
          "incline_dumbbell_press:3",
          "dumbbell_lateral_raise:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Pull",
        pt: "Puxar",
        slots: [
          "barbell_row:4",
          "pull_up:3",
          "seated_cable_row:3",
          "face_pull:3",
          "ez_bar_curl:3",
        ],
      },
      {
        en: "Legs",
        pt: "Pernas",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "lying_leg_curl:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Upper",
        pt: "Superior",
        slots: [
          "incline_barbell_press:4",
          "chest_supported_row:4",
          "machine_shoulder_press:3",
          "cable_lateral_raise:3",
          "incline_dumbbell_curl:3",
          "skull_crusher:3",
        ],
      },
      {
        en: "Lower",
        pt: "Inferior",
        slots: [
          "hack_squat:4",
          "hip_thrust:3",
          "seated_leg_curl:3",
          "leg_extension:3",
          "seated_calf_raise:3",
          "cable_crunch:3",
        ],
      },
    ],
  },
  {
    key: "powerbuilding_5",
    en: "Powerbuilding 5x",
    pt: "Powerbuilding 5x",
    descEn:
      "One main lift per day taken heavy, then hypertrophy work behind it. Strength and size without choosing.",
    descPt:
      "Um exercício principal pesado por dia e trabalho de hipertrofia atrás. Força e tamanho sem precisar escolher.",
    daysPerWeek: 5,
    weeks: 5,
    level: "advanced",
    goal: "strength",
    days: [
      {
        en: "Squat",
        pt: "Agachamento",
        slots: [
          "back_squat:5:3-5",
          "leg_press:3:8-12",
          "lying_leg_curl:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Bench",
        pt: "Supino",
        slots: [
          "barbell_bench_press:5:3-5",
          "incline_dumbbell_press:3:8-12",
          "pec_deck:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Deadlift",
        pt: "Levantamento Terra",
        slots: [
          "conventional_deadlift:4:3-5",
          "barbell_row:4:6-10",
          "lat_pulldown:3",
          "hanging_leg_raise:3",
        ],
      },
      {
        en: "Overhead Press",
        pt: "Desenvolvimento",
        slots: [
          "overhead_press:4:4-6",
          "dumbbell_shoulder_press:3:8-12",
          "cable_lateral_raise:3",
          "ez_bar_curl:3",
        ],
      },
      {
        en: "Accessories",
        pt: "Acessórios",
        slots: [
          "front_squat:3:6-10",
          "romanian_deadlift:3:8-12",
          "chest_supported_row:3",
          "face_pull:3",
          "hammer_curl:3",
          "overhead_cable_extension:3",
        ],
      },
    ],
  },
  {
    key: "arms_focus_5",
    en: "Arm Specialization 5x",
    pt: "Especialização em Braços 5x",
    descEn:
      "Two dedicated arm days bracketing the week, with everything else held at maintenance. A block, not a lifestyle.",
    descPt:
      "Dois dias dedicados a braços abrindo e fechando a semana, com o resto em manutenção. Um bloco, não um estilo de vida.",
    daysPerWeek: 5,
    weeks: 5,
    level: "advanced",
    goal: "hypertrophy",
    days: [
      {
        en: "Arms A",
        pt: "Braços A",
        slots: [
          "ez_bar_curl:4",
          "close_grip_bench:4",
          "incline_dumbbell_curl:3",
          "overhead_cable_extension:3",
          "hammer_curl:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Chest & Delts",
        pt: "Peito e Ombros",
        slots: [
          "barbell_bench_press:4",
          "dumbbell_shoulder_press:3",
          "incline_dumbbell_press:3",
          "dumbbell_lateral_raise:4",
          "pec_deck:3",
        ],
      },
      {
        en: "Legs",
        pt: "Pernas",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "lying_leg_curl:3",
          "standing_calf_raise:3",
        ],
      },
      {
        en: "Back",
        pt: "Costas",
        slots: [
          "barbell_row:4",
          "pull_up:3",
          "seated_cable_row:3",
          "face_pull:3",
          "straight_arm_pulldown:3",
        ],
      },
      {
        en: "Arms B",
        pt: "Braços B",
        slots: [
          "preacher_curl:4",
          "skull_crusher:4",
          "cable_curl:3",
          "dumbbell_kickback:3",
          "reverse_curl:3",
          "wrist_curl:3",
        ],
      },
    ],
  },

  // ------------------------------------------------------------- 6 days

  {
    key: "ppl_6",
    en: "Push / Pull / Legs 6x",
    pt: "Empurrar / Puxar / Pernas 6x",
    descEn:
      "Six days, each muscle twice a week with plenty of room for volume. Demands consistent recovery.",
    descPt:
      "Seis dias, cada músculo duas vezes por semana com bastante espaço para volume. Exige recuperação consistente.",
    daysPerWeek: 6,
    weeks: 5,
    level: "advanced",
    goal: "hypertrophy",
    days: [
      {
        en: "Push A",
        pt: "Empurrar A",
        slots: [
          "barbell_bench_press:4",
          "dumbbell_shoulder_press:3",
          "incline_dumbbell_press:3",
          "dumbbell_lateral_raise:3",
          "triceps_pushdown:3",
          "overhead_cable_extension:2",
        ],
      },
      {
        en: "Pull A",
        pt: "Puxar A",
        slots: [
          "barbell_row:4",
          "pull_up:3",
          "seated_cable_row:3",
          "face_pull:3",
          "ez_bar_curl:3",
          "hammer_curl:2",
        ],
      },
      {
        en: "Legs A",
        pt: "Pernas A",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "lying_leg_curl:3",
          "standing_calf_raise:3",
          "hanging_leg_raise:3",
        ],
      },
      {
        en: "Push B",
        pt: "Empurrar B",
        slots: [
          "incline_barbell_press:4",
          "machine_chest_press:3",
          "machine_shoulder_press:3",
          "cable_lateral_raise:3",
          "pec_deck:3",
          "skull_crusher:3",
        ],
      },
      {
        en: "Pull B",
        pt: "Puxar B",
        slots: [
          "lat_pulldown:4",
          "chest_supported_row:3",
          "dumbbell_row:3",
          "reverse_pec_deck:3",
          "incline_dumbbell_curl:3",
          "barbell_shrug:2",
        ],
      },
      {
        en: "Legs B",
        pt: "Pernas B",
        slots: [
          "hack_squat:4",
          "hip_thrust:3",
          "seated_leg_curl:3",
          "leg_extension:3",
          "seated_calf_raise:3",
          "cable_crunch:3",
        ],
      },
    ],
  },
  {
    key: "arnold_6",
    en: "Arnold Split 6x",
    pt: "Divisão Arnold 6x",
    descEn:
      "Chest with back, shoulders with arms, then legs — twice through. Antagonist pairing keeps the pump and the pace up.",
    descPt:
      "Peito com costas, ombros com braços e pernas — duas voltas. O pareamento de antagonistas mantém o pump e o ritmo.",
    daysPerWeek: 6,
    weeks: 5,
    level: "advanced",
    goal: "hypertrophy",
    days: [
      {
        en: "Chest & Back A",
        pt: "Peito e Costas A",
        slots: [
          "barbell_bench_press:4",
          "barbell_row:4",
          "incline_dumbbell_press:3",
          "lat_pulldown:3",
          "pec_deck:3",
          "straight_arm_pulldown:3",
        ],
      },
      {
        en: "Shoulders & Arms A",
        pt: "Ombros e Braços A",
        slots: [
          "overhead_press:4",
          "dumbbell_lateral_raise:4",
          "ez_bar_curl:3",
          "skull_crusher:3",
          "hammer_curl:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Legs A",
        pt: "Pernas A",
        slots: [
          "back_squat:4",
          "romanian_deadlift:3",
          "leg_press:3",
          "lying_leg_curl:3",
          "standing_calf_raise:4",
        ],
      },
      {
        en: "Chest & Back B",
        pt: "Peito e Costas B",
        slots: [
          "incline_barbell_press:4",
          "pull_up:4",
          "machine_chest_press:3",
          "seated_cable_row:3",
          "cable_fly_low_high:3",
          "chest_supported_row:3",
        ],
      },
      {
        en: "Shoulders & Arms B",
        pt: "Ombros e Braços B",
        slots: [
          "machine_shoulder_press:4",
          "cable_lateral_raise:4",
          "reverse_pec_deck:3",
          "preacher_curl:3",
          "overhead_cable_extension:3",
          "incline_dumbbell_curl:3",
        ],
      },
      {
        en: "Legs B",
        pt: "Pernas B",
        slots: [
          "hack_squat:4",
          "hip_thrust:3",
          "seated_leg_curl:3",
          "leg_extension:3",
          "seated_calf_raise:4",
        ],
      },
    ],
  },
  {
    key: "upper_lower_6",
    en: "High-Frequency Upper / Lower 6x",
    pt: "Superior / Inferior Alta Frequência 6x",
    descEn:
      "Three times per muscle per week in short sessions. Volume comes from frequency, so no single day is punishing.",
    descPt:
      "Três vezes por músculo por semana em treinos curtos. O volume vem da frequência, então nenhum dia isolado é castigante.",
    daysPerWeek: 6,
    weeks: 5,
    level: "advanced",
    goal: "hypertrophy",
    days: [
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "barbell_bench_press:3",
          "barbell_row:3",
          "dumbbell_lateral_raise:3",
          "ez_bar_curl:2",
          "triceps_pushdown:2",
        ],
      },
      {
        en: "Lower A",
        pt: "Inferior A",
        slots: ["back_squat:3", "lying_leg_curl:3", "standing_calf_raise:3", "cable_crunch:2"],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "incline_dumbbell_press:3",
          "lat_pulldown:3",
          "reverse_pec_deck:3",
          "hammer_curl:2",
          "skull_crusher:2",
        ],
      },
      {
        en: "Lower B",
        pt: "Inferior B",
        slots: ["romanian_deadlift:3", "leg_press:3", "leg_extension:3", "hanging_leg_raise:2"],
      },
      {
        en: "Upper C",
        pt: "Superior C",
        slots: [
          "machine_chest_press:3",
          "chest_supported_row:3",
          "cable_lateral_raise:3",
          "cable_curl:2",
          "overhead_cable_extension:2",
        ],
      },
      {
        en: "Lower C",
        pt: "Inferior C",
        slots: ["hack_squat:3", "hip_thrust:3", "seated_leg_curl:3", "seated_calf_raise:3"],
      },
    ],
  },
  {
    key: "lean_high_frequency_6",
    en: "Lean High Frequency 6x",
    pt: "Definição Alta Frequência 6x",
    descEn:
      "Six short, dense sessions. Frequent training days help hold muscle and appetite in check through a cut.",
    descPt:
      "Seis treinos curtos e densos. Treinar com frequência ajuda a manter músculo e controlar o apetite durante o corte.",
    daysPerWeek: 6,
    weeks: 5,
    level: "intermediate",
    goal: "fatloss",
    restSec: 45,
    days: [
      {
        en: "Push A",
        pt: "Empurrar A",
        slots: [
          "machine_chest_press:3",
          "dumbbell_shoulder_press:3",
          "cable_lateral_raise:3",
          "triceps_pushdown:3",
        ],
      },
      {
        en: "Pull A",
        pt: "Puxar A",
        slots: ["lat_pulldown:3", "seated_cable_row:3", "face_pull:3", "cable_curl:3"],
      },
      {
        en: "Legs A",
        pt: "Pernas A",
        slots: ["leg_press:3", "lying_leg_curl:3", "walking_lunge:3", "standing_calf_raise:3"],
      },
      {
        en: "Push B",
        pt: "Empurrar B",
        slots: [
          "incline_dumbbell_press:3",
          "machine_shoulder_press:3",
          "pec_deck:3",
          "overhead_cable_extension:3",
        ],
      },
      {
        en: "Pull B",
        pt: "Puxar B",
        slots: [
          "chest_supported_row:3",
          "neutral_grip_pulldown:3",
          "reverse_pec_deck:3",
          "hammer_curl:3",
        ],
      },
      {
        en: "Legs B",
        pt: "Pernas B",
        slots: ["hack_squat:3", "hip_thrust:3", "seated_leg_curl:3", "cable_crunch:3"],
      },
    ],
  },

  // ------------------------------------------------------- track phases
  //
  // Blocks written as steps of a track (see seed-tracks.ts), not as programs
  // you would pick on their own — the picker lists them only inside their
  // track. They exist so a track does not consume a standalone program:
  // building "Foundations" out of Upper / Lower 4x removed Upper / Lower 4x
  // from the library, which is a bad trade for a program that common.
  //
  // Each phase changes one thing from the one before it. Names read as phases
  // because that is also what the block is called once it is running.

  {
    key: "foundations_learn",
    en: "Foundations · Learn the Lifts",
    pt: "Fundamentos · Aprender os Movimentos",
    descEn:
      "Few exercises, moderate reps, plenty of rest. Enough work to grow on, short enough that technique is still the hardest part.",
    descPt:
      "Poucos exercícios, repetições moderadas e bastante descanso. Trabalho suficiente para crescer, curto o bastante para a técnica continuar sendo o mais difícil.",
    daysPerWeek: 3,
    weeks: 5,
    level: "beginner",
    goal: "hypertrophy",
    days: [
      {
        en: "Full Body A",
        pt: "Corpo Todo A",
        slots: [
          "back_squat:3:6-8",
          "barbell_bench_press:3:6-8",
          "seated_cable_row:3:8-12",
          "plank:2",
        ],
      },
      {
        en: "Full Body B",
        pt: "Corpo Todo B",
        slots: [
          "romanian_deadlift:3:8-10",
          "lat_pulldown:3:8-12",
          "dumbbell_shoulder_press:3:8-12",
          "hanging_leg_raise:2",
        ],
      },
      {
        en: "Full Body C",
        pt: "Corpo Todo C",
        slots: [
          "front_squat:3:6-8",
          "incline_dumbbell_press:3:8-12",
          "dumbbell_row:3:8-12",
          "standing_calf_raise:2:10-15",
        ],
      },
    ],
  },
  {
    key: "foundations_volume",
    en: "Foundations · Add Volume",
    pt: "Fundamentos · Adicionar Volume",
    descEn:
      "The same three days with accessory work added. Same lifts you already know, more of the work that actually grows muscle.",
    descPt:
      "Os mesmos três dias com trabalho acessório. Os mesmos exercícios que você já conhece, com mais do trabalho que realmente constrói músculo.",
    daysPerWeek: 3,
    weeks: 5,
    level: "beginner",
    goal: "hypertrophy",
    days: [
      {
        en: "Full Body A",
        pt: "Corpo Todo A",
        slots: [
          "back_squat:3:6-10",
          "barbell_bench_press:3:8-10",
          "barbell_row:3:8-12",
          "lying_leg_curl:2:10-15",
          "dumbbell_lateral_raise:2:12-20",
          "plank:2",
        ],
      },
      {
        en: "Full Body B",
        pt: "Corpo Todo B",
        slots: [
          "romanian_deadlift:3:8-12",
          "lat_pulldown:3:8-12",
          "incline_dumbbell_press:3:8-12",
          "leg_press:2:10-20",
          "ez_bar_curl:2:8-12",
          "standing_calf_raise:2:10-15",
        ],
      },
      {
        en: "Full Body C",
        pt: "Corpo Todo C",
        slots: [
          "hack_squat:3:8-15",
          "dumbbell_shoulder_press:3:8-12",
          "chest_supported_row:3:8-15",
          "pec_deck:2:10-15",
          "triceps_pushdown:2:10-15",
          "hanging_leg_raise:2:10-20",
        ],
      },
    ],
  },
  {
    key: "foundations_split",
    en: "Foundations · Split the Week",
    pt: "Fundamentos · Dividir a Semana",
    descEn:
      "A fourth day, and the body split in two. Each muscle is trained twice a week with room for more exercises per session.",
    descPt:
      "Um quarto dia e o corpo dividido em dois. Cada músculo treinado duas vezes por semana, com espaço para mais exercícios por treino.",
    daysPerWeek: 4,
    weeks: 5,
    level: "beginner",
    goal: "hypertrophy",
    days: [
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "barbell_bench_press:4:6-10",
          "barbell_row:4:6-12",
          "dumbbell_shoulder_press:3:8-12",
          "lat_pulldown:3:8-15",
          "ez_bar_curl:2:8-12",
          "triceps_pushdown:2:10-15",
        ],
      },
      {
        en: "Lower A",
        pt: "Inferior A",
        slots: [
          "back_squat:4:5-10",
          "romanian_deadlift:3:8-12",
          "leg_press:3:10-20",
          "lying_leg_curl:3:10-15",
          "standing_calf_raise:3:10-15",
        ],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "incline_dumbbell_press:4:8-12",
          "chest_supported_row:4:8-15",
          "cable_lateral_raise:3:12-20",
          "neutral_grip_pulldown:3:8-15",
          "incline_dumbbell_curl:2:10-15",
          "overhead_cable_extension:2:10-15",
        ],
      },
      {
        en: "Lower B",
        pt: "Inferior B",
        slots: [
          "hack_squat:4:8-15",
          "hip_thrust:3:8-12",
          "seated_leg_curl:3:10-15",
          "leg_extension:3:10-20",
          "seated_calf_raise:3:12-20",
        ],
      },
    ],
  },

  {
    key: "hyper_build_base",
    en: "Hypertrophy Build · Base",
    pt: "Construção · Base",
    descEn:
      "Four days, each muscle twice a week, every session built around a heavy compound before the isolation work.",
    descPt:
      "Quatro dias, cada músculo duas vezes por semana, cada treino montado em torno de um composto pesado antes do trabalho isolado.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "barbell_bench_press:4:6-10",
          "barbell_row:4:6-12",
          "dumbbell_shoulder_press:3:8-12",
          "lat_pulldown:3:8-15",
          "cable_fly_high_low:2:10-15",
          "ez_bar_curl:3:8-12",
          "triceps_pushdown:3:10-15",
        ],
      },
      {
        en: "Lower A",
        pt: "Inferior A",
        slots: [
          "back_squat:4:5-10",
          "romanian_deadlift:3:8-12",
          "leg_press:3:10-20",
          "lying_leg_curl:3:10-15",
          "standing_calf_raise:3:10-15",
          "cable_crunch:3:12-20",
        ],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "incline_barbell_press:4:6-10",
          "chest_supported_row:4:8-15",
          "cable_lateral_raise:3:12-20",
          "neutral_grip_pulldown:3:8-15",
          "pec_deck:2:10-15",
          "incline_dumbbell_curl:3:10-15",
          "skull_crusher:3:8-12",
        ],
      },
      {
        en: "Lower B",
        pt: "Inferior B",
        slots: [
          "hack_squat:4:8-15",
          "hip_thrust:3:8-12",
          "seated_leg_curl:3:10-15",
          "leg_extension:3:10-20",
          "seated_calf_raise:3:12-20",
          "hanging_leg_raise:3:10-20",
        ],
      },
    ],
  },
  {
    key: "hyper_build_volume",
    en: "Hypertrophy Build · Volume",
    pt: "Construção · Volume",
    descEn:
      "Six days across push, pull and legs twice each. The weekly set counts four days cannot reach, spread thin enough to recover from.",
    descPt:
      "Seis dias entre empurrar, puxar e pernas, duas vezes cada. O volume semanal que quatro dias não alcançam, diluído o bastante para recuperar.",
    daysPerWeek: 6,
    weeks: 5,
    level: "intermediate",
    goal: "hypertrophy",
    days: [
      {
        en: "Push A",
        pt: "Empurrar A",
        slots: [
          "barbell_bench_press:4:6-10",
          "dumbbell_shoulder_press:3:8-12",
          "incline_dumbbell_press:3:8-12",
          "cable_lateral_raise:3:12-20",
          "triceps_pushdown:3:10-15",
          "overhead_cable_extension:2:10-15",
        ],
      },
      {
        en: "Pull A",
        pt: "Puxar A",
        slots: [
          "barbell_row:4:6-12",
          "lat_pulldown:3:8-15",
          "chest_supported_row:3:8-15",
          "face_pull:3:12-20",
          "ez_bar_curl:3:8-12",
          "hammer_curl:2:10-15",
        ],
      },
      {
        en: "Legs A",
        pt: "Pernas A",
        slots: [
          "back_squat:4:5-10",
          "romanian_deadlift:3:8-12",
          "leg_press:3:10-20",
          "lying_leg_curl:3:10-15",
          "standing_calf_raise:3:10-15",
        ],
      },
      {
        en: "Push B",
        pt: "Empurrar B",
        slots: [
          "incline_barbell_press:4:6-10",
          "machine_chest_press:3:8-12",
          "machine_shoulder_press:3:8-12",
          "dumbbell_lateral_raise:3:12-20",
          "close_grip_bench:3:8-12",
          "triceps_dip:2:8-12",
        ],
      },
      {
        en: "Pull B",
        pt: "Puxar B",
        slots: [
          "pull_up:4:5-10",
          "seated_cable_row:3:8-15",
          "neutral_grip_pulldown:3:8-15",
          "reverse_pec_deck:3:12-20",
          "incline_dumbbell_curl:3:10-15",
          "cable_curl:2:10-15",
        ],
      },
      {
        en: "Legs B",
        pt: "Pernas B",
        slots: [
          "hack_squat:4:8-15",
          "hip_thrust:3:8-12",
          "seated_leg_curl:3:10-15",
          "leg_extension:3:10-20",
          "seated_calf_raise:3:12-20",
        ],
      },
    ],
  },

  {
    key: "strength_size_base",
    en: "Strength & Size · Base",
    pt: "Força e Tamanho · Base",
    descEn:
      "Two heavy days and two hypertrophy days. The heavy work sets the load, the volume work grows the muscle that moves it.",
    descPt:
      "Dois dias pesados e dois de hipertrofia. O trabalho pesado define a carga; o trabalho de volume constrói o músculo que a move.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "strength",
    days: [
      {
        en: "Upper Power",
        pt: "Superior Pesado",
        slots: [
          "barbell_bench_press:4:3-5",
          "barbell_row:4:4-6",
          "overhead_press:3:5-8",
          "pull_up:3:5-8",
          "close_grip_bench:2:6-10",
          "ez_bar_curl:2:8-12",
        ],
      },
      {
        en: "Lower Power",
        pt: "Inferior Pesado",
        slots: [
          "back_squat:4:3-5",
          "conventional_deadlift:3:3-5",
          "leg_press:3:8-12",
          "lying_leg_curl:3:8-12",
          "standing_calf_raise:3:8-12",
        ],
      },
      {
        en: "Upper Hypertrophy",
        pt: "Superior Hipertrofia",
        slots: [
          "incline_dumbbell_press:4:8-12",
          "chest_supported_row:4:8-15",
          "dumbbell_lateral_raise:3:12-20",
          "lat_pulldown:3:8-15",
          "pec_deck:3:10-15",
          "incline_dumbbell_curl:3:10-15",
          "triceps_pushdown:3:10-15",
        ],
      },
      {
        en: "Lower Hypertrophy",
        pt: "Inferior Hipertrofia",
        slots: [
          "hack_squat:4:8-15",
          "romanian_deadlift:3:8-12",
          "leg_extension:3:10-20",
          "seated_leg_curl:3:10-15",
          "seated_calf_raise:3:12-20",
        ],
      },
    ],
  },
  {
    key: "strength_size_build",
    en: "Strength & Size · Build",
    pt: "Força e Tamanho · Construção",
    descEn:
      "A fifth day splits the hypertrophy work by body part, so the heavy days stay heavy and the volume lands where you want it.",
    descPt:
      "Um quinto dia divide o trabalho de hipertrofia por grupo muscular, para os dias pesados continuarem pesados e o volume cair onde você quer.",
    daysPerWeek: 5,
    weeks: 5,
    level: "intermediate",
    goal: "strength",
    days: [
      {
        en: "Upper Power",
        pt: "Superior Pesado",
        slots: [
          "barbell_bench_press:4:3-5",
          "barbell_row:4:4-6",
          "overhead_press:3:5-8",
          "pull_up:3:5-8",
          "close_grip_bench:2:6-10",
        ],
      },
      {
        en: "Lower Power",
        pt: "Inferior Pesado",
        slots: [
          "back_squat:4:3-5",
          "romanian_deadlift:3:5-8",
          "leg_press:3:8-12",
          "standing_calf_raise:3:8-12",
        ],
      },
      {
        en: "Chest & Arms",
        pt: "Peito e Braços",
        slots: [
          "incline_dumbbell_press:4:8-12",
          "machine_chest_press:3:10-15",
          "cable_fly_high_low:3:12-20",
          "ez_bar_curl:3:8-12",
          "triceps_pushdown:3:10-15",
          "hammer_curl:2:10-15",
        ],
      },
      {
        en: "Back & Delts",
        pt: "Costas e Ombros",
        slots: [
          "lat_pulldown:4:8-15",
          "seated_cable_row:4:8-15",
          "dumbbell_lateral_raise:3:12-20",
          "reverse_pec_deck:3:12-20",
          "barbell_shrug:3:8-12",
        ],
      },
      {
        en: "Legs",
        pt: "Pernas",
        slots: [
          "hack_squat:4:8-15",
          "lying_leg_curl:3:10-15",
          "leg_extension:3:10-20",
          "hip_thrust:3:8-12",
          "seated_calf_raise:3:12-20",
        ],
      },
    ],
  },
  {
    key: "strength_size_peak",
    en: "Strength & Size · Peak",
    pt: "Força e Tamanho · Pico",
    descEn:
      "One main lift per day, taken heavy, with accessories chosen to support it. The narrowest and hardest block of the three.",
    descPt:
      "Um exercício principal por dia, feito pesado, com acessórios escolhidos para sustentá-lo. O bloco mais estreito e mais difícil dos três.",
    daysPerWeek: 5,
    weeks: 5,
    level: "advanced",
    goal: "strength",
    days: [
      {
        en: "Squat Day",
        pt: "Dia de Agachamento",
        slots: [
          "back_squat:5:3-5",
          "front_squat:3:5-8",
          "leg_press:3:8-12",
          "lying_leg_curl:3:10-15",
          "standing_calf_raise:3:8-12",
        ],
      },
      {
        en: "Bench Day",
        pt: "Dia de Supino",
        slots: [
          "barbell_bench_press:5:3-5",
          "incline_dumbbell_press:3:8-12",
          "dumbbell_shoulder_press:3:8-12",
          "triceps_pushdown:3:10-15",
        ],
      },
      {
        en: "Deadlift Day",
        pt: "Dia de Levantamento Terra",
        slots: [
          "conventional_deadlift:4:3-5",
          "romanian_deadlift:3:6-10",
          "chest_supported_row:3:8-15",
          "lat_pulldown:3:8-15",
        ],
      },
      {
        en: "Press Day",
        pt: "Dia de Desenvolvimento",
        slots: [
          "overhead_press:5:3-6",
          "close_grip_bench:3:6-10",
          "dumbbell_lateral_raise:3:12-20",
          "skull_crusher:3:8-12",
        ],
      },
      {
        en: "Pull Day",
        pt: "Dia de Puxada",
        slots: [
          "pull_up:4:5-10",
          "barbell_row:4:6-10",
          "face_pull:3:12-20",
          "ez_bar_curl:3:8-12",
          "hammer_curl:2:10-15",
        ],
      },
    ],
  },

  {
    key: "lean_out_hold",
    en: "Lean Out · Hold",
    pt: "Definição · Manter",
    descEn:
      "Moderate volume and short rests on four days. Enough stimulus to keep the muscle you have while the calories are down.",
    descPt:
      "Volume moderado e descansos curtos em quatro dias. Estímulo suficiente para manter o músculo que você tem enquanto as calorias estão baixas.",
    daysPerWeek: 4,
    weeks: 5,
    level: "intermediate",
    goal: "fatloss",
    restSec: 45,
    days: [
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "barbell_bench_press:3:8-12",
          "barbell_row:3:8-12",
          "dumbbell_shoulder_press:3:10-15",
          "lat_pulldown:3:10-15",
          "ez_bar_curl:2:10-15",
          "triceps_pushdown:2:10-15",
        ],
      },
      {
        en: "Lower A",
        pt: "Inferior A",
        slots: [
          "back_squat:3:8-12",
          "romanian_deadlift:3:8-12",
          "leg_press:3:12-20",
          "lying_leg_curl:2:10-15",
          "standing_calf_raise:2:12-20",
        ],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "incline_dumbbell_press:3:10-15",
          "seated_cable_row:3:10-15",
          "cable_lateral_raise:3:12-20",
          "neutral_grip_pulldown:3:10-15",
          "cable_curl:2:12-20",
          "overhead_cable_extension:2:12-20",
        ],
      },
      {
        en: "Lower B",
        pt: "Inferior B",
        slots: [
          "hack_squat:3:10-15",
          "hip_thrust:3:10-15",
          "seated_leg_curl:2:12-20",
          "leg_extension:2:12-20",
          "seated_calf_raise:2:12-20",
        ],
      },
    ],
  },
  {
    key: "lean_out_frequency",
    en: "Lean Out · Frequency",
    pt: "Definição · Frequência",
    descEn:
      "The same weekly work cut into six short sessions. Easier to fit around a deficit, and nothing runs long enough to drag.",
    descPt:
      "O mesmo trabalho semanal dividido em seis treinos curtos. Mais fácil de encaixar durante o déficit, e nenhum deles se arrasta.",
    daysPerWeek: 6,
    weeks: 5,
    level: "intermediate",
    goal: "fatloss",
    restSec: 45,
    days: [
      {
        en: "Upper A",
        pt: "Superior A",
        slots: [
          "barbell_bench_press:3:8-12",
          "barbell_row:3:8-12",
          "dumbbell_lateral_raise:2:12-20",
          "triceps_pushdown:2:12-20",
        ],
      },
      {
        en: "Lower A",
        pt: "Inferior A",
        slots: ["back_squat:3:8-12", "lying_leg_curl:3:10-15", "standing_calf_raise:2:12-20"],
      },
      {
        en: "Upper B",
        pt: "Superior B",
        slots: [
          "incline_dumbbell_press:3:10-15",
          "lat_pulldown:3:10-15",
          "cable_lateral_raise:2:12-20",
          "ez_bar_curl:2:12-20",
        ],
      },
      {
        en: "Lower B",
        pt: "Inferior B",
        slots: ["romanian_deadlift:3:8-12", "leg_press:3:12-20", "seated_calf_raise:2:12-20"],
      },
      {
        en: "Upper C",
        pt: "Superior C",
        slots: [
          "machine_chest_press:3:10-15",
          "seated_cable_row:3:10-15",
          "reverse_pec_deck:2:12-20",
          "overhead_cable_extension:2:12-20",
        ],
      },
      {
        en: "Lower C",
        pt: "Inferior C",
        slots: ["hack_squat:3:10-15", "hip_thrust:3:10-15", "leg_extension:2:12-20"],
      },
    ],
  },
];
