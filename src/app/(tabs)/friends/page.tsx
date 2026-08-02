import {
  AddFriendForm,
  RemoveFriendButton,
  RequestActions,
  WithdrawButton,
} from "@/components/friend-controls";
import { Avatar, PersonName } from "@/components/avatar";
import { Medal } from "@/components/medal";
import { Standings } from "@/components/standings";
import { Chevron, List, Row, RowLink, Screen, ScreenHeader, Section } from "@/components/ui";
import { createTranslator, formatDate, formatNumber } from "@/lib/i18n";
import { friendFeed, incomingRequests, leaderboard, listFriends, outgoingRequests } from "@/server/friends";
import { getUserContext } from "@/server/user";

export default async function FriendsPage() {
  const { userId, locale } = await getUserContext();
  const t = createTranslator(locale);

  const [feed, friends, incoming, outgoing, standings] = await Promise.all([
    friendFeed(userId, locale),
    listFriends(userId),
    incomingRequests(userId),
    outgoingRequests(userId),
    leaderboard(userId),
  ]);

  return (
    <>
      <ScreenHeader back="/progress" backLabel={t("progress.title")} title={t("friends.title")} />

      <Screen>
        {/* Requests first when there are any: someone is waiting on an answer. */}
        {incoming.length > 0 && (
          <Section label={t("friends.incoming")}>
            <List>
              {incoming.map((request) => (
                <Row key={request.friendshipId}>
                  <div className="flex items-center gap-3 py-3.5">
                    <Avatar name={request.name} username={request.username} />
                    <PersonName
                      name={request.name}
                      username={request.username}
                      className="flex-1"
                    />
                    <RequestActions friendshipId={request.friendshipId} />
                  </div>
                </Row>
              ))}
            </List>
          </Section>
        )}

        <Section label={t("friends.feed")}>
          {feed.length === 0 ? (
            <p className="py-6 text-sm leading-relaxed text-ink-3">{t("friends.noActivity")}</p>
          ) : (
            <List>
              {feed.map((item) => (
                <Row key={`${item.kind}-${item.username}-${+item.at}`}>
                  <RowLink href={`/friends/${item.username}`} className="items-start">
                    {item.kind === "achievement" ? (
                      <Medal tier={item.tier} size="sm" />
                    ) : (
                      <Avatar name={item.name} username={item.username} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-snug">
                        <span className="font-semibold">{item.name}</span>{" "}
                        {item.kind === "session"
                          ? t("friends.didSession", { label: item.label })
                          : t("friends.earned", { name: item.title })}
                      </span>
                      <span className="mt-0.5 block text-[13px] tabular-nums text-ink-3">
                        {item.kind === "session" ? (
                          <>
                            {t("common.week")} {item.week}
                            <span className="mx-1.5 text-ink-3/50">·</span>
                            {item.sets} {t("common.sets").toLowerCase()}
                            <span className="mx-1.5 text-ink-3/50">·</span>
                            {formatNumber(item.tonnageKg, locale)} kg
                          </>
                        ) : (
                          <>
                            +{item.points} {t("achv.points").toLowerCase()}
                          </>
                        )}
                        <span className="mx-1.5 text-ink-3/50">·</span>
                        {formatDate(item.at, locale)}
                      </span>
                    </span>
                  </RowLink>
                </Row>
              ))}
            </List>
          )}
        </Section>

        {/* Only worth a section once there is somebody to be ranked against. */}
        {standings.length > 1 && <Standings rows={standings} />}

        <Section label={t("friends.yours")}>
          {friends.length === 0 ? (
            <p className="pb-4 text-sm leading-relaxed text-ink-3">{t("friends.none")}</p>
          ) : (
            <List>
              {friends.map((friend) => (
                <Row key={friend.friendshipId} className="flex items-center gap-1">
                  {/* The row opens their page; unfriending stays a separate
                      target beside it rather than inside the link. */}
                  <RowLink href={`/friends/${friend.username}`} className="min-w-0 flex-1">
                    <Avatar name={friend.name} username={friend.username} />
                    <PersonName name={friend.name} username={friend.username} className="flex-1">
                      {/* Points are what standings ranks by, so they are not
                          repeated here — this line is the training behind them. */}
                      <span className="mt-0.5 block truncate text-[13px] tabular-nums text-ink-3">
                        {friend.sessions === 1
                          ? t("friends.sessionsDoneOne")
                          : t("friends.sessionsDone", { count: friend.sessions })}
                        {friend.streakWeeks > 0 && (
                          <>
                            <span className="mx-1.5 text-ink-3/50">·</span>
                            {friend.streakWeeks === 1
                              ? t("friends.streakOne")
                              : t("friends.streak", { count: friend.streakWeeks })}
                          </>
                        )}
                      </span>
                    </PersonName>
                    <Chevron />
                  </RowLink>
                  <RemoveFriendButton friendshipId={friend.friendshipId} name={friend.name} />
                </Row>
              ))}
            </List>
          )}
        </Section>

        {outgoing.length > 0 && (
          <Section label={t("friends.outgoing")}>
            <List>
              {outgoing.map((request) => (
                <Row key={request.friendshipId}>
                  <div className="flex items-center gap-3 py-3.5">
                    <Avatar name={request.name} username={request.username} />
                    <PersonName
                      name={request.name}
                      username={request.username}
                      className="flex-1"
                    />
                    <WithdrawButton friendshipId={request.friendshipId} />
                  </div>
                </Row>
              ))}
            </List>
          </Section>
        )}

        <Section label={t("friends.add")}>
          <AddFriendForm />
          {/* Stated on the screen, not just in the code: people should know
              what they are agreeing to share before they agree to it. */}
          <p className="mt-5 text-xs leading-relaxed text-ink-3">{t("friends.privacy")}</p>
        </Section>
      </Screen>
    </>
  );
}


