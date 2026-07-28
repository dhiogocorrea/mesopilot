"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, WEIGHT_UNITS, type Locale, type WeightUnit } from "@/lib/types";
import { updateSettings } from "@/server/actions";
import { Button, Input, Label, Section, Segmented } from "./ui";

export function SettingsForm({
  name: initialName,
  locale: initialLocale,
  unit: initialUnit,
}: {
  name: string;
  locale: Locale;
  unit: WeightUnit;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [locale, setLocale] = useState(initialLocale);
  const [unit, setUnit] = useState(initialUnit);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = name !== initialName || locale !== initialLocale || unit !== initialUnit;

  function save() {
    startTransition(async () => {
      await updateSettings({ locale, unit, name: name.trim() || undefined });
      setSaved(true);
    });
  }

  const localeLabels: Record<Locale, string> = {
    en: t("settings.english"),
    pt: t("settings.portuguese"),
  };

  const unitLabels: Record<WeightUnit, string> = {
    kg: t("settings.kilograms"),
    lb: t("settings.pounds"),
  };

  return (
    <Section label={t("settings.preferences")}>
      <div className="space-y-5">
        <div>
          <Label htmlFor="settings-name">{t("onboarding.name")}</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
          />
        </div>

        <div>
          <Label>{t("settings.language")}</Label>
          <Segmented
            value={locale}
            onChange={(value) => {
              setLocale(value);
              setSaved(false);
            }}
            options={LOCALES.map((value) => ({ value, label: localeLabels[value] }))}
          />
        </div>

        <div>
          <Label>{t("settings.units")}</Label>
          <Segmented
            value={unit}
            onChange={(value) => {
              setUnit(value);
              setSaved(false);
            }}
            options={WEIGHT_UNITS.map((value) => ({ value, label: unitLabels[value] }))}
          />
        </div>

        <Button full disabled={!dirty || pending} onClick={save}>
          {pending ? t("common.loading") : saved && !dirty ? t("common.done") : t("common.save")}
        </Button>
      </div>
    </Section>
  );
}
