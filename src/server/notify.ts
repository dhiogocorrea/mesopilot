import "server-only";

import webpush, { WebPushError } from "web-push";

import { db } from "@/lib/db";
import { createTranslator } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { isLocale, type NotificationKind } from "@/lib/types";
import { appUrl } from "./email";

/**
 * Reaching an athlete who is not looking at the app.
 *
 * Unconfigured is a supported state, like email and the AI coach: with no VAPID
 * keys the message is logged to the server console instead of sent, so every
 * screen and every action works end to end in development with no keys anywhere.
 *
 * Three properties this file exists to hold:
 *
 *   - **It takes a `userId` and nothing from the request.** That is what makes it
 *     callable from a scheduled job later. `coachSession()` reads
 *     `getUserContext()` internally and therefore cannot run outside a request;
 *     this must not repeat that.
 *   - **It is localised from the *recipient's* row**, never the actor's request
 *     context. A Brazilian athlete hears about an English-speaking friend's
 *     request in Portuguese.
 *   - **It cannot break its caller.** The whole body is wrapped, it returns
 *     nothing to branch on, and every call site goes through `after()`. Same
 *     reasoning as `awardAchievements` and the coach: a notification arriving
 *     late is a non-event next to the action that produced it failing.
 */

/**
 * What each kind is allowed to say. This mapped type is the outbound half of the
 * privacy rule that `friends.ts` enforces on reads with its explicit
 * `select: { id, username, name }` — a payload cannot mention bodyweight,
 * injuries or recovery because there is no kind whose params admit them.
 */
export type NotifyPayloads = {
  "friend.request": { name: string };
  "friend.accepted": { name: string };
  "test.ping": Record<string, never>;
};

type Template = {
  title: DictionaryKey;
  body: DictionaryKey;
  /** Where tapping it should land. Relative — the service worker refuses the rest. */
  url: string;
};

/**
 * `satisfies` rather than a plain annotation, so adding a kind to
 * `NOTIFICATION_KINDS` without copy for it is a compile error rather than a
 * notification that silently renders its own key.
 */
const TEMPLATES = {
  "friend.request": {
    title: "notif.friendRequest.title",
    body: "notif.friendRequest.body",
    url: "/friends",
  },
  "friend.accepted": {
    title: "notif.friendAccepted.title",
    body: "notif.friendAccepted.body",
    url: "/friends",
  },
  "test.ping": {
    title: "notif.test.title",
    body: "notif.test.body",
    url: "/settings",
  },
} satisfies Record<NotificationKind, Template>;

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Never `webpush.setVapidDetails()` at module scope: it validates and throws
 * when the keys are absent, which would turn "no keys configured" from a
 * supported state into a crash on import, and it is global mutable state across
 * a module cache Next reuses between requests.
 */
function vapid(): webpush.RequestOptions["vapidDetails"] {
  return {
    subject: vapidSubject(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  };
}

/**
 * The contact the push services see, per the VAPID spec — how Google or Mozilla
 * would reach whoever runs this deployment if it started misbehaving.
 *
 * `web-push` accepts **only** `https:` or `mailto:`, which rules out the
 * `http://localhost:3000` that `appUrl()` returns in development. Falling back
 * to the app URL unconditionally made every send fail locally with a validation
 * error, while production — where `APP_URL` is https — looked perfectly fine.
 */
function vapidSubject(): string {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;

  const url = appUrl();
  if (url.startsWith("https://")) return url;

  // Development. Nothing ever contacts this address for a localhost deployment;
  // it exists because the header is mandatory and must parse.
  const from = process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.EMAIL_FROM;
  return from?.includes("@") ? `mailto:${from}` : "mailto:dev@meso505.invalid";
}

/** A day. An offline phone should still get it; a week-old ping should not. */
const TTL_SECONDS = 24 * 60 * 60;

export async function notify<K extends NotificationKind>(
  userId: string,
  kind: K,
  params: NotifyPayloads[K],
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        locale: true,
        pushDevices: { select: { endpoint: true, p256dh: true, auth: true } },
      },
    });

    if (!user) return;

    // The one fan-out point. Email for athletes with no device would branch
    // here, and nowhere else.
    if (user.pushDevices.length === 0) return;

    const t = createTranslator(isLocale(user.locale) ? user.locale : "en");
    const template = TEMPLATES[kind];
    const payload = JSON.stringify({
      title: t(template.title, params),
      body: t(template.body, params),
      url: template.url,
      // Collapses repeats on the device rather than stacking five identical
      // "new friend request" banners.
      tag: kind,
    });

    if (!isPushConfigured()) {
      console.info(`[push] VAPID keys not set — not sending ${kind} to ${userId}: ${payload}`);
      return;
    }

    const results = await Promise.allSettled(
      user.pushDevices.map((device) =>
        webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { vapidDetails: vapid(), TTL: TTL_SECONDS },
        ),
      ),
    );

    await Promise.all(
      results.map((result, index) =>
        result.status === "rejected"
          ? forget(result.reason, user.pushDevices[index]!.endpoint)
          : undefined,
      ),
    );
  } catch (error) {
    // Returns void and swallows: no caller can be made to depend on this.
    console.error(`[push] ${kind} to ${userId} failed`, error);
  }
}

/**
 * 404 and 410 are the push service saying the subscription is gone for good —
 * the browser was uninstalled, or the permission was revoked. Anything else
 * (429, a 5xx) is a bad afternoon at Google or Mozilla, and is not a reason to
 * unsubscribe someone.
 */
async function forget(reason: unknown, endpoint: string): Promise<void> {
  if (!(reason instanceof WebPushError) || (reason.statusCode !== 404 && reason.statusCode !== 410)) {
    console.error(`[push] send to ${endpoint} failed`, reason);
    return;
  }

  // `deleteMany` on one endpoint rather than `delete`: two concurrent sends to
  // the same dead device will both land here, and the second must not throw for
  // finding the row already gone. Same reasoning as `endSession`.
  await db.pushDevice.deleteMany({ where: { endpoint } });
}
