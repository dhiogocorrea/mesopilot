"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  isIOSDevice,
  isPushSupported,
  isStandalone,
  noSubscription,
  readFlag,
  subscribeDisplayMode,
  urlBase64ToUint8Array,
  writeFlag,
} from "@/lib/device";
import { useI18n } from "@/lib/i18n/provider";
import { deletePushDevice, savePushDevice, sendTestPush } from "@/server/push-actions";
import { readVisits, useInstallPrompt } from "./install-prompt";
import { Sheet } from "./sheet";
import { Button, Chevron, List, Row, RowButton, Section } from "./ui";

/**
 * Turning on push notifications.
 *
 * Structurally a sibling of `install-prompt.tsx`, and gated against it: on iOS
 * push is delivered **only to an app installed on the home screen**, so asking
 * an un-installed iPhone to enable notifications offers something that cannot
 * work and spends the one refusal we get. There, this renders nothing and lets
 * the install prompt make the correct ask instead.
 *
 * The sheet is not the permission prompt. The browser's own dialog only appears
 * from a user gesture, so everything happens inside the button's handler — the
 * sheet exists to explain what is about to be asked, which is the difference
 * between a considered yes and a reflexive block.
 */

const DISMISSED_KEY = "m505_push_dismissed";

/**
 * Later than the install prompt's threshold. Notifications are a bigger ask
 * than a home-screen slot, and this one follows it rather than competing.
 */
const MIN_VISITS = 4;

type Permission = NotificationPermission | "unsupported";

/**
 * `Notification.permission` is a browser fact with no change event, but it does
 * change — once, when we ask. So it is read through `useSyncExternalStore` like
 * every other device fact, with a store we nudge ourselves after requesting.
 * Assigning it from an effect instead is the cascading-render pattern the React
 * compiler rejects.
 */
let permissionListeners: (() => void)[] = [];

function subscribePermission(onChange: () => void): () => void {
  permissionListeners = [...permissionListeners, onChange];
  return () => {
    permissionListeners = permissionListeners.filter((listener) => listener !== onChange);
  };
}

function readPermission(): Permission {
  return isPushSupported() ? Notification.permission : "unsupported";
}

function permissionChanged(): void {
  for (const listener of permissionListeners) listener();
}

export type PushState = {
  /** There is something worth offering on this device. */
  isOffered: boolean;
  permission: Permission;
  /** A subscription exists and is saved. */
  isOn: boolean;
  busy: boolean;
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
  dismiss: () => void;
};

export function usePushPrompt(): PushState {
  const supported = useSyncExternalStore(noSubscription, isPushSupported, () => false);
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const isIOS = useSyncExternalStore(noSubscription, isIOSDevice, () => false);

  const permission = useSyncExternalStore(
    subscribePermission,
    readPermission,
    () => "unsupported" as const,
  );
  const [isOn, setIsOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    // `getRegistration`, never `register`: reading whether notifications are
    // already on must not install a worker on a device whose owner never
    // agreed to one.
    let cancelled = false;
    void navigator.serviceWorker
      .getRegistration("/")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setIsOn(Boolean(subscription));
      })
      .catch(() => {
        // No worker registered yet, which simply means "off".
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        // The worker decides how every future notification behaves; never let a
        // browser serve it from its HTTP cache.
        updateViaCache: "none",
      });
      await navigator.serviceWorker.ready;

      const granted = await Notification.requestPermission();
      permissionChanged();
      if (granted !== "granted") return false;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from the build");

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          // Non-negotiable in every browser: a push must produce a visible
          // notification, and we would not want a silent one anyway.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      // A live PushSubscription is not a plain object and cannot cross the
      // server-action boundary; this is the documented way to flatten it.
      const plain = JSON.parse(JSON.stringify(subscription)) as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await savePushDevice(plain);
      setIsOn(true);
      return true;
    } catch (error) {
      console.error("[push] enabling failed", error);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        const { endpoint } = subscription;
        // Unsubscribe first: if the server call fails we would rather hold a
        // row that no longer resolves — which the 410 path cleans up on the
        // next send — than keep a live subscription with nothing to stop it.
        await subscription.unsubscribe();
        await deletePushDevice(endpoint);
      }

      setIsOn(false);
    } catch (error) {
      console.error("[push] disabling failed", error);
    } finally {
      setBusy(false);
    }
  }, []);

  const dismiss = useCallback(() => writeFlag(DISMISSED_KEY), []);

  return {
    // iOS without an install cannot receive push at all, so there is nothing
    // honest to offer there.
    isOffered: supported && !(isIOS && !standalone),
    permission,
    isOn,
    busy,
    enable,
    disable,
    dismiss,
  };
}

/**
 * Self-opening, once, and never at the same time as the install prompt — both
 * mount in the tabs layout, and two sheets rising over each other reads as a
 * bug. On iOS the install is also the prerequisite, so the order is causal
 * rather than merely tidy.
 */
export function PushPrompt() {
  const state = usePushPrompt();
  const install = useInstallPrompt();

  const [refused] = useState(() =>
    typeof window === "undefined" ? true : readFlag(DISMISSED_KEY),
  );
  // Read, never written — `InstallPrompt` owns this counter.
  const [visits] = useState(() => (typeof window === "undefined" ? 0 : readVisits()));
  const [closed, setClosed] = useState(false);

  const close = useCallback(() => {
    state.dismiss();
    setClosed(true);
  }, [state]);

  const open =
    state.isOffered &&
    // "denied" means the browser will show nothing whatever we do; "granted"
    // means it is already on. Only an unanswered question is worth a sheet.
    state.permission === "default" &&
    !install.isOffered &&
    !refused &&
    !closed &&
    visits >= MIN_VISITS;

  return <PushSheet open={open} onClose={close} state={state} />;
}

/** The permanent control, for anyone who dismissed the sheet or never saw it. */
export function PushSection() {
  const state = usePushPrompt();
  const [open, setOpen] = useState(false);
  const [tested, setTested] = useState(false);
  const { t } = useI18n();

  if (!state.isOffered) return null;

  const blocked = state.permission === "denied";

  return (
    <Section label={t("settings.notifications")}>
      <List>
        <Row>
          <RowButton
            onClick={() => (state.isOn ? void state.disable() : setOpen(true))}
            disabled={state.busy || blocked}
          >
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[15px] font-medium">{t("push.title")}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">
                {blocked ? t("push.blocked") : state.isOn ? t("push.on") : t("push.rowBody")}
              </span>
            </span>
            {!blocked && <Chevron />}
          </RowButton>
        </Row>
      </List>

      {/* Without a second account there is no other way to see that this
          works end to end, which makes the control self-evidently functional
          rather than a switch you have to take on faith. */}
      {state.isOn && (
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={state.busy}
            onClick={async () => {
              await sendTestPush();
              setTested(true);
            }}
          >
            {t("push.test")}
          </Button>
          {tested && <p className="mt-2 text-[13px] text-ink-3">{t("push.testSent")}</p>}
        </div>
      )}

      <PushSheet open={open} onClose={() => setOpen(false)} state={state} />
    </Section>
  );
}

function PushSheet({
  open,
  onClose,
  state,
}: {
  open: boolean;
  onClose: () => void;
  state: PushState;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);

  return (
    <Sheet open={open} onClose={onClose} title={t("push.title")} subtitle={t("push.body")}>
      <div className="pb-2 pt-1">
        <Button
          size="lg"
          full
          disabled={state.busy}
          onClick={async () => {
            // The browser's permission dialog needs the gesture, so the whole
            // sequence runs here rather than on mount or in an effect.
            const ok = await state.enable();
            if (ok) onClose();
            else setFailed(true);
          }}
        >
          {t("push.enable")}
        </Button>
        {failed && (
          <p className="mt-3 text-[13px] leading-relaxed text-danger">
            {state.permission === "denied" ? t("push.blocked") : t("push.failed")}
          </p>
        )}
      </div>
    </Sheet>
  );
}
