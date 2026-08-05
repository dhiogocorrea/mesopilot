"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  isIOSDevice,
  isStandalone,
  noSubscription,
  readFlag,
  subscribeDisplayMode,
  writeFlag,
} from "@/lib/device";
import { useI18n } from "@/lib/i18n/provider";
import { Sheet } from "./sheet";
import { Button, Chevron, List, Row, RowButton, Section } from "./ui";

/**
 * Adding the app to the home screen.
 *
 * The two platforms are genuinely different, and pretending otherwise is what
 * makes install prompts feel broken:
 *
 * - **Chromium** fires `beforeinstallprompt` once it decides the app qualifies,
 *   and hands over an event we can replay later from a tap. That is a real,
 *   one-tap OS install dialog — but only if we call `preventDefault()` on it,
 *   which is what stops the browser showing its own bar and lets us keep the
 *   event for a moment of our choosing.
 * - **iOS** has no such API and never has. Nothing a page runs can install it,
 *   so iOS gets instructions instead — and no "Install" button that would sit
 *   there doing nothing.
 *
 * Either way this stays quiet once the app is already installed, and once the
 * athlete has said no it does not ask again — Settings keeps a permanent row so
 * refusing is never a decision they are stuck with.
 */

/** Chromium's install event. Not in lib.dom, so it is spelled out here. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "m505_install_dismissed";

/**
 * Exported because the push prompt gates on the same counter — but **this file
 * is its only writer.** `InstallPrompt` increments it in a lazy `useState`
 * initialiser; a second component doing the same would count every visit twice
 * and quietly break both gates.
 */
export const VISITS_KEY = "m505_visits";

/** How many visits have happened, without touching the count. */
export function readVisits(): number {
  try {
    return Number(window.localStorage.getItem(VISITS_KEY) ?? "0");
  } catch {
    return 0;
  }
}

/**
 * Not on the first visit. The sheet asks someone to give a home-screen slot to
 * an app they have opened once, and the answer to that is no — after which we
 * have spent the single refusal we get.
 */
const MIN_VISITS = 2;

// ------------------------------------------------------------------ hook

/**
 * The device facts come from `src/lib/device.ts`, shared with the push prompt —
 * on iOS the push gate is exactly "is iOS and not installed", so the two must
 * never disagree about either half.
 *
 * They are read through `useSyncExternalStore` rather than assigned from an
 * effect: they are facts about the device the server cannot know, and setting
 * them via `setState` on mount is the cascading-render pattern the React
 * compiler rejects. The server snapshot is `false`, so the first paint matches
 * the markup and the real answer arrives on hydration.
 */

export type InstallState = {
  /** Chromium only: a real install dialog is available right now. */
  canPrompt: boolean;
  /** iOS: no API, so the sheet explains the manual route instead. */
  isIOS: boolean;
  /** There is something worth offering on this device. */
  isOffered: boolean;
  install: () => Promise<void>;
  dismiss: () => void;
};

export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // Set only from `appinstalled`, which `display-mode` does not always follow
  // in the tab that triggered the install.
  const [justInstalled, setJustInstalled] = useState(false);

  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const isIOS = useSyncExternalStore(noSubscription, isIOSDevice, () => false);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Without this Chromium shows its own bar and the event is spent; holding
      // it is what lets the sheet offer a real dialog later.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setDeferred(null);
      setJustInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // Single-use: the event cannot be replayed, so drop it either way. If they
    // accepted, `appinstalled` handles the rest.
    setDeferred(null);
  }, [deferred]);

  const dismiss = useCallback(() => writeFlag(DISMISSED_KEY), []);

  const installed = standalone || justInstalled;

  return {
    canPrompt: deferred !== null,
    isIOS,
    isOffered: !installed && (deferred !== null || isIOS),
    install,
    dismiss,
  };
}

// ------------------------------------------------------------ components

/**
 * Self-opening, once. Mounted in the tabs layout so it can appear on whichever
 * screen the athlete is on when Chromium decides the app qualifies.
 */
export function InstallPrompt() {
  const state = useInstallPrompt();

  // Read once, lazily. `open` is then derived rather than set from an effect —
  // the effect below only writes the counter back out.
  const [visits] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      return Number(window.localStorage.getItem(VISITS_KEY) ?? "0") + 1;
    } catch {
      return 0;
    }
  });
  const [refused] = useState(() =>
    typeof window === "undefined" ? true : readFlag(DISMISSED_KEY),
  );
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(VISITS_KEY, String(visits));
    } catch {
      // See `dismiss`.
    }
  }, [visits]);

  const close = useCallback(() => {
    state.dismiss();
    setClosed(true);
  }, [state]);

  const open = state.isOffered && !refused && !closed && visits >= MIN_VISITS;

  return <InstallSheet open={open} onClose={close} state={state} />;
}

/**
 * The permanent way in, for anyone who dismissed the sheet or never saw it.
 *
 * Owns its own `Section` rather than being dropped into one on the settings
 * page: whether the app can be installed is only knowable on the client, and a
 * server-rendered wrapper around a component that returns null leaves an empty
 * labelled section with a hairline under it on every device that is already
 * installed — which is every device that got the point.
 */
export function InstallSection() {
  const state = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  if (!state.isOffered) return null;

  return (
    <Section label={t("settings.app")}>
      <List>
        <Row>
          <RowButton onClick={() => setOpen(true)}>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[15px] font-medium">{t("install.title")}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">
                {t("install.rowBody")}
              </span>
            </span>
            <Chevron />
          </RowButton>
        </Row>
      </List>
      <InstallSheet open={open} onClose={() => setOpen(false)} state={state} />
    </Section>
  );
}

function InstallSheet({
  open,
  onClose,
  state,
}: {
  open: boolean;
  onClose: () => void;
  state: InstallState;
}) {
  const { t } = useI18n();

  return (
    <Sheet open={open} onClose={onClose} title={t("install.title")} subtitle={t("install.body")}>
      {state.canPrompt ? (
        <div className="pb-2 pt-1">
          <Button
            size="lg"
            full
            onClick={async () => {
              await state.install();
              onClose();
            }}
          >
            {t("install.action")}
          </Button>
        </div>
      ) : (
        // iOS: there is no API to call, so the sheet *is* the instruction.
        // Numbered because "tap Share" on its own sends people to the wrong
        // toolbar, and the item is below the fold in Safari's share sheet.
        <ol className="space-y-3 pb-2 pt-1">
          <Step index={1} text={t("install.iosShare")} />
          <Step index={2} text={t("install.iosAdd")} />
          <Step index={3} text={t("install.iosConfirm")} />
        </ol>
      )}
    </Sheet>
  );
}

function Step({ index, text }: { index: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink-2">
        {index}
      </span>
      <span className="text-[15px] leading-relaxed text-ink-2">{text}</span>
    </li>
  );
}
