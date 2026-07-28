import { TrackNextBlock } from "@/components/track-next-block";
import {
  ButtonLink,
  Chip,
  EmptyState,
  List,
  Row,
  Screen,
  ScreenHeader,
  Section,
} from "@/components/ui";
import { formatRepRange } from "@/lib/format";
import { createTranslator, localized } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import {
  findCurrentSession,
  getActiveMesocycle,
  mesocycleProgress,
  type MesocycleSession,
} from "@/server/mesocycle";
import { trackContextFor } from "@/server/track";
import { getUserContext } from "@/server/user";

export default async function TodayPage() {
  // The tabs layout already guarantees a profile exists.
  const { userId, name, locale } = await getUserContext();
  const t = createTranslator(locale);

  const mesocycle = await getActiveMesocycle(userId);

  if (!mesocycle) {
    return (
      <>
        <ScreenHeader eyebrow={name} title={t("today.title")} />
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

  const session = findCurrentSession(mesocycle);
  const progress = mesocycleProgress(mesocycle);
  const track = await trackContextFor(mesocycle.trackId, mesocycle.trackPosition);

  return (
    <>
      <ScreenHeader eyebrow={name} title={t("today.title")} />

      <Screen>
        <Section label={t("today.currentBlock")}>
          <p className="text-headline">{mesocycle.name}</p>
          <p className="mt-1 text-sm text-ink-2">
            {t("today.sessionsDone", { done: progress.done, total: progress.total })}
          </p>
          {track && (
            // The track line is the block's address, so it sits with the name
            // rather than competing with it.
            <p className="mt-1 text-[13px] text-ink-3">
              {localized(track.track, locale)}
              <span className="mx-1.5 text-ink-3/50">·</span>
              {t("track.step", { step: track.step, total: track.total })}
            </p>
          )}
          <WeekTrack
            current={progress.currentWeek}
            total={mesocycle.weeks}
            deloadLabel={t("meso.deloadWeek")}
          />
        </Section>

        {session ? (
          <NextSession session={session} locale={locale} t={t} />
        ) : track?.next ? (
          <TrackNextBlock
            trackId={track.trackId}
            position={track.next.position}
            name={localized(track.next, locale)}
          />
        ) : (
          <EmptyState
            title={track ? t("track.finished") : t("today.blockComplete")}
            body={track ? t("track.finishedBody") : t("today.blockCompleteBody")}
            action={
              <ButtonLink href="/plan/new" size="lg">
                {t("today.createBlock")}
              </ButtonLink>
            }
          />
        )}
      </Screen>
    </>
  );
}

function NextSession({
  session,
  locale,
  t,
}: {
  session: MesocycleSession;
  locale: Locale;
  t: ReturnType<typeof createTranslator>;
}) {
  const totalSets = session.entries.reduce((total, entry) => total + entry.targetSets, 0);

  return (
    <Section label={t("today.upNext")}>
      {/* The session name is the largest thing on the screen — it is what you
          opened the app to act on. */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="display-face text-display">{session.label}</h2>
        {session.isDeload && <Chip tone="warn">{t("meso.deloadWeek")}</Chip>}
      </div>

      <p className="mt-2.5 text-sm text-ink-2">
        {t("common.week")} {session.week} · {t("common.day")} {session.dayIndex + 1} ·{" "}
        {totalSets} {t("common.sets").toLowerCase()}
      </p>

      {session.isDeload && (
        <p className="mt-4 border-l-2 border-warn/50 py-0.5 pl-3 text-sm leading-relaxed text-warn">
          {t("today.deloadWeekBody")}
        </p>
      )}

      <List className="mt-6">
        {session.entries.map((entry) => (
          <Row key={entry.id}>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <span className="min-w-0 flex-1 truncate text-[15px]">
                {localized(entry.exercise, locale)}
              </span>
              <span className="shrink-0 text-sm text-ink-3">
                {entry.targetSets} × {formatRepRange(entry.repMin, entry.repMax)}
              </span>
            </div>
          </Row>
        ))}
      </List>

      <div className="sticky bottom-24 mt-7">
        <ButtonLink href={`/session/${session.id}`} size="lg" full>
          {session.status === "in_progress"
            ? t("today.continueSession")
            : t("today.startSession")}
        </ButtonLink>
      </div>
    </Section>
  );
}

/**
 * One segment per week of the block, filled up to the current one. Reads as
 * progress through the mesocycle at a glance without needing a number.
 */
function WeekTrack({
  current,
  total,
  deloadLabel,
}: {
  current: number;
  total: number;
  deloadLabel: string;
}) {
  return (
    <div className="mt-5">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => {
          const week = index + 1;
          const isDeload = week === total;
          return (
            <span
              key={week}
              className={
                week < current
                  ? "h-1 flex-1 rounded-full bg-accent"
                  : week === current
                    ? "h-1 flex-1 rounded-full bg-accent/45"
                    : isDeload
                      ? "h-1 flex-1 rounded-full bg-warn/25"
                      : "h-1 flex-1 rounded-full bg-surface-3"
              }
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-3">
        <span>
          {current} / {total}
        </span>
        <span>{deloadLabel}</span>
      </div>
    </div>
  );
}
