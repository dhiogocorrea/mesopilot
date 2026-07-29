/**
 * The medal catalogue.
 *
 * In code rather than in the database, for the same reason the progression
 * reason codes are: it ships with the app, nobody creates one at runtime, and a
 * key in a `UserAchievement` row means nothing without the definition anyway.
 * Only the *unlock* is per-athlete, so only the unlock is a row.
 *
 * Rules that matter if you add one:
 *
 *   - **Keys are permanent.** They are written into unlock rows; renaming one
 *     orphans every medal already earned.
 *   - **Points are snapshotted at unlock.** Re-pricing a medal changes what it
 *     is worth to earn from now on, never what someone already has.
 *   - Thresholds within a metric must ascend, and every metric needs at least
 *     one reachable tier. `catalogue.test.ts` enforces both.
 */

import type { Locale } from "../types";

/** What the threshold is counted against. Each maps to a field of `AthleteStats`. */
export const METRICS = [
  "sessions",
  "blocks",
  "perfectBlocks",
  "tonnageKg",
  "streakWeeks",
  "exercises",
] as const;
export type Metric = (typeof METRICS)[number];

/** Purely visual, and the order is the ranking. */
export const TIERS = ["bronze", "silver", "gold", "platinum"] as const;
export type Tier = (typeof TIERS)[number];

const POINTS: Record<Tier, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  platinum: 100,
};

export type Achievement = {
  key: string;
  metric: Metric;
  /** Unlocks when the athlete's value for `metric` reaches this. */
  threshold: number;
  tier: Tier;
  points: number;
  en: { name: string; description: string };
  pt: { name: string; description: string };
};

type Draft = Omit<Achievement, "points" | "tier"> & { tier: Tier };

function define(drafts: Draft[]): Achievement[] {
  return drafts.map((draft) => ({ ...draft, points: POINTS[draft.tier] }));
}

export const ACHIEVEMENTS: Achievement[] = define([
  // ------------------------------------------------------------- sessions
  {
    key: "sessions_1",
    metric: "sessions",
    threshold: 1,
    tier: "bronze",
    en: { name: "First Rep", description: "Finish your first session." },
    pt: { name: "Primeira Série", description: "Conclua seu primeiro treino." },
  },
  {
    key: "sessions_10",
    metric: "sessions",
    threshold: 10,
    tier: "bronze",
    en: { name: "Getting Warm", description: "Finish 10 sessions." },
    pt: { name: "Aquecendo", description: "Conclua 10 treinos." },
  },
  {
    key: "sessions_25",
    metric: "sessions",
    threshold: 25,
    tier: "silver",
    en: { name: "Regular", description: "Finish 25 sessions." },
    pt: { name: "Frequente", description: "Conclua 25 treinos." },
  },
  {
    key: "sessions_50",
    metric: "sessions",
    threshold: 50,
    tier: "silver",
    en: { name: "Committed", description: "Finish 50 sessions." },
    pt: { name: "Comprometido", description: "Conclua 50 treinos." },
  },
  {
    key: "sessions_100",
    metric: "sessions",
    threshold: 100,
    tier: "gold",
    en: { name: "Century", description: "Finish 100 sessions." },
    pt: { name: "Centenário", description: "Conclua 100 treinos." },
  },
  {
    key: "sessions_250",
    metric: "sessions",
    threshold: 250,
    tier: "platinum",
    en: { name: "Iron Habit", description: "Finish 250 sessions." },
    pt: { name: "Hábito de Ferro", description: "Conclua 250 treinos." },
  },

  // --------------------------------------------------------------- blocks
  {
    key: "blocks_1",
    metric: "blocks",
    threshold: 1,
    tier: "silver",
    en: { name: "Full Circle", description: "Complete a training block, deload and all." },
    pt: { name: "Ciclo Completo", description: "Complete um bloco de treino, deload incluído." },
  },
  {
    key: "blocks_3",
    metric: "blocks",
    threshold: 3,
    tier: "gold",
    en: { name: "Periodised", description: "Complete 3 training blocks." },
    pt: { name: "Periodizado", description: "Complete 3 blocos de treino." },
  },
  {
    key: "blocks_10",
    metric: "blocks",
    threshold: 10,
    tier: "platinum",
    en: { name: "Long Game", description: "Complete 10 training blocks." },
    pt: { name: "Jogo Longo", description: "Complete 10 blocos de treino." },
  },

  // -------------------------------------------------------- perfect blocks
  {
    key: "perfect_1",
    metric: "perfectBlocks",
    threshold: 1,
    tier: "gold",
    en: { name: "Nothing Skipped", description: "Finish every session in a block." },
    pt: { name: "Nenhum Pulado", description: "Conclua todos os treinos de um bloco." },
  },
  {
    key: "perfect_3",
    metric: "perfectBlocks",
    threshold: 3,
    tier: "platinum",
    en: { name: "Unbroken", description: "Finish every session in 3 blocks." },
    pt: { name: "Inquebrável", description: "Conclua todos os treinos de 3 blocos." },
  },

  // -------------------------------------------------------------- tonnage
  {
    key: "tonnage_25k",
    metric: "tonnageKg",
    threshold: 25_000,
    tier: "bronze",
    en: { name: "25 Tonnes", description: "Move 25,000 kg in total." },
    pt: { name: "25 Toneladas", description: "Mova 25.000 kg no total." },
  },
  {
    key: "tonnage_100k",
    metric: "tonnageKg",
    threshold: 100_000,
    tier: "silver",
    en: { name: "100 Tonnes", description: "Move 100,000 kg in total." },
    pt: { name: "100 Toneladas", description: "Mova 100.000 kg no total." },
  },
  {
    key: "tonnage_500k",
    metric: "tonnageKg",
    threshold: 500_000,
    tier: "gold",
    en: { name: "Half a Megatonne", description: "Move 500,000 kg in total." },
    pt: { name: "Meia Megatonelada", description: "Mova 500.000 kg no total." },
  },
  {
    key: "tonnage_1m",
    metric: "tonnageKg",
    threshold: 1_000_000,
    tier: "platinum",
    en: { name: "Millionaire", description: "Move 1,000,000 kg in total." },
    pt: { name: "Milionário", description: "Mova 1.000.000 kg no total." },
  },

  // --------------------------------------------------------------- streak
  {
    key: "streak_4",
    metric: "streakWeeks",
    threshold: 4,
    tier: "bronze",
    en: { name: "Four in a Row", description: "Train every week for 4 weeks." },
    pt: { name: "Quatro Seguidas", description: "Treine todas as semanas por 4 semanas." },
  },
  {
    key: "streak_12",
    metric: "streakWeeks",
    threshold: 12,
    tier: "silver",
    en: { name: "A Season", description: "Train every week for 12 weeks." },
    pt: { name: "Uma Temporada", description: "Treine todas as semanas por 12 semanas." },
  },
  {
    key: "streak_26",
    metric: "streakWeeks",
    threshold: 26,
    tier: "gold",
    en: { name: "Half a Year", description: "Train every week for 26 weeks." },
    pt: { name: "Meio Ano", description: "Treine todas as semanas por 26 semanas." },
  },
  {
    key: "streak_52",
    metric: "streakWeeks",
    threshold: 52,
    tier: "platinum",
    en: { name: "Every Week, All Year", description: "Train every week for 52 weeks." },
    pt: { name: "Todas as Semanas do Ano", description: "Treine todas as semanas por 52 semanas." },
  },

  // ------------------------------------------------------------ exercises
  {
    key: "exercises_15",
    metric: "exercises",
    threshold: 15,
    tier: "bronze",
    en: { name: "Explorer", description: "Log 15 different exercises." },
    pt: { name: "Explorador", description: "Registre 15 exercícios diferentes." },
  },
  {
    key: "exercises_40",
    metric: "exercises",
    threshold: 40,
    tier: "silver",
    en: { name: "Well Rounded", description: "Log 40 different exercises." },
    pt: { name: "Completo", description: "Registre 40 exercícios diferentes." },
  },
  {
    key: "exercises_80",
    metric: "exercises",
    threshold: 80,
    tier: "gold",
    en: { name: "Tried Everything", description: "Log 80 different exercises." },
    pt: { name: "Testou de Tudo", description: "Registre 80 exercícios diferentes." },
  },
]);

const BY_KEY = new Map(ACHIEVEMENTS.map((achievement) => [achievement.key, achievement]));

export function achievementFor(key: string): Achievement | undefined {
  return BY_KEY.get(key);
}

export function localizedAchievement(
  achievement: Achievement,
  locale: Locale,
): { name: string; description: string } {
  return locale === "pt" ? achievement.pt : achievement.en;
}
