import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toPortuguese } from "./exercise-names";

describe("toPortuguese", () => {
  it("translates a bare movement", () => {
    assert.equal(toPortuguese("Row"), "Remada");
    assert.equal(toPortuguese("Squat"), "Agachamento");
  });

  it("puts equipment after the movement, as Portuguese does", () => {
    assert.equal(toPortuguese("Cable Row"), "Remada no cabo");
    assert.equal(toPortuguese("Machine Shrug"), "Encolhimento na máquina");
    assert.equal(toPortuguese("DB Shoulder Press"), "Desenvolvimento com halteres");
  });

  it("agrees adjectives with the head noun's gender", () => {
    // Remada is feminine, Supino masculine — the same English word differs.
    assert.equal(toPortuguese("Seated Cable Row"), "Remada sentada no cabo");
    assert.equal(toPortuguese("Incline Barbell Press"), "Supino inclinado com barra");
  });

  it("puts bare adjectives before the equipment and phrases after it", () => {
    // "Rosca com halteres alternada" is what a naive join produces; nobody
    // says that. The split is on whether the modifier starts a preposition.
    assert.equal(toPortuguese("Alternating DB Curl"), "Rosca alternada com halteres");
    assert.equal(toPortuguese("Chest-Supported Machine Row"), "Remada na máquina com apoio no peito");
  });

  it("prefers the longest movement match", () => {
    assert.equal(toPortuguese("EZ-Bar Preacher Curl"), "Rosca scott com barra W");
    assert.equal(toPortuguese("Lat Pulldown"), "Puxada");
    assert.equal(toPortuguese("Leg Curl"), "Mesa flexora");
  });

  it("prefers the longest equipment match", () => {
    // "Smith Machine" must not be read as "Machine".
    assert.equal(toPortuguese("Smith Machine Lunge"), "Afundo no Smith");
  });

  it("keeps multiple modifiers in a readable order", () => {
    assert.equal(
      toPortuguese("Close-Grip Lat Pulldown"),
      "Puxada pegada fechada",
    );
    assert.equal(
      toPortuguese("Chest-Supported T-Bar Row"),
      "Remada cavalinho com apoio no peito",
    );
  });

  it("carries a known parenthetical across", () => {
    assert.equal(toPortuguese("Dead Hang (optional)"), "Pendurado na barra (opcional)");
    assert.equal(
      toPortuguese("Pec Deck (w/ integrated partials)"),
      "Voador (com parciais integradas)",
    );
  });

  it("keeps superset labels, which are structure rather than name", () => {
    assert.equal(
      toPortuguese("Superset B2: Leg Extension"),
      "Superset B2: Cadeira extensora",
    );
  });

  it("uses an override where composition reads badly", () => {
    assert.equal(toPortuguese("Belt Squat"), "Agachamento no cinto");
    assert.equal(toPortuguese("Squat (Your Choice)"), "Agachamento (à sua escolha)");
  });

  it("returns null rather than half-translating", () => {
    // A made-up word is not vocabulary; the English name should stand.
    assert.equal(toPortuguese("Frobnicating Widget Pull"), null);
    assert.equal(toPortuguese(""), null);
  });

  it("returns null when only part of the name is understood", () => {
    // "Kompressor" is unknown, so this must not become "Remada no cabo".
    assert.equal(toPortuguese("Kompressor Cable Row"), null);
  });
});
