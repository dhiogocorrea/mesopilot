import { cx } from "@/lib/cx";

/**
 * What the coach section is actually claiming, drawn rather than described.
 *
 * The point of the AI layer here is an ordering — the engine decides, the model
 * comments — and that is hard to say in a paragraph and obvious in a picture.
 * So the card shows both voices stacked against one prescription, with the
 * clamp stated on the row where it applies.
 */
export function CoachNote({
  exercise,
  delta,
  engineLabel,
  engine,
  coachLabel,
  note,
  clamp,
  className,
}: {
  exercise: string;
  delta: string;
  engineLabel: string;
  engine: string;
  coachLabel: string;
  note: string;
  clamp: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-hairline-strong bg-surface p-5 shadow-2xl shadow-black/50",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-4">
        <p className="min-w-0 truncate text-[15px] font-semibold">{exercise}</p>
        <p className="shrink-0 text-[15px] font-bold tabular-nums text-accent">{delta}</p>
      </div>

      {/* Engine first, and marked as the one that decided. */}
      <div className="flex gap-3 pt-4">
        {/* Wide enough for the longest label in either language: "TREINADOR"
            overran a 14 and ran straight into the sentence beside it. */}
        <span className="text-label mt-0.5 w-20 shrink-0 uppercase text-ink-3">{engineLabel}</span>
        <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink-2">{engine}</p>
      </div>

      <div className="mt-4 flex gap-3">
        <span className="text-label mt-0.5 w-20 shrink-0 uppercase text-accent">{coachLabel}</span>
        <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink">{note}</p>
      </div>

      <p className="mt-5 border-t border-hairline pt-4 text-[12px] tabular-nums text-ink-3">
        {clamp}
      </p>
    </div>
  );
}
