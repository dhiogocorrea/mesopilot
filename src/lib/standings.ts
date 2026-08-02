/**
 * The shape of a leaderboard and how it is ordered. Pure, and deliberately not
 * in `src/server/friends.ts`: the toggle between windows happens on the device,
 * so the client imports this — and `server-only` would drag Prisma into the
 * browser bundle behind it.
 */

export const RANK_PERIODS = ["month", "all"] as const;
export type RankPeriod = (typeof RANK_PERIODS)[number];

export type RankTotals = {
  points: number;
  medals: number;
  /** Completed sessions in the same window — what the points came out of. */
  sessions: number;
};

export type LeaderboardRow = {
  userId: string;
  username: string;
  name: string;
  /** The signed-in athlete's own row, so the UI can mark it. */
  you: boolean;
} & Record<RankPeriod, RankTotals>;

/**
 * Ranked for one window.
 *
 * Sessions break the ties, and they do a lot of work: medals are milestones, so
 * a month where nobody crosses one would otherwise rank everyone equal and fall
 * back to alphabetical. Ordering those rows by training done is what the board
 * was being asked anyway.
 */
export function rankBy(rows: LeaderboardRow[], period: RankPeriod): LeaderboardRow[] {
  return [...rows].sort(
    (a, b) =>
      b[period].points - a[period].points ||
      b[period].sessions - a[period].sessions ||
      a.username.localeCompare(b.username),
  );
}
