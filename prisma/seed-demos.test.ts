import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EXERCISES } from "./seed-data";
import { INFERRED_DEMOS } from "./seed-demos";

/**
 * A demo keyed to a misspelled exercise would do nothing at all — the seed
 * would skip it and the app would quietly fall back to a search. These tests
 * make that failure loud.
 */
describe("INFERRED_DEMOS", () => {
  const exerciseKeys = new Set(EXERCISES.map((exercise) => exercise.key));

  it("only references exercises that exist", () => {
    const unknown = Object.keys(INFERRED_DEMOS).filter((key) => !exerciseKeys.has(key));
    assert.deepEqual(unknown, [], `unknown exercise keys: ${unknown.join(", ")}`);
  });

  it("covers every exercise in the library", () => {
    const missing = [...exerciseKeys].filter((key) => !(key in INFERRED_DEMOS));
    assert.deepEqual(missing, [], `exercises without a demo: ${missing.join(", ")}`);
  });

  it("stores watchable video URLs, not search pages", () => {
    for (const [key, url] of Object.entries(INFERRED_DEMOS)) {
      assert.match(url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/, `${key}: ${url}`);
    }
  });

  it("does not point two exercises at the same video", () => {
    // A duplicate almost always means a copy-paste slip rather than a genuine
    // shared demonstration.
    const seen = new Map<string, string>();
    for (const [key, url] of Object.entries(INFERRED_DEMOS)) {
      const previous = seen.get(url);
      assert.equal(previous, undefined, `${key} reuses the video assigned to ${previous}`);
      seen.set(url, key);
    }
  });
});
