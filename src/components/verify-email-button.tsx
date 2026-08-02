"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { resendVerification } from "@/server/auth-actions";
import { Button } from "./ui";

export function VerifyEmailButton() {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<"sent" | "failed" | null>(null);

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { sent } = await resendVerification();
            setResult(sent ? "sent" : "failed");
          })
        }
      >
        {pending ? t("common.loading") : t("settings.resend")}
      </Button>

      {result === "sent" && <p className="text-[13px] text-accent">{t("settings.resendSent")}</p>}
      {result === "failed" && (
        <p className="text-[13px] text-danger">{t("settings.resendFailed")}</p>
      )}
    </div>
  );
}
