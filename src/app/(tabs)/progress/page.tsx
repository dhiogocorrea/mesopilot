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
      take: 8,
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

  const strength = new Map<string, { name: string; e1rm: number }>();
  let totalSets = 0;
  let totalTonnage = 0;

  for (const session of recent) {
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (!set.completed || set.weightKg === null || set.reps === null) continue;
        totalSets += 1;
        totalTonnage += set.weightKg * set.reps;
        const e1rm = estimateOneRepMax(set.weightKg, set.reps);
        const existing = strength.get(entry.exerciseId);
        if (!existing || e1rm > existing.e1rm) {
          strength.set(entry.exerciseId, { name: localized(entry.exercise, locale), e1rm });
        }
      }
    }
  }

  const topLifts = [...strength.values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 6);

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
              {topLifts.map((lift) => (
                <Row key={lift.name}>
                  <div className="flex items-baseline justify-between gap-4 py-3.5">
                    <span className="min-w-0 flex-1 truncate text-[15px]">{lift.name}</span>
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                      {formatNumber(fromKg(lift.e1rm, unit), locale)}
                      <span className="ml-1 text-[13px] font-normal text-ink-3">{unit}</span>
                    </span>
                  </div>
                </Row>
              ))}
            </List>
          </Section>
        )}

        <Section label={t("progress.recentSessions")}>
          <List>
            {recent.map((session) => {
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
