import { cx } from "./ui";

/**
 * Charts, drawn by hand in SVG.
 *
 * No charting library: the app ships no webfont and no third-party bundle, and
 * every one of these is a handful of points on a phone-width strip. A library
 * would cost more kilobytes than the whole progress screen and still need
 * overriding to reach the palette.
 *
 * They follow the visual system rather than chart convention — no gridlines, no
 * axes, no legend. A hairline baseline and the figures beside the shape carry
 * everything those would have said, and the accent marks the live value only.
 */

export type Point = { value: number; label?: string };

/**
 * A trend line at a glance. Deliberately unlabelled: it sits beside the number
 * it describes, so its job is the shape, not the reading.
 */
export function Sparkline({
  points,
  className,
  tone = "accent",
}: {
  points: number[];
  className?: string;
  tone?: "accent" | "ink";
}) {
  if (points.length < 2) return null;

  const width = 100;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min;

  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    // A lift that has not moved is drawn down the middle. Scaling it against a
    // zero span puts it along the floor instead, which reads as a collapse.
    const y = span === 0 ? height / 2 : height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const last = coords[coords.length - 1]!.split(",");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cx("h-7 w-full", className)}
      aria-hidden="true"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={tone === "accent" ? "var(--color-accent)" : "var(--color-ink-3)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* The latest value is the one being read; the rest is context. */}
      <circle
        cx={last[0]}
        cy={last[1]}
        r="2"
        fill={tone === "accent" ? "var(--color-accent)" : "var(--color-ink-3)"}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Session-by-session bars. Reads left to right as time, and the last bar is
 * accented because "how does today compare" is the question being asked.
 */
export function BarChart({
  points,
  height = 120,
  emptyLabel,
}: {
  points: Point[];
  height?: number;
  emptyLabel?: string;
}) {
  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-3">{emptyLabel}</p>;
  }

  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {points.map((point, index) => {
          const live = index === points.length - 1;
          return (
            <div
              key={index}
              className="flex min-w-0 flex-1 justify-center"
              style={{ height: "100%" }}
            >
              <div className="flex h-full w-full flex-col justify-end">
                <div
                  className={cx(
                    "w-full rounded-t-sm transition-[height]",
                    live ? "bg-accent" : "bg-surface-3",
                  )}
                  // A zero-value session still gets a visible sliver, otherwise
                  // a rest-day gap and a missing bar look identical.
                  style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {points.some((point) => point.label) && (
        <div className="mt-2 flex gap-1">
          {points.map((point, index) => (
            <span
              key={index}
              className="min-w-0 flex-1 truncate text-center text-[10px] tabular-nums text-ink-3"
            >
              {/* Only the ends are labelled: eight dates across a phone is a
                  smear, and the range is what the axis was for. */}
              {index === 0 || index === points.length - 1 ? point.label : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
