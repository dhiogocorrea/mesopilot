import type { Equipment, MovementType } from "../src/lib/types";

/**
 * Seed content: muscle groups with their volume landmarks, the exercise
 * library, and the stock programs. Kept separate from seed.ts so the data can
 * be imported by tests and by the "reset to defaults" flow.
 */

// ------------------------------------------------------------- muscles
//
// Weekly set landmarks follow Renaissance Periodization's published guidance.
// They are starting estimates — the app calibrates them per user over time.

export type MuscleSeed = {
  key: string;
  en: string;
  pt: string;
  mv: number;
  mev: number;
  mav: number;
  mrv: number;
};

export const MUSCLES: MuscleSeed[] = [
  { key: "chest", en: "Chest", pt: "Peito", mv: 4, mev: 8, mav: 16, mrv: 22 },
  { key: "back", en: "Back", pt: "Costas", mv: 6, mev: 10, mav: 20, mrv: 25 },
  { key: "traps", en: "Traps", pt: "Trapézio", mv: 0, mev: 4, mav: 12, mrv: 20 },
  { key: "front_delts", en: "Front delts", pt: "Deltoide anterior", mv: 0, mev: 0, mav: 8, mrv: 12 },
  { key: "side_delts", en: "Side delts", pt: "Deltoide lateral", mv: 6, mev: 8, mav: 19, mrv: 26 },
  { key: "rear_delts", en: "Rear delts", pt: "Deltoide posterior", mv: 0, mev: 6, mav: 16, mrv: 24 },
  { key: "biceps", en: "Biceps", pt: "Bíceps", mv: 4, mev: 8, mav: 16, mrv: 20 },
  { key: "triceps", en: "Triceps", pt: "Tríceps", mv: 4, mev: 6, mav: 14, mrv: 18 },
  { key: "forearms", en: "Forearms", pt: "Antebraço", mv: 0, mev: 2, mav: 10, mrv: 16 },
  { key: "quads", en: "Quads", pt: "Quadríceps", mv: 6, mev: 8, mav: 18, mrv: 22 },
  { key: "hamstrings", en: "Hamstrings", pt: "Posterior de coxa", mv: 3, mev: 6, mav: 14, mrv: 20 },
  { key: "glutes", en: "Glutes", pt: "Glúteos", mv: 0, mev: 4, mav: 12, mrv: 16 },
  { key: "calves", en: "Calves", pt: "Panturrilhas", mv: 6, mev: 8, mav: 16, mrv: 20 },
  { key: "abs", en: "Abs", pt: "Abdômen", mv: 0, mev: 6, mav: 16, mrv: 25 },
];

// ------------------------------------------------------------ exercises

export type ExerciseSeed = {
  key: string;
  en: string;
  pt: string;
  muscle: string;
  secondary?: string[];
  equipment: Equipment;
  type?: MovementType;
  repMin?: number;
  repMax?: number;
  rest?: number;
  /** Stimulus-to-fatigue ratio 1..5; higher gets volume added to it first. */
  sfr?: number;
};

export const EXERCISES: ExerciseSeed[] = [
  // ---- chest
  { key: "barbell_bench_press", en: "Barbell Bench Press", pt: "Supino reto com barra", muscle: "chest", secondary: ["triceps", "front_delts"], equipment: "barbell", repMin: 6, repMax: 10, rest: 90, sfr: 4 },
  { key: "incline_barbell_press", en: "Incline Barbell Press", pt: "Supino inclinado com barra", muscle: "chest", secondary: ["front_delts", "triceps"], equipment: "barbell", repMin: 6, repMax: 10, rest: 90, sfr: 4 },
  { key: "dumbbell_bench_press", en: "Dumbbell Bench Press", pt: "Supino reto com halteres", muscle: "chest", secondary: ["triceps", "front_delts"], equipment: "dumbbell", repMin: 8, repMax: 12, rest: 75, sfr: 5 },
  { key: "incline_dumbbell_press", en: "Incline Dumbbell Press", pt: "Supino inclinado com halteres", muscle: "chest", secondary: ["front_delts", "triceps"], equipment: "dumbbell", repMin: 8, repMax: 12, rest: 75, sfr: 5 },
  { key: "machine_chest_press", en: "Machine Chest Press", pt: "Supino máquina", muscle: "chest", secondary: ["triceps"], equipment: "machine", repMin: 8, repMax: 15, rest: 60, sfr: 5 },
  { key: "smith_incline_press", en: "Smith Incline Press", pt: "Supino inclinado no Smith", muscle: "chest", secondary: ["front_delts", "triceps"], equipment: "smith", repMin: 8, repMax: 12, rest: 75, sfr: 4 },
  { key: "chest_dip", en: "Chest Dip", pt: "Mergulho para peito", muscle: "chest", secondary: ["triceps", "front_delts"], equipment: "bodyweight", repMin: 6, repMax: 12, rest: 75, sfr: 4 },
  { key: "pec_deck", en: "Pec Deck", pt: "Voador (peck deck)", muscle: "chest", equipment: "machine", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "cable_fly_high_low", en: "High-to-Low Cable Fly", pt: "Crucifixo no cabo (de cima)", muscle: "chest", equipment: "cable", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "cable_fly_low_high", en: "Low-to-High Cable Fly", pt: "Crucifixo no cabo (de baixo)", muscle: "chest", equipment: "cable", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "dumbbell_fly", en: "Dumbbell Fly", pt: "Crucifixo com halteres", muscle: "chest", equipment: "dumbbell", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 4 },
  { key: "push_up", en: "Push-Up", pt: "Flexão de braço", muscle: "chest", secondary: ["triceps", "front_delts"], equipment: "bodyweight", repMin: 10, repMax: 20, rest: 60, sfr: 3 },

  // ---- back
  { key: "conventional_deadlift", en: "Conventional Deadlift", pt: "Levantamento terra convencional", muscle: "back", secondary: ["hamstrings", "glutes", "traps"], equipment: "barbell", repMin: 4, repMax: 8, rest: 120, sfr: 3 },
  { key: "pull_up", en: "Pull-Up", pt: "Barra fixa (pegada pronada)", muscle: "back", secondary: ["biceps", "rear_delts"], equipment: "bodyweight", repMin: 6, repMax: 12, rest: 90, sfr: 5 },
  { key: "chin_up", en: "Chin-Up", pt: "Barra fixa (pegada supinada)", muscle: "back", secondary: ["biceps"], equipment: "bodyweight", repMin: 6, repMax: 12, rest: 90, sfr: 5 },
  { key: "lat_pulldown", en: "Lat Pulldown", pt: "Puxada frontal", muscle: "back", secondary: ["biceps"], equipment: "cable", repMin: 8, repMax: 15, rest: 60, sfr: 5 },
  { key: "neutral_grip_pulldown", en: "Neutral-Grip Pulldown", pt: "Puxada com pegada neutra", muscle: "back", secondary: ["biceps"], equipment: "cable", repMin: 8, repMax: 15, rest: 60, sfr: 5 },
  { key: "barbell_row", en: "Barbell Row", pt: "Remada curvada com barra", muscle: "back", secondary: ["biceps", "rear_delts"], equipment: "barbell", repMin: 6, repMax: 12, rest: 90, sfr: 4 },
  { key: "pendlay_row", en: "Pendlay Row", pt: "Remada Pendlay", muscle: "back", secondary: ["biceps", "rear_delts"], equipment: "barbell", repMin: 5, repMax: 8, rest: 90, sfr: 4 },
  { key: "dumbbell_row", en: "Single-Arm Dumbbell Row", pt: "Remada unilateral com halter", muscle: "back", secondary: ["biceps"], equipment: "dumbbell", repMin: 8, repMax: 12, rest: 60, sfr: 5 },
  { key: "chest_supported_row", en: "Chest-Supported Row", pt: "Remada com apoio no peito", muscle: "back", secondary: ["rear_delts", "biceps"], equipment: "machine", repMin: 8, repMax: 15, rest: 60, sfr: 5 },
  { key: "seated_cable_row", en: "Seated Cable Row", pt: "Remada sentada no cabo", muscle: "back", secondary: ["biceps", "rear_delts"], equipment: "cable", repMin: 8, repMax: 15, rest: 60, sfr: 5 },
  { key: "t_bar_row", en: "T-Bar Row", pt: "Remada cavalinho", muscle: "back", secondary: ["biceps", "rear_delts"], equipment: "barbell", repMin: 8, repMax: 12, rest: 75, sfr: 4 },
  { key: "machine_row", en: "Machine Row", pt: "Remada máquina", muscle: "back", secondary: ["biceps"], equipment: "machine", repMin: 8, repMax: 15, rest: 60, sfr: 5 },
  { key: "straight_arm_pulldown", en: "Straight-Arm Pulldown", pt: "Pulldown com braços estendidos", muscle: "back", equipment: "cable", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 4 },

  // ---- traps
  { key: "barbell_shrug", en: "Barbell Shrug", pt: "Encolhimento com barra", muscle: "traps", equipment: "barbell", type: "isolation", repMin: 8, repMax: 15, rest: 60, sfr: 4 },
  { key: "dumbbell_shrug", en: "Dumbbell Shrug", pt: "Encolhimento com halteres", muscle: "traps", equipment: "dumbbell", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 4 },

  // ---- shoulders
  { key: "overhead_press", en: "Overhead Press", pt: "Desenvolvimento militar com barra", muscle: "front_delts", secondary: ["triceps", "side_delts"], equipment: "barbell", repMin: 5, repMax: 10, rest: 90, sfr: 4 },
  { key: "dumbbell_shoulder_press", en: "Dumbbell Shoulder Press", pt: "Desenvolvimento com halteres", muscle: "front_delts", secondary: ["triceps", "side_delts"], equipment: "dumbbell", repMin: 8, repMax: 12, rest: 75, sfr: 4 },
  { key: "machine_shoulder_press", en: "Machine Shoulder Press", pt: "Desenvolvimento máquina", muscle: "front_delts", secondary: ["triceps"], equipment: "machine", repMin: 8, repMax: 15, rest: 60, sfr: 4 },
  { key: "front_raise", en: "Front Raise", pt: "Elevação frontal", muscle: "front_delts", equipment: "dumbbell", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 3 },
  { key: "dumbbell_lateral_raise", en: "Dumbbell Lateral Raise", pt: "Elevação lateral com halteres", muscle: "side_delts", equipment: "dumbbell", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 5 },
  { key: "cable_lateral_raise", en: "Cable Lateral Raise", pt: "Elevação lateral no cabo", muscle: "side_delts", equipment: "cable", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 5 },
  { key: "machine_lateral_raise", en: "Machine Lateral Raise", pt: "Elevação lateral máquina", muscle: "side_delts", equipment: "machine", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 5 },
  { key: "upright_row", en: "Upright Row", pt: "Remada alta", muscle: "side_delts", secondary: ["traps"], equipment: "barbell", repMin: 10, repMax: 15, rest: 60, sfr: 3 },
  { key: "reverse_pec_deck", en: "Reverse Pec Deck", pt: "Voador inverso", muscle: "rear_delts", equipment: "machine", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 5 },
  { key: "face_pull", en: "Face Pull", pt: "Face pull", muscle: "rear_delts", secondary: ["traps"], equipment: "cable", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 5 },
  { key: "rear_delt_fly", en: "Bent-Over Rear Delt Fly", pt: "Crucifixo inverso com halteres", muscle: "rear_delts", equipment: "dumbbell", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 4 },

  // ---- biceps
  { key: "barbell_curl", en: "Barbell Curl", pt: "Rosca direta com barra", muscle: "biceps", equipment: "barbell", type: "isolation", repMin: 8, repMax: 12, rest: 60, sfr: 4 },
  { key: "ez_bar_curl", en: "EZ-Bar Curl", pt: "Rosca direta com barra W", muscle: "biceps", equipment: "barbell", type: "isolation", repMin: 8, repMax: 12, rest: 60, sfr: 5 },
  { key: "dumbbell_curl", en: "Dumbbell Curl", pt: "Rosca alternada com halteres", muscle: "biceps", equipment: "dumbbell", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 4 },
  { key: "incline_dumbbell_curl", en: "Incline Dumbbell Curl", pt: "Rosca inclinada", muscle: "biceps", equipment: "dumbbell", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "hammer_curl", en: "Hammer Curl", pt: "Rosca martelo", muscle: "biceps", secondary: ["forearms"], equipment: "dumbbell", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 4 },
  { key: "preacher_curl", en: "Preacher Curl", pt: "Rosca Scott", muscle: "biceps", equipment: "barbell", type: "isolation", repMin: 8, repMax: 12, rest: 60, sfr: 5 },
  { key: "cable_curl", en: "Cable Curl", pt: "Rosca no cabo", muscle: "biceps", equipment: "cable", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },

  // ---- triceps
  { key: "close_grip_bench", en: "Close-Grip Bench Press", pt: "Supino com pegada fechada", muscle: "triceps", secondary: ["chest", "front_delts"], equipment: "barbell", repMin: 6, repMax: 10, rest: 75, sfr: 4 },
  { key: "triceps_dip", en: "Triceps Dip", pt: "Mergulho para tríceps", muscle: "triceps", secondary: ["chest"], equipment: "bodyweight", repMin: 6, repMax: 12, rest: 60, sfr: 4 },
  { key: "skull_crusher", en: "Skull Crusher", pt: "Tríceps testa", muscle: "triceps", equipment: "barbell", type: "isolation", repMin: 8, repMax: 12, rest: 60, sfr: 5 },
  { key: "overhead_cable_extension", en: "Overhead Cable Extension", pt: "Tríceps francês no cabo", muscle: "triceps", equipment: "cable", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "triceps_pushdown", en: "Triceps Pushdown", pt: "Tríceps na polia", muscle: "triceps", equipment: "cable", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "dumbbell_kickback", en: "Dumbbell Kickback", pt: "Tríceps coice", muscle: "triceps", equipment: "dumbbell", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 3 },

  // ---- forearms
  { key: "wrist_curl", en: "Wrist Curl", pt: "Rosca de punho", muscle: "forearms", equipment: "dumbbell", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 4 },
  { key: "reverse_curl", en: "Reverse Curl", pt: "Rosca inversa", muscle: "forearms", secondary: ["biceps"], equipment: "barbell", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 4 },

  // ---- quads
  { key: "back_squat", en: "Back Squat", pt: "Agachamento livre", muscle: "quads", secondary: ["glutes", "hamstrings"], equipment: "barbell", repMin: 5, repMax: 10, rest: 120, sfr: 4 },
  { key: "front_squat", en: "Front Squat", pt: "Agachamento frontal", muscle: "quads", secondary: ["glutes", "abs"], equipment: "barbell", repMin: 5, repMax: 10, rest: 120, sfr: 4 },
  { key: "hack_squat", en: "Hack Squat", pt: "Agachamento hack", muscle: "quads", secondary: ["glutes"], equipment: "machine", repMin: 8, repMax: 15, rest: 90, sfr: 5 },
  { key: "leg_press", en: "Leg Press", pt: "Leg press", muscle: "quads", secondary: ["glutes"], equipment: "machine", repMin: 10, repMax: 20, rest: 90, sfr: 5 },
  { key: "smith_squat", en: "Smith Machine Squat", pt: "Agachamento no Smith", muscle: "quads", secondary: ["glutes"], equipment: "smith", repMin: 8, repMax: 15, rest: 90, sfr: 4 },
  { key: "bulgarian_split_squat", en: "Bulgarian Split Squat", pt: "Agachamento búlgaro", muscle: "quads", secondary: ["glutes"], equipment: "dumbbell", repMin: 8, repMax: 15, rest: 75, sfr: 4 },
  { key: "walking_lunge", en: "Walking Lunge", pt: "Afundo caminhando", muscle: "quads", secondary: ["glutes"], equipment: "dumbbell", repMin: 10, repMax: 20, rest: 75, sfr: 4 },
  { key: "goblet_squat", en: "Goblet Squat", pt: "Agachamento goblet", muscle: "quads", secondary: ["glutes"], equipment: "dumbbell", repMin: 10, repMax: 20, rest: 60, sfr: 3 },
  { key: "leg_extension", en: "Leg Extension", pt: "Cadeira extensora", muscle: "quads", equipment: "machine", type: "isolation", repMin: 12, repMax: 20, rest: 60, sfr: 5 },

  // ---- hamstrings
  { key: "romanian_deadlift", en: "Romanian Deadlift", pt: "Levantamento terra romeno", muscle: "hamstrings", secondary: ["glutes", "back"], equipment: "barbell", repMin: 8, repMax: 12, rest: 90, sfr: 5 },
  { key: "stiff_leg_deadlift", en: "Stiff-Leg Deadlift", pt: "Terra com pernas rígidas", muscle: "hamstrings", secondary: ["glutes"], equipment: "barbell", repMin: 8, repMax: 12, rest: 90, sfr: 4 },
  { key: "lying_leg_curl", en: "Lying Leg Curl", pt: "Mesa flexora", muscle: "hamstrings", equipment: "machine", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "seated_leg_curl", en: "Seated Leg Curl", pt: "Cadeira flexora", muscle: "hamstrings", equipment: "machine", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "nordic_curl", en: "Nordic Hamstring Curl", pt: "Flexora nórdica", muscle: "hamstrings", equipment: "bodyweight", type: "isolation", repMin: 5, repMax: 10, rest: 60, sfr: 4 },
  { key: "good_morning", en: "Good Morning", pt: "Good morning", muscle: "hamstrings", secondary: ["glutes", "back"], equipment: "barbell", repMin: 8, repMax: 12, rest: 75, sfr: 3 },

  // ---- glutes
  { key: "hip_thrust", en: "Barbell Hip Thrust", pt: "Elevação pélvica com barra", muscle: "glutes", secondary: ["hamstrings"], equipment: "barbell", repMin: 8, repMax: 15, rest: 75, sfr: 5 },
  { key: "sumo_deadlift", en: "Sumo Deadlift", pt: "Levantamento terra sumô", muscle: "glutes", secondary: ["quads", "hamstrings", "back"], equipment: "barbell", repMin: 5, repMax: 8, rest: 120, sfr: 3 },
  { key: "glute_bridge", en: "Glute Bridge", pt: "Ponte de glúteo", muscle: "glutes", equipment: "bodyweight", type: "isolation", repMin: 12, repMax: 20, rest: 60, sfr: 4 },
  { key: "cable_kickback", en: "Cable Glute Kickback", pt: "Coice no cabo", muscle: "glutes", equipment: "cable", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 4 },
  { key: "hip_abduction", en: "Hip Abduction Machine", pt: "Cadeira abdutora", muscle: "glutes", equipment: "machine", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 4 },

  // ---- calves
  { key: "standing_calf_raise", en: "Standing Calf Raise", pt: "Panturrilha em pé", muscle: "calves", equipment: "machine", type: "isolation", repMin: 10, repMax: 15, rest: 60, sfr: 5 },
  { key: "seated_calf_raise", en: "Seated Calf Raise", pt: "Panturrilha sentado", muscle: "calves", equipment: "machine", type: "isolation", repMin: 12, repMax: 20, rest: 60, sfr: 5 },
  { key: "leg_press_calf_raise", en: "Leg Press Calf Raise", pt: "Panturrilha no leg press", muscle: "calves", equipment: "machine", type: "isolation", repMin: 12, repMax: 20, rest: 60, sfr: 4 },

  // ---- abs
  { key: "hanging_leg_raise", en: "Hanging Leg Raise", pt: "Elevação de pernas na barra", muscle: "abs", equipment: "bodyweight", type: "isolation", repMin: 10, repMax: 20, rest: 60, sfr: 5 },
  { key: "cable_crunch", en: "Cable Crunch", pt: "Abdominal na polia", muscle: "abs", equipment: "cable", type: "isolation", repMin: 12, repMax: 20, rest: 60, sfr: 5 },
  { key: "decline_crunch", en: "Decline Crunch", pt: "Abdominal declinado", muscle: "abs", equipment: "bodyweight", type: "isolation", repMin: 12, repMax: 20, rest: 45, sfr: 4 },
  { key: "ab_wheel", en: "Ab Wheel Rollout", pt: "Rodinha abdominal", muscle: "abs", equipment: "bodyweight", type: "isolation", repMin: 8, repMax: 15, rest: 60, sfr: 4 },
  { key: "plank", en: "Plank", pt: "Prancha", muscle: "abs", equipment: "bodyweight", type: "isolation", repMin: 1, repMax: 3, rest: 45, sfr: 3 },
];
