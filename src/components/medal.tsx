import type { Tier } from "@/lib/achievements/catalogue";
import { cx } from "./ui";

/**
 * A medal, drawn rather than imaged: five sizes of PNG per tier is a lot of
 * bytes for a shape that is a disc and a ribbon, and this one recolours with
 * the theme tokens instead of being baked at export time.
 *
 * Tier is the only thing that varies. Bronze through gold use warm metals;
 * platinum borrows the accent, because it is the one that should feel like the
 * app is congratulating you rather than filing you.
 */

const TIER_CLASS: Record<Tier, { ring: string; face: string; ink: string }> = {
  bronze: { ring: "border-[#7a4a2b]", face: "bg-[#7a4a2b]/25", ink: "text-[#c98553]" },
  silver: { ring: "border-[#8a8f98]", face: "bg-[#8a8f98]/25", ink: "text-[#b9bfc9]" },
  gold: { ring: "border-[#a8842c]", face: "bg-[#a8842c]/25", ink: "text-[#e0b544]" },
  platinum: { ring: "border-accent", face: "bg-accent-soft", ink: "text-accent" },
};

export function Medal({
  tier,
  locked = false,
  size = "md",
  className,
}: {
  tier: Tier;
  locked?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = TIER_CLASS[tier];
  const box = size === "sm" ? "size-9" : "size-12";

  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2",
        box,
        locked ? "border-hairline-strong bg-surface-2" : `${style.ring} ${style.face}`,
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={cx(size === "sm" ? "size-4" : "size-5", locked ? "text-ink-3" : style.ink)}
        fill="none"
      >
        {locked ? (
          // A padlock body with a shackle — reads as "not yet" without needing
          // a second colour.
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor" />
            <path
              d="M8 10V7a4 4 0 0 1 8 0v3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path
            d="M12 2.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 8.9l6.1-.8L12 2.5Z"
            fill="currentColor"
          />
        )}
      </svg>
    </span>
  );
}
