"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { safeZone } from "@/lib/time";
import { isScheduledKind } from "@/lib/types";
import { notify } from "./notify";
import { getUserContext } from "./user";

/**
 * Registering and forgetting the device the athlete is holding.
 *
 * **`endpoint` is a URL this server will later make requests to**, which makes
 * it the one field here worth being careful about: a server action is a public
 * endpoint, so an arbitrary caller could otherwise register an internal address
 * and use `notify()` as a request forwarder. Requiring HTTPS and a sane length
 * removes the obvious shapes of that. It is not a full allowlist — push vendors
 * change hostnames often enough that pinning them breaks delivery for real
 * users — so the residual risk is an authenticated caller pointing us at an
 * arbitrary HTTPS host, which is worth knowing about if this ever runs
 * somewhere with private HTTPS services on the same network.
 */
const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(1024)
    .refine((value) => value.startsWith("https://"), "Push endpoints must be HTTPS"),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});

export async function savePushDevice(input: z.infer<typeof subscriptionSchema>): Promise<void> {
  const data = subscriptionSchema.parse(input);
  const { userId } = await getUserContext();

  await db.pushDevice.upsert({
    where: { endpoint: data.endpoint },
    create: {
      userId,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
    },
    update: {
      // `userId` belongs in the update, not just the create: the endpoint is the
      // *device*, and the same browser can later be signed in as someone else.
      // Without this, the second account's phone keeps receiving the first
      // account's notifications.
      userId,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      lastSeenAt: new Date(),
    },
  });
}

export async function deletePushDevice(endpoint: string): Promise<void> {
  const value = z.string().min(1).max(1024).parse(endpoint);
  const { userId } = await getUserContext();

  // Scoped to the caller: an endpoint is guessable in principle, and nobody
  // gets to unsubscribe somebody else's phone.
  await db.pushDevice.deleteMany({ where: { endpoint: value, userId } });
}

/**
 * The only way to confirm the whole path works without a second account — which
 * is what makes the Settings switch trustworthy rather than a claim.
 */
export async function sendTestPush(): Promise<void> {
  const { userId } = await getUserContext();
  await notify(userId, "test.ping", {});
}

/**
 * Records where the athlete is, so a reminder lands during their day.
 *
 * Taken from the browser rather than asked for — nobody should have to pick
 * their timezone from a list to avoid being woken up — and written only when it
 * actually differs from what is stored, so this is not a write on every visit.
 * `safeZone` rejects anything this runtime cannot resolve rather than storing a
 * value the scheduler would later have to defend against.
 */
export async function setTimezone(timezone: string): Promise<void> {
  const offered = z.string().min(1).max(64).parse(timezone);
  const resolved = safeZone(offered);
  if (resolved === "UTC" && offered !== "UTC") return;

  const { userId } = await getUserContext();
  await db.user.updateMany({ where: { id: userId, timezone: { not: resolved } }, data: { timezone: resolved } });
}

/**
 * Muting or unmuting one scheduled reminder.
 *
 * Refuses anything that is not a scheduled kind. A friend request is a
 * consequence of something the recipient is a party to, and the way to stop
 * those is to turn notifications off entirely — offering a switch that silences
 * them would leave someone wondering for weeks why nobody adds them.
 */
export async function setReminder(kind: string, enabled: boolean): Promise<void> {
  const value = z.string().min(1).max(64).parse(kind);
  if (!isScheduledKind(value)) throw new Error(`${value} is not a mutable reminder`);

  const { userId } = await getUserContext();

  if (enabled) {
    // Absence of a row is the subscribed state, so unmuting is a delete.
    await db.notificationOptOut.deleteMany({ where: { userId, kind: value } });
  } else {
    await db.notificationOptOut.upsert({
      where: { userId_kind: { userId, kind: value } },
      create: { userId, kind: value },
      update: {},
    });
  }

  revalidatePath("/settings");
}
