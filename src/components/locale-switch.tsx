"use client";

import { useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { setPreferredLocale } from "@/server/locale";
import type { Locale } from "@/lib/types";
import { cx } from "./ui";

/**
 * Language picker for the login screen, where there is no account to read a
 * preference from. Settings keeps its own control for signed-in athletes.
 *
 * The flags are drawn rather than set as emoji: Windows ships no flag glyphs at
 * all, so 🇧🇷 renders there as the letters "BR" — the one platform where this
 * has to work is the one that would show it broken.
 */

const OPTIONS: { locale: Locale; label: string; Flag: () => React.ReactElement }[] = [
  { locale: "en", label: "English", Flag: FlagUS },
  { locale: "pt", label: "Português", Flag: FlagBR },
];

export function LocaleSwitch({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div className={cx("flex items-center gap-2", className)} role="group" aria-label={t("settings.language")}>
      {OPTIONS.map(({ locale: value, label, Flag }) => {
        const active = locale === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={label}
            disabled={pending || active}
            onClick={() => startTransition(() => setPreferredLocale(value))}
            className={cx(
              "flex h-9 items-center gap-2 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-hairline-strong text-ink-3 active:bg-surface",
            )}
          >
            <Flag />
            <span>{value.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Simplified to seven stripes; thirteen at this size is a grey smear. */
function FlagUS() {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0 rounded-[2px]" aria-hidden="true">
      <rect width="20" height="14" fill="#b22234" />
      <rect y="2" width="20" height="2" fill="#fff" />
      <rect y="6" width="20" height="2" fill="#fff" />
      <rect y="10" width="20" height="2" fill="#fff" />
      <rect width="8.5" height="8" fill="#3c3b6e" />
    </svg>
  );
}

function FlagBR() {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0 rounded-[2px]" aria-hidden="true">
      <rect width="20" height="14" fill="#009b3a" />
      <path d="M10 1.6 18.4 7 10 12.4 1.6 7Z" fill="#fedf00" />
      <circle cx="10" cy="7" r="3.1" fill="#002776" />
      {/* The band, clipped to the disc so it reads as the globe not a stripe. */}
      <clipPath id="mp-br-disc">
        <circle cx="10" cy="7" r="3.1" />
      </clipPath>
      <path d="M6.6 7.7a7 7 0 0 1 6.9 0.5l0 0.9a7 7 0 0 0-6.9-0.5Z" fill="#fff" clipPath="url(#mp-br-disc)" />
    </svg>
  );
}
