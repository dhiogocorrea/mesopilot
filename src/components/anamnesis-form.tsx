"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { toKg } from "@/lib/units";
import {
  CALORIC_STATES,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOALS,
  type CaloricState,
  type Equipment,
  type Experience,
  type Goal,
} from "@/lib/types";
import { saveProfile } from "@/server/actions";
import { Button, FilterPill, Input, Label, Section, Segmented } from "./ui";

export type AnamnesisValues = {
  name: string;
  sex: "male" | "female" | "other" | null;
  heightCm: string;
  bodyweight: string;
  experience: Experience;
  primaryGoal: Goal;
  daysPerWeek: number;
  sessionMinutes: number;
  sleepQuality: number;
  stressLevel: number;
  nutritionQuality: number;
  caloricState: CaloricState;
  injuries: string;
  equipment: Equipment[];
};

/**
 * The anamnesis. Everything here feeds either the progression engine
 * (experience sets the starting RIR; sleep/stress/nutrition throttle how fast
 * volume climbs) or the program matcher and the AI coach's context.
 */
export function AnamnesisForm({
  initial,
  editing,
}: {
  initial: AnamnesisValues;
  editing: boolean;
}) {
  const { t, unit } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<AnamnesisValues>(initial);

  function set<K extends keyof AnamnesisValues>(key: K, value: AnamnesisValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleEquipment(item: Equipment) {
    set(
      "equipment",
      values.equipment.includes(item)
        ? values.equipment.filter((value) => value !== item)
        : [...values.equipment, item],
    );
  }

  function submit() {
    setError(null);
    const trimmed = values.name.trim();
    if (!trimmed) {
      setError(t("onboarding.name"));
      return;
    }

    const weightValue = Number.parseFloat(values.bodyweight);
    const heightValue = Number.parseFloat(values.heightCm);

    startTransition(async () => {
      try {
        await saveProfile({
          name: trimmed,
          sex: values.sex,
          birthDate: null,
          heightCm: Number.isFinite(heightValue) ? heightValue : null,
          // The form collects the athlete's preferred unit; storage is kg.
          bodyweightKg: Number.isFinite(weightValue) ? toKg(weightValue, unit) : null,
          experience: values.experience,
          primaryGoal: values.primaryGoal,
          daysPerWeek: values.daysPerWeek,
          sessionMinutes: values.sessionMinutes,
          sleepQuality: values.sleepQuality,
          stressLevel: values.stressLevel,
          nutritionQuality: values.nutritionQuality,
          caloricState: values.caloricState,
          injuries: values.injuries
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
          equipment: values.equipment,
        });
        // Editing returns you where you came from; a first run goes on to pick
        // a program.
        router.push(editing ? "/settings" : "/plan/new");
      } catch {
        setError(t("common.error"));
      }
    });
  }

  const scale = [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }));

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      {editing && (
        <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-5 py-3">
            <Link
              href="/settings"
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
            <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold">
              {t("settings.anamnesis")}
            </h1>
          </div>
        </header>
      )}

      <div className="px-5 pb-16 pt-8">
        {!editing && (
          <>
            <h1 className="display-face text-display">{t("onboarding.title")}</h1>
            <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-ink-2">
              {t("onboarding.subtitle")}
            </p>
          </>
        )}

        <div className={editing ? "" : "mt-14"}>
          <Section label={t("onboarding.basics")}>
            <div className="space-y-5">
              <div>
                <Label htmlFor="name">{t("onboarding.name")}</Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder={t("onboarding.namePlaceholder")}
                  autoComplete="given-name"
                />
              </div>

              <div>
                <Label>{t("onboarding.sex")}</Label>
                <Segmented
                  value={values.sex}
                  onChange={(value) => set("sex", value)}
                  columns={3}
                  options={[
                    { value: "male" as const, label: t("onboarding.male") },
                    { value: "female" as const, label: t("onboarding.female") },
                    { value: "other" as const, label: t("onboarding.other") },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="height">{t("onboarding.height")}</Label>
                  <Input
                    id="height"
                    type="number"
                    inputMode="decimal"
                    value={values.heightCm}
                    onChange={(event) => set("heightCm", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bodyweight">
                    {t("onboarding.bodyweight")} ({unit})
                  </Label>
                  <Input
                    id="bodyweight"
                    type="number"
                    inputMode="decimal"
                    value={values.bodyweight}
                    onChange={(event) => set("bodyweight", event.target.value)}
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section label={t("onboarding.training")}>
            <div className="space-y-5">
              <div>
                <Label>{t("onboarding.experience")}</Label>
                <Segmented
                  value={values.experience}
                  onChange={(value) => set("experience", value)}
                  columns={1}
                  options={EXPERIENCE_LEVELS.map((level) => ({
                    value: level,
                    label: t(`onboarding.${level}`),
                    hint: t(`onboarding.${level}Hint`),
                  }))}
                />
              </div>

              <div>
                <Label>{t("onboarding.goal")}</Label>
                <Segmented
                  value={values.primaryGoal}
                  onChange={(value) => set("primaryGoal", value)}
                  options={GOALS.map((goal) => ({ value: goal, label: t(`onboarding.${goal}`) }))}
                />
              </div>

              <div>
                <Label>{t("onboarding.daysPerWeek")}</Label>
                <Segmented
                  value={values.daysPerWeek}
                  onChange={(value) => set("daysPerWeek", value)}
                  columns={6}
                  options={[2, 3, 4, 5, 6, 7].map((value) => ({ value, label: String(value) }))}
                />
              </div>

              <div>
                <Label htmlFor="minutes">{t("onboarding.sessionMinutes")}</Label>
                <Input
                  id="minutes"
                  type="number"
                  inputMode="numeric"
                  value={values.sessionMinutes}
                  onChange={(event) => set("sessionMinutes", Number(event.target.value) || 60)}
                />
              </div>

              <div>
                <Label>{t("onboarding.equipment")}</Label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT.map((item) => (
                    <FilterPill
                      key={item}
                      active={values.equipment.includes(item)}
                      onClick={() => toggleEquipment(item)}
                    >
                      {t(`equipment.${item}`)}
                    </FilterPill>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section label={t("onboarding.recovery")}>
            <p className="mb-5 max-w-[40ch] text-[13px] leading-relaxed text-ink-3">
              {t("onboarding.recoveryHint")}
            </p>

            <div className="space-y-5">
              <ScaleField
                label={t("onboarding.sleepQuality")}
                value={values.sleepQuality}
                onChange={(value) => set("sleepQuality", value)}
                options={scale}
                lowLabel={t("onboarding.low")}
                highLabel={t("onboarding.high")}
              />
              <ScaleField
                label={t("onboarding.stressLevel")}
                value={values.stressLevel}
                onChange={(value) => set("stressLevel", value)}
                options={scale}
                lowLabel={t("onboarding.low")}
                highLabel={t("onboarding.high")}
              />
              <ScaleField
                label={t("onboarding.nutritionQuality")}
                value={values.nutritionQuality}
                onChange={(value) => set("nutritionQuality", value)}
                options={scale}
                lowLabel={t("onboarding.low")}
                highLabel={t("onboarding.high")}
              />

              <div>
                <Label>{t("onboarding.caloricState")}</Label>
                <Segmented
                  value={values.caloricState}
                  onChange={(value) => set("caloricState", value)}
                  columns={3}
                  options={CALORIC_STATES.map((state) => ({
                    value: state,
                    label: t(`onboarding.${state}`),
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="injuries">
                  {t("onboarding.injuries")} ({t("common.optional")})
                </Label>
                <Input
                  id="injuries"
                  value={values.injuries}
                  onChange={(event) => set("injuries", event.target.value)}
                  placeholder={t("onboarding.injuriesPlaceholder")}
                />
              </div>
            </div>
          </Section>

          {error && <p className="mb-4 text-sm text-danger">{error}</p>}

          <Button size="lg" full onClick={submit} disabled={pending}>
            {pending
              ? t("common.loading")
              : editing
                ? t("common.save")
                : t("onboarding.finish")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScaleField({
  label,
  value,
  onChange,
  options,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Segmented value={value} onChange={onChange} columns={5} options={options} />
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-3">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
