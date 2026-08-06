/**
 * Reading the clock in somebody else's timezone.
 *
 * A scheduled notification has two questions a reactive one never had to ask:
 * *is it a reasonable hour where they are*, and *have they already had this
 * today* — and "today" has to mean their day, or an athlete far enough east
 * gets the same reminder twice while one far enough west gets it at 3am.
 *
 * Everything here goes through `Intl`, which ships with the platform and knows
 * the IANA database including the parts that change — no date library, and
 * nothing that needs updating when a country moves its clocks.
 *
 * Pure and dependency-free on purpose: the scheduler's decisions about *who* to
 * notify should be testable without a database or a fixed system clock.
 */

/** Null, empty, or a zone this runtime does not know: treat as UTC. */
export function safeZone(timezone: string | null | undefined): string {
  if (!timezone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    // A stale or mistyped zone must not take the whole scheduler down with it.
    return "UTC";
  }
}

/**
 * The calendar date where this athlete is, as `YYYY-MM-DD`.
 *
 * `en-CA` because its short date format is already ISO order — cheaper and less
 * error-prone than reassembling parts by hand.
 */
export function localDay(now: Date, timezone: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Hour of the day, 0–23, where this athlete is. */
export function localHour(now: Date, timezone: string | null | undefined): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeZone(timezone),
    hour: "2-digit",
    hour12: false,
  }).format(now);

  // en-GB renders midnight as "24" in some ICU versions.
  return Number(hour) % 24;
}

/**
 * Waking hours, and not the edges of them. Nothing here is urgent enough to
 * arrive before breakfast or to be the last thing someone reads at night, and a
 * notification that wakes an athlete is one that gets notifications turned off.
 */
const EARLIEST_HOUR = 9;
const LATEST_HOUR = 21;

export function isReasonableHour(now: Date, timezone: string | null | undefined): boolean {
  const hour = localHour(now, timezone);
  return hour >= EARLIEST_HOUR && hour < LATEST_HOUR;
}

/**
 * Which day of the week it is where they are, 1 = Monday … 7 = Sunday.
 *
 * Monday-based to match `weekIndex` in the achievements engine, which is what
 * decides when a streak week actually ends.
 */
export function localWeekday(now: Date, timezone: string | null | undefined): number {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(timezone),
    weekday: "short",
  }).format(now);

  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(day);
  return index === -1 ? 1 : index + 1;
}
