"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { finishSession, reopenSession, skipSession, startSession } from "@/server/actions";
import { Sheet } from "../sheet";
import { Button, Chip, EmptyState, cx } from "../ui";
import {
  EditExerciseSheet,
  type CatalogueExercise,
  type EditJob,
} from "./edit-exercise-sheet";
import { ExerciseBlock, type EntryView } from "./exercise-block";
import { FeedbackSheet, NO_FEEDBACK, type FeedbackValues } from "./feedback-sheet";
import { RestTimer } from "./rest-timer";

export type MuscleFeedbackView = FeedbackValues & { muscleGroupId: string };

export type SessionView = {
  id: string;
  label: string;
  week: number;
  totalWeeks: number;
  dayIndex: number;
  isDeload: boolean;
  status: "planned" | "in_progress" | "completed" | "skipped";
  notes: string;
  entries: EntryView[];
  /** Every exercise the athlete may swap or add to, sent with the page. */
  catalogue: CatalogueExercise[];
  /** One row per muscle group already answered for this session. */
  feedback: MuscleFeedbackView[];
};

type MuscleStop = {
  id: string;
  name: string;
  /** Where in `entries` this muscle's last exercise sits. */
  lastEntryIndex: number;
  hasLoggedSets: boolean;
  /** Every set of every exercise training this muscle is ticked off. */
  finished: boolean;
  /** At least one of its exercises is actually being done today. */
  hasWork: boolean;
  answers: FeedbackValues;
  answered: boolean;
};

/**
 * The feedback questions are about a muscle, so they are asked once per muscle
 * — after its last exercise, wherever that falls. Chest and triceps in one
 * session is two prompts, not one per movement: several answers to the same
 * question told the engine two different things about one muscle's recovery.
 */
function muscleStops(session: SessionView): MuscleStop[] {
  const answersByMuscle = new Map(session.feedback.map((row) => [row.muscleGroupId, row]));
  const stops = new Map<string, MuscleStop>();

  session.entries.forEach((entry, index) => {
    // A skipped exercise is not work the muscle is waiting on — it still marks
    // where the group ends on screen, but it can neither finish the group nor
    // hold it open.
    const counts = entry.plan !== "skipped";
    const logged = counts && entry.sets.some((set) => set.completed);
    // An exercise with a blank set row left on it is not finished — the athlete
    // is still on it, whatever the target said.
    const done = counts && entry.sets.length > 0 && entry.sets.every((set) => set.completed);
    const existing = stops.get(entry.muscleGroupId);

    if (existing) {
      existing.lastEntryIndex = index;
      existing.hasLoggedSets ||= logged;
      existing.finished = counts ? existing.finished && done : existing.finished;
      existing.hasWork ||= counts;
      return;
    }

    const answers = answersByMuscle.get(entry.muscleGroupId);
    stops.set(entry.muscleGroupId, {
      id: entry.muscleGroupId,
      name: entry.muscleName,
      lastEntryIndex: index,
      hasLoggedSets: logged,
      finished: done,
      hasWork: counts,
      answers: answers ?? NO_FEEDBACK,
      answered: answers !== undefined,
    });
  });

  // A muscle every one of whose exercises was skipped was not trained, so
  // there is nothing to ask about.
  return [...stops.values()].filter((stop) => stop.hasWork);
}

export function SessionLogger({ session }: { session: SessionView }) {
  const { t } = useI18n();
  const [restDeadline, setRestDeadline] = useState<number | null>(null);
  const [askingMuscleId, setAskingMuscleId] = useState<string | null>(null);
  const [editJob, setEditJob] = useState<EditJob | null>(null);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [finishing, startFinish] = useTransition();

  const completed = session.status === "completed";
  const skipped = session.status === "skipped";

  // Opening a planned session is the same gesture as starting it — there is no
  // separate "begin" tap to forget.
  useEffect(() => {
    if (session.status === "planned") {
      void startSession(session.id);
    }
  }, [session.id, session.status]);

  // Skipped exercises are out of both totals: the bar would otherwise stall
  // short of full on work nobody intends to do.
  const active = session.entries.filter((entry) => entry.plan !== "skipped");
  const targetSets = active.reduce((total, entry) => total + entry.targetSets, 0);
  const loggedSets = active.reduce(
    (total, entry) => total + entry.sets.filter((set) => set.completed).length,
    0,
  );
  const stops = useMemo(() => muscleStops(session), [session]);
  const stopByEntryIndex = new Map(stops.map((stop) => [stop.lastEntryIndex, stop]));
  const unrated = stops.filter((stop) => stop.hasLoggedSets && !stop.answered);

  // Ticking the last set of a muscle group is the moment the four questions are
  // about — asking then costs a rest interval the athlete is spending anyway,
  // and a prompt they have to notice and tap is one they finish the session
  // without. Only the transition fires it: muscles already finished when this
  // screen opened are seeded as asked, so returning to a session is not greeted
  // by a modal, and un-ticking a set arms it again.
  const autoAsked = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (completed) return;

    if (autoAsked.current === null) {
      autoAsked.current = new Set(stops.filter((stop) => stop.finished).map((stop) => stop.id));
      return;
    }

    for (const stop of stops) {
      if (!stop.finished) autoAsked.current.delete(stop.id);
    }

    const due = stops.find(
      (stop) => stop.finished && !stop.answered && !autoAsked.current!.has(stop.id),
    );
    if (!due) return;

    autoAsked.current.add(due.id);
    setAskingMuscleId(due.id);
  }, [stops, completed]);

  const pct = targetSets === 0 ? 0 : Math.min(100, (loggedSets / targetSets) * 100);
  const asking = stops.find((stop) => stop.id === askingMuscleId) ?? null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-5 py-3">
          <Link
            href="/"
            aria-label={t("common.back")}
            className="-ml-2 flex size-9 items-center justify-center text-ink-2"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m14.5 5-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-tight">{session.label}</h1>
            <p className="text-[11px] tabular-nums text-ink-3">
              {t("common.week")} {session.week}/{session.totalWeeks} · {loggedSets}/{targetSets}{" "}
              {t("common.sets").toLowerCase()}
            </p>
          </div>
          {session.isDeload && <Chip tone="warn">{t("meso.deloadWeek")}</Chip>}
        </div>

        {/* Progress reads as a hairline the header sits on, not as a widget. */}
        <div className="h-px w-full bg-hairline" aria-hidden="true">
          <div
            className="h-px bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <main className="flex-1 px-5 pb-48">
        {session.isDeload && (
          <p className="mt-5 border-l-2 border-warn/50 py-0.5 pl-3 text-sm leading-relaxed text-warn">
            {t("session.deloadBanner")}
          </p>
        )}

        {session.entries.length === 0 ? (
          <EmptyState title={t("session.empty")} body={t("session.addExercise")} />
        ) : (
          session.entries.map((entry, index) => {
            const stop = stopByEntryIndex.get(index);

            return (
              // A fragment rather than a wrapper: an element around each block
              // would make every section the last child of its own parent, and
              // the hairline between exercises is `last:border-b-0`.
              <Fragment key={entry.id}>
                <ExerciseBlock
                  entry={entry}
                  index={index}
                  editable={!completed}
                  onSetCompleted={(restSec) => setRestDeadline(Date.now() + restSec * 1000)}
                  onEdit={() =>
                    setEditJob({
                      kind: "menu",
                      entry: {
                        id: entry.id,
                        exerciseName: entry.exerciseName,
                        muscleGroupId: entry.muscleGroupId,
                        hasLoggedSets: entry.sets.some((set) => set.completed),
                      },
                    })
                  }
                />
                {stop && (
                  <FeedbackPrompt
                    stop={stop}
                    locked={completed}
                    onOpen={() => setAskingMuscleId(stop.id)}
                  />
                )}
              </Fragment>
            );
          })
        )}

        {!completed && session.entries.length > 0 && (
          <button
            type="button"
            onClick={() => setEditJob({ kind: "add" })}
            className="tap mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline-strong text-[13px] font-medium text-ink-2 active:bg-surface"
          >
            + {t("session.addExercise")}
          </button>
        )}
      </main>

      <EditExerciseSheet
        // Remounted per job so each open starts at its own first step.
        key={editJob === null ? "closed" : editJob.kind === "add" ? "add" : editJob.entry.id}
        job={editJob}
        onClose={() => setEditJob(null)}
        sessionId={session.id}
        catalogue={session.catalogue}
      />

      {reopening && <ReopenSheet sessionId={session.id} onClose={() => setReopening(false)} />}

      {asking && (
        <FeedbackSheet
          // Keyed by muscle so reopening on another one starts from its own
          // answers rather than the last muscle's.
          key={asking.id}
          open
          onClose={() => setAskingMuscleId(null)}
          sessionId={session.id}
          muscleGroupId={asking.id}
          muscleName={asking.name}
          initial={asking.answers}
        />
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg space-y-2.5 border-t border-hairline bg-canvas/95 px-5 pt-3 backdrop-blur-xl">
        {restDeadline !== null && (
          <RestTimer
            key={restDeadline}
            deadline={restDeadline}
            onDismiss={() => setRestDeadline(null)}
            onExtend={() => setRestDeadline((current) => (current ?? Date.now()) + 30_000)}
          />
        )}

        {skipped ? (
          // Nothing to finish and nothing logged — the only thing left to offer
          // is changing your mind, which puts the day back in the plan.
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-2">{t("session.skippedBody")}</p>
            <Button
              variant="secondary"
              size="lg"
              full
              disabled={finishing}
              onClick={() =>
                startFinish(() => reopenSession({ sessionId: session.id, clear: true }))
              }
            >
              {finishing ? t("common.loading") : t("session.unskip")}
            </Button>
          </div>
        ) : completed ? (
          <Button variant="secondary" size="lg" full onClick={() => setReopening(true)}>
            {t("session.edit")}
          </Button>
        ) : confirmingFinish ? (
          <div className="space-y-2.5">
            <p className="text-sm text-ink-2">
              {unrated.length > 0
                ? t("session.finishWithoutFeedback", {
                    muscles: unrated.map((stop) => stop.name).join(", "),
                  })
                : t("session.finishConfirm")}
            </p>
            <div className="flex gap-2.5">
              <Button
                size="lg"
                className="flex-1"
                disabled={finishing}
                onClick={() => startFinish(() => finishSession(session.id))}
              >
                {finishing ? t("common.loading") : t("common.confirm")}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => setConfirmingFinish(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              size="lg"
              full
              disabled={loggedSets === 0}
              onClick={() => setConfirmingFinish(true)}
            >
              {t("session.finish")}
            </Button>

            {/* Only while the session is still empty. Once a set is ticked this
                is not a skipped day, it is an unfinished one — and the honest
                way out of that is to clear it, not to relabel it. */}
            {loggedSets === 0 &&
              (confirmingSkip ? (
                <div className="mt-3 space-y-2.5">
                  <p className="text-sm leading-relaxed text-ink-2">{t("session.skipConfirm")}</p>
                  <div className="flex gap-2.5">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="flex-1"
                      disabled={finishing}
                      onClick={() => startFinish(() => skipSession(session.id))}
                    >
                      {finishing ? t("common.loading") : t("session.skip")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="flex-1"
                      onClick={() => setConfirmingSkip(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="md"
                  full
                  className="mt-2"
                  onClick={() => setConfirmingSkip(true)}
                >
                  {t("session.skip")}
                </Button>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The end of a muscle's work in this session. It is a row rather than a panel
 * because it belongs to the list it interrupts — one bordered box per muscle
 * would out-shout the exercises above it.
 */
function FeedbackPrompt({
  stop,
  locked,
  onOpen,
}: {
  stop: MuscleStop;
  /** The session is finished: progression already ran on these answers. */
  locked: boolean;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const due = stop.hasLoggedSets && !stop.answered;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={locked}
      className={cx(
        "tap mt-4 mb-1 flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
        due
          ? "border-accent-line bg-accent-soft active:bg-surface-2"
          : "border-hairline text-ink-2 active:bg-surface",
        locked && "opacity-50",
      )}
    >
      <span
        className={cx(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
          stop.answered ? "bg-surface-3 text-ink-2" : "bg-accent text-accent-ink",
        )}
        aria-hidden="true"
      >
        {stop.answered ? "✓" : "?"}
      </span>

      <span className="min-w-0 flex-1">
        <span className={cx("block text-sm font-semibold", due ? "text-ink" : "text-ink-2")}>
          {t("feedback.askFor", { muscle: stop.name })}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-3">
          {stop.answered ? t("feedback.answered") : t("feedback.whyAsk")}
        </span>
      </span>

      {/* No call to action once the session is closed — the answers have
          already been read by the engine, so there is nothing left to change. */}
      {!locked && (
        <span className={cx("text-[13px] font-medium", due ? "text-accent" : "text-ink-3")}>
          {stop.answered ? t("common.edit") : t("feedback.answer")}
        </span>
      )}
    </button>
  );
}

/**
 * The way back into a finished session. Both routes delete the week this one
 * produced, so the correction is what next week gets written from — which is
 * only possible while that week is untouched, and the server says so if it is
 * not.
 */
function ReopenSheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(clear: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await reopenSession({ sessionId, clear });
      } catch (failure) {
        // A successful reopen redirects, and a redirect throws by design — it
        // must not be reported to the athlete as a failure.
        if (failure instanceof Error && failure.message.includes("NEXT_REDIRECT")) throw failure;
        setError(t("session.errNextStarted"));
      }
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("session.reopenTitle")}
      subtitle={t("session.reopenBody")}
    >
      <div className="space-y-2.5 pt-1">
        <ReopenChoice
          label={t("session.reopen")}
          hint={t("session.reopenHint")}
          disabled={pending}
          onClick={() => run(false)}
        />
        <ReopenChoice
          label={t("session.reopenClear")}
          hint={t("session.reopenClearHint")}
          danger
          disabled={pending}
          onClick={() => run(true)}
        />
        {error && <p className="pt-1 text-sm leading-relaxed text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}

function ReopenChoice({
  label,
  hint,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  danger?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "tap w-full rounded-xl border px-4 py-3.5 text-left transition-colors disabled:opacity-40",
        danger
          ? "border-danger/40 active:bg-surface-2"
          : "border-hairline-strong active:bg-surface-2",
      )}
    >
      <span className={cx("block text-[15px] font-semibold", danger && "text-danger")}>{label}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{hint}</span>
    </button>
  );
}
