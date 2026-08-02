import type { Locale } from "../types";

/**
 * The engine never emits prose — it emits reason codes. This file is the only
 * place that turns them into words, which keeps the algorithm testable and
 * keeps every explanation available in both locales.
 */
export const REASON_CODES = [
  "recovered_fully",
  "recovered_in_time",
  "still_sore",
  "low_pump",
  "great_pump",
  "workload_easy",
  "workload_high",
  "workload_too_much",
  "joint_pain_some",
  "joint_pain_high",
  "below_mev",
  "at_mrv",
  "approaching_mrv",
  "recovery_context_poor",
  "deload_week",
  "load_increase",
  "load_decrease",
  "load_hold",
  "no_history",
  "no_feedback",
  "skipped_last_week",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

type ReasonParams = Record<string, string | number>;

export type Reason = {
  code: ReasonCode;
  params?: ReasonParams;
};

const TEXT: Record<ReasonCode, Record<Locale, string>> = {
  recovered_fully: {
    en: "You never got sore — there is room for more volume.",
    pt: "Você não ficou dolorido — dá para aumentar o volume.",
  },
  recovered_in_time: {
    en: "Soreness healed right on time — volume is well matched.",
    pt: "A dor passou na hora certa — o volume está adequado.",
  },
  still_sore: {
    en: "Still sore going in — holding volume back to let it recover.",
    pt: "Ainda dolorido no início — segurando o volume para recuperar.",
  },
  low_pump: {
    en: "Pump was low, so the stimulus needs more sets.",
    pt: "O pump foi fraco, então o estímulo precisa de mais séries.",
  },
  great_pump: {
    en: "Pump was strong — current sets are doing their job.",
    pt: "O pump foi forte — as séries atuais estão funcionando.",
  },
  workload_easy: {
    en: "The work felt easy, so you can handle more.",
    pt: "O treino pareceu fácil, então você aguenta mais.",
  },
  workload_high: {
    en: "You pushed close to your limit — keeping sets steady.",
    pt: "Você chegou perto do limite — mantendo as séries.",
  },
  workload_too_much: {
    en: "That was too much work to recover from — pulling sets back.",
    pt: "Foi trabalho demais para recuperar — reduzindo as séries.",
  },
  joint_pain_some: {
    en: "Some joint discomfort — not adding sets this week.",
    pt: "Algum desconforto articular — sem adicionar séries esta semana.",
  },
  joint_pain_high: {
    en: "Significant joint pain — cutting volume and worth swapping the exercise.",
    pt: "Dor articular significativa — cortando volume; vale trocar o exercício.",
  },
  below_mev: {
    en: "Weekly volume is under your minimum effective dose — building up.",
    pt: "O volume semanal está abaixo do mínimo efetivo — aumentando.",
  },
  at_mrv: {
    en: "You are at your maximum recoverable volume — a deload is due.",
    pt: "Você atingiu o volume máximo recuperável — hora de um deload.",
  },
  approaching_mrv: {
    en: "Close to your recoverable ceiling — adding conservatively.",
    pt: "Perto do teto de recuperação — aumentando com cautela.",
  },
  recovery_context_poor: {
    en: "Sleep, stress or nutrition are limiting recovery — capping the jump.",
    pt: "Sono, estresse ou nutrição estão limitando a recuperação — limitando o aumento.",
  },
  deload_week: {
    en: "Deload week: half the sets at a lighter load to shed fatigue.",
    pt: "Semana de deload: metade das séries com carga leve para tirar a fadiga.",
  },
  load_increase: {
    en: "Last time you beat the rep target, so the load goes up to {from}→{to}.",
    pt: "Da última vez você superou a meta de reps, então a carga sobe de {from} para {to}.",
  },
  load_decrease: {
    en: "You fell short of the rep range — dropping to {to} to get back in it.",
    pt: "Você ficou abaixo da faixa de reps — reduzindo para {to} para voltar nela.",
  },
  load_hold: {
    en: "Keep {to} and chase an extra rep before the load moves.",
    pt: "Mantenha {to} e busque uma rep a mais antes de aumentar a carga.",
  },
  no_history: {
    en: "First time on this exercise — pick a load you can hold for the rep range.",
    pt: "Primeira vez neste exercício — escolha uma carga que sustente a faixa de reps.",
  },
  no_feedback: {
    en: "No feedback was recorded, so the prescription stays as it was.",
    pt: "Nenhum feedback foi registrado, então a prescrição continua a mesma.",
  },
  skipped_last_week: {
    en: "You skipped this last time, so it comes back unchanged.",
    pt: "Você pulou este da última vez, então ele volta sem mudanças.",
  },
};

function interpolate(template: string, params?: ReasonParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function renderReason(reason: Reason, locale: Locale): string {
  return interpolate(TEXT[reason.code][locale], reason.params);
}

export function renderReasons(reasons: Reason[], locale: Locale): string {
  return reasons.map((reason) => renderReason(reason, locale)).join(" ");
}
