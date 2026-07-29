"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { relationshipWith } from "./friends";
import { getUserContext } from "./user";

/**
 * Friend requests. Every one of these is a public endpoint that names another
 * account, so each checks that the signed-in athlete is actually a party to the
 * row it touches — an id from the client says nothing about whose it is.
 *
 * Errors come back as dictionary keys, not sentences: this screen is reachable
 * in either language.
 */

export type FriendError =
  | "friends.errNotFound"
  | "friends.errSelf"
  | "friends.errAlready"
  | "friends.errPending"
  | "friends.errDeclined";

export type FriendResult = { error: FriendError } | { ok: true } | undefined;

const usernameInput = z.string().trim().min(1).max(32);

export async function sendFriendRequest(
  _previous: FriendResult,
  formData: FormData,
): Promise<FriendResult> {
  const parsed = usernameInput.safeParse(formData.get("username"));
  if (!parsed.success) return { error: "friends.errNotFound" };

  const { userId } = await getUserContext();

  const target = await db.user.findUnique({
    where: { usernameLower: parsed.data.toLowerCase() },
    select: { id: true },
  });

  // Same answer for "no such account" as for anything else that fails to
  // resolve, so this cannot be used to enumerate who has signed up.
  if (!target) return { error: "friends.errNotFound" };
  if (target.id === userId) return { error: "friends.errSelf" };

  const existing = await relationshipWith(userId, target.id);
  if (existing?.status === "accepted") return { error: "friends.errAlready" };
  if (existing?.status === "pending") return { error: "friends.errPending" };
  // A "no" stays a no until the person who said it changes their mind, which
  // is not something the asker gets to do from here.
  if (existing?.status === "declined") return { error: "friends.errDeclined" };

  await db.friendship.create({ data: { requesterId: userId, addresseeId: target.id } });

  revalidatePath("/friends");
  return { ok: true };
}

const respondSchema = z.object({
  friendshipId: z.string().min(1),
  accept: z.boolean(),
});

export async function respondToFriendRequest(
  input: z.infer<typeof respondSchema>,
): Promise<void> {
  const data = respondSchema.parse(input);
  const { userId } = await getUserContext();

  // Only the person who was asked may answer, and only while it is pending.
  const updated = await db.friendship.updateMany({
    where: { id: data.friendshipId, addresseeId: userId, status: "pending" },
    data: {
      status: data.accept ? "accepted" : "declined",
      respondedAt: new Date(),
    },
  });

  if (updated.count === 0) throw new Error("Not found");

  revalidatePath("/friends");
  revalidatePath("/progress");
}

/** Withdrawing a request you sent, before it is answered. */
export async function cancelFriendRequest(friendshipId: string): Promise<void> {
  const id = z.string().min(1).parse(friendshipId);
  const { userId } = await getUserContext();

  await db.friendship.deleteMany({
    where: { id, requesterId: userId, status: "pending" },
  });

  revalidatePath("/friends");
}

/**
 * Either party can end a friendship, and the row goes entirely — unlike a
 * decline, this is not a "no" that needs remembering, and it should leave them
 * free to connect again later.
 */
export async function removeFriend(friendshipId: string): Promise<void> {
  const id = z.string().min(1).parse(friendshipId);
  const { userId } = await getUserContext();

  await db.friendship.deleteMany({
    where: {
      id,
      status: "accepted",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });

  revalidatePath("/friends");
  revalidatePath("/progress");
}
