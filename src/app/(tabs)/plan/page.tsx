import { EndBlockButton } from "@/components/end-block-button";
import {
  ButtonLink,
  Chevron,
  Chip,
  EmptyState,
  List,
  Row,
  RowLink,
  Screen,
  ScreenHeader,
  Section,
} from "@/components/ui";
import { createTranslator, localized } from "@/lib/i18n";
import { getActiveMesocycle, mesocycleProgress } from "@/server/mesocycle";
import { trackContextFor } from "@/server/track";
import { getUserContext } from "@/server/user";

export default async function PlanPage() {
  const { userId, locale } = await getUserContext();
  const t = createTranslator(locale);
  const mesocycle = await getActiveMesocycle(userId);

  if (!mesocycle) {
    return (
      <>
        <ScreenHeader title={t("meso.title")} />
        <EmptyState
          title={t("today.noActiveBlock")}
          body={t("today.noActiveBlockBody")}
          action={
            <ButtonLink href="/plan/new" size="lg">
              {t("today.createBlock")}
            </ButtonLink>
          }
        />
      </>
    );
  }

  const progress = mesocycleProgress(mesocycle);
  const track = await trackContextFor(mesocycle.trackId, mesocycle.trackPosition);

  // Later weeks are written by the engine as the previous one completes, so
  // only weeks that already exist appear here.
  const weeks = new Map<number, typeof mesocycle.sessions>();
  for (const session of mesocycle.sessions) {
    const bucket = weeks.get(session.week) ?? [];
    bucket.push(session);
    weeks.set(session.week, bucket);
  }

  return (
    <>
      <ScreenHeader
        eyebrow={
          // In a track, where you are matters more than that the block is
          // active — the big "End this block" button below already says that.
          track
            ? `${localized(track.track, locale)} · ${t("track.step", {
                step: track.step,
                total: track.total,
              })}`
            : t("meso.active")
        }
        title={mesocycle.name}
        meta={t("meso.weekProgress", { week: progress.currentWeek, total: mesocycle.weeks })}
      />

      <Screen>
        {[...weeks.entries()].map(([week, sessions]) => (
          <Section
            key={week}
            label={`${t("common.week")} ${week}`}
            action={sessions[0]?.isDeload ? <Chip tone="warn">{t("meso.deloadWeek")}</Chip> : null}
          >
            <List>
              {sessions.map((session) => (
                <Row key={session.id}>
                  <RowLink href={`/session/${session.id}`}>
                    <StatusMark status={session.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {session.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                        {session.entries
                          .slice(0, 3)
                          .map((entry) => localized(entry.exercise, locale))
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] text-ink-3">
                      {session.entries.reduce((total, entry) => total + entry.targetSets, 0)}
                    </span>
                    <Chevron />
                  </RowLink>
                </Row>
              ))}
            </List>
          </Section>
        ))}

        <div className="space-y-3 pb-4">
          <ButtonLink href="/plan/new" variant="secondary" size="lg" full>
            {t("meso.new")}
          </ButtonLink>
          <EndBlockButton mesocycleId={mesocycle.id} />
        </div>
      </Screen>
    </>
  );
}

/** Ring for planned, half for in-progress, filled for done, hollow for skipped. */
function StatusMark({ status }: { status: string }) {
  if (status === "completed") {
    return <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />;
  }
  if (status === "skipped") {
    // A dash, not a ring: a skipped day is settled, and reading as "not done
    // yet" would invite tapping it week after week.
    return <span className="h-px w-2 shrink-0 bg-ink-3" aria-hidden="true" />;
  }
  if (status === "in_progress") {
    return (
      <span
        className="size-2 shrink-0 rounded-full border-2 border-accent bg-transparent"
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className="size-2 shrink-0 rounded-full border border-hairline-strong"
      aria-hidden="true"
    />
  );
}
