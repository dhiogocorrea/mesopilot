import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { estimateSessionMinutes } from "../training-time";
import { JOINT_PAIN, PUMP, SORENESS, WORKLOAD, type PartialFeedback } from "../types";
import { allocateSets, type AllocatableExercise } from "./allocate";
import type { RecoveryContext, VolumeLandmarks } from "./engine";

const LANDMARKS: VolumeLandmarks = { mev: 8, mav: 16, mrv: 22 };

const GOOD_RECOVERY: RecoveryContext = {
  sleepQuality: 4,
  stressLevel: 2,
  nutritionQuality: 4,
  caloricState: "maintenance",
};

/** Recovered, poor pump, felt easy — the answer that earns the most volume. */
const WANTS_MORE: PartialFeedback = {
  soreness: SORENESS.NEVER_SORE,
  pump: PUMP.LOW,
  workload: WORKLOAD.EASY,
  jointPain: JOINT_PAIN.NONE,
};

const TOO_MUCH: PartialFeedback = {
  soreness: SORENESS.STILL_SORE,
  pump: PUMP.MODERATE,
  workload: WORKLOAD.TOO_MUCH,
  jointPain: JOINT_PAIN.NONE,
};

function back(
  count: number,
  sets: number,
  options: { restSec?: number; sfr?: number[] } = {},
): AllocatableExercise[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `ex${index}`,
    muscleGroupId: "back",
    currentSets: sets,
    restSec: options.restSec ?? 120,
    sfr: options.sfr?.[index] ?? 3,
  }));
}

const totalSets = (exercises: AllocatableExercise[], allocation: ReturnType<typeof allocateSets>) =>
  exercises.reduce((sum, e) => sum + allocation.byKey.get(e.key)!.sets, 0);

describe("allocateSets — the muscle is the unit, not the exercise", () => {
  it("spends the muscle's weekly budget once, however many exercises train it", () => {
    // The regression this file exists for. Five back movements, the muscle two
    // sets under its ceiling. Asked per exercise, each saw room for one more
    // and the muscle finished at 25 of a 22-set MRV.
    const exercises = back(5, 4);
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 20, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 0,
    });

    const added = totalSets(exercises, allocation) - 5 * 4;
    assert.equal(added, 1, "one set for the muscle, not one set each");
    assert.ok(20 + added <= LANDMARKS.mrv, "weekly volume stays under MRV");
  });

  it("never exceeds MRV and calls for the deload when it lands on it", () => {
    const exercises = back(4, 5);
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 21, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 0,
    });

    assert.equal(totalSets(exercises, allocation) - 4 * 5, 1, "only the set that fits");
    assert.ok(allocation.suggestDeload);
  });

  it("gives the set to the better movement first", () => {
    const exercises = back(3, 3, { sfr: [2, 5, 3] });
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 21, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 0,
    });

    assert.equal(allocation.byKey.get("ex1")!.delta, 1, "sfr 5 takes it");
    assert.equal(allocation.byKey.get("ex0")!.delta, 0, "sfr 2 does not");
  });

  it("spreads a two-set budget rather than piling it on one lift", () => {
    // The worry that started this: one exercise creeping to five, six, seven
    // sets while its neighbours stay at three.
    const exercises = back(4, 3, { sfr: [5, 4, 3, 2] });
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 12, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 0,
    });

    const deltas = exercises.map((e) => allocation.byKey.get(e.key)!.delta);
    assert.deepEqual(deltas, [1, 1, 0, 0], "one each to the two best, not two to the best");
  });

  it("tells a movement that got nothing why", () => {
    const exercises = back(3, 3, { sfr: [5, 3, 3] });
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 21, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 0,
    });

    const passedOver = allocation.byKey.get("ex1")!;
    assert.equal(passedOver.delta, 0);
    assert.ok(passedOver.reasons.some((r) => r.code === "volume_went_elsewhere"));
  });

  it("cuts the worst movement first", () => {
    const exercises = back(3, 4, { sfr: [5, 4, 1] });
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 12, landmarks: LANDMARKS, feedback: TOO_MUCH },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 0,
    });

    assert.equal(allocation.byKey.get("ex2")!.delta, -1, "sfr 1 gives the set back");
    assert.equal(allocation.byKey.get("ex0")!.delta, 0, "sfr 5 keeps its work");
  });
});

describe("allocateSets — the clock", () => {
  it("refuses growth that would run past the session budget", () => {
    // 4 x 3 sets on 180s rest is 50 minutes; the athlete said they have 50.
    const exercises = back(4, 3, { restSec: 180 });
    const budget = estimateSessionMinutes(
      exercises.map((e) => ({ sets: e.currentSets, restSec: e.restSec })),
    );
    assert.equal(budget, 50, "fixture sanity");

    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 12, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: budget,
    });

    assert.equal(totalSets(exercises, allocation), 12, "no growth at all");
    assert.ok(allocation.setsWithheldForTime > 0);
    assert.ok(allocation.estimatedMinutes <= budget);

    const capped = exercises
      .map((e) => allocation.byKey.get(e.key)!)
      .filter((a) => a.reasons.some((r) => r.code === "time_capped"));
    assert.ok(capped.length > 0, "the athlete is told the clock stopped it, not their recovery");
  });

  it("lets volume grow when there is room in the session", () => {
    const exercises = back(4, 3, { restSec: 180 });
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 12, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 90,
    });

    assert.equal(totalSets(exercises, allocation) - 12, 2, "recovery decides when time is not tight");
    assert.equal(allocation.setsWithheldForTime, 0);
  });

  it("never cuts work the athlete was already doing to fit the clock", () => {
    // Their chosen program already runs long. That is the program they picked;
    // shortening it here would be a silent edit, not a constraint.
    const exercises = back(4, 6, { restSec: 180 });
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 24, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 30,
    });

    assert.equal(totalSets(exercises, allocation), 24, "held, never reduced");
    assert.ok(allocation.estimatedMinutes > 30, "the session is honestly reported as long");
  });
});

describe("allocateSets — carried-over entries", () => {
  it("leaves a skipped entry alone but still counts its time", () => {
    const exercises: AllocatableExercise[] = [
      ...back(2, 3, { restSec: 120 }),
      { key: "skipped", muscleGroupId: "back", currentSets: 4, restSec: 120, sfr: 5, frozen: true },
    ];

    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 12, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 0,
    });

    assert.equal(allocation.byKey.get("skipped")!.delta, 0, "untouched despite the best sfr");
    assert.equal(
      allocation.estimatedMinutes,
      estimateSessionMinutes([
        { sets: 4, restSec: 120 },
        { sets: 4, restSec: 120 },
        { sets: 4, restSec: 120 },
      ]),
      "its sets still cost the session time",
    );
  });

  it("respects a high-set protocol's own ceiling", () => {
    // German Volume Training starts above the usual per-exercise cap and must
    // not be quietly progressed down to it.
    const exercises = back(1, 10);
    const allocation = allocateSets({
      exercises,
      muscles: [
        { muscleGroupId: "back", weeklyVolume: 10, landmarks: LANDMARKS, feedback: WANTS_MORE },
      ],
      recovery: GOOD_RECOVERY,
      budgetMinutes: 0,
    });

    assert.equal(allocation.byKey.get("ex0")!.sets, 10, "capped, not reduced");
  });
});
