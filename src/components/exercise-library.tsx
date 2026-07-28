"use client";

import { useMemo, useState, useTransition } from "react";

import type { ExerciseDemo } from "@/lib/demo";
import { formatRepRange } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { EQUIPMENT, MOVEMENT_TYPES, type Equipment, type MovementType } from "@/lib/types";
import { createExercise } from "@/server/actions";
import { DemoButton, DemoLinkEditor } from "./exercise-demo";
import {
  Button,
  Chip,
  FilterPill,
  Input,
  Label,
  List,
  Row,
  Screen,
  Section,
  Segmented,
  Select,
} from "./ui";

type ExerciseItem = {
  id: string;
  name: string;
  muscleId: string;
  muscleName: string;
  equipment: string;
  movementType: string;
  repMin: number;
  repMax: number;
  isCustom: boolean;
  demoUrl: string | null;
  demoUnverified: boolean;
  demo: ExerciseDemo;
};

type MuscleItem = { id: string; key: string; name: string };

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function ExerciseLibrary({
  exercises,
  muscles,
}: {
  exercises: ExerciseItem[];
  muscles: MuscleItem[];
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openDemo, setOpenDemo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    // Accent-insensitive, so "flexao" finds "Flexão".
    const needle = normalize(query);
    return exercises.filter((exercise) => {
      if (muscleFilter && exercise.muscleId !== muscleFilter) return false;
      if (!needle) return true;
      return normalize(`${exercise.name} ${exercise.muscleName}`).includes(needle);
    });
  }, [exercises, query, muscleFilter]);

  return (
    <Screen>
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("exercises.searchPlaceholder")}
        aria-label={t("common.search")}
      />

      {/* Swipeable, with the scrollbar hidden — a visible bar is a desktop
          affordance, not a mobile one. */}
      <div className="bleed no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        <FilterPill active={muscleFilter === null} onClick={() => setMuscleFilter(null)}>
          {t("common.all")}
        </FilterPill>
        {muscles.map((muscle) => (
          <FilterPill
            key={muscle.id}
            active={muscleFilter === muscle.id}
            onClick={() =>
              setMuscleFilter((current) => (current === muscle.id ? null : muscle.id))
            }
          >
            {muscle.name}
          </FilterPill>
        ))}
      </div>

      <div className="mt-4">
        {creating ? (
          <CreateExerciseForm muscles={muscles} onDone={() => setCreating(false)} />
        ) : (
          <Button variant="secondary" full onClick={() => setCreating(true)}>
            + {t("exercises.create")}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">{t("exercises.noResults")}</p>
      ) : (
        <List className="mt-6">
          {filtered.map((exercise) => (
            <Row key={exercise.id}>
              <div className="py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{exercise.name}</p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-3">
                      {exercise.muscleName} · {t(`equipment.${exercise.equipment as Equipment}`)}{" "}
                      · {formatRepRange(exercise.repMin, exercise.repMax)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {exercise.isCustom && <Chip tone="accent">{t("exercises.custom")}</Chip>}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDemo((current) => (current === exercise.id ? null : exercise.id))
                      }
                      aria-expanded={openDemo === exercise.id}
                      aria-label={t("exercises.demo")}
                      className="flex size-8 items-center justify-center rounded-lg border border-hairline-strong text-ink-3 active:bg-surface"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="3"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M10.5 9.5v5l4-2.5-4-2.5Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mt-2.5">
                  <DemoButton demo={exercise.demo} exerciseName={exercise.name} compact />
                </div>

                {openDemo === exercise.id && (
                  <>
                    {exercise.demoUnverified && (
                      <p className="mt-3 text-xs leading-relaxed text-warn">
                        {t("exercises.demoUnverifiedHint")}
                      </p>
                    )}
                    <DemoLinkEditor exerciseId={exercise.id} currentUrl={exercise.demoUrl} />
                  </>
                )}
              </div>
            </Row>
          ))}
        </List>
      )}
    </Screen>
  );
}

function CreateExerciseForm({
  muscles,
  onDone,
}: {
  muscles: MuscleItem[];
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [nameEn, setNameEn] = useState("");
  const [namePt, setNamePt] = useState("");
  const [muscleGroupId, setMuscleGroupId] = useState(muscles[0]?.id ?? "");
  const [equipment, setEquipment] = useState<Equipment>("barbell");
  const [movementType, setMovementType] = useState<MovementType>("compound");
  const [repMin, setRepMin] = useState(8);
  const [repMax, setRepMax] = useState(12);
  const [restSec, setRestSec] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const en = nameEn.trim();
    const pt = namePt.trim();
    if (!en || !muscleGroupId) {
      setError(t("exercises.name"));
      return;
    }
    if (repMax < repMin) {
      setError(t("exercises.repRange"));
      return;
    }

    startTransition(async () => {
      try {
        await createExercise({
          nameEn: en,
          // A custom exercise usually has one name the athlete thinks in;
          // reuse it rather than forcing a translation.
          namePt: pt || en,
          muscleGroupId,
          secondary: [],
          equipment,
          movementType,
          defaultRepMin: repMin,
          defaultRepMax: repMax,
          defaultRestSec: restSec,
        });
        onDone();
      } catch {
        setError(t("common.error"));
      }
    });
  }

  return (
    <Section label={t("exercises.create")}>
      <div className="space-y-5">
        <div>
          <Label htmlFor="name-en">{t("exercises.nameEn")}</Label>
          <Input id="name-en" value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
        </div>

        <div>
          <Label htmlFor="name-pt">
            {t("exercises.namePt")} ({t("common.optional")})
          </Label>
          <Input id="name-pt" value={namePt} onChange={(event) => setNamePt(event.target.value)} />
        </div>

        <div>
          <Label htmlFor="muscle">{t("exercises.muscleGroup")}</Label>
          <Select
            id="muscle"
            value={muscleGroupId}
            onChange={(event) => setMuscleGroupId(event.target.value)}
          >
            {muscles.map((muscle) => (
              <option key={muscle.id} value={muscle.id}>
                {muscle.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>{t("exercises.movementType")}</Label>
          <Segmented
            value={movementType}
            onChange={setMovementType}
            options={MOVEMENT_TYPES.map((type) => ({ value: type, label: t(`exercises.${type}`) }))}
          />
        </div>

        <div>
          <Label>{t("exercises.equipment")}</Label>
          <Segmented
            value={equipment}
            onChange={setEquipment}
            columns={2}
            options={EQUIPMENT.map((item) => ({ value: item, label: t(`equipment.${item}`) }))}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="rep-min">{t("common.reps")} min</Label>
            <Input
              id="rep-min"
              type="number"
              inputMode="numeric"
              value={repMin}
              onChange={(event) => setRepMin(Number(event.target.value) || 1)}
            />
          </div>
          <div>
            <Label htmlFor="rep-max">{t("common.reps")} max</Label>
            <Input
              id="rep-max"
              type="number"
              inputMode="numeric"
              value={repMax}
              onChange={(event) => setRepMax(Number(event.target.value) || 1)}
            />
          </div>
          <div>
            <Label htmlFor="rest">{t("common.rest")}</Label>
            <Input
              id="rest"
              type="number"
              inputMode="numeric"
              value={restSec}
              onChange={(event) => setRestSec(Number(event.target.value) || 60)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2.5">
          <Button className="flex-1" disabled={pending} onClick={submit}>
            {pending ? t("common.loading") : t("common.save")}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onDone}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </Section>
  );
}
