"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { fromKg, toKg } from "@/lib/units";
import { logSet, removeSet } from "@/server/actions";
import { cx } from "../ui";

export type SetView = {
  id: string;
  order: number;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  completed: boolean;
};

/**
 * Column widths are shared by the header and every row so they cannot drift.
 * The trailing column is always reserved even when the remove button is hidden,
 * otherwise the last remaining set's inputs jump sideways.
 */
const ROW_GRID = "grid grid-cols-[1.25rem_1fr_1fr_1fr_2.5rem_1.75rem] items-center gap-1.5";

/**
 * Names the three number columns — without it they are three identical boxes.
 * RIR carries a help toggle: most people have never met the term, and it is the
 * one input here whose meaning is not self-evident.
 */
export function SetHeader({ targetRir }: { targetRir: number }) {
  const { t, unit } = useI18n();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <div className={cx(ROW_GRID, "text-label pb-1 uppercase text-ink-3")}>
        <span aria-hidden="true" />
        <span aria-hidden="true" className="text-center">
          {unit}
        </span>
        <span aria-hidden="true" className="text-center">
          {t("common.reps")}
        </span>
        <span className="flex items-center justify-center gap-1">
          <span aria-hidden="true">{t("common.rir")}</span>
          <button
            type="button"
            onClick={() => setShowHelp((current) => !current)}
            aria-expanded={showHelp}
            aria-label={t("session.whatIsRir")}
            className={cx(
              "relative flex size-4 items-center justify-center rounded-full border text-[9px] leading-none transition-colors",
              // The dot stays small so it does not crowd the column; the
              // pseudo-element gives it a thumb-sized hit area.
              "before:absolute before:-inset-2.5 before:content-['']",
              showHelp ? "border-accent bg-accent-soft text-accent" : "border-hairline-strong",
            )}
          >
            ?
          </button>
        </span>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </div>

      {showHelp && (
        <p className="mb-1 rounded-xl bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-ink-2">
          {targetRir === 0
            ? t("session.rirExplainerFailure")
            : t("session.rirExplainer", { target: targetRir })}
        </p>
      )}
    </>
  );
}

/**
 * One logged set. Local state is authoritative while the athlete types — the
 * server action fires on blur and on completion, so a mid-set re-render never
 * yanks a half-typed number out from under them.
 */
export function SetRow({
  set,
  index,
  targetRir,
  canRemove,
  onComplete,
}: {
  set: SetView;
  index: number;
  targetRir: number;
  canRemove: boolean;
  onComplete: () => void;
}) {
  const { t, unit } = useI18n();
  const [, startTransition] = useTransition();

  const [weight, setWeight] = useState(
    set.weightKg === null ? "" : String(Math.round(fromKg(set.weightKg, unit) * 100) / 100),
  );
  const [reps, setReps] = useState(set.reps === null ? "" : String(set.reps));
  const [rir, setRir] = useState(set.rir === null ? "" : String(set.rir));
  const [completed, setCompleted] = useState(set.completed);

  function persist(next: { completed?: boolean }) {
    const weightValue = Number.parseFloat(weight);
    const repsValue = Number.parseInt(reps, 10);
    const rirValue = Number.parseInt(rir, 10);

    startTransition(() =>
      logSet({
        setId: set.id,
        weightKg: Number.isFinite(weightValue) ? toKg(weightValue, unit) : null,
        reps: Number.isFinite(repsValue) ? repsValue : null,
        rir: Number.isFinite(rirValue) ? rirValue : null,
        completed: next.completed ?? completed,
      }),
    );
  }

  function toggleComplete() {
    const next = !completed;
    setCompleted(next);

    // Assume the prescribed effort unless they logged something different —
    // one less field to fill in on every set.
    if (next && rir === "") setRir(String(targetRir));

    persist({ completed: next });
    if (next) onComplete();
  }

  return (
    <div className={ROW_GRID}>
      <span
        className={cx(
          "text-center text-[13px] font-medium tabular-nums",
          completed ? "text-accent" : "text-ink-3",
        )}
      >
        {index + 1}
      </span>

      <NumberField
        value={weight}
        onChange={setWeight}
        onBlur={() => persist({})}
        label={`${t("common.weight")} (${unit})`}
        step="0.5"
        done={completed}
      />
      <NumberField
        value={reps}
        onChange={setReps}
        onBlur={() => persist({})}
        label={t("common.reps")}
        done={completed}
      />
      <NumberField
        value={rir}
        onChange={setRir}
        onBlur={() => persist({})}
        label={t("common.rir")}
        placeholder={String(targetRir)}
        done={completed}
      />

      <button
        type="button"
        onClick={toggleComplete}
        aria-pressed={completed}
        aria-label={t("common.done")}
        className={cx(
          "flex h-11 items-center justify-center rounded-xl border transition-colors",
          completed
            ? "border-accent bg-accent text-accent-ink"
            : "border-hairline-strong text-ink-3 active:bg-surface-2",
        )}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m5 12.5 4.5 4.5L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {canRemove ? (
        <button
          type="button"
          onClick={() => startTransition(() => removeSet(set.id))}
          aria-label={t("session.removeSet")}
          className="flex h-11 items-center justify-center text-ink-3 active:text-danger"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  onBlur,
  label,
  placeholder,
  step,
  done,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  label: string;
  placeholder?: string;
  step?: string;
  done: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={value}
      aria-label={label}
      placeholder={placeholder ?? "—"}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      // 16px text stops iOS Safari zooming the viewport on focus.
      className={cx(
        "h-11 w-full min-w-0 rounded-xl border px-1 text-center text-base font-semibold tabular-nums outline-none transition-colors",
        done
          ? "border-transparent bg-accent-soft text-ink"
          : "border-hairline-strong bg-surface text-ink focus:border-accent",
      )}
    />
  );
}
