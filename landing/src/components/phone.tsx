import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * The app, shown in a phone.
 *
 * These are the real screens rebuilt in markup rather than screenshots, and the
 * reason is not purity: a PNG of the logger is a picture of somebody's actual
 * training data, it goes stale the first time a screen changes, and it is a
 * bitmap on a page that is otherwise crisp at any density. Rebuilt, they use
 * the same tokens as the app, so the landing page cannot drift out of the
 * product's palette.
 */

export function PhoneFrame({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  /** The hero phone carries a halo; the ones behind it must not. */
  glow?: boolean;
}) {
  return (
    // Narrower on a phone so the lifters beside it are figures rather than
    // fragments. The screens inside are the app's own sizes either way.
    <div className={cx("relative w-[208px] shrink-0 sm:w-[248px]", className)}>
      {glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-accent/20 blur-3xl"
        />
      )}

      <div className="rounded-[2.25rem] border border-hairline-strong bg-surface-2 p-[3px] shadow-2xl shadow-black/60">
        <div className="relative overflow-hidden rounded-[2rem] bg-canvas">
          {/* The cutout, drawn small — at this size a notch is a shape, not a
              component, and a detailed one reads as clutter. */}
          <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-canvas" />
          <div className="h-[500px] overflow-hidden pt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ screens */

/** Today: the block, and the session waiting to be started. */
export function ScreenToday() {
  return (
    <div className="px-4 pt-3">
      <p className="text-label uppercase text-ink-3">Today</p>

      <div className="mt-4 rounded-2xl border border-hairline bg-surface p-4">
        <p className="text-label uppercase text-ink-3">Current block</p>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug">
          Chest &amp; Triceps / Back &amp; Biceps 4×
        </p>
        <p className="mt-1 text-[12px] text-ink-3">8 of 20 sessions done</p>

        <div className="mt-3.5 flex items-end gap-1.5">
          {[38, 56, 74, 92, 44].map((height, index) => (
            <div key={index} className="flex-1">
              <div
                className={cx(
                  "w-full rounded-t-sm",
                  index === 3 ? "bg-accent" : "bg-surface-3",
                )}
                style={{ height }}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="text-label mt-6 uppercase text-ink-3">Up next</p>
      <p className="display-face mt-2 text-[19px]">Chest &amp; Triceps</p>
      <p className="mt-1 text-[12px] tabular-nums text-ink-3">Week 3 · Day 1 · 20 sets</p>

      <ul className="mt-3 border-t border-hairline">
        {[
          ["Barbell Bench Press", "5 × 6-10"],
          ["Incline Dumbbell Press", "4 × 8-12"],
          ["Pec Deck", "3 × 10-15"],
          ["Close-Grip Bench Press", "4 × 6-10"],
        ].map(([name, sets]) => (
          <li
            key={name}
            className="flex items-center justify-between gap-3 border-b border-hairline py-2.5"
          >
            <span className="min-w-0 truncate text-[13px]">{name}</span>
            <span className="shrink-0 text-[12px] tabular-nums text-ink-3">{sets}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex h-11 items-center justify-center rounded-xl bg-accent text-[14px] font-semibold text-accent-ink">
        Continue session
      </div>
    </div>
  );
}

/** The logger, mid-set. The screen the whole app exists to serve. */
export function ScreenLogger() {
  return (
    <div>
      <div className="border-b border-hairline px-4 pb-2.5">
        <p className="text-[13px] font-semibold leading-tight">Chest &amp; Triceps</p>
        <p className="text-[10px] tabular-nums text-ink-3">Week 3/5 · 9/20 sets</p>
      </div>
      <div className="h-px w-full bg-hairline">
        <div className="h-px w-[45%] bg-accent" />
      </div>

      <div className="px-4">
        <div className="border-b border-hairline py-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 w-3 text-[12px] font-semibold text-accent">✓</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-snug">Barbell Bench Press</p>
              <p className="mt-0.5 text-[11px] text-ink-3">Chest · Rest 90s</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-bold tabular-nums leading-none">
                5<span className="mx-0.5 text-ink-3">×</span>6-10
              </p>
              <p className="mt-1 text-[10px] tabular-nums text-ink-3">@ 2 RIR</p>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            {[
              ["80", "9", "2", true],
              ["80", "8", "2", true],
              ["82.5", "7", "1", false],
            ].map(([kg, reps, rir, done], index) => (
              <div key={index} className="grid grid-cols-[0.75rem_1fr_1fr_1fr_1.9rem] gap-1">
                <span
                  className={cx(
                    "text-center text-[11px] font-medium tabular-nums",
                    done ? "text-accent" : "text-ink-3",
                  )}
                >
                  {index + 1}
                </span>
                {[kg, reps, rir].map((value, cell) => (
                  <span
                    key={cell}
                    className={cx(
                      "rounded-lg py-1.5 text-center text-[12px] font-semibold tabular-nums",
                      done ? "bg-accent-soft text-ink" : "border border-hairline-strong text-ink",
                    )}
                  >
                    {String(value)}
                  </span>
                ))}
                <span
                  className={cx(
                    "flex items-center justify-center rounded-lg border text-[11px]",
                    done
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-hairline-strong text-ink-3",
                  )}
                >
                  ✓
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* The per-muscle prompt: the thing that makes the next week different. */}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-accent-line bg-accent-soft px-3 py-2.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
            ?
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold">Chest feedback</span>
            <span className="block text-[10px] text-ink-3">Sets this muscle&apos;s volume</span>
          </span>
          <span className="text-[11px] font-medium text-accent">Answer</span>
        </div>

        <div className="border-b border-hairline py-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 w-3 text-[12px] font-semibold text-ink-3">2</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-snug">Close-Grip Bench Press</p>
              <p className="mt-0.5 text-[11px] text-ink-3">Triceps · Rest 90s</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-bold tabular-nums leading-none">
                4<span className="mx-0.5 text-ink-3">×</span>6-10
              </p>
              <p className="mt-1 text-[10px] tabular-nums text-ink-3">@ 2 RIR</p>
            </div>
          </div>
          <p className="mt-2.5 pl-5 text-[11px] tabular-nums text-ink-3">
            <span className="text-ink-2">Last time</span> 60×9@2 60×8@2 60×7@1
          </p>
        </div>
      </div>
    </div>
  );
}

/** Progress: what the logging turns into. */
export function ScreenProgress() {
  return (
    <div className="px-4 pt-3">
      <p className="display-face text-[19px]">Progress</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          ["24", "Sessions"],
          ["312", "Sets"],
          ["48.2t", "Volume"],
        ].map(([value, label], index) => (
          <div key={label}>
            <p
              className={cx(
                "text-[19px] font-bold tabular-nums leading-none",
                index === 2 && "text-accent",
              )}
            >
              {value}
            </p>
            <p className="text-label mt-1.5 uppercase text-ink-3">{label}</p>
          </div>
        ))}
      </div>

      <p className="text-label mt-6 uppercase text-ink-3">Volume · per session</p>
      <div className="mt-2.5 flex h-16 items-end gap-1">
        {[42, 61, 55, 78, 66, 88, 71, 96].map((height, index, all) => (
          <div key={index} className="flex-1">
            <div
              className={cx(
                "w-full rounded-t-sm",
                index === all.length - 1 ? "bg-accent" : "bg-surface-3",
              )}
              style={{ height: `${height}%` }}
            />
          </div>
        ))}
      </div>

      <p className="text-label mt-6 uppercase text-ink-3">Strength trend</p>
      <ul className="mt-2 border-t border-hairline">
        {[
          ["Barbell Bench Press", "+7.5", "102"],
          ["Barbell Row", "+5.0", "94"],
          ["Close-Grip Bench", "+2.5", "78"],
        ].map(([name, delta, value]) => (
          <li key={name} className="flex items-center gap-2.5 border-b border-hairline py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px]">{name}</span>
              <span className="block text-[11px] tabular-nums text-accent">{delta} kg</span>
            </span>
            <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-5 w-12">
              <polyline
                points="0,24 20,20 40,21 60,12 80,9 100,3"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums">
              {value}
              <span className="ml-0.5 text-[10px] font-normal text-ink-3">kg</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The picker: tracks, and the blocks inside them, ranked against the profile. */
export function ScreenPlan() {
  return (
    <div className="px-4 pt-3">
      <p className="text-label uppercase text-ink-3">Plan</p>
      <p className="display-face mt-2 text-[19px]">Pick a track</p>
      <p className="mt-1 text-[12px] text-ink-3">Ranked for 4 days · 60 min</p>

      {/* The recommended one is open, with its blocks in order. */}
      <div className="mt-4 rounded-2xl border border-accent-line bg-accent-soft p-3.5">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold leading-snug">Hypertrophy Base</span>
            <span className="mt-0.5 block text-[11px] text-ink-3">3 blocks · 15 weeks</span>
          </span>
          <span className="shrink-0 rounded-md border border-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            Best fit
          </span>
        </div>

        <ul className="mt-3 space-y-2">
          {[
            ["1", "Upper / Lower 4×", "5 weeks"],
            ["2", "Push / Pull / Legs 5×", "5 weeks"],
            ["3", "Intensification 4×", "5 weeks"],
          ].map(([n, name, weeks]) => (
            <li key={n} className="flex items-center gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold tabular-nums text-ink-2">
                {n}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px]">{name}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{weeks}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-3 border-t border-hairline">
        {[
          ["Foundations", "2 blocks · 10 weeks"],
          ["Full Body 3×", "One block · 5 weeks"],
          ["Upper / Lower 4×", "One block · 5 weeks"],
          ["Arm Specialisation", "One block · 5 weeks"],
        ].map(([name, meta]) => (
          <li
            key={name}
            className="flex items-center justify-between gap-3 border-b border-hairline py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{name}</span>
              <span className="block truncate text-[11px] text-ink-3">{meta}</span>
            </span>
            <span className="shrink-0 text-ink-3">›</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
