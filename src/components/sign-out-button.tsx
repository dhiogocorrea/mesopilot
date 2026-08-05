"use client";

import { useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { signOut } from "@/server/auth-actions";
import { deletePushDevice } from "@/server/push-actions";
import { Button } from "./ui";

/**
 * Signing out has to take the push subscription with it, and only the browser
 * can do that: `endSession()` clears the cookie, but it has no way to know
 * *which* endpoint belongs to the device making the request. Without this,
 * signing out of a shared phone leaves it receiving the previous account's
 * notifications until someone notices.
 *
 * Best-effort, and deliberately not allowed to block the sign-out — being
 * unable to reach the push manager is not a reason to keep someone logged in.
 */
async function forgetThisDevice(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;

    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const { endpoint } = subscription;
    await subscription.unsubscribe();
    await deletePushDevice(endpoint);
  } catch (error) {
    console.error("[push] could not unsubscribe on sign out", error);
  }
}

export function SignOutButton() {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      full
      disabled={pending}
      onClick={() => {
        void forgetThisDevice().then(() => startTransition(() => signOut()));
      }}
    >
      {pending ? t("common.loading") : t("settings.signOut")}
    </Button>
  );
}
