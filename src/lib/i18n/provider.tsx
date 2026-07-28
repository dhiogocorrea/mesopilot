"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Locale, WeightUnit } from "../types";
import { createTranslator, type Translate } from "./index";

type I18nValue = {
  locale: Locale;
  unit: WeightUnit;
  t: Translate;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  unit,
  children,
}: {
  locale: Locale;
  unit: WeightUnit;
  children: ReactNode;
}) {
  // The translator closes over the dictionary, so rebuild it only when the
  // user actually switches language.
  const value = useMemo<I18nValue>(
    () => ({ locale, unit, t: createTranslator(locale) }),
    [locale, unit],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside an I18nProvider");
  }
  return value;
}
