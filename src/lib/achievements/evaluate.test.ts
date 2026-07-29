import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ACHIEVEMENTS, METRICS, achievementFor } from "./catalogue";
import { currentStreakWeeks, evaluate, progressToward, type AthleteStats } from "./evaluate";

const ZERO: AthleteStats = {
  sessions: 0,
  blocks: 0,
  perfectBlocks: 0,
  tonnageKg: 0,
  streakWeeks: 0,
  exercises: 0,
};

function stats(overrides: Partial<AthleteStats>): AthleteStats {
  return { ...ZERO, ...overrides };
}

describe("catalogue", () => {
  it("has unique keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("only uses known metrics", () => {
    for (const achievement of ACHIEVEMENTS) {
      assert.ok(METRICS.includes(achievement.metric), `${achievement.key}: ${achievement.metric}`);
    }
  });

  it("covers every metric, so none is unreachable", () => {
    const used = new Set(ACHIEVEMENTS.map((a) => a.metric));
    for (const metric of METRICS) assert.ok(used.has(metric), `no achievement for ${metric}`);
  });

  it("ascends in threshold and never decreases in points within a metric", () => {
    for (const metric of METRICS) {
      const tiers = ACHIEVEMENTS.filter((a) => a.metric === metric);
      for (let i = 1; i < tiers.length; i += 1) {
        assert.ok(
          tiers[i]!.threshold > tiers[i - 1]!.threshold,
          `${metric}: ${tiers[i]!.key} does not exceed ${tiers[i - 1]!.key}`,
        );
        assert.ok(
          tiers[i]!.points >= tiers[i - 1]!.points,
          `${metric}: ${tiers[i]!.key} is worth less than an easier tier`,
        );
      }
    }
  });

  it("is translated in both locales", () => {
    for (const achievement of ACHIEVEMENTS) {
      for (const locale of ["en", "pt"] as const) {
        assert.ok(achievement[locale].name.trim(), `${achievement.key}: missing ${locale} name`);
        assert.ok(
          achievement[locale].description.trim(),
          `${achievement.key}: missing ${locale} description`,
        );
      }
    }
  });

  it("looks up by key", () => {
    assert.equal(achievementFor("sessions_1")?.metric, "sessions");
    assert.equal(achievementFor("nope"), undefined);
  });
});

describe("evaluate", () => {
  it("awards nothing to a fresh athlete", () => {
    assert.deepEqual(evaluate(ZERO, new Set()), []);
  });

  it("awards a tier the moment its threshold is reached", () => {
    const awards = evaluate(stats({ sessions: 1 }), new Set());
    assert.deepEqual(
      awards.map((a) => a.key),
      ["sessions_1"],
    );
    assert.equal(awards[0]!.value, 1);
  });

  it("never re-awards what is already unlocked", () => {
    const awards = evaluate(stats({ sessions: 10 }), new Set(["sessions_1", "sessions_10"]));
    assert.deepEqual(awards, []);
  });

  it("awards every tier crossed at once", () => {
    // An imported history can clear several tiers in one go; dropping the
    // lower ones would leave a permanent hole in the collection.
    const awards = evaluate(stats({ sessions: 30 }), new Set());
    assert.deepEqual(
      awards.map((a) => a.key),
      ["sessions_1", "sessions_10", "sessions_25"],
    );
  });

  it("carries the catalogue's points onto the award", () => {
    const [award] = evaluate(stats({ blocks: 1 }), new Set());
    assert.equal(award!.points, achievementFor("blocks_1")!.points);
  });

  it("keeps metrics independent", () => {
    const awards = evaluate(stats({ tonnageKg: 30_000 }), new Set());
    assert.deepEqual(
      awards.map((a) => a.key),
      ["tonnage_25k"],
    );
  });
});

describe("progressToward", () => {
  it("is a fraction of the threshold, capped at 1", () => {
    const tenSessions = achievementFor("sessions_10")!;
    assert.equal(progressToward(tenSessions, stats({ sessions: 0 })), 0);
    assert.equal(progressToward(tenSessions, stats({ sessions: 5 })), 0.5);
    assert.equal(progressToward(tenSessions, stats({ sessions: 99 })), 1);
  });
});

describe("currentStreakWeeks", () => {
  const monday = (weeksAgo: number) => new Date(Date.UTC(2026, 0, 5 + weeksAgo * 7));

  it("is zero with no sessions", () => {
    assert.equal(currentStreakWeeks([]), 0);
  });

  it("counts one week for a single session", () => {
    assert.equal(currentStreakWeeks([monday(0)]), 1);
  });

  it("counts consecutive weeks", () => {
    assert.equal(currentStreakWeeks([monday(0), monday(1), monday(2)]), 3);
  });

  it("counts a week once however many sessions it holds", () => {
    const week = [monday(0), new Date(Date.UTC(2026, 0, 7)), new Date(Date.UTC(2026, 0, 9))];
    assert.equal(currentStreakWeeks(week), 1);
  });

  it("stops at a missed week", () => {
    assert.equal(currentStreakWeeks([monday(0), monday(1), monday(3), monday(4)]), 2);
  });

  it("measures back from the latest session, not from today", () => {
    // Trained Monday, opens the app on Sunday: still a streak, not a break.
    const old = [monday(0), monday(1)];
    assert.equal(currentStreakWeeks(old), 2);
  });

  it("does not care about input order", () => {
    assert.equal(currentStreakWeeks([monday(2), monday(0), monday(1)]), 3);
  });

  it("treats Sunday as the end of its week, not the start of the next", () => {
    const mondayStart = new Date(Date.UTC(2026, 0, 5));
    const sundayEnd = new Date(Date.UTC(2026, 0, 11));
    assert.equal(currentStreakWeeks([mondayStart, sundayEnd]), 1);
  });
});
