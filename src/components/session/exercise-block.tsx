"use client";

import { useState, useTransition } from "react";

import type { ExerciseDemo } from "@/lib/demo";
import { formatRepRange } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { formatWeight } from "@/lib/units";
import { addSet } from "@/server/actions";
import { DemoButton } from "../exercise-demo";
import { Chip, cx } from "../ui";
import { FeedbackForm } from "./feedback-form";
import { SetHeader, SetRow, type SetView } from "./set-row";

export type EntryView = {
  id: string;
  exerciseName: string;
  demo: ExerciseDemo;
  muscleName: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  targetRir: number;
  restSec: number;
  soreness: number | null;
  pump: number | null;
  workload: number | null;
  jointPain: number | null;
  aiNote: string | null;
  reason: string | null;
  setDelta: number;
  sets: SetView[];
  previous: {
    week: number;
    sets: { weightKg: number | null; reps: number | null; rir: number | null }[];
  } | null;
};

export function ExerciseBlock({
  entry,
  index,
  onSetCompleted,
}: {
  entry: EntryView;
  index: number;
  onSetCompleted: (restSec: number) => void;
}) {
  const { t, unit } = useI18n();
  const [showWhy, setShowWhy] = useState(false);
  const [pending, startTransition] = useTransition();

  const doneSets = entry.sets.filter((set) => set.completed).length;
  const needsFeedback = doneSets > 0 && entry.workload === null;
  const complete = doneSets >= entry.targetSets && entry.workload !== null;
  const hasExplanation = Boolean(entry.reason ?? entry.aiNote);

  return (
    <section className="border-b border-hairline py-7 last:border-b-0">
      {/* Header: the movement, then the prescription as a single legible line. */}
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "mt-0.5 w-5 shrink-0 text-sm font-semibold tabular-nums",
            complete ? "text-accent" : "text-ink-3",
          )}
        >
          {complete ? "✓" : index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-headline leading-snug">{entry.exerciseName}</h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {entry.muscleName} · {t("session.restTimer")} {Math.round(entry.restSec / 15) * 15}s
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums leading-none">
            {entry.targetSets}
            <span className="mx-0.5 text-ink-3">×</span>
            {formatRepRange(entry.repMin, entry.repMax)}
          </p>
          <p className="mt-1.5 text-[11px] font-medium tabular-nums text-ink-3">
            @ {entry.targetRir} {t("common.rir")}
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2 pl-8">
        <DemoButton demo={entry.demo} exerciseName={entry.exerciseName} compact />
        {entry.setDelta !== 0 && (
          <Chip tone={entry.setDelta > 0 ? "accent" : "warn"}>
            {entry.setDelta > 0
              ? t("coach.setsUp", { count: entry.setDelta })
              : t("coach.setsDown", { count: entry.setDelta })}
          </Chip>
        )}
        {needsFeedback && <Chip tone="info">{t("feedback.pending")}</Chip>}
        {hasExplanation && (
          <button
            type="button"
            onClick={() => setShowWhy((current) => !current)}
            aria-expanded={showWhy}
            className="text-[13px] text-ink-3 underline decoration-hairline-strong underline-offset-4"
          >
            {t("session.whyThis")}
          </button>
        )}
      </div>

      {showWhy && hasExplanation && (
        <div className="mt-3 space-y-2 border-l-2 border-hairline-strong py-0.5 pl-3 text-[13px] leading-relaxed">
          {entry.reason && <p className="text-ink-2">{entry.reason}</p>}
          {entry.aiNote && (
            <p className="text-ink">
              <span className="mr-1.5 font-semibold text-accent">{t("session.coachNote")}</span>
              {entry.aiNote}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 pl-8 text-[13px] tabular-nums text-ink-3">
        {entry.previous ? (
          <>
            <span className="text-ink-2">{t("session.previous")}</span>{" "}
            {entry.previous.sets
              .map(
                (set) =>
                  `${formatWeight(set.weightKg, unit)}×${set.reps ?? "?"}@${set.rir ?? "?"}`,
              )
              .join("   ")}
          </>
        ) : (
          t("session.noPrevious")
        )}
      </p>

      <div className="mt-4 space-y-1">
        <SetHeader targetRir={entry.targetRir} />
        {entry.sets.map((set, setIndex) => (
          <SetRow
            key={set.id}
            set={set}
            index={setIndex}
            targetRir={entry.targetRir}
            canRemove={entry.sets.length > 1}
            onComplete={() => onSetCompleted(entry.restSec)}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => addSet(entry.id))}
        className="mt-2 h-10 w-full rounded-xl text-[13px] font-medium text-ink-3 transition-colors active:bg-surface disabled:opacity-30"
      >
        + {t("session.addSet")}
      </button>

      {needsFeedback && (
        <div className="mt-4">
          <FeedbackForm
            sessionExerciseId={entry.id}
            initial={{
              soreness: entry.soreness,
              pump: entry.pump,
              workload: entry.workload,
              jointPain: entry.jointPain,
            }}
          />
        </div>
      )}
    </section>
  );
}
