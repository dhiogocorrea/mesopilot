"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { cx } from "./ui";

/**
 * A bottom sheet: modal, dismissable, and anchored to the edge the thumb is
 * already near. Mid-workout the alternative — a form expanded inline — pushes
 * the sets below it off screen and puts a wall of questions between the athlete
 * and the next exercise.
 *
 * Rendered in place rather than through a portal. Nothing in this app clips or
 * transforms its ancestors, so `position: fixed` already escapes the layout,
 * and a portal would only cost the server/client tree agreeing.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    // The page behind must not scroll under the sheet — on a touchscreen that
    // reads as the sheet itself having lost its place.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    // Move focus in so a keyboard user lands inside the dialog rather than
    // continuing through the page underneath it.
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="absolute inset-0 bg-canvas/80 backdrop-blur-sm [animation:scrim-in_150ms_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          "safe-bottom relative flex max-h-[88dvh] w-full max-w-lg flex-col",
          "rounded-t-3xl border-t border-hairline-strong bg-surface",
          "[animation:sheet-rise_180ms_cubic-bezier(0.32,0.72,0,1)]",
        )}
      >
        {/* A grab handle, not a control: it says which edge this came from. */}
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-9 rounded-full bg-surface-3" aria-hidden="true" />
        </div>

        <div className="flex items-start gap-3 px-5 pb-3 pt-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-headline leading-snug">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-3 active:bg-surface-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
      </div>
    </div>
  );
}
