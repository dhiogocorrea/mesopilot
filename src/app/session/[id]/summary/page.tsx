import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink, Chip, List, Row, Screen, Section, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { formatRepRange } from "@/lib/format";
import { createTranslator, formatNumber, localized } from "@/lib/i18n";
import { fromKg } from "@/lib/units";
import { Medal } from "@/components/medal";
import { unlockedByKeys } from "@/server/achievements";
import { countLoggedSets, getSessionDetail, sessionTonnage } from "@/server/session";
import { getUserContext } from "@/server/user";

export default async function SessionSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ earned?: string }>;
}) {
  const { id } = await params;
  const { earned } = await searchParams;
  const { userId, locale, unit } = await getUserContext();
  const t = createTranslator(locale);

  const session = await getSessionDetail(id, userId);
  if (!session) notFound();

  // Validated against the athlete's own collection, so a hand-edited query
  // string shows nothing rather than a medal nobody earned.
  const medals = await unlockedByKeys(userId, earned?.split(",").filter(Boolean) ?? [], locale);

  // The session the progression engine wrote from this one.
  const next = await db.session.findFirst({
    where: {
      mesocycleId: session.mesocycleId,
      week: session.week + 1,
      dayIndex: session.dayIndex,
    },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: { exercise: true, decisions: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  const minutes =
    session.startedAt && session.completedAt
      ? Math.max(1, Math.round((+session.completedAt - +session.startedAt) / 60_000))
      : null;

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-16 pt-14">
      <Screen>
        <p className="text-label uppercase text-ink-3">
          {t("common.week")} {session.week} · {session.label}
        </p>
        <h1 className="display-face text-display mt-2">{t("session.summary")}</h1>

        {medals.length > 0 && (
          <div className="mt-7 rounded-2xl border border-accent-line bg-accent-soft p-4">
            <p className="text-label uppercase text-accent">
              {medals.length === 1
                ? t("achv.newlyEarned")
                : t("achv.newlyEarnedPlural", { count: medals.length })}
            </p>
            <ul className="mt-3 space-y-3">
              {medals.map((medal) => (
                <li key={medal.key} className="flex items-center gap-3">
                  <Medal tier={medal.tier} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug">
                      {medal.name}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">
                      {medal.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-accent">
                    +{medal.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-10 mt-9 grid grid-cols-3 gap-4">
          <Stat value={String(countLoggedSets(session))} label={t("session.totalSets")} />
          <Stat
            value={formatNumber(fromKg(sessionTonnage(session), unit), locale)}
            unit={unit}
            label={t("session.totalVolume")}
            tone="accent"
          />
          <Stat value={minutes ? String(minutes) : "—"} unit="min" label={t("session.duration")} />
        </div>

        {next && (
          <Section label={t("coach.adjustments")}>
            <List>
              {next.entries.map((entry) => {
                // Newest decision wins — the AI layer appends after the engine.
                const decision = entry.decisions.at(-1);
                const reason = decision
                  ? locale === "pt"
                    ? decision.reasonPt || decision.reasonEn
                    : decision.reasonEn || decision.reasonPt
                  : null;

                return (
                  <Row key={entry.id}>
                    <div className="py-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="min-w-0 flex-1 truncate text-[15px] font-medium">
                          {localized(entry.exercise, locale)}
                        </h3>
                        <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                          {entry.targetSets} × {formatRepRange(entry.repMin, entry.repMax)}
                          <span className="ml-1.5 text-[13px] font-normal text-ink-3">
                            @{entry.targetRir}
                          </span>
                        </span>
                      </div>

                      {decision && (decision.setDelta !== 0 || decision.loadDeltaPct !== 0) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {decision.setDelta !== 0 && (
                            <Chip tone={decision.setDelta > 0 ? "accent" : "warn"}>
                              {decision.setDelta > 0
                                ? t("coach.setsUp", { count: decision.setDelta })
                                : t("coach.setsDown", { count: decision.setDelta })}
                            </Chip>
                          )}
                          {decision.loadDeltaPct > 0 && (
                            <Chip tone="accent">{t("coach.loadUp")}</Chip>
                          )}
                          {decision.loadDeltaPct < 0 && (
                            <Chip tone="warn">{t("coach.loadDown")}</Chip>
                          )}
                        </div>
                      )}

                      {reason && (
                        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{reason}</p>
                      )}
                      {entry.aiNote && (
                        <p className="mt-2 border-l-2 border-accent-line py-0.5 pl-3 text-[13px] leading-relaxed">
                          {entry.aiNote}
                        </p>
                      )}
                    </div>
                  </Row>
                );
              })}
            </List>
          </Section>
        )}

        <div className="space-y-4">
          <ButtonLink href="/" size="lg" full>
            {t("common.done")}
          </ButtonLink>
          {next && (
            <Link
              href={`/session/${next.id}`}
              className="block text-center text-[13px] text-ink-3 underline decoration-hairline-strong underline-offset-4"
            >
              {t("session.nextPlanned")}
            </Link>
          )}
        </div>
      </Screen>
    </div>
  );
}
