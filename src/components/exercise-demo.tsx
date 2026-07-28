"use client";

import { useState, useTransition } from "react";

import { isSafeDemoUrl, type ExerciseDemo } from "@/lib/demo";
import { useI18n } from "@/lib/i18n/provider";
import { setExerciseDemo } from "@/server/actions";
import { Input, Label, cx } from "./ui";

const PLAY_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M8 5.5v13l11-6.5-11-6.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

const SEARCH_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
    <path d="m20 20-4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/**
 * Shows a form demonstration. A stored video plays inline; the default
 * name-based search opens in a new tab, because a search results page is not
 * something we can — or should — embed.
 */
export function DemoButton({
  demo,
  exerciseName,
  compact,
}: {
  demo: ExerciseDemo;
  exerciseName: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const playable = demo.kind === "embed" || demo.kind === "media";
  const label = playable
    ? open
      ? t("exercises.hideDemo")
      : t("exercises.watchDemo")
    : t("exercises.searchDemo");

  const className = cx(
    "inline-flex items-center gap-1.5 rounded-md border border-hairline-strong font-medium text-ink-2 transition-colors active:bg-surface",
    compact ? "h-6 px-2 text-[11px]" : "h-9 px-3 text-sm",
  );

  if (!playable) {
    return (
      <a
        href={demo.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={demo.kind === "search" ? t("exercises.demoSearchNote") : undefined}
      >
        {SEARCH_ICON}
        {label}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={className}
      >
        {PLAY_ICON}
        {label}
      </button>

      {open && (
        <div className="mt-2 w-full overflow-hidden rounded-xl border border-hairline bg-black">
          {demo.kind === "embed" ? (
            <iframe
              src={demo.url}
              title={`${t("exercises.demo")} — ${exerciseName}`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="aspect-video w-full border-0"
            />
          ) : (
            /* A .gif needs <img>; .mp4/.webm need <video>. Branch on extension. */
            <DemoMedia url={demo.url} exerciseName={exerciseName} />
          )}
        </div>
      )}
    </>
  );
}

function DemoMedia({ url, exerciseName }: { url: string; exerciseName: string }) {
  const isGif = url.toLowerCase().split("?")[0]?.endsWith(".gif") ?? false;

  if (isGif) {
    // eslint-disable-next-line @next/next/no-img-element -- remote, user-supplied host
    return <img src={url} alt={exerciseName} className="w-full" loading="lazy" />;
  }

  return (
    <video
      src={url}
      className="w-full"
      controls
      loop
      muted
      playsInline
      preload="metadata"
      aria-label={exerciseName}
    />
  );
}

/** Lets the athlete replace the search fallback with a specific clip. */
export function DemoLinkEditor({
  exerciseId,
  currentUrl,
}: {
  exerciseId: string;
  currentUrl: string | null;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(currentUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    const trimmed = next.trim();
    if (trimmed && !isSafeDemoUrl(trimmed)) {
      setError(t("exercises.demoInvalid"));
      return;
    }
    setError(null);
    startTransition(() => setExerciseDemo({ exerciseId, demoUrl: trimmed }));
  }

  const dirty = value.trim() !== (currentUrl ?? "");

  return (
    <div className="mt-2 space-y-2">
      <Label htmlFor={`demo-${exerciseId}`}>{t("exercises.demoUrl")}</Label>
      <div className="flex gap-2">
        <Input
          id={`demo-${exerciseId}`}
          type="url"
          inputMode="url"
          value={value}
          disabled={pending}
          onChange={(event) => setValue(event.target.value)}
          // Blur alone is not enough: on a phone the keyboard's "go" often
          // submits without one, so Enter and an explicit button both work.
          onBlur={() => dirty && save(value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save(value);
            }
          }}
          placeholder={t("exercises.demoUrlPlaceholder")}
        />
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => save(value)}
          className="h-12 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-30"
        >
          {t("common.save")}
        </button>
      </div>

      {currentUrl && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setValue("");
            save("");
          }}
          className="text-xs text-ink-3 underline decoration-hairline-strong underline-offset-4 active:text-danger"
        >
          {t("exercises.demoClear")}
        </button>
      )}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        <p className="text-xs leading-relaxed text-ink-3">{t("exercises.demoUrlHint")}</p>
      )}
    </div>
  );
}
