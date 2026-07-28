"use client";

import { useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { signOut } from "@/server/auth-actions";
import { Button } from "./ui";

export function SignOutButton() {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      full
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
    >
      {pending ? t("common.loading") : t("settings.signOut")}
    </Button>
  );
}
