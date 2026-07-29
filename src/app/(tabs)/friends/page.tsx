import {
  AddFriendForm,
  RemoveFriendButton,
  RequestActions,
  WithdrawButton,
} from "@/components/friend-controls";
import { Medal } from "@/components/medal";
import { List, Row, Screen, ScreenHeader, Section } from "@/components/ui";
import { createTranslator, formatDate, formatNumber } from "@/lib/i18n";
import { friendFeed, incomingRequests, listFriends, outgoingRequests } from "@/server/friends";
import { getUserContext } from "@/server/user";

export default async function FriendsPage() {
  const { userId, locale } = await getUserContext();
  const t = createTranslator(locale);

  const [feed, friends, incoming, outgoing] = await Promise.all([
    friendFeed(userId, locale),
    listFriends(userId),
    incomingRequests(userId),
    outgoingRequests(userId),
  ]);

  return (
    <>
      <ScreenHeader title={t("friends.title")} />

      <Screen>
        {/* Requests first when there are any: someone is waiting on an answer. */}
        {incoming.length > 0 && (
          <Section label={t("friends.incoming")}>
            <List>
              {incoming.map((request) => (
                <Row key={request.friendshipId}>
                  <div className="flex items-center gap-3 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {request.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                        @{request.username}
                      </span>
                    </span>
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
                  <div className="flex items-start gap-3 py-3.5">
                    {item.kind === "achievement" ? (
                      <Medal tier={item.tier} size="sm" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="mt-1 size-2 shrink-0 rounded-full bg-accent"
                      />
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
                  </div>
                </Row>
              ))}
            </List>
          )}
        </Section>

        <Section label={t("friends.yours")}>
          {friends.length === 0 ? (
            <p className="pb-4 text-sm leading-relaxed text-ink-3">{t("friends.none")}</p>
          ) : (
            <List>
              {friends.map((friend) => (
                <Row key={friend.friendshipId}>
                  <div className="flex items-start gap-3 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{friend.name}</span>
                      <span className="mt-0.5 block truncate text-[13px] tabular-nums text-ink-3">
                        {t("friends.points", { count: formatNumber(friend.points, locale) })}
                        <span className="mx-1.5 text-ink-3/50">·</span>
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
                    </span>
                    <RemoveFriendButton
                      friendshipId={friend.friendshipId}
                      name={friend.name}
                    />
                  </div>
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
                    <span className="min-w-0 flex-1 truncate text-[15px] text-ink-2">
                      @{request.username}
                    </span>
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
