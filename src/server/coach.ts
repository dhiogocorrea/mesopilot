import "server-only";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

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
 *   - With no model configured the app runs on the engine alone.
 *   - Overrides are clamped to ±1 set and ±10% load around the engine's answer,
 *     so a hallucinated number cannot produce an unsafe session.
 *   - Any failure is swallowed; the engine's prescription stands.
 *
 * The value it adds is explanation and pattern-spotting across sessions —
 * things a rule table cannot express.
 *
 * Routed through LangChain so the provider is a deployment detail. Azure is the
 * primary target; plain OpenAI is the fallback, and adding another provider
 * means another branch in `createModel` and nothing else — everything below it
 * speaks `BaseChatModel`.
 */

const MAX_SET_OVERRIDE = 1;
const MAX_LOAD_OVERRIDE_PCT = 0.1;
const MAX_TOKENS = 4000;

/** Azure pins the model at the deployment, so there is nothing to name here. */
const DEFAULT_AZURE_API_VERSION = "2024-10-21";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";

type Provider = "azure" | "openai";

/**
 * Which provider the environment is configured for, if any. Azure wins when
 * both are present: it is the deployment this app is built around, and a stray
 * OPENAI_API_KEY in the environment should never silently redirect an
 * athlete's training data to a different vendor.
 */
function coachProvider(): Provider | null {
  const azure = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
  const target = process.env.AZURE_OPENAI_API_INSTANCE_NAME ?? process.env.AZURE_OPENAI_ENDPOINT;

  if (azure && deployment && target) return "azure";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export function isCoachConfigured(): boolean {
  return coachProvider() !== null;
}

function createModel(): BaseChatModel | null {
  const provider = coachProvider();
  if (provider === null) return null;

  // Zero temperature on purpose: this is a reviewer applying a rubric to
  // numbers, and run-to-run variation in a training prescription is noise the
  // athlete would have to second-guess.
  //
  // `maxCompletionTokens`, not `maxTokens`: the reasoning-era models reject
  // `max_tokens` outright with a 400, and the older ones accept either. The
  // failure was invisible except in the logs, because a coach error is
  // swallowed by design — worth knowing before changing this back.
  const shared = { temperature: 0, maxCompletionTokens: MAX_TOKENS, maxRetries: 2 };

  if (provider === "azure") {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    return new AzureChatOpenAI({
      ...shared,
      azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
      azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? DEFAULT_AZURE_API_VERSION,
      // Either form works; the endpoint is the one Azure's portal shows.
      ...(endpoint
        ? { azureOpenAIEndpoint: endpoint }
        : { azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME }),
    });
  }

  return new ChatOpenAI({
    ...shared,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
  });
}

/**
 * Replaces a hand-written JSON schema and a hand-written parser: the same zod
 * the server actions already validate with, handed to the provider as its
 * response format and used to parse what comes back.
 */
const CoachReview = z.object({
  summary: z.string().describe("Two sentences on how the session went and what changes next time."),
  adjustments: z
    .array(
      z.object({
        entryId: z.string().describe("The exact entryId given in the input for this exercise."),
        note: z.string().describe("One sentence to the athlete explaining the prescription."),
        setsDelta: z
          .number()
          .int()
          .describe("Change to the algorithm's set count. Must be -1, 0, or 1."),
        loadDeltaPct: z
          .number()
          .describe("Change to the algorithm's load, as a fraction between -0.1 and 0.1."),
      }),
    )
    .describe("One entry per exercise you want to comment on. Omit exercises you agree with."),
});

type CoachResponse = z.infer<typeof CoachReview>;

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
      feedback: { include: { muscleGroup: true } },
    },
  });
}

function describeCompletedSession(session: SessionForCoach, locale: Locale): string {
  const lines = session.entries.map((entry) => {
    const sets = entry.sets
      .filter((set) => set.completed)
      .map((set) => `${formatWeight(set.weightKg, "kg")}kg x ${set.reps ?? "?"} @ ${set.rir ?? "?"} RIR`)
      .join(", ");

    // A skipped exercise says so. Left as "nothing logged" it reads as a lift
    // the athlete failed rather than one they chose not to do today.
    const performed = entry.plan === "skipped" ? "skipped today" : sets || "nothing logged";

    return `- ${localized(entry.exercise, locale)} (${localized(entry.exercise.muscleGroup, locale)}): target ${entry.targetSets}x${entry.repMin}-${entry.repMax} @ ${entry.targetRir} RIR. Performed: ${performed}.`;
  });

  // Feedback is answered per muscle, not per movement, so it is described that
  // way. Repeating one muscle's answer against each of its exercises reads as
  // several independent reports that happen to agree.
  const feedback = session.feedback.map(
    (row) =>
      `- ${localized(row.muscleGroup, locale)}: soreness ${row.soreness}/3, pump ${row.pump}/2, workload ${row.workload}/3, joint pain ${row.jointPain}/2.`,
  );

  return [
    lines.join("\n"),
    "",
    "Feedback by muscle group:",
    feedback.length > 0 ? feedback.join("\n") : "- none given",
  ].join("\n");
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

  const model = createModel();
  if (!model) return null;

  const reviewer = model.withStructuredOutput(CoachReview, { name: "coach_review" });

  const parsed = await reviewer.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(prompt),
  ]);

  // A refusal or a malformed response throws out of `invoke`, and the caller
  // already swallows that — the engine's prescription stands either way.
  if (!parsed?.summary) return null;

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
