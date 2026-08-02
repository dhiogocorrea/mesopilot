"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { resetTrainingData } from "@/server/actions";
import { Button } from "./ui";

export function ResetTrainingButton() {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" full onClick={() => setConfirming(true)}>
        {t("settings.resetData")}
      </Button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3.5">
      <p className="text-sm leading-relaxed">{t("settings.resetDataConfirm")}</p>
      <div className="flex gap-2.5">
        <Button
          variant="danger"
          size="sm"
          className="flex-1"
          disabled={pending}
          onClick={() => startTransition(() => resetTrainingData())}
        >
          {pending ? t("common.loading") : t("common.confirm")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => setConfirming(false)}
        >
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
