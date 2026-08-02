import { notFound } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { Medal } from "@/components/medal";
import { List, Row, Screen, ScreenHeader, Section, Stat } from "@/components/ui";
import { createTranslator, formatDate, formatNumber } from "@/lib/i18n";
import { fromKg } from "@/lib/units";
import { friendProfile } from "@/server/friends";
import { getUserContext } from "@/server/user";

/**
 * A friend's page. Everything on it is training activity they agreed to share
 * by accepting; `friendProfile` returns null for anyone who has not, so a
 * guessed username is a 404 rather than a peek.
 */
export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { userId, locale, unit } = await getUserContext();
  const t = createTranslator(locale);

  const friend = await friendProfile(userId, username, locale);
  if (!friend) notFound();

  return (
    <>
      <ScreenHeader
        back="/friends"
        backLabel={t("friends.title")}
        leading={<Avatar name={friend.name} username={friend.username} size="lg" />}
        title={friend.name}
        meta={`@${friend.username}`}
      />

      <Screen>
        <Section>
          <div className="grid grid-cols-3 gap-4">
            <Stat
              value={formatNumber(friend.points, locale)}
              label={t("achv.points")}
              tone="accent"
            />
            <Stat value={String(friend.sessions)} label={t("progress.recentSessions")} />
            <Stat
              value={formatNumber(fromKg(friend.tonnageKg, unit), locale)}
              unit={unit}
              label={t("session.totalVolume")}
            />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <Stat value={String(friend.medals)} label={t("achv.medals")} />
            <Stat value={String(friend.setsLogged)} label={t("session.totalSets")} />
            <Stat
              value={String(friend.streakWeeks)}
              label={t("friends.streakWeeks")}
            />
          </div>
        </Section>

        <Section label={t("friends.theirMedals")}>
          {friend.unlocked.length === 0 ? (
            <p className="pb-4 text-sm leading-relaxed text-ink-3">{t("friends.noMedals")}</p>
          ) : (
            <List>
              {friend.unlocked.map((medal) => (
                <Row key={medal.key}>
                  <div className="flex items-center gap-3.5 py-3.5">
                    <Medal tier={medal.tier} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug">{medal.name}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
                        {formatDate(medal.unlockedAt, locale)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-accent">
                      +{medal.points}
                    </span>
                  </div>
                </Row>
              ))}
            </List>
          )}
        </Section>

        <Section label={t("friends.theirSessions")}>
          {friend.recent.length === 0 ? (
            <p className="pb-4 text-sm leading-relaxed text-ink-3">{t("friends.noSessions")}</p>
          ) : (
            <List>
              {friend.recent.map((session) => (
                <Row key={session.id}>
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{session.label}</p>
                      <p className="mt-0.5 text-[13px] text-ink-3">
                        {formatDate(session.at, locale)} · {t("common.week")} {session.week}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-semibold tabular-nums">{session.sets}</p>
                      <p className="mt-0.5 text-[13px] tabular-nums text-ink-3">
                        {formatNumber(fromKg(session.tonnageKg, unit), locale)} {unit}
                      </p>
                    </div>
                  </div>
                </Row>
              ))}
            </List>
          )}
        </Section>
      </Screen>
    </>
  );
}
