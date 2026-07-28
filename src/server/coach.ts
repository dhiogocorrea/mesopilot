import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/json";
import { localized } from "@/lib/i18n";
import { formatWeight } from "@/lib/units";
import type { Locale } from "@/lib/types";
import { getUserContext } from "./user";

/**
 * The AI coaching layer. It reviews what the deterministic engine already
 * decided and may nudge it, but it is never the sole author of a prescription:
 *
 *   - Without ANTHROPIC_API_KEY the app runs on the engine alone.
 *   - Overrides are clamped to ±1 set and ±10% load around the engine's answer,
 *     so a hallucinated number cannot produce an unsafe session.
 *   - Any failure is swallowed; the engine's prescription stands.
 *
 * The value it adds is explanation and pattern-spotting across sessions —
 * things a rule table cannot express.
 */

const MODEL = "claude-opus-5";
const MAX_SET_OVERRIDE = 1;
const MAX_LOAD_OVERRIDE_PCT = 0.1;

export function isCoachConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Two sentences on how the session went and what changes next time.",
    },
    adjustments: {
      type: "array",
      description: "One entry per exercise you want to comment on. Omit exercises you agree with.",
      items: {
        type: "object",
        properties: {
          entryId: {
            type: "string",
            description: "The exact entryId given in the input for this exercise.",
          },
          note: {
            type: "string",
            description: "One sentence to the athlete explaining the prescription.",
          },
          setsDelta: {
            type: "integer",
            description: "Change to the algorithm's set count. Must be -1, 0, or 1.",
          },
          loadDeltaPct: {
            type: "number",
            description: "Change to the algorithm's load, as a fraction between -0.1 and 0.1.",
          },
        },
        required: ["entryId", "note", "setsDelta", "loadDeltaPct"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "adjustments"],
  additionalProperties: false,
} as const;

type CoachResponse = {
  summary: string;
  adjustments: {
    entryId: string;
    note: string;
    setsDelta: number;
    loadDeltaPct: number;
  }[];
};

function parseCoachResponse(raw: string): CoachResponse | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const candidate = parsed as Partial<CoachResponse>;
    if (typeof candidate.summary !== "string" || !Array.isArray(candidate.adjustments)) {
      return null;
    }

    const adjustments = candidate.adjustments.filter(
      (item): item is CoachResponse["adjustments"][number] =>
        typeof item?.entryId === "string" &&
        typeof item.note === "string" &&
        typeof item.setsDelta === "number" &&
        typeof item.loadDeltaPct === "number",
    );

    return { summary: candidate.summary, adjustments };
  } catch {
    return null;
  }
}

const LANGUAGE_NAME: Record<Locale, string> = {
  en: "English",
  pt: "Brazilian Portuguese",
};

const SYSTEM_PROMPT = `You are a hypertrophy coach reviewing a completed training session, working in the Renaissance Periodization framework: weekly volume is managed between MEV (minimum effective volume) and MRV (maximum recoverable volume), effort ramps by lowering reps-in-reserve across the mesocycle, and set counts respond to soreness, pump, workload and joint pain feedback.

A deterministic algorithm has already produced next session's prescription. Your job is to review it, not to replace it.

- Agree with the algorithm by default. Only adjust when the athlete's history or context shows something the rules missed — a stalled lift, a joint that keeps complaining, feedback that contradicts the logged performance, or recovery context that makes the jump unwise.
- setsDelta must be -1, 0 or 1. loadDeltaPct must be between -0.1 and 0.1. Values outside those ranges are clamped.
- Write every note directly to the athlete in second person. One sentence, concrete, no hedging.
- Never invent numbers that are not in the input.`;

type SessionForCoach = NonNullable<Awaited<ReturnType<typeof loadSessionForCoach>>>;

async function loadSessionForCoach(sessionId: string) {
  return db.session.findUnique({
    where: { id: sessionId },
    include: {
      mesocycle: true,
      entries: {
        orderBy: { order: "asc" },
        include: {
          exercise: { include: { muscleGroup: true } },
          sets: { orderBy: { order: "asc" } },
          decisions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
}

function describeCompletedSession(session: SessionForCoach, locale: Locale): string {
  const lines = session.entries.map((entry) => {
    const sets = entry.sets
      .filter((set) => set.completed)
      .map((set) => `${formatWeight(set.weightKg, "kg")}kg x ${set.reps ?? "?"} @ ${set.rir ?? "?"} RIR`)
      .join(", ");

    const feedback = [
      `soreness ${entry.soreness ?? "n/a"}/3`,
      `pump ${entry.pump ?? "n/a"}/2`,
      `workload ${entry.workload ?? "n/a"}/3`,
      `joint pain ${entry.jointPain ?? "n/a"}/2`,
    ].join(", ");

    return `- ${localized(entry.exercise, locale)} (${localized(entry.exercise.muscleGroup, locale)}): target ${entry.targetSets}x${entry.repMin}-${entry.repMax} @ ${entry.targetRir} RIR. Performed: ${sets || "nothing logged"}. Feedback: ${feedback}.`;
  });

  return lines.join("\n");
}

function describePrescription(session: SessionForCoach, locale: Locale): string {
  const lines = session.entries.map((entry) => {
    const decision = entry.decisions[0];
    const load = entry.sets[0]?.weightKg;

    return `- entryId ${entry.id} | ${localized(entry.exercise, locale)}: ${entry.targetSets} sets x ${entry.repMin}-${entry.repMax} @ ${entry.targetRir} RIR at ${load === null || load === undefined ? "athlete's choice" : `${formatWeight(load, "kg")}kg`}. Algorithm reasoning: ${decision?.reasonEn ?? "none recorded"}`;
  });

  return lines.join("\n");
}

/**
 * Reviews `completedSessionId` and annotates (and possibly adjusts) the
 * generated `nextSessionId`. Returns the coach summary, or null when the AI
 * layer is unavailable — callers treat null as "engine output stands".
 */
export async function coachSession(
  completedSessionId: string,
  nextSessionId: string,
): Promise<string | null> {
  if (!isCoachConfigured()) return null;

  const [completed, next, context] = await Promise.all([
    loadSessionForCoach(completedSessionId),
    loadSessionForCoach(nextSessionId),
    getUserContext(),
  ]);

  if (!completed || !next) return null;

  const profile = await db.profile.findUnique({ where: { userId: context.userId } });
  const { locale, unit } = context;

  const injuries = parseJsonArray<string>(profile?.injuries);

  const athlete = [
    `Experience: ${profile?.experience ?? "intermediate"}`,
    `Goal: ${profile?.primaryGoal ?? "hypertrophy"}`,
    `Bodyweight: ${profile?.bodyweightKg ? `${profile.bodyweightKg}kg` : "unknown"}`,
    `Sleep ${profile?.sleepQuality ?? 3}/5, stress ${profile?.stressLevel ?? 3}/5, nutrition ${profile?.nutritionQuality ?? 3}/5, ${profile?.caloricState ?? "maintenance"}`,
    injuries.length > 0 ? `Injuries: ${injuries.join("; ")}` : "No reported injuries",
    `Preferred units: ${unit}`,
  ].join("\n");

  const prompt = `# Athlete
${athlete}

# Block
"${completed.mesocycle.name}" — week ${completed.week} of ${completed.mesocycle.weeks}, day "${completed.label}". Starting RIR ${completed.mesocycle.startRir}.

# Session just completed
${describeCompletedSession(completed, locale)}

# Algorithm's prescription for week ${next.week}, same day
${describePrescription(next, locale)}

Review the prescription. Write the summary and all notes in ${LANGUAGE_NAME[locale]}.`;

  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") return null;

  const text = response.content.find((block) => block.type === "text");
  if (!text) return null;

  const parsed = parseCoachResponse(text.text);
  if (!parsed) return null;

  await applyCoachAdjustments(next, parsed, locale);
  return parsed.summary;
}

async function applyCoachAdjustments(
  next: SessionForCoach,
  coach: CoachResponse,
  locale: Locale,
): Promise<void> {
  const entriesById = new Map(next.entries.map((entry) => [entry.id, entry]));

  for (const adjustment of coach.adjustments) {
    const entry = entriesById.get(adjustment.entryId);
    if (!entry) continue;

    // Clamp before trusting: the model can only nudge the engine, never
    // override it outright.
    const setsDelta = clamp(Math.round(adjustment.setsDelta), -MAX_SET_OVERRIDE, MAX_SET_OVERRIDE);
    const loadDeltaPct = clamp(adjustment.loadDeltaPct, -MAX_LOAD_OVERRIDE_PCT, MAX_LOAD_OVERRIDE_PCT);

    const targetSets = Math.max(1, Math.min(8, entry.targetSets + setsDelta));
    const appliedSetsDelta = targetSets - entry.targetSets;

    await db.sessionExercise.update({
      where: { id: entry.id },
      data: { targetSets, aiNote: adjustment.note },
    });

    if (appliedSetsDelta > 0) {
      const lastOrder = entry.sets.at(-1)?.order ?? -1;
      await db.setLog.createMany({
        data: Array.from({ length: appliedSetsDelta }, (_, index) => ({
          sessionExerciseId: entry.id,
          order: lastOrder + 1 + index,
          weightKg: entry.sets.at(-1)?.weightKg ?? null,
        })),
      });
    } else if (appliedSetsDelta < 0) {
      const doomed = entry.sets.slice(appliedSetsDelta).map((set) => set.id);
      await db.setLog.deleteMany({ where: { id: { in: doomed } } });
    }

    if (loadDeltaPct !== 0) {
      for (const set of entry.sets) {
        if (set.weightKg === null) continue;
        await db.setLog.update({
          where: { id: set.id },
          data: { weightKg: Math.round(set.weightKg * (1 + loadDeltaPct) * 4) / 4 },
        });
      }
    }

    if (appliedSetsDelta !== 0 || loadDeltaPct !== 0) {
      await db.progressionDecision.create({
        data: {
          sessionExerciseId: entry.id,
          source: "ai",
          setDelta: appliedSetsDelta,
          loadDeltaPct,
          targetRir: entry.targetRir,
          // The note is authored in one language; store it in both columns so
          // the UI never has to fall back to an empty string.
          reasonEn: locale === "en" ? adjustment.note : "",
          reasonPt: locale === "pt" ? adjustment.note : "",
        },
      });
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
