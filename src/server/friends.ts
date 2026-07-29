import "server-only";

import { db } from "@/lib/db";
import { achievementFor, localizedAchievement, type Tier } from "@/lib/achievements/catalogue";
import { currentStreakWeeks } from "@/lib/achievements/evaluate";
import type { Locale } from "@/lib/types";

/**
 * Friends, and the feed of what they have been doing.
 *
 * **What a friend can see is deliberately narrow.** Training activity — the
 * sessions you finished and the medals you earned — and nothing from the
 * anamnesis. Bodyweight, injuries, sleep, stress, nutrition and caloric state
 * are health data that happens to live in the same database; they are not part
 * of "see their progress" and no query here selects them.
 *
 * Consent is mutual and explicit: a `Friendship` row does nothing until it is
 * accepted, so nobody's history becomes visible by someone else's action alone.
 */

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type Friend = {
  /** The row to delete when ending it — the UI has no other handle on it. */
  friendshipId: string;
  userId: string;
  username: string;
  name: string;
  points: number;
  medals: number;
  streakWeeks: number;
  sessions: number;
};

export type FriendRequest = {
  friendshipId: string;
  username: string;
  name: string;
  createdAt: Date;
};

export type FeedItem =
  | {
      kind: "session";
      at: Date;
      username: string;
      name: string;
      label: string;
      week: number;
      sets: number;
      tonnageKg: number;
    }
  | {
      kind: "achievement";
      at: Date;
      username: string;
      name: string;
      title: string;
      description: string;
      tier: Tier;
      points: number;
    };

/** Everyone who has accepted, in either direction, paired with their row id. */
async function acceptedEdges(userId: string): Promise<Map<string, string>> {
  const rows = await db.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { id: true, requesterId: true, addresseeId: true },
  });

  return new Map(
    rows.map((row) => [row.requesterId === userId ? row.addresseeId : row.requesterId, row.id]),
  );
}

/** Ids of everyone who has accepted, in either direction. */
export async function friendIds(userId: string): Promise<string[]> {
  return [...(await acceptedEdges(userId)).keys()];
}

/**
 * The friend list, with the numbers that make a comparison meaningful. Points
 * are summed from the unlock rows, the same way the athlete's own total is.
 */
export async function listFriends(userId: string): Promise<Friend[]> {
  const edges = await acceptedEdges(userId);
  const ids = [...edges.keys()];
  if (ids.length === 0) return [];

  const [users, achievements, sessions] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids } },
      // Explicit: never `include: { profile: true }` here.
      select: { id: true, username: true, name: true },
    }),
    db.userAchievement.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _sum: { points: true },
      _count: true,
    }),
    db.session.findMany({
      where: { status: "completed", mesocycle: { userId: { in: ids } } },
      select: { completedAt: true, mesocycle: { select: { userId: true } } },
    }),
  ]);

  const scores = new Map(achievements.map((row) => [row.userId, row]));

  const byUser = new Map<string, Date[]>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    const list = byUser.get(session.mesocycle.userId) ?? [];
    list.push(session.completedAt);
    byUser.set(session.mesocycle.userId, list);
  }

  return users
    .map((user) => {
      const dates = byUser.get(user.id) ?? [];
      return {
        friendshipId: edges.get(user.id)!,
        userId: user.id,
        username: user.username,
        name: user.name,
        points: scores.get(user.id)?._sum.points ?? 0,
        medals: scores.get(user.id)?._count ?? 0,
        streakWeeks: currentStreakWeeks(dates),
        sessions: dates.length,
      };
    })
    .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));
}

export async function incomingRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await db.friendship.findMany({
    where: { addresseeId: userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      requester: { select: { username: true, name: true } },
    },
  });

  return rows.map((row) => ({
    friendshipId: row.id,
    username: row.requester.username,
    name: row.requester.name,
    createdAt: row.createdAt,
  }));
}

export async function outgoingRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await db.friendship.findMany({
    where: { requesterId: userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      addressee: { select: { username: true, name: true } },
    },
  });

  return rows.map((row) => ({
    friendshipId: row.id,
    username: row.addressee.username,
    name: row.addressee.name,
    createdAt: row.createdAt,
  }));
}

/**
 * What friends have been doing lately.
 *
 * Derived from the training data rather than written to an events table: there
 * is nothing to backfill, nothing to keep in sync, and a session edited or
 * deleted stops being in the feed because it stops being true. Two reads merged
 * in memory is fine at this size, and the alternative — an append-only feed
 * that can disagree with the sessions it describes — is worse than a join.
 */
export async function friendFeed(
  userId: string,
  locale: Locale,
  limit = 30,
): Promise<FeedItem[]> {
  const ids = await friendIds(userId);
  if (ids.length === 0) return [];

  const [sessions, medals] = await Promise.all([
    db.session.findMany({
      where: { status: "completed", mesocycle: { userId: { in: ids } } },
      orderBy: { completedAt: "desc" },
      take: limit,
      select: {
        completedAt: true,
        label: true,
        week: true,
        mesocycle: { select: { user: { select: { username: true, name: true } } } },
        entries: { select: { sets: { select: { weightKg: true, reps: true, completed: true } } } },
      },
    }),
    db.userAchievement.findMany({
      where: { userId: { in: ids } },
      orderBy: { unlockedAt: "desc" },
      take: limit,
      select: {
        key: true,
        points: true,
        unlockedAt: true,
        user: { select: { username: true, name: true } },
      },
    }),
  ]);

  const items: FeedItem[] = [];

  for (const session of sessions) {
    if (!session.completedAt) continue;

    let sets = 0;
    let tonnageKg = 0;
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (!set.completed || set.weightKg === null || set.reps === null) continue;
        sets += 1;
        tonnageKg += set.weightKg * set.reps;
      }
    }

    items.push({
      kind: "session",
      at: session.completedAt,
      username: session.mesocycle.user.username,
      name: session.mesocycle.user.name,
      label: session.label,
      week: session.week,
      sets,
      tonnageKg: Math.round(tonnageKg),
    });
  }

  for (const medal of medals) {
    const achievement = achievementFor(medal.key);
    if (!achievement) continue;
    const text = localizedAchievement(achievement, locale);

    items.push({
      kind: "achievement",
      at: medal.unlockedAt,
      username: medal.user.username,
      name: medal.user.name,
      title: text.name,
      description: text.description,
      tier: achievement.tier,
      points: medal.points,
    });
  }

  return items.sort((a, b) => +b.at - +a.at).slice(0, limit);
}

/**
 * How the signed-in athlete stands relative to someone else. Used to decide
 * which button to show, and to stop a second request being created for a pair
 * that already has a row in either direction.
 */
export async function relationshipWith(
  userId: string,
  otherId: string,
): Promise<{ id: string; status: FriendshipStatus; outgoing: boolean } | null> {
  const row = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: userId },
      ],
    },
    select: { id: true, status: true, requesterId: true },
  });

  if (!row) return null;
  return {
    id: row.id,
    status: row.status as FriendshipStatus,
    outgoing: row.requesterId === userId,
  };
}
