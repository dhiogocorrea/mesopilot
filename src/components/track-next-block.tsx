"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { startTrackStep } from "@/server/actions";
import { Button, ButtonLink, Section } from "./ui";

/**
 * Shown when a block that belongs to a track finishes. The whole point of a
 * track is that the athlete does not have to walk back into a 40-item picker
 * to answer a question the track already answered.
 */
export function TrackNextBlock({
  trackId,
  position,
  name,
}: {
  trackId: string;
  position: number;
  name: string;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        await startTrackStep({ trackId, position });
      } catch {
        setError(t("common.error"));
      }
    });
  }

  return (
    <Section label={t("track.upNextBlock")}>
      <h2 className="text-headline">{name}</h2>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 space-y-3">
        <Button size="lg" full onClick={start} disabled={pending}>
          {pending ? t("common.loading") : t("track.startNextBlock", { name })}
        </Button>
        <ButtonLink href="/plan/new" variant="secondary" full>
          {t("track.showPrograms")}
        </ButtonLink>
      </div>
    </Section>
  );
}
