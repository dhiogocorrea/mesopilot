"use client";

import { useEffect } from "react";

import { setTimezone } from "@/server/push-actions";

/**
 * Tells the server where the athlete is, once.
 *
 * Scheduled reminders are only worth sending during someone's waking hours, and
 * a server has no way to know when those are. Reading it from the browser costs
 * nothing and asks nobody to pick their region from a list — the one thing
 * guaranteed to be got wrong or skipped.
 *
 * Renders nothing and writes nothing unless the answer actually changed, so the
 * common case is a comparison and no request at all. `current` comes from the
 * account row, so a second device in the same zone is silent too, and travel
 * corrects itself on the next screen.
 */
export function TimezoneSync({ current }: { current: string | null }) {
  useEffect(() => {
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }

    if (!zone || zone === current) return;

    // Best-effort by design: failing to record a timezone must never surface to
    // someone who was only trying to open the app.
    void setTimezone(zone).catch(() => {});
  }, [current]);

  return null;
}
