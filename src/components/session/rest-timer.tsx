"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/provider";

/**
 * Counts down from the exercise's prescribed rest. Driven off a wall-clock
 * deadline rather than a decrementing counter, because mobile browsers throttle
 * timers in a backgrounded tab — the athlete puts the phone down between sets.
 *
 * The caller keys this on `deadline`, so a new rest period remounts it and the
 * clock starts clean without a reset effect.
 */
export function RestTimer({
  deadline,
  onDismiss,
  onExtend,
}: {
  deadline: number;
  onDismiss: () => void;
  onExtend: () => void;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const announced = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  const remaining = Math.max(0, Math.round((deadline - now) / 1000));
  const done = remaining <= 0;

  useEffect(() => {
    if (!done || announced.current) return;
    announced.current = true;
    // A short buzz is the only signal that works with the phone face-down.
    navigator.vibrate?.([120, 60, 120]);
  }, [done]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${
        done ? "border-accent bg-accent-soft" : "border-hairline-strong bg-surface"
      }`}
    >
      <span
        className={`text-[1.75rem] font-bold tabular-nums leading-none tracking-tight ${
          done ? "text-accent" : "text-ink"
        }`}
      >
        {done ? "0:00" : formatDuration(remaining)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">
        {done ? t("session.restDone") : t("session.restTimer")}
      </span>
      <button
        type="button"
        onClick={onExtend}
        className="h-9 shrink-0 rounded-lg px-2 text-[13px] font-semibold text-ink-2 active:bg-surface-2"
      >
        {t("session.addTime")}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="h-9 shrink-0 rounded-lg px-2 text-[13px] font-semibold text-accent active:bg-surface-2"
      >
        {t("session.skipRest")}
      </button>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
