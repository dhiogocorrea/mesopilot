import { Medal } from "@/components/medal";
import { List, Row, Screen, ScreenHeader, Section, Stat } from "@/components/ui";
import { createTranslator, formatDate, formatNumber } from "@/lib/i18n";
import { achievementSummary } from "@/server/achievements";
import { getUserContext } from "@/server/user";

export default async function AchievementsPage() {
  const { userId, locale } = await getUserContext();
  const t = createTranslator(locale);
  const { points, unlocked, locked } = await achievementSummary(userId, locale);

  const total = unlocked.length + locked.length;

  return (
    <>
      <ScreenHeader
        back="/progress"
        backLabel={t("progress.title")}
        title={t("achv.title")}
        meta={t("achv.earnedOf", { earned: unlocked.length, total })}
      />

      <Screen>
        <Section>
          <div className="flex gap-10">
            <Stat value={formatNumber(points, locale)} label={t("achv.points")} tone="accent" />
            <Stat value={`${unlocked.length}`} label={t("achv.medals")} />
          </div>
        </Section>

        {unlocked.length > 0 && (
          <Section label={t("achv.earned")}>
            <List>
              {unlocked.map((achievement) => (
                <Row key={achievement.key}>
                  <div className="flex items-center gap-3.5 py-3.5">
                    <Medal tier={achievement.tier} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug">{achievement.name}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
                        {achievement.description}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-3">
                        {formatDate(achievement.unlockedAt, locale)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-accent">
                      +{achievement.points}
                    </span>
                  </div>
                </Row>
              ))}
            </List>
          </Section>
        )}

        <Section label={t("achv.locked")}>
          {/* Sorted closest-first by the server: the useful question is not
              "what have I missed" but "what could I get next". */}
          <List>
            {locked.map((achievement) => (
              <Row key={achievement.key}>
                <div className="flex items-center gap-3.5 py-3.5">
                  <Medal tier={achievement.tier} locked />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug text-ink-2">
                      {achievement.name}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
                      {achievement.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2.5">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="block h-full rounded-full bg-accent/50"
                          style={{ width: `${Math.round(achievement.progress * 100)}%` }}
                        />
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums text-ink-3">
                        {formatNumber(achievement.current, locale)} /{" "}
                        {formatNumber(achievement.threshold, locale)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-ink-3">
                    +{achievement.points}
                  </span>
                </div>
              </Row>
            ))}
          </List>
        </Section>
      </Screen>
    </>
  );
}
