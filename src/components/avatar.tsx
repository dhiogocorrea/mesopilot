import type { ReactNode } from "react";

import { initialsFor } from "@/lib/initials";
import { cx } from "./ui";

/**
 * A person, wherever one appears.
 *
 * Initials rather than a colour-coded disc: identity colour would be decorative
 * colour, and on this canvas a row of tinted circles competes with the one
 * accent that is supposed to mean "live". The name is always right beside it —
 * the avatar's job is to give a row a face and a consistent left edge, not to
 * be the thing you read.
 *
 * Drawn, not fetched. Nothing here reaches a third-party host, so no viewer's
 * IP goes anywhere by rendering a friend's row.
 */

const SIZES = {
  sm: "size-8 text-[12px]",
  md: "size-10 text-[14px]",
  lg: "size-14 text-[19px]",
} as const;

export function Avatar({
  name,
  username,
  size = "md",
  className,
}: {
  name: string;
  username?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full",
        "border border-hairline-strong bg-surface-2 font-semibold text-ink-2",
        SIZES[size],
        className,
      )}
    >
      {initialsFor(name, username)}
    </span>
  );
}

/**
 * Name over handle — the pairing used everywhere a person is listed. The name
 * is what people recognise; the username is how you are found, so it is present
 * but quiet.
 */
export function PersonName({
  name,
  username,
  className,
  tone = "default",
  badge,
  children,
}: {
  name: string;
  username: string;
  className?: string;
  tone?: "default" | "accent";
  /** Sits beside the name — "You" in a list that includes the reader. */
  badge?: ReactNode;
  /** An extra quiet line under the handle, for stats that belong to the row. */
  children?: ReactNode;
}) {
  return (
    <span className={cx("block min-w-0", className)}>
      <span className="flex items-center gap-2">
        <span
          className={cx(
            "min-w-0 truncate text-[15px] font-medium",
            tone === "accent" && "text-accent",
          )}
        >
          {name}
        </span>
        {badge}
      </span>
      <span className="mt-0.5 block truncate text-[13px] text-ink-3">@{username}</span>
      {children}
    </span>
  );
}
