"use client";

import { useMemo, useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import type { EditScope } from "@/lib/types";
import {
  addExerciseToSession,
  removeExerciseFromSession,
  swapSessionExercise,
} from "@/server/actions";
import { Sheet } from "../sheet";
import { Button, Input, cx } from "../ui";

/**
 * Mid-session edits: swap a movement, add one, drop one.
 *
 * Every one of them ends on the same question — today only, or from here on?
 * The plan *is* the sessions, so an edit made in the logger rewrites the rest
 * of the block unless the athlete says it was a one-off. Asking is cheaper than
 * either default being wrong: silently permanent turns a busy squat rack into a
 * programme change, and silently temporary brings back a movement they have
 * deliberately abandoned, every week, for the rest of the block.
 */

export type CatalogueExercise = {
  id: string;
  name: string;
  muscleGroupId: string;
  muscleName: string;
};

/** The entry a menu was opened on. Structurally satisfied by an EntryView. */
type EditTarget = {
  id: string;
  exerciseName: string;
  muscleGroupId: string;
  /** Work already banked against this movement. */
  hasLoggedSets: boolean;
};

export type EditJob = { kind: "menu"; entry: EditTarget } | { kind: "add" };

type Step = "menu" | "swap" | "add" | "remove";

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function EditExerciseSheet({
  job,
  onClose,
  sessionId,
  catalogue,
}: {
  job: EditJob | null;
  onClose: () => void;
  sessionId: string;
  catalogue: CatalogueExercise[];
}) {
  const { t } = useI18n();
  // Remounted per job by the caller's key, so every open starts at its own
  // first step rather than wherever the last one was abandoned.
  const [step, setStep] = useState<Step>(job?.kind === "add" ? "add" : "menu");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CatalogueExercise | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const target = job?.kind === "menu" ? job.entry : null;

  // Swapping is offered inside the muscle group only. The slot carries that
  // muscle's volume and the engine reasons about volume per muscle — a chest
  // slot that quietly became a biceps one moves a week's sets between two sets
  // of landmarks with nothing in the app saying so.
  const options = useMemo(() => {
    const pool =
      step === "swap" && target
        ? catalogue.filter(
            (exercise) =>
              exercise.muscleGroupId === target.muscleGroupId &&
              exercise.name !== target.exerciseName,
          )
        : catalogue;

    const needle = normalize(query);
    if (!needle) return pool;
    return pool.filter((exercise) =>
      normalize(`${exercise.name} ${exercise.muscleName}`).includes(needle),
    );
  }, [catalogue, step, target, query]);

  if (!job) return null;

  function commit(scope: EditScope) {
    setError(null);

    startTransition(async () => {
      try {
        if (step === "remove" && target) {
          await removeExerciseFromSession({ sessionExerciseId: target.id, scope });
        } else if (step === "swap" && target && picked) {
          await swapSessionExercise({
            sessionExerciseId: target.id,
            exerciseId: picked.id,
            scope,
          });
        } else if (step === "add" && picked) {
          await addExerciseToSession({ sessionId, exerciseId: picked.id, scope });
        }
        onClose();
      } catch {
        // The guards live on the server because the client's copy of the
        // session can be a few seconds stale — a set ticked on another tab is
        // enough. Failing here means the edit is no longer allowed, not that
        // the athlete did something wrong.
        setError(t("session.errEntryLogged"));
      }
    });
  }

  const scoping = (step === "remove" || picked !== null) && step !== "menu";

  const title = scoping
    ? t("session.scopeTitle")
    : step === "swap"
      ? t("session.swapExercise")
      : step === "add"
        ? t("session.addExercise")
        : (target?.exerciseName ?? t("session.editExercise"));

  const subtitle = scoping
    ? step === "remove"
      ? t("session.scopeRemoveBody", { exercise: target!.exerciseName })
      : t(step === "swap" ? "session.scopeSwapBody" : "session.scopeAddBody", {
          exercise: picked!.name,
        })
    : step === "swap"
      ? t("session.swapSameMuscle")
      : undefined;

  return (
    <Sheet open onClose={onClose} title={title} subtitle={subtitle}>
      {scoping ? (
        <div className="space-y-2.5 pt-1">
          <ScopeChoice
            label={t("session.scopeToday")}
            hint={step === "remove" ? t("session.scopeTodayRemove") : t("session.scopeTodayHint")}
            disabled={pending}
            onClick={() => commit("session")}
          />
          <ScopeChoice
            label={t("session.scopeForward")}
            hint={
              step === "remove" ? t("session.scopeForwardRemove") : t("session.scopeForwardHint")
            }
            danger={step === "remove"}
            disabled={pending}
            onClick={() => commit("forward")}
          />

          {error && <p className="pt-1 text-sm text-danger">{error}</p>}

          {/* Back rather than cancel: they have chosen a movement and may only
              want a different one. */}
          {step !== "remove" && (
            <Button variant="secondary" full disabled={pending} onClick={() => setPicked(null)}>
              {t("common.back")}
            </Button>
          )}
        </div>
      ) : step === "menu" ? (
        <div className="space-y-2.5 pt-1">
          {target?.hasLoggedSets ? (
            // Said here rather than three taps later. Substituting a movement
            // under logged numbers files those numbers against a lift that
            // never did them, and the comparison outlives the session.
            <p className="pb-2 text-sm leading-relaxed text-ink-2">
              {t("session.errEntryLogged")}
            </p>
          ) : (
            <>
              <MenuChoice label={t("session.swapExercise")} onClick={() => setStep("swap")} />
              <MenuChoice
                label={t("session.removeExercise")}
                danger
                onClick={() => setStep("remove")}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("exercises.searchPlaceholder")}
            aria-label={t("common.search")}
          />

          {options.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-3">{t("exercises.noResults")}</p>
          ) : (
            <ul className="-mx-1">
              {options.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(exercise)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-1 text-left transition-colors active:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px]">{exercise.name}</span>
                    <span className="shrink-0 text-[12px] text-ink-3">{exercise.muscleName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

function MenuChoice({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "tap w-full rounded-xl border border-hairline-strong px-4 py-3.5 text-left text-[15px] font-medium transition-colors active:bg-surface-2",
        danger && "text-danger",
      )}
    >
      {label}
    </button>
  );
}

function ScopeChoice({
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
        danger ? "border-danger/40 active:bg-surface-2" : "border-hairline-strong active:bg-surface-2",
      )}
    >
      <span className={cx("block text-[15px] font-semibold", danger && "text-danger")}>{label}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{hint}</span>
    </button>
  );
}
