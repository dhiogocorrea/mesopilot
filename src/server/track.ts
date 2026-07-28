import "server-only";

import { db } from "@/lib/db";

/**
 * A track is a macrocycle: several blocks meant to be run back to back.
 *
 * A mesocycle records the track it came from and its *position* in it, rather
 * than pointing at the entry row — re-importing a program rebuilds its entries,
 * which would orphan a foreign key mid-track. An index survives that; the worst
 * case is a track that got shorter, handled by `nextTrackStep` returning null.
 */

/**
 * Entries carry only the template id: the picker already loads every template
 * with its days and slots, so re-fetching them nested here would read the same
 * rows a second time.
 */
export async function listTracks(userId: string) {
  return db.programTrack.findMany({
    where: { OR: [{ isCustom: false }, { userId }] },
    orderBy: [{ isCustom: "asc" }, { nameEn: "asc" }],
    include: {
      entries: {
        orderBy: { order: "asc" },
        select: { order: true, templateId: true },
      },
    },
  });
}

export type TrackWithEntries = Awaited<ReturnType<typeof listTracks>>[number];

/** Both locales come back raw; the page localizes with `localized()`. */
type Named = { nameEn: string; namePt: string };

export type TrackContext = {
  trackId: string;
  track: Named;
  /** 1-based, for display: "block 2 of 4". */
  step: number;
  total: number;
  /** The step to start next, absent on the last block. */
  next: (Named & { position: number }) | null;
};

/**
 * Where a block sits in its track. Null when it isn't part of one, which is
 * every block created before tracks existed and every one-off since.
 */
export async function trackContextFor(
  trackId: string | null,
  trackPosition: number | null,
): Promise<TrackContext | null> {
  if (!trackId || trackPosition === null) return null;

  const track = await db.programTrack.findUnique({
    where: { id: trackId },
    include: { entries: { orderBy: { order: "asc" }, include: { template: true } } },
  });
  if (!track) return null;

  const index = track.entries.findIndex((entry) => entry.order === trackPosition);
  const following = index >= 0 ? track.entries[index + 1] : undefined;

  return {
    trackId: track.id,
    track: { nameEn: track.nameEn, namePt: track.namePt },
    step: (index >= 0 ? index : trackPosition) + 1,
    total: track.entries.length,
    next: following
      ? {
          position: following.order,
          nameEn: following.template.nameEn,
          namePt: following.template.namePt,
        }
      : null,
  };
}
