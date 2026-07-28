"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { finishSession, startSession } from "@/server/actions";
import { Button, Chip, EmptyState } from "../ui";
import { ExerciseBlock, type EntryView } from "./exercise-block";
import { RestTimer } from "./rest-timer";

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
};

export function SessionLogger({ session }: { session: SessionView }) {
  const { t } = useI18n();
  const [restDeadline, setRestDeadline] = useState<number | null>(null);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [finishing, startFinish] = useTransition();

  const completed = session.status === "completed";

  // Opening a planned session is the same gesture as starting it — there is no
  // separate "begin" tap to forget.
  useEffect(() => {
    if (session.status === "planned") {
      void startSession(session.id);
    }
  }, [session.id, session.status]);

  const targetSets = session.entries.reduce((total, entry) => total + entry.targetSets, 0);
  const loggedSets = session.entries.reduce(
    (total, entry) => total + entry.sets.filter((set) => set.completed).length,
    0,
  );
  const missingFeedback = session.entries.some(
    (entry) => entry.sets.some((set) => set.completed) && entry.workload === null,
  );
  const pct = targetSets === 0 ? 0 : Math.min(100, (loggedSets / targetSets) * 100);

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
          session.entries.map((entry, index) => (
            <ExerciseBlock
              key={entry.id}
              entry={entry}
              index={index}
              onSetCompleted={(restSec) => setRestDeadline(Date.now() + restSec * 1000)}
            />
          ))
        )}
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg space-y-2.5 border-t border-hairline bg-canvas/95 px-5 pt-3 backdrop-blur-xl">
        {restDeadline !== null && (
          <RestTimer
            key={restDeadline}
            deadline={restDeadline}
            onDismiss={() => setRestDeadline(null)}
            onExtend={() => setRestDeadline((current) => (current ?? Date.now()) + 30_000)}
          />
        )}

        {completed ? (
          <Button variant="secondary" size="lg" full disabled>
            {t("meso.completed")}
          </Button>
        ) : confirmingFinish ? (
          <div className="space-y-2.5">
            <p className="text-sm text-ink-2">
              {missingFeedback ? t("session.finishWithUnlogged") : t("session.finishConfirm")}
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
          <Button
            size="lg"
            full
            disabled={loggedSets === 0}
            onClick={() => setConfirmingFinish(true)}
          >
            {t("session.finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
