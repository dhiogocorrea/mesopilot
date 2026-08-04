"use client";

import { useMemo, useState, useTransition } from "react";

import { formatRepRange } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import type { DictionaryKey } from "@/lib/i18n";
import { rankPrograms, type ProgramMatch, type TrainingPreferences } from "@/lib/program-match";
import {
  EXPERIENCE_LEVELS,
  GOALS,
  type Experience,
  type Goal,
  type ProgramOrigin,
} from "@/lib/types";
import { createBlock, startTrackStep } from "@/server/actions";
import {
  Button,
  ButtonLink,
  Chip,
  Input,
  Label,
  Screen,
  Segmented,
  cx,
} from "./ui";

/**
 * One picker, one pattern: everything on this screen is a track, and a track is
 * one or more blocks run in order. A stock program is simply a track of one, so
 * there is no second list and no second mental model — the difference between
 * "a program" and "a sequence of programs" was never a distinction the athlete
 * had to make before choosing.
 */

export type BlockOption = {
  templateId: string;
  name: string;
  daysPerWeek: number;
  weeks: number;
  estimatedMinutes: number;
  /** What the session grows to before the deload. See `projectMinuteRange`. */
  peakMinutes: number;
  /** Stock blocks are duplicated into the builder; the athlete's are edited. */
  editable: boolean;
  days: {
    label: string;
    exercises: { name: string; sets: number; repMin: number; repMax: number }[];
  }[];
};

export type TrackOption = {
  id: string;
  /** "track" starts a stored sequence; "block" starts a single program. */
  kind: "track" | "block";
  name: string;
  description: string;
  origin: ProgramOrigin;
  level: Experience;
  goal: Goal;
  /**
   * The block you would start now. Ranking a twenty-week track by its hardest
   * block hid every one of them behind the profile filter, for a reason the
   * athlete cannot act on today — capacity is meant to grow across a track.
   * The full range is on the row, so nothing is hidden by judging block one.
   */
  daysPerWeek: number;
  estimatedMinutes: number;
  /**
   * Where the time budget is actually tested. A block is not a 40-minute block
   * because week one is 40 minutes — the engine grows it every week.
   */
  peakMinutes: number;
  /** Spread across every block, for the summary line. */
  minDaysPerWeek: number;
  maxDaysPerWeek: number;
  minEstimatedMinutes: number;
  maxEstimatedMinutes: number;
  totalWeeks: number;
  blocks: BlockOption[];
};

/** Strips accents so "forca" finds "Força". */
function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** "3–4" when the blocks differ, plain "4" when they don't. */
function range(min: number, max: number): string {
  return min === max ? String(max) : `${min}–${max}`;
}

/**
 * Close enough to begin today, using the same slack the scorer already gives
 * partial credit for. A multi-block track that clears this stays on screen
 * even under the profile filter: hiding every one of them is how the athlete
 * never finds out tracks exist, and the row still states the mismatch plainly.
 */
function startableNow(track: TrackOption, preferences: TrainingPreferences): boolean {
  return (
    track.blocks.length > 1 &&
    Math.abs(track.daysPerWeek - preferences.daysPerWeek) <= 1 &&
    track.peakMinutes - preferences.sessionMinutes <= 15
  );
}

type DurationBand = "short" | "medium" | "long";

const DURATION_BANDS: {
  value: DurationBand;
  label: DictionaryKey;
  test: (min: number) => boolean;
}[] = [
  { value: "short", label: "meso.under45", test: (min) => min < 45 },
  { value: "medium", label: "meso.45to60", test: (min) => min >= 45 && min <= 60 },
  { value: "long", label: "meso.over60", test: (min) => min > 60 },
];

export function TrackPicker({
  tracks,
  preferences,
}: {
  tracks: TrackOption[];
  preferences: TrainingPreferences;
}) {
  const { t } = useI18n();

  const [query, setQuery] = useState("");
  const [onlyFits, setOnlyFits] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const [level, setLevel] = useState<Experience | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [duration, setDuration] = useState<DurationBand | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ranked = useMemo(() => {
    const scored = rankPrograms(
      tracks.map((track) => ({
        ...track,
        facts: {
          daysPerWeek: track.daysPerWeek,
          estimatedMinutes: track.estimatedMinutes,
          peakMinutes: track.peakMinutes,
          level: track.level,
          goal: track.goal,
        },
      })),
      preferences,
    );

    // Longest tracks first, profile fit deciding within each length. A
    // four-block sequence is the bigger commitment and the harder thing to
    // discover; ranking it purely on fit buried every one of them under
    // thirty single blocks. `rankPrograms` already returns fit order, and
    // sort is stable, so the tiebreak needs no second comparison.
    return scored.sort((a, b) => b.blocks.length - a.blocks.length);
  }, [tracks, preferences]);

  const activeFilterCount = [days, level, goal, duration].filter((value) => value !== null).length;

  const results = useMemo(() => {
    const needle = normalize(query);

    const matchesFilters = ranked.filter((track) => {
      const haystack = `${track.name} ${track.description} ${track.blocks
        .map((block) => block.name)
        .join(" ")}`;
      if (needle && !normalize(haystack).includes(needle)) return false;
      // A range matches if any block in it runs that many days.
      if (days !== null && !track.blocks.some((block) => block.daysPerWeek === days)) return false;
      if (level !== null && track.level !== level) return false;
      if (goal !== null && track.goal !== goal) return false;
      if (duration !== null) {
        const band = DURATION_BANDS.find((entry) => entry.value === duration);
        // Banded on the peak: a block that opens at 40 minutes and finishes at
        // 70 does not belong under "under 45".
        if (band && !track.blocks.some((block) => band.test(block.peakMinutes))) return false;
      }
      return true;
    });

    // The profile filter is a default, not a cage: when it would leave the
    // screen empty, fall back to the ranked list and say so.
    if (!onlyFits) return { list: matchesFilters, relaxed: false };

    const fitting = matchesFilters.filter(
      (track) => track.match.fits || startableNow(track, preferences),
    );
    return fitting.length > 0
      ? { list: fitting, relaxed: false }
      : { list: matchesFilters, relaxed: matchesFilters.length > 0 };
  }, [ranked, query, onlyFits, days, level, goal, duration, preferences]);

  function clearFilters() {
    setQuery("");
    setDays(null);
    setLevel(null);
    setGoal(null);
    setDuration(null);
    setOnlyFits(false);
  }

  return (
    <Screen className="pb-8">
      <ButtonLink href="/plan/custom" variant="secondary" full>
        + {t("meso.buildCustom")}
      </ButtonLink>

      <div className="mt-6 space-y-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("meso.searchPlaceholder")}
          aria-label={t("common.search")}
        />

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setOnlyFits((current) => !current)}
            aria-pressed={onlyFits}
            className={cx(
              "h-11 flex-1 rounded-xl border text-[13px] font-medium transition-colors",
              onlyFits
                ? "border-accent bg-accent-soft text-accent"
                : "border-hairline-strong text-ink-2 active:bg-surface",
            )}
          >
            {t("meso.fitsMyProfile")}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className={cx(
              "h-11 rounded-xl border px-4 text-[13px] font-medium transition-colors",
              activeFilterCount > 0
                ? "border-accent bg-accent-soft text-accent"
                : "border-hairline-strong text-ink-2 active:bg-surface",
            )}
          >
            {t("meso.filters")}
            {activeFilterCount > 0 && ` · ${activeFilterCount}`}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mt-5 space-y-5 rounded-2xl border border-hairline bg-surface p-4">
          <FilterGroup
            label={t("meso.daysPerWeek")}
            value={days}
            onChange={setDays}
            options={[2, 3, 4, 5, 6].map((value) => ({ value, label: String(value) }))}
            anyLabel={t("meso.any")}
            columns={6}
          />
          <FilterGroup
            label={t("meso.duration")}
            value={duration}
            onChange={setDuration}
            options={DURATION_BANDS.map((band) => ({ value: band.value, label: t(band.label) }))}
            anyLabel={t("meso.any")}
            columns={2}
          />
          <FilterGroup
            label={t("meso.level")}
            value={level}
            onChange={setLevel}
            options={EXPERIENCE_LEVELS.map((value) => ({
              value,
              label: t(`onboarding.${value}`),
            }))}
            anyLabel={t("meso.any")}
            columns={2}
          />
          <FilterGroup
            label={t("meso.goal")}
            value={goal}
            onChange={setGoal}
            options={GOALS.map((value) => ({ value, label: t(`onboarding.${value}`) }))}
            anyLabel={t("meso.any")}
            columns={2}
          />
        </div>
      )}

      <div className="mt-6 flex items-baseline justify-between gap-3">
        <p className="text-label uppercase text-ink-3">
          {t("track.showing", { shown: results.list.length, total: tracks.length })}
        </p>
        {(activeFilterCount > 0 || query || onlyFits) && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[13px] text-ink-3 underline decoration-hairline-strong underline-offset-4"
          >
            {t("meso.clearFilters")}
          </button>
        )}
      </div>

      {results.relaxed && (
        <p className="mt-3 border-l-2 border-info/50 py-0.5 pl-3 text-[13px] leading-relaxed text-info">
          {t("meso.nothingFitsProfile")}
        </p>
      )}

      {results.list.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">{t("track.noMatches")}</p>
      ) : (
        <ul className="bleed mt-3 border-t border-hairline">
          {results.list.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              match={track.match}
              preferences={preferences}
              expanded={track.id === expandedId}
              onToggle={() => setExpandedId(track.id === expandedId ? null : track.id)}
            />
          ))}
        </ul>
      )}
    </Screen>
  );
}

function TrackRow({
  track,
  match,
  preferences,
  expanded,
  onToggle,
}: {
  track: TrackOption;
  match: ProgramMatch;
  preferences: TrainingPreferences;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const multi = track.blocks.length > 1;

  return (
    <li className="border-b border-hairline">
      <button type="button" onClick={onToggle} className="w-full py-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{track.name}</h3>
          {/* Fit is the single most useful signal, so it sits where the eye lands. */}
          {match.fits && <Chip tone="accent">✓ {t("meso.matchesProfile")}</Chip>}
        </div>

        {/* Facts as one quiet monospaced line rather than a row of pills. The
            block count leads on every row, including tracks of one, so the
            list reads as tracks throughout rather than as a program list with
            a few sequences mixed in. */}
        <p className="mt-1.5 text-[13px] tabular-nums text-ink-3">
          {multi ? t("track.blocks", { count: track.blocks.length }) : t("track.oneBlock")}
          <span className="mx-1.5 text-ink-3/50">·</span>
          {range(track.minDaysPerWeek, track.maxDaysPerWeek)} {t("meso.days")}
          <span className="mx-1.5 text-ink-3/50">·</span>~
          {range(track.minEstimatedMinutes, track.maxEstimatedMinutes)} min
          <span className="mx-1.5 text-ink-3/50">·</span>
          {track.totalWeeks} {t("meso.weeks").toLowerCase()}
          <span className="mx-1.5 text-ink-3/50">·</span>
          {t(`onboarding.${track.level}`)}
        </p>

        {track.description && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
            {track.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
          {track.origin === "custom" && <Chip tone="info">{t("track.mine")}</Chip>}
          {match.dayDelta !== 0 && (
            <span>
              {t("meso.otherDays", {
                days: track.daysPerWeek,
                planned: preferences.daysPerWeek,
              })}
            </span>
          )}
          {match.minuteDelta > 5 && (
            <span>
              {t("meso.overTime", {
                over: match.minuteDelta,
                budget: preferences.sessionMinutes,
              })}
            </span>
          )}
        </div>
      </button>

      {expanded && <TrackDetail track={track} />}
    </li>
  );
}

function TrackDetail({ track }: { track: TrackOption }) {
  const [openBlock, setOpenBlock] = useState<number | null>(null);

  // How it starts follows from what it *is*, not from how many blocks it has:
  // a stored track of one still has to be started as a track, or the block
  // would lose its place in the sequence.
  const start = track.kind === "track" ? <StartTrack track={track} /> : <StartBlock track={track} />;

  // Only one block to look at means no header to choose between, and it would
  // only repeat the row above — its contents are the point of expanding.
  if (track.blocks.length === 1) {
    return (
      <div className="space-y-5 pb-5">
        <BlockDetail block={track.blocks[0]!} />
        {start}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-5">
      <ol className="rule-y">
        {track.blocks.map((block, index) => (
          <li key={block.templateId}>
            <button
              type="button"
              onClick={() => setOpenBlock(openBlock === index ? null : index)}
              className="flex w-full items-baseline gap-3 py-3 text-left"
            >
              <span
                className={cx(
                  "w-5 shrink-0 tabular-nums text-[13px]",
                  index === 0 ? "text-accent" : "text-ink-3",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{block.name}</span>
                <BlockFacts block={block} />
              </span>
              <span className="shrink-0 text-[12px] text-ink-3">
                {openBlock === index ? "−" : "+"}
              </span>
            </button>

            {openBlock === index && (
              <div className="pb-4 pl-8">
                <BlockDetail block={block} />
              </div>
            )}
          </li>
        ))}
      </ol>

      {start}
    </div>
  );
}

function BlockFacts({ block }: { block: BlockOption }) {
  const { t } = useI18n();

  return (
    <span className="mt-0.5 block text-[12px] tabular-nums text-ink-3">
      {block.daysPerWeek} {t("meso.days")}
      {/* Opening length through to the longest week. One figure here read as a
          promise the block does not keep — the engine grows it every week. */}
      <span className="mx-1.5 text-ink-3/50">·</span>~
      {range(block.estimatedMinutes, block.peakMinutes)} min
      <span className="mx-1.5 text-ink-3/50">·</span>
      {block.weeks} {t("meso.weeks").toLowerCase()}
    </span>
  );
}

function BlockDetail({ block }: { block: BlockOption }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Keyed by position, not by name: a day can prescribe the same movement
          twice (an imported block opens with two preacher curl entries), and
          two days can share a label. Both are legitimate, and neither name is
          unique enough to identify a row. */}
      {block.days.map((day, dayIndex) => (
        <div key={`${dayIndex}-${day.label}`}>
          <p className="text-label mb-1.5 uppercase text-ink-3">{day.label}</p>
          <ul className="space-y-1">
            {day.exercises.map((exercise, exerciseIndex) => (
              <li
                key={`${exerciseIndex}-${exercise.name}`}
                className="flex items-baseline justify-between gap-3 text-[13px]"
              >
                <span className="min-w-0 flex-1 truncate text-ink-2">{exercise.name}</span>
                <span className="shrink-0 tabular-nums text-ink-3">
                  {exercise.sets} × {formatRepRange(exercise.repMin, exercise.repMax)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <ButtonLink
        href={
          block.editable
            ? `/plan/custom?edit=${block.templateId}`
            : `/plan/custom?from=${block.templateId}`
        }
        variant="secondary"
        size="sm"
        full
      >
        {block.editable ? t("meso.editProgram") : t("meso.duplicate")}
      </ButtonLink>
    </div>
  );
}

/** A sequence runs from the top; its blocks are named and dated by the track. */
function StartTrack({ track }: { track: TrackOption }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        await startTrackStep({ trackId: track.id, position: 0 });
      } catch {
        setError(t("common.error"));
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button size="lg" full onClick={start} disabled={pending}>
        {pending ? t("common.loading") : t("track.start")}
      </Button>
    </div>
  );
}

/** A track of one is a one-off block, so it keeps its own name and length. */
function StartBlock({ track }: { track: TrackOption }) {
  const { t } = useI18n();
  const block = track.blocks[0]!;

  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(block.weeks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createBlock({
          templateId: block.templateId,
          name: name.trim() || block.name,
          weeks,
        });
      } catch {
        setError(t("common.error"));
      }
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-hairline bg-surface p-4">
      <div>
        <Label htmlFor={`name-${block.templateId}`}>{t("meso.name")}</Label>
        <Input
          id={`name-${block.templateId}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={block.name}
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
        <p className="mt-2 text-xs text-ink-3">{t("meso.weeksHint")}</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button size="lg" full onClick={submit} disabled={pending}>
        {pending ? t("common.loading") : t("meso.create")}
      </Button>
    </div>
  );
}

/** A Segmented that also offers "Any" to clear the dimension. */
function FilterGroup<T extends string | number>({
  label,
  value,
  onChange,
  options,
  anyLabel,
  columns,
}: {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: { value: T; label: string }[];
  anyLabel: string;
  columns: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cx(
            "h-10 rounded-xl border px-2 text-[13px] font-medium transition-colors",
            value === null
              ? "border-accent bg-accent-soft text-accent"
              : "border-hairline-strong text-ink-2 active:bg-surface-2",
          )}
        >
          {anyLabel}
        </button>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value === value ? null : option.value)}
            aria-pressed={option.value === value}
            className={cx(
              "h-10 rounded-xl border px-2 text-[13px] font-medium tabular-nums transition-colors",
              option.value === value
                ? "border-accent bg-accent-soft text-accent"
                : "border-hairline-strong text-ink-2 active:bg-surface-2",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
