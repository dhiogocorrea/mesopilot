import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { JOINT_PAIN, PUMP, SORENESS, WORKLOAD } from "../types";
import {
  decideLoad,
  decideSets,
  deloadSets,
  isDeloadWeek,
  prescribe,
  rirForWeek,
  startRirFor,
  type RecoveryContext,
  type VolumeLandmarks,
} from "./engine";

const LANDMARKS: VolumeLandmarks = { mev: 8, mav: 16, mrv: 22 };

const GOOD_RECOVERY: RecoveryContext = {
  sleepQuality: 4,
  stressLevel: 2,
  nutritionQuality: 4,
  caloricState: "maintenance",
};

const POOR_RECOVERY: RecoveryContext = {
  sleepQuality: 2,
  stressLevel: 4,
  nutritionQuality: 2,
  caloricState: "deficit",
};

describe("rirForWeek", () => {
  it("ramps 3->0 across a 5 week mesocycle", () => {
    const rirs = [1, 2, 3, 4].map((week) => rirForWeek(week, 5, 3));
    assert.deepEqual(rirs, [3, 2, 1, 0]);
  });

  it("ramps smoothly across a 6 week mesocycle", () => {
    const rirs = [1, 2, 3, 4, 5].map((week) => rirForWeek(week, 6, 3));
    assert.deepEqual(rirs, [3, 2, 2, 1, 0]);
  });

  it("backs off during the deload week", () => {
    assert.equal(rirForWeek(5, 5, 3), 4);
    assert.ok(isDeloadWeek(5, 5));
    assert.ok(!isDeloadWeek(4, 5));
  });

  it("starts advanced lifters closer to failure", () => {
    assert.equal(startRirFor("advanced"), 2);
    assert.equal(startRirFor("intermediate"), 3);
    assert.equal(rirForWeek(1, 5, startRirFor("advanced")), 2);
  });
});

describe("decideSets", () => {
  const base = {
    currentSets: 3,
    weeklyVolume: 12,
    landmarks: LANDMARKS,
    recovery: GOOD_RECOVERY,
  };

  it("adds sets when recovery is complete and stimulus was weak", () => {
    const result = decideSets({
      ...base,
      feedback: {
        soreness: SORENESS.NEVER_SORE,
        pump: PUMP.LOW,
        workload: WORKLOAD.EASY,
        jointPain: JOINT_PAIN.NONE,
      },
    });
    assert.equal(result.delta, 2, "capped at two sets per session");
    assert.equal(result.sets, 5);
  });

  it("holds when the dose is already well matched", () => {
    const result = decideSets({
      ...base,
      feedback: {
        soreness: SORENESS.HEALED_JUST_ON_TIME,
        pump: PUMP.AMAZING,
        workload: WORKLOAD.PUSHED_LIMITS,
        jointPain: JOINT_PAIN.NONE,
      },
    });
    assert.equal(result.delta, 0);
    assert.equal(result.sets, 3);
  });

  it("cuts a set when still sore and the workload was too much", () => {
    const result = decideSets({
      ...base,
      feedback: {
        soreness: SORENESS.STILL_SORE,
        pump: PUMP.MODERATE,
        workload: WORKLOAD.TOO_MUCH,
        jointPain: JOINT_PAIN.NONE,
      },
    });
    assert.equal(result.delta, -1);
    assert.equal(result.sets, 2);
  });

  it("caps the jump when life outside the gym is not supporting recovery", () => {
    const feedback = {
      soreness: SORENESS.NEVER_SORE,
      pump: PUMP.LOW,
      workload: WORKLOAD.EASY,
      jointPain: JOINT_PAIN.NONE,
    };
    const rested = decideSets({ ...base, feedback });
    const depleted = decideSets({ ...base, feedback, recovery: POOR_RECOVERY });

    assert.equal(rested.delta, 2);
    assert.equal(depleted.delta, 1);
    assert.ok(depleted.reasons.some((r) => r.code === "recovery_context_poor"));
  });

  it("never adds past maximum recoverable volume and calls for a deload", () => {
    const result = decideSets({
      ...base,
      weeklyVolume: 21,
      feedback: {
        soreness: SORENESS.NEVER_SORE,
        pump: PUMP.LOW,
        workload: WORKLOAD.EASY,
        jointPain: JOINT_PAIN.NONE,
      },
    });
    assert.equal(result.delta, 1, "only the one set that fits under MRV");
    assert.ok(result.suggestDeload);
  });

  it("flags an exercise swap on serious joint pain and cuts volume", () => {
    const result = decideSets({
      ...base,
      feedback: {
        soreness: SORENESS.NEVER_SORE,
        pump: PUMP.LOW,
        workload: WORKLOAD.EASY,
        jointPain: JOINT_PAIN.A_LOT,
      },
    });
    assert.equal(result.delta, -1);
    assert.ok(result.suggestSwap);
  });

  it("holds instead of cutting below the minimum effective volume", () => {
    const result = decideSets({
      ...base,
      currentSets: 2,
      weeklyVolume: 5,
      feedback: {
        soreness: SORENESS.STILL_SORE,
        pump: PUMP.MODERATE,
        workload: WORKLOAD.TOO_MUCH,
        jointPain: JOINT_PAIN.NONE,
      },
    });
    assert.equal(result.delta, 0);
    assert.ok(result.reasons.some((r) => r.code === "below_mev"));
  });

  it("holds a high-set protocol at its starting volume instead of cutting it", () => {
    // German Volume Training starts at 10 sets, above the usual ceiling. The
    // engine must not "progress" that down to 8.
    const feedback = {
      soreness: SORENESS.NEVER_SORE,
      pump: PUMP.LOW,
      workload: WORKLOAD.EASY,
      jointPain: JOINT_PAIN.NONE,
    };
    const grow = decideSets({ ...base, currentSets: 10, weeklyVolume: 20, feedback });
    assert.equal(grow.sets, 10, "capped, not reduced");
    assert.equal(grow.delta, 0);

    // A genuine cut still applies.
    const cut = decideSets({
      ...base,
      currentSets: 10,
      weeklyVolume: 20,
      feedback: { ...feedback, soreness: SORENESS.STILL_SORE, workload: WORKLOAD.TOO_MUCH },
    });
    assert.equal(cut.sets, 9);
  });

  it("leaves the prescription alone when no feedback was given", () => {
    const result = decideSets({ ...base, feedback: {} });
    assert.equal(result.delta, 0);
    assert.deepEqual(result.reasons, [{ code: "no_feedback" }]);
  });
});

describe("decideLoad", () => {
  const base = {
    repMin: 8,
    repMax: 12,
    nextTargetRir: 2,
    movementType: "compound" as const,
    isLowerBody: false,
    unit: "kg" as const,
  };

  it("raises the load once the rep target is beaten at the new RIR", () => {
    // 12 reps at 3 RIR projects to 13 at 2 RIR — past the top of the range.
    const result = decideLoad({
      ...base,
      lastSets: [{ weightKg: 60, reps: 12, rir: 3 }],
    });
    assert.ok(result.weightKg !== null && result.weightKg > 60);
    assert.equal(result.weightKg, 62.5, "rounded onto a loadable increment");
    assert.equal(result.reasons[0].code, "load_increase");
  });

  it("holds the load while there are still reps to gain in range", () => {
    const result = decideLoad({
      ...base,
      lastSets: [{ weightKg: 60, reps: 9, rir: 2 }],
    });
    assert.equal(result.weightKg, 60);
    assert.equal(result.deltaPct, 0);
    assert.equal(result.reasons[0].code, "load_hold");
  });

  it("drops the load when the rep range was missed", () => {
    const result = decideLoad({
      ...base,
      lastSets: [{ weightKg: 100, reps: 6, rir: 0 }],
    });
    assert.ok(result.weightKg !== null && result.weightKg < 100);
    assert.equal(result.reasons[0].code, "load_decrease");
  });

  it("moves lower body compounds in bigger jumps than isolation work", () => {
    const sets = [{ weightKg: 100, reps: 12, rir: 3 }];
    const squat = decideLoad({ ...base, lastSets: sets, isLowerBody: true });
    const curl = decideLoad({ ...base, lastSets: sets, movementType: "isolation" });

    assert.ok(squat.weightKg !== null && curl.weightKg !== null);
    assert.ok(squat.weightKg > curl.weightKg);
  });

  it("anchors to the heaviest working set", () => {
    const result = decideLoad({
      ...base,
      lastSets: [
        { weightKg: 60, reps: 12, rir: 3 },
        { weightKg: 70, reps: 12, rir: 3 },
        { weightKg: 65, reps: 10, rir: 1 },
      ],
    });
    assert.ok(result.weightKg !== null && result.weightKg > 70);
  });

  it("asks the user to choose when there is no history", () => {
    const result = decideLoad({ ...base, lastSets: [] });
    assert.equal(result.weightKg, null);
    assert.equal(result.reasons[0].code, "no_history");
  });

  it("always moves by at least one loadable increment", () => {
    const result = decideLoad({
      ...base,
      lastSets: [{ weightKg: 20, reps: 12, rir: 3 }],
      movementType: "isolation",
    });
    // 2.5% of 20kg is 0.5kg, which no gym can load.
    assert.equal(result.weightKg, 22.5);
  });
});

describe("prescribe", () => {
  const base = {
    totalWeeks: 5,
    startRir: 3,
    currentSets: 3,
    repMin: 8,
    repMax: 12,
    weeklyVolume: 12,
    landmarks: LANDMARKS,
    recovery: GOOD_RECOVERY,
    movementType: "compound" as const,
    isLowerBody: false,
    unit: "kg" as const,
  };

  it("combines set and load decisions for a normal week", () => {
    const result = prescribe({
      ...base,
      week: 2,
      feedback: {
        soreness: SORENESS.NEVER_SORE,
        pump: PUMP.LOW,
        workload: WORKLOAD.EASY,
        jointPain: JOINT_PAIN.NONE,
      },
      lastSets: [{ weightKg: 60, reps: 12, rir: 3 }],
    });

    assert.equal(result.targetRir, 2);
    assert.equal(result.sets, 5);
    assert.equal(result.weightKg, 62.5);
    assert.equal(result.isDeload, false);
    assert.ok(result.reasons.length > 1);
  });

  it("halves volume and load on the deload week regardless of feedback", () => {
    const result = prescribe({
      ...base,
      week: 5,
      currentSets: 5,
      feedback: {
        soreness: SORENESS.NEVER_SORE,
        pump: PUMP.LOW,
        workload: WORKLOAD.EASY,
        jointPain: JOINT_PAIN.NONE,
      },
      lastSets: [{ weightKg: 100, reps: 12, rir: 0 }],
    });

    assert.ok(result.isDeload);
    assert.equal(result.sets, 3, "5 sets halved and rounded up");
    assert.equal(result.weightKg, 60);
    assert.equal(result.targetRir, 4);
    assert.deepEqual(result.reasons, [{ code: "deload_week" }]);
  });

  it("deloadSets never drops below a single working set", () => {
    assert.equal(deloadSets(1), 1);
    assert.equal(deloadSets(2), 1);
    assert.equal(deloadSets(4), 2);
  });
});
