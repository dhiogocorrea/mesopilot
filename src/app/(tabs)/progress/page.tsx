import { BarChart, Sparkline } from "@/components/chart";
import { Medal } from "@/components/medal";
import {
  Chevron,
  Chip,
  cx,
  EmptyState,
  List,
  Row,
  RowLink,
  Screen,
  ScreenHeader,
  Section,
  Stat,
} from "@/components/ui";
import { db } from "@/lib/db";
import { createTranslator, formatDate, formatNumber, localized } from "@/lib/i18n";
import { estimateOneRepMax, fromKg } from "@/lib/units";
import { achievementSummary } from "@/server/achievements";
import { incomingRequests, listFriends } from "@/server/friends";
import { getActiveMesocycle } from "@/server/mesocycle";
import { getLandmarks, getUserContext } from "@/server/user";

export default async function ProgressPage() {
  const { userId, locale, unit } = await getUserContext();
  const t = createTranslator(locale);

  const [mesocycle, landmarks, muscles, recent, achievements, friends, requests] =
    await Promise.all([
    getActiveMesocycle(userId),
    getLandmarks(userId),
    db.muscleGroup.findMany({ orderBy: { order: "asc" } }),
    db.session.findMany({
      where: { status: "completed", mesocycle: { userId } },
      orderBy: { completedAt: "desc" },
      // Deeper than the eight rows listed below: a trend line needs a run of
      // sessions behind it, and this is one query either way.
      take: 40,
      include: { entries: { include: { exercise: true, sets: true } } },
    }),
    achievementSummary(userId, locale),
    listFriends(userId),
    incomingRequests(userId),
  ]);

  // Rendered in both branches. Achievements and a waiting friend request are
  // exactly what someone with no logged sessions still needs to reach, and an
  // early return that skipped them left the request with no way in.
  const social = (
    <Section>
      <List>
        <Row>
          <RowLink href="/achievements">
            {achievements.unlocked[0] ? (
              <Medal tier={achievements.unlocked[0].tier} size="sm" />
            ) : (
              <Medal tier="bronze" size="sm" locked />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{t("achv.viewAll")}</span>
              <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                {achievements.unlocked.length > 0
                  ? t("achv.earnedOf", {
                      earned: achievements.unlocked.length,
                      total: achievements.unlocked.length + achievements.locked.length,
                    })
                  : t("achv.none")}
              </span>
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-accent">
              {formatNumber(achievements.points, locale)}
            </span>
            <Chevron />
          </RowLink>
        </Row>
        <Row>
          <RowLink href="/friends">
            <span
              aria-hidden="true"
              className={cx(
                "size-2 shrink-0 rounded-full",
                requests.length > 0 ? "bg-accent" : "bg-surface-3",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{t("friends.title")}</span>
              <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                {requests.length > 0
                  ? t("friends.incoming")
                  : friends.length > 0
                    ? friends.map((friend) => friend.name).join(", ")
                    : t("friends.none")}
              </span>
            </span>
            <Chevron />
          </RowLink>
        </Row>
      </List>
    </Section>
  );

  if (recent.length === 0) {
    return (
      <>
        <ScreenHeader title={t("progress.title")} />
        <Screen>{social}</Screen>
        <EmptyState title={t("progress.noData")} body={t("progress.noDataBody")} />
      </>
    );
  }

  // Prescribed sets per muscle for the week in progress — the number the
  // MEV/MRV landmarks are actually defined against.
  const currentWeek = mesocycle
    ? (mesocycle.sessions.find((session) => session.status !== "completed")?.week ??
      mesocycle.weeks)
    : null;

  const weeklyVolume = new Map<string, number>();
  if (mesocycle && currentWeek !== null) {
    for (const session of mesocycle.sessions) {
      if (session.week !== currentWeek) continue;
      for (const entry of session.entries) {
        weeklyVolume.set(
          entry.muscleGroupId,
          (weeklyVolume.get(entry.muscleGroupId) ?? 0) + entry.targetSets,
        );
      }
    }
  }

  const trained = muscles.filter((muscle) => (weeklyVolume.get(muscle.id) ?? 0) > 0);

  // Oldest first from here down: every series reads left to right as time.
  const history = [...recent].reverse();

  const perSession: { at: Date | null; sets: number; tonnage: number }[] = [];
  const liftSeries = new Map<string, { name: string; e1rms: number[] }>();
  let totalSets = 0;
  let totalTonnage = 0;

  for (const session of history) {
    let sets = 0;
    let tonnage = 0;
    // Best estimate *per session*, so a lift trains one point per workout — a
    // point per set would draw the warm-up ramp instead of the progression.
    const bestThisSession = new Map<string, { name: string; e1rm: number }>();

    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (!set.completed || set.weightKg === null || set.reps === null) continue;
        sets += 1;
        tonnage += set.weightKg * set.reps;

        const e1rm = estimateOneRepMax(set.weightKg, set.reps);
        const best = bestThisSession.get(entry.exerciseId);
        if (!best || e1rm > best.e1rm) {
          bestThisSession.set(entry.exerciseId, {
            name: localized(entry.exercise, locale),
            e1rm,
          });
        }
      }
    }

    totalSets += sets;
    totalTonnage += tonnage;
    perSession.push({ at: session.completedAt, sets, tonnage });

    for (const [exerciseId, best] of bestThisSession) {
      const series = liftSeries.get(exerciseId) ?? { name: best.name, e1rms: [] };
      series.e1rms.push(best.e1rm);
      liftSeries.set(exerciseId, series);
    }
  }

  // Ranked by what they lift now, not by how much they have improved: this is
  // the list of their main lifts, and the trend beside each is the story.
  const topLifts = [...liftSeries.values()]
    .map((series) => ({
      name: series.name,
      e1rms: series.e1rms,
      current: series.e1rms[series.e1rms.length - 1]!,
      first: series.e1rms[0]!,
    }))
    .sort((a, b) => b.current - a.current)
    .slice(0, 6);

  // A phone fits about a fortnight of bars before they turn into a comb.
  const tonnageBars = perSession.slice(-14).map((point) => ({
    value: Math.round(fromKg(point.tonnage, unit)),
    label: point.at ? formatDate(point.at, locale) : undefined,
  }));

  return (
    <>
      <ScreenHeader title={t("progress.title")} />

      <Screen>
        {social}

        {/* The headline figures, before any breakdown. */}
        <div className="mb-9 grid grid-cols-3 gap-4">
          <Stat value={String(recent.length)} label={t("progress.recentSessions")} />
          <Stat value={String(totalSets)} label={t("session.totalSets")} />
          <Stat
            value={formatNumber(fromKg(totalTonnage, unit), locale)}
            unit={unit}
            label={t("session.totalVolume")}
            tone="accent"
          />
        </div>

        {tonnageBars.length > 1 && (
          <Section label={`${t("session.totalVolume")} · ${t("progress.perSession")}`}>
            <BarChart points={tonnageBars} emptyLabel={t("progress.noData")} />
          </Section>
        )}

        {trained.length > 0 && (
          <Section label={t("progress.weeklyVolume")}>
            <div className="space-y-5">
              {trained.map((muscle) => (
                <VolumeBar
                  key={muscle.id}
                  name={localized(muscle, locale)}
                  sets={weeklyVolume.get(muscle.id) ?? 0}
                  landmarks={
                    landmarks.get(muscle.id) ?? {
                      mev: muscle.mev,
                      mav: muscle.mav,
                      mrv: muscle.mrv,
                    }
                  }
                  belowLabel={t("progress.belowMev")}
                  aboveLabel={t("progress.aboveMrv")}
                  inRangeLabel={t("progress.inRange")}
                />
              ))}
            </div>
          </Section>
        )}

        {topLifts.length > 0 && (
          <Section label={`${t("progress.strength")} · ${t("progress.estimated1rm")}`}>
            <List>
              {topLifts.map((lift) => {
                const delta = lift.current - lift.first;
                return (
                  <Row key={lift.name}>
                    <div className="flex items-center gap-4 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{lift.name}</span>
                        {/* Only worth stating once it has moved. */}
                        {lift.e1rms.length > 1 && Math.abs(fromKg(delta, unit)) >= 0.5 && (
                          <span
                            className={cx(
                              "mt-0.5 block text-[13px] tabular-nums",
                              delta > 0 ? "text-accent" : "text-ink-3",
                            )}
                          >
                            {delta > 0 ? "+" : "−"}
                            {formatNumber(Math.abs(fromKg(delta, unit)), locale, 1)} {unit}
                          </span>
                        )}
                      </span>

                      <span className="w-16 shrink-0">
                        <Sparkline points={lift.e1rms} tone={delta >= 0 ? "accent" : "ink"} />
                      </span>

                      <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums">
                        {formatNumber(fromKg(lift.current, unit), locale)}
                        <span className="ml-1 text-[13px] font-normal text-ink-3">{unit}</span>
                      </span>
                    </div>
                  </Row>
                );
              })}
            </List>
          </Section>
        )}

        <Section label={t("progress.recentSessions")}>
          <List>
            {recent.slice(0, 8).map((session) => {
              const sets = session.entries.reduce(
                (total, entry) => total + entry.sets.filter((set) => set.completed).length,
                0,
              );
              const tonnage = session.entries.reduce(
                (total, entry) =>
                  total +
                  entry.sets.reduce(
                    (sum, set) =>
                      set.completed && set.weightKg !== null && set.reps !== null
                        ? sum + set.weightKg * set.reps
                        : sum,
                    0,
                  ),
                0,
              );

              return (
                <Row key={session.id}>
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{session.label}</p>
                      <p className="mt-0.5 text-[13px] text-ink-3">
                        {session.completedAt ? formatDate(session.completedAt, locale) : "—"} ·{" "}
                        {t("common.week")} {session.week}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-semibold tabular-nums">{sets}</p>
                      <p className="mt-0.5 text-[13px] tabular-nums text-ink-3">
                        {formatNumber(fromKg(tonnage, unit), locale)} {unit}
                      </p>
                    </div>
                  </div>
                </Row>
              );
            })}
          </List>
        </Section>
      </Screen>
    </>
  );
}

/**
 * Weekly sets against the muscle's landmarks. Scaled to MRV so the MEV and MAV
 * ticks land consistently across muscles, and coloured only when the volume is
 * actually out of the productive range.
 */
function VolumeBar({
  name,
  sets,
  landmarks,
  belowLabel,
  aboveLabel,
  inRangeLabel,
}: {
  name: string;
  sets: number;
  landmarks: { mev: number; mav: number; mrv: number };
  belowLabel: string;
  aboveLabel: string;
  inRangeLabel: string;
}) {
  const scale = Math.max(landmarks.mrv, sets);
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const status = sets < landmarks.mev ? "below" : sets > landmarks.mrv ? "above" : "in-range";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[15px]">{name}</span>
        <span className="shrink-0 text-[13px] tabular-nums text-ink-3">
          <span className="font-semibold text-ink">{sets}</span> / {landmarks.mrv}
        </span>
      </div>

      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={
            status === "above"
              ? "h-full rounded-full bg-danger"
              : status === "below"
                ? "h-full rounded-full bg-info"
                : "h-full rounded-full bg-accent"
          }
          style={{ width: pct(sets) }}
        />
        {/* MEV and MAV read as the edges of the productive zone. */}
        <span
          className="absolute top-0 h-full w-px bg-canvas"
          style={{ left: pct(landmarks.mev) }}
          aria-hidden="true"
        />
        <span
          className="absolute top-0 h-full w-px bg-canvas"
          style={{ left: pct(landmarks.mav) }}
          aria-hidden="true"
        />
      </div>

      {status !== "in-range" && (
        <div className="mt-2">
          <Chip tone={status === "below" ? "info" : "danger"}>
            {status === "below" ? belowLabel : aboveLabel}
          </Chip>
        </div>
      )}
      <span className="sr-only">{status === "in-range" ? inRangeLabel : ""}</span>
    </div>
  );
}
