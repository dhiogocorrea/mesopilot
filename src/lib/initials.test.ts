import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initialsFor } from "./initials";

describe("initialsFor", () => {
  it("takes the first and last word", () => {
    assert.equal(initialsFor("Dhiogo Correa"), "DC");
    assert.equal(initialsFor("Ana Paula dos Santos"), "AS");
  });

  it("takes one letter from a single word", () => {
    assert.equal(initialsFor("orimaz"), "O");
  });

  it("ignores surrounding and repeated whitespace", () => {
    assert.equal(initialsFor("  Ana   Silva  "), "AS");
  });

  it("falls back to the username when the name is blank", () => {
    assert.equal(initialsFor("", "rodox"), "R");
    assert.equal(initialsFor("   ", "rodox"), "R");
  });

  it("falls back again when there is nothing at all", () => {
    assert.equal(initialsFor(""), "?");
  });

  it("uppercases what it finds", () => {
    assert.equal(initialsFor("ana silva"), "AS");
    assert.equal(initialsFor("élan vital"), "ÉV");
  });

  it("keeps a whole character rather than half a surrogate pair", () => {
    // Slicing by code unit would return a lone surrogate here, which renders
    // as the replacement glyph.
    assert.equal(initialsFor("𝒜lice"), "𝒜");
  });
});
