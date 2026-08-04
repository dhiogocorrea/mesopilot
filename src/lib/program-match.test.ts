import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  matchProgram,
  rankPrograms,
  type ProgramFacts,
  type TrainingPreferences,
} from "./program-match";

const PREFS: TrainingPreferences = {
  daysPerWeek: 4,
  sessionMinutes: 60,
  experience: "intermediate",
  goal: "hypertrophy",
};

function program(overrides: Partial<ProgramFacts> = {}): ProgramFacts {
  const base = {
    daysPerWeek: 4,
    estimatedMinutes: 60,
    level: "intermediate" as const,
    goal: "hypertrophy" as const,
    ...overrides,
  };
  // A program that never grows is the simplest case, so unless a test says
  // otherwise the peak is the opening length.
  return { ...base, peakMinutes: overrides.peakMinutes ?? base.estimatedMinutes };
}

describe("matchProgram", () => {
  it("judges the time budget on where the program ends up, not where it starts", () => {
    // The trap this replaced: a block opening at 40 minutes against an hour
    // looks like a comfortable fit, and is — for one week. The engine then
    // grows it to 85 and the athlete has already committed to the block.
    const grows = program({ estimatedMinutes: 40, peakMinutes: 85 });

    assert.equal(grows.estimatedMinutes < PREFS.sessionMinutes, true, "week one fits");
    assert.equal(matchProgram(grows, PREFS).fits, false, "the block does not");
    assert.equal(matchProgram(grows, PREFS).minuteDelta, 25);

    // One that genuinely stays inside the hour still matches.
    assert.equal(matchProgram(program({ estimatedMinutes: 40, peakMinutes: 58 }), PREFS).fits, true);
  });

  it("scores a perfect match on every factor", () => {
    const match = matchProgram(program(), PREFS);
    assert.equal(match.score, 100);
    assert.ok(match.fits);
    assert.deepEqual([...match.matched].sort(), ["days", "goal", "level", "time"]);
  });

  it("only fits when both hard constraints hold", () => {
    assert.ok(matchProgram(program(), PREFS).fits);
    assert.equal(matchProgram(program({ daysPerWeek: 5 }), PREFS).fits, false);
    assert.equal(matchProgram(program({ estimatedMinutes: 80 }), PREFS).fits, false);
  });

  it("reports how far off it is so the UI can say why", () => {
    const match = matchProgram(program({ daysPerWeek: 6, estimatedMinutes: 90 }), PREFS);
    assert.equal(match.dayDelta, 2);
    assert.equal(match.minuteDelta, 30);
  });

  it("tolerates a few minutes over the stated budget", () => {
    // Nobody's session slot is precise to the minute.
    const match = matchProgram(program({ estimatedMinutes: 65 }), PREFS);
    assert.ok(match.fits);
    assert.ok(match.matched.includes("time"));
  });

  it("counts a shorter program as fitting the time budget", () => {
    const match = matchProgram(program({ estimatedMinutes: 30 }), PREFS);
    assert.ok(match.fits);
    assert.equal(match.minuteDelta, -30);
  });

  it("treats level and goal as preferences, not blockers", () => {
    const match = matchProgram(program({ level: "advanced", goal: "strength" }), PREFS);
    assert.ok(match.fits, "still fits the week and the session slot");
    assert.ok(match.score < 100);
    assert.deepEqual([...match.matched].sort(), ["days", "time"]);
  });

  it("prefers the right day count over an otherwise identical program", () => {
    const right = matchProgram(program(), PREFS);
    const wrong = matchProgram(program({ daysPerWeek: 6 }), PREFS);
    assert.ok(right.score > wrong.score);
  });

  it("gives partial credit for an adjacent experience level", () => {
    const adjacent = matchProgram(program({ level: "advanced" }), PREFS);
    const distant = matchProgram(program({ level: "beginner" }), {
      ...PREFS,
      experience: "advanced",
    });
    assert.ok(adjacent.score > distant.score);
  });
});

describe("rankPrograms", () => {
  const catalogue = [
    { name: "Six day split", facts: program({ daysPerWeek: 6, estimatedMinutes: 75 }) },
    { name: "Perfect fit", facts: program() },
    { name: "Wrong level", facts: program({ level: "advanced" }) },
    { name: "Wrong goal", facts: program({ estimatedMinutes: 40, goal: "fatloss" }) },
  ];

  it("puts the best match first and the worst last", () => {
    const ranked = rankPrograms(catalogue, PREFS);
    assert.equal(ranked[0]!.name, "Perfect fit");
    assert.equal(ranked.at(-1)!.name, "Six day split");
  });

  it("breaks score ties on the shorter session", () => {
    const ranked = rankPrograms(
      [
        { name: "Long", facts: program({ estimatedMinutes: 60 }) },
        { name: "Short", facts: program({ estimatedMinutes: 45 }) },
      ],
      PREFS,
    );
    assert.equal(ranked[0]!.name, "Short");
  });

  it("ranks rather than filters — nothing is hidden", () => {
    assert.equal(rankPrograms(catalogue, PREFS).length, catalogue.length);
  });
});
