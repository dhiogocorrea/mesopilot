"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { formatRepRange } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { estimateProgramMinutes } from "@/lib/training-time";
import { EXPERIENCE_LEVELS, GOALS, type Experience, type Goal } from "@/lib/types";
import { deleteCustomProgram, saveCustomProgram } from "@/server/actions";
import { Button, Input, Label, Screen, Segmented, cx } from "./ui";

export type ExerciseChoice = {
  id: string;
  name: string;
  muscleName: string;
  repMin: number;
  repMax: number;
  restSec: number;
};

export type BuilderSlot = {
  /** Stable across reorders so React does not remount rows while editing. */
  key: string;
  exerciseId: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
};

export type BuilderDay = {
  key: string;
  label: string;
  slots: BuilderSlot[];
};

export type BuilderInitial = {
  id?: string;
  name: string;
  level: Experience;
  goal: Goal;
  weeks: number;
  days: BuilderDay[];
};

let keyCounter = 0;
function nextKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function ProgramBuilder({
  exercises,
  initial,
}: {
  exercises: ExerciseChoice[];
  initial: BuilderInitial;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [level, setLevel] = useState(initial.level);
  const [goal, setGoal] = useState(initial.goal);
  const [weeks, setWeeks] = useState(initial.weeks);
  const [days, setDays] = useState<BuilderDay[]>(initial.days);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const estimatedMinutes = useMemo(
    () =>
      estimateProgramMinutes(
        days.map((day) => day.slots.map((slot) => ({ sets: slot.sets, restSec: slot.restSec }))),
      ),
    [days],
  );

  function updateDay(key: string, patch: Partial<BuilderDay>) {
    setDays((current) => current.map((day) => (day.key === key ? { ...day, ...patch } : day)));
  }

  function updateSlot(dayKey: string, slotKey: string, patch: Partial<BuilderSlot>) {
    setDays((current) =>
      current.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.key === slotKey ? { ...slot, ...patch } : slot,
              ),
            }
          : day,
      ),
    );
  }

  function moveSlot(dayKey: string, index: number, direction: -1 | 1) {
    setDays((current) =>
      current.map((day) => {
        if (day.key !== dayKey) return day;
        const target = index + direction;
        if (target < 0 || target >= day.slots.length) return day;
        const slots = [...day.slots];
        [slots[index], slots[target]] = [slots[target]!, slots[index]!];
        return { ...day, slots };
      }),
    );
  }

  function addExercise(dayKey: string, choice: ExerciseChoice) {
    setDays((current) =>
      current.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              slots: [
                ...day.slots,
                {
                  key: nextKey("slot"),
                  exerciseId: choice.id,
                  name: choice.name,
                  sets: 3,
                  repMin: choice.repMin,
                  repMax: choice.repMax,
                  restSec: choice.restSec,
                },
              ],
            }
          : day,
      ),
    );
    setPickerDay(null);
  }

  function validate(): string | null {
    if (!name.trim()) return t("builder.errName");
    if (days.length === 0) return t("builder.errEmptyDay");
    if (days.some((day) => !day.label.trim())) return t("builder.errDayName");
    if (days.some((day) => day.slots.length === 0)) return t("builder.errEmptyDay");
    if (days.some((day) => day.slots.some((slot) => slot.repMax < slot.repMin))) {
      return t("builder.errRepRange");
    }
    return null;
  }

  function submit() {
    const problem = validate();
    setError(problem);
    if (problem) return;

    startTransition(async () => {
      try {
        await saveCustomProgram({
          id: initial.id,
          name: name.trim(),
          level,
          goal,
          weeks,
          days: days.map((day) => ({
            label: day.label.trim(),
            slots: day.slots.map((slot) => ({
              exerciseId: slot.exerciseId,
              sets: slot.sets,
              repMin: slot.repMin,
              repMax: slot.repMax,
              restSec: slot.restSec,
            })),
          })),
        });
        router.push("/plan/new");
      } catch {
        setError(t("common.error"));
      }
    });
  }

  return (
    <Screen className="pb-8">
      <div className="space-y-5">
        <div>
          <Label htmlFor="program-name">{t("builder.programName")}</Label>
          <Input
            id="program-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("builder.programNamePlaceholder")}
          />
        </div>

        <div>
          <Label>{t("meso.level")}</Label>
          <Segmented
            value={level}
            onChange={setLevel}
            columns={3}
            options={EXPERIENCE_LEVELS.map((value) => ({
              value,
              label: t(`onboarding.${value}`),
            }))}
          />
        </div>

        <div>
          <Label>{t("meso.goal")}</Label>
          <Segmented
            value={goal}
            onChange={setGoal}
            options={GOALS.map((value) => ({ value, label: t(`onboarding.${value}`) }))}
          />
        </div>

        <div>
          <Label>{t("meso.weeks")}</Label>
          <Segmented
            value={weeks}
            onChange={setWeeks}
            columns={5}
            options={[4, 5, 6, 7, 8].map((value) => ({ value, label: String(value) }))}
          />
        </div>

        {days.length > 0 && (
          <p className="text-[13px] tabular-nums text-ink-3">
            {days.length} {t("meso.days")}
            <span className="mx-1.5 text-ink-3/50">·</span>
            {t("builder.estimated", { count: estimatedMinutes })}
          </p>
        )}
      </div>

      {days.map((day, dayIndex) => (
        <section key={day.key} className="mt-9 border-t border-hairline pt-6">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor={`day-${day.key}`}>
                {t("common.day")} {dayIndex + 1}
              </Label>
              <Input
                id={`day-${day.key}`}
                value={day.label}
                onChange={(event) => updateDay(day.key, { label: event.target.value })}
                placeholder={t("builder.dayNamePlaceholder")}
              />
            </div>
            <button
              type="button"
              onClick={() => setDays((current) => current.filter((d) => d.key !== day.key))}
              aria-label={t("builder.removeDay")}
              className="flex size-12 items-center justify-center rounded-xl border border-hairline-strong text-ink-3 active:text-danger"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {day.slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">{t("builder.noExercises")}</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {day.slots.map((slot, slotIndex) => (
                <li key={slot.key} className="rounded-xl border border-hairline bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{slot.name}</span>
                    <div className="flex shrink-0 gap-0.5">
                      <IconButton
                        label={t("builder.moveUp")}
                        disabled={slotIndex === 0}
                        onClick={() => moveSlot(day.key, slotIndex, -1)}
                        path="m7 14 5-5 5 5"
                      />
                      <IconButton
                        label={t("builder.moveDown")}
                        disabled={slotIndex === day.slots.length - 1}
                        onClick={() => moveSlot(day.key, slotIndex, 1)}
                        path="m7 10 5 5 5-5"
                      />
                      <IconButton
                        label={t("builder.removeExercise")}
                        danger
                        onClick={() =>
                          updateDay(day.key, {
                            slots: day.slots.filter((s) => s.key !== slot.key),
                          })
                        }
                        path="M6 6l12 12M18 6 6 18"
                      />
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    <NumberCell
                      label={t("common.sets")}
                      value={slot.sets}
                      min={1}
                      max={20}
                      onChange={(sets) => updateSlot(day.key, slot.key, { sets })}
                    />
                    <NumberCell
                      label={`${t("builder.repsShort")} min`}
                      value={slot.repMin}
                      min={1}
                      max={50}
                      onChange={(repMin) => updateSlot(day.key, slot.key, { repMin })}
                    />
                    <NumberCell
                      label={`${t("builder.repsShort")} max`}
                      value={slot.repMax}
                      min={1}
                      max={60}
                      onChange={(repMax) => updateSlot(day.key, slot.key, { repMax })}
                    />
                    <NumberCell
                      label={t("builder.restShort")}
                      value={slot.restSec}
                      min={15}
                      max={600}
                      step={15}
                      onChange={(restSec) => updateSlot(day.key, slot.key, { restSec })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pickerDay === day.key ? (
            <ExercisePicker
              exercises={exercises}
              onPick={(choice) => addExercise(day.key, choice)}
              onCancel={() => setPickerDay(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setPickerDay(day.key)}
              className="mt-3 h-11 w-full rounded-xl border border-dashed border-hairline-strong text-sm font-medium text-ink-3 active:bg-surface"
            >
              + {t("builder.addExercise")}
            </button>
          )}
        </section>
      ))}

      <div className="mt-6 space-y-3">
        {days.length < 10 && (
          <Button
            variant="secondary"
            full
            onClick={() =>
              setDays((current) => [...current, { key: nextKey("day"), label: "", slots: [] }])
            }
          >
            + {t("builder.addDay")}
          </Button>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button size="lg" full onClick={submit} disabled={pending}>
          {pending ? t("common.loading") : t("builder.save")}
        </Button>

        {initial.id &&
        (confirmingDelete ? (
          <div className="space-y-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3.5">
            <p className="text-sm">{t("builder.deleteConfirm")}</p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() => startTransition(() => deleteCustomProgram(initial.id!))}
              >
                {t("common.confirm")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmingDelete(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" full onClick={() => setConfirmingDelete(true)}>
            {t("builder.delete")}
          </Button>
        ))}
      </div>
    </Screen>
  );
}

function IconButton({
  label,
  onClick,
  path,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  path: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cx(
        "flex size-9 items-center justify-center rounded-lg text-ink-3 transition-colors",
        "disabled:opacity-20",
        danger ? "active:text-danger" : "active:bg-surface-2",
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function NumberCell({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-label mb-1 block text-center uppercase text-ink-3">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="h-10 w-full min-w-0 rounded-lg border border-hairline-strong bg-surface-2 px-1 text-center text-base font-semibold tabular-nums outline-none transition-colors focus:border-accent"
      />
    </label>
  );
}

function ExercisePicker({
  exercises,
  onPick,
  onCancel,
}: {
  exercises: ExerciseChoice[];
  onPick: (choice: ExerciseChoice) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return exercises;
    return exercises.filter((exercise) =>
      normalize(`${exercise.name} ${exercise.muscleName}`).includes(needle),
    );
  }, [exercises, query]);

  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-hairline bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("builder.pickExercise")}</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] text-ink-3 underline decoration-hairline-strong underline-offset-4"
        >
          {t("common.cancel")}
        </button>
      </div>

      <Input
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("exercises.searchPlaceholder")}
        aria-label={t("common.search")}
      />

      {results.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">{t("exercises.noResults")}</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {results.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => onPick(exercise)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left transition-colors active:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{exercise.name}</span>
                  <span className="block truncate text-xs text-ink-3">{exercise.muscleName}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-3">
                  {formatRepRange(exercise.repMin, exercise.repMax)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
