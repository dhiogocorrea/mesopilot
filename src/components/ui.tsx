import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The shared visual vocabulary.
 *
 * The guiding rule: structure comes from type, spacing and hairlines. A raised
 * `Panel` is reserved for the one thing on a screen you are meant to act on —
 * if everything is boxed, nothing reads as important.
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ layout

/** Page gutter. Every screen's direct children sit inside this. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("px-5", className)}>{children}</div>;
}

export function ScreenHeader({
  eyebrow,
  title,
  meta,
  action,
  back,
  backLabel,
  leading,
}: {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  /** Sits before the title — an avatar on a screen that is about a person. */
  leading?: ReactNode;
  /**
   * Where the back chevron goes. Required on any screen the bottom nav cannot
   * reach — without it those are dead ends, since no tab is ever marked current
   * and there is nothing on screen to leave by.
   */
  back?: string;
  backLabel?: string;
}) {
  return (
    <header className="px-5 pb-6 pt-8">
      {back && (
        <Link
          href={back}
          aria-label={backLabel}
          className="tap -ml-2 -mt-2 mb-1 flex w-fit items-center gap-1 pr-3 text-[13px] font-medium text-ink-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m14.5 5-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {backLabel}
        </Link>
      )}

      <div className="flex items-center justify-between gap-4">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-label mb-2 uppercase text-ink-3">{eyebrow}</p>}
          <h1 className="display-face text-title truncate">{title}</h1>
          {meta && <div className="mt-1.5 text-sm text-ink-2">{meta}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

/** A labelled group. The label is the only thing that marks the boundary. */
export function Section({
  label,
  action,
  children,
  className,
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mb-9", className)}>
      {(label ?? action) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {label && <h2 className="text-label uppercase text-ink-3">{label}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Hairline-separated rows. Bleeds to the screen edge so the rules run full width. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cx("bleed border-t border-hairline", className)}>{children}</ul>
  );
}

export function Row({
  children,
  className,
  ...props
}: ComponentProps<"li">) {
  return (
    <li className={cx("border-b border-hairline", className)} {...props}>
      {children}
    </li>
  );
}

/** The tappable body of a Row. */
export function RowLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx(
        "flex w-full items-center gap-3 py-3.5 transition-colors active:bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function RowButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cx(
        "flex w-full items-center gap-3 py-3.5 text-left transition-colors active:bg-surface",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A raised surface. Use sparingly — at most one per screen, for the thing the
 * screen exists to do.
 */
export function Panel({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-2xl border border-hairline bg-surface p-5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cx("shrink-0 text-ink-3", className)}
    >
      <path
        d="m9.5 5 7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------------------------------------------------------------- content

/** A figure and what it measures. Numbers are the hero; the label whispers. */
export function Stat({
  value,
  label,
  unit,
  tone,
}: {
  value: string;
  label: string;
  unit?: string;
  tone?: "accent";
}) {
  return (
    <div>
      <p
        className={cx(
          "text-[1.75rem] font-bold leading-none tracking-[-0.03em]",
          tone === "accent" ? "text-accent" : "text-ink",
        )}
      >
        {value}
        {unit && <span className="ml-1 text-base font-medium text-ink-3">{unit}</span>}
      </p>
      <p className="text-label mt-2 uppercase text-ink-3">{label}</p>
    </div>
  );
}

const CHIP_TONES = {
  neutral: "border-hairline-strong text-ink-2",
  accent: "border-accent-line bg-accent-soft text-accent",
  warn: "border-warn/30 bg-warn/10 text-warn",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
} as const;

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof CHIP_TONES;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-4",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <p className="text-headline">{title}</p>
      <p className="mx-auto mt-2 max-w-[28ch] text-sm leading-relaxed text-ink-2">{body}</p>
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

// ----------------------------------------------------------------- actions

const BUTTON_VARIANTS = {
  primary: "bg-accent text-accent-ink active:bg-accent-hot",
  secondary: "border border-hairline-strong text-ink active:bg-surface-2",
  ghost: "text-ink-2 active:bg-surface",
  danger: "border border-danger/40 text-danger active:bg-danger/10",
} as const;

const BUTTON_SIZES = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-[15px] rounded-xl",
  lg: "h-14 px-6 text-base rounded-2xl",
} as const;

type ButtonStyleProps = {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  full?: boolean;
};

function buttonClass({ variant = "primary", size = "md", full }: ButtonStyleProps): string {
  return cx(
    "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
    "disabled:opacity-30 disabled:pointer-events-none",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    full && "w-full",
  );
}

export function Button({
  variant,
  size,
  full,
  className,
  ...props
}: ComponentProps<"button"> & ButtonStyleProps) {
  return <button className={cx(buttonClass({ variant, size, full }), className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  full,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyleProps) {
  return <Link className={cx(buttonClass({ variant, size, full }), className)} {...props} />;
}

// ------------------------------------------------------------------ inputs

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cx("text-label mb-2 block uppercase text-ink-3", className)} {...props} />;
}

const FIELD_BASE =
  "w-full rounded-xl border border-hairline-strong bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(FIELD_BASE, "h-12", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cx(FIELD_BASE, "h-12 appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(FIELD_BASE, "py-3", className)} {...props} />;
}

/**
 * Horizontal choice picker. Selected state is carried by the accent outline
 * rather than a fill, so a row of them does not turn into a wall of colour.
 */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  columns,
}: {
  value: T | null;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  columns?: number;
}) {
  // Short labels (a 1–5 scale, a day count) read as a control when centred;
  // wording reads as a list when left-aligned.
  const centred = options.every((option) => option.label.length <= 3 && !option.hint);

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns ?? 2}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cx(
              "tap rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
              centred ? "text-center tabular-nums" : "text-left",
              selected
                ? "border-accent bg-accent-soft text-ink"
                : "border-hairline-strong text-ink-2 active:bg-surface",
            )}
          >
            <span className="block">{option.label}</span>
            {option.hint && (
              <span className="mt-0.5 block text-xs font-normal leading-snug text-ink-3">
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Scrollable filter pill. */
export function FilterPill({
  active,
  className,
  ...props
}: ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-hairline-strong text-ink-2 active:bg-surface",
        className,
      )}
      {...props}
    />
  );
}
