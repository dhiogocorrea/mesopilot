/**
 * The MesoPilot mark.
 *
 * A mesocycle in profile: four weeks of climbing volume, then the deload. It is
 * the same shape `WeekTrack` draws on Today, which is deliberate — the logo is
 * a picture of what the app does rather than a monogram that could belong to
 * anything. The peak week carries the accent, because the ramp is the point.
 *
 * Drawn as geometry, not set in a typeface: the app ships no webfont, so a mark
 * made of live text would render differently on every platform — and a logo
 * that changes shape by device is not a logo.
 */

const WEEKS = [
  { x: 2, y: 28, height: 14 },
  { x: 11.5, y: 22, height: 20 },
  { x: 21, y: 16, height: 26 },
  { x: 30.5, y: 10, height: 32, peak: true },
  // The deload. Short on purpose — the drop is the most recognisable part of
  // the silhouette, and the only reason it reads as a *cycle*.
  { x: 40, y: 33, height: 9, deload: true },
];

export function LogoMark({
  className,
  title,
}: {
  className?: string;
  /** Omit inside a lockup that already names the brand in text. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {WEEKS.map((week) => (
        <rect
          key={week.x}
          x={week.x}
          y={week.y}
          width={6}
          height={week.height}
          rx={2}
          className={week.peak ? "fill-accent" : week.deload ? "fill-ink-3" : "fill-current"}
        />
      ))}
    </svg>
  );
}

/** Mark plus wordmark, for the login screen and anywhere the brand is stated. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <LogoMark className="h-9 w-9 shrink-0 text-ink" title="MesoPilot" />
      <span className="display-face text-[2rem] font-bold leading-none tracking-tight">
        Meso<span className="text-accent">Pilot</span>
      </span>
    </span>
  );
}
