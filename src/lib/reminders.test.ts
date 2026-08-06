import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { abandonedCutoffs, hasLapsed, streakAtRisk } from "./reminders";

/**
 * The rules that decide whether to interrupt someone. Every case here is one
 * where sending would be wrong — a warning to somebody who already trained, a
 * "start something" to somebody mid-block — because those are the mistakes that
 * get notifications switched off, and they are invisible until they happen to a
 * real athlete on a real Saturday.
 */

/** Monday 2026-08-03 … Sunday 2026-08-09, at noon UTC. */
const monday = new Date("2026-08-03T12:00:00Z");
const friday = new Date("2026-08-07T12:00:00Z");
const saturday = new Date("2026-08-08T12:00:00Z");

/** A session in each of the N weeks *before* the week containing `friday`. */
function weeklyRun(count: number): Date[] {
  return Array.from(
    { length: count },
    (_, index) => new Date(friday.getTime() - (index + 1) * 7 * 86_400_000),
  );
}

describe("streakAtRisk", () => {
  it("warns late in the week when a real streak has nothing in it yet", () => {
    assert.equal(streakAtRisk(weeklyRun(4), saturday, "UTC"), 4);
  });

  it("says nothing before the week is nearly gone", () => {
    // Same athlete, same untouched week — on Monday there is a whole week left
    // and a warning would be noise.
    assert.equal(streakAtRisk(weeklyRun(4), monday, "UTC"), null);
  });

  it("says nothing to someone who already trained this week", () => {
    const trainedTuesday = [new Date("2026-08-04T18:00:00Z"), ...weeklyRun(4)];
    assert.equal(streakAtRisk(trainedTuesday, saturday, "UTC"), null, "their streak is safe");
  });

  it("says nothing once the streak has already gone", () => {
    // Last session two weeks back: the week between them is empty, so it broke
    // before today and there is nothing left to save.
    const stale = weeklyRun(3).map((date) => new Date(date.getTime() - 7 * 86_400_000));
    assert.equal(streakAtRisk(stale, saturday, "UTC"), null);
  });

  it("does not call a single week a streak", () => {
    assert.equal(streakAtRisk(weeklyRun(1), saturday, "UTC"), null);
  });

  it("has nothing to say to someone who has never trained", () => {
    assert.equal(streakAtRisk([], saturday, "UTC"), null);
  });

  it("uses the athlete's week, not the server's", () => {
    // 22:00 UTC on Thursday is already Friday in Tokyo. The Tokyo athlete is
    // late in their week and worth warning; the UTC one is not.
    const thursdayNight = new Date("2026-08-06T22:00:00Z");
    const history = weeklyRun(3);

    assert.equal(streakAtRisk(history, thursdayNight, "UTC"), null);
    assert.equal(streakAtRisk(history, thursdayNight, "Asia/Tokyo"), 3);
  });
});

describe("hasLapsed", () => {
  const now = new Date("2026-08-05T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("leaves anyone with a block running alone", () => {
    // Mid-block and resting is not lapsed, however long the gap.
    assert.equal(hasLapsed(true, daysAgo(30), daysAgo(90), now), false);
  });

  it("nudges someone with no block and nothing logged for a while", () => {
    assert.equal(hasLapsed(false, daysAgo(14), daysAgo(90), now), true);
  });

  it("waits out a short gap", () => {
    assert.equal(hasLapsed(false, daysAgo(3), daysAgo(90), now), false);
  });

  it("counts from sign-up for an account that never trained", () => {
    assert.equal(hasLapsed(false, null, daysAgo(30), now), true);
    // …but does not pounce on somebody who joined yesterday.
    assert.equal(hasLapsed(false, null, daysAgo(1), now), false);
  });
});

describe("abandonedCutoffs", () => {
  const now = new Date("2026-08-05T12:00:00Z");

  it("skips a session that is merely still running", () => {
    const { after } = abandonedCutoffs(now);
    const startedAnHourAgo = new Date(now.getTime() - 3_600_000);
    assert.ok(startedAnHourAgo > after, "an hour in is a workout, not an abandoned one");
  });

  it("catches one left open for hours", () => {
    const { after, until } = abandonedCutoffs(now);
    const startedThisMorning = new Date(now.getTime() - 6 * 3_600_000);
    assert.ok(startedThisMorning < after && startedThisMorning > until);
  });

  it("gives up on one from days ago rather than inviting stale logging", () => {
    const { until } = abandonedCutoffs(now);
    const lastWeek = new Date(now.getTime() - 5 * 86_400_000);
    assert.ok(lastWeek < until, "past the window — reopening it later is the honest path");
  });
});
