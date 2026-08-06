import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isReasonableHour, localDay, localHour, localWeekday, safeZone } from "./time";

/**
 * These decide when a reminder is allowed to arrive, so the failure they guard
 * against is a push at 4am — the single fastest way to have notifications
 * turned off for good.
 */
describe("safeZone", () => {
  it("falls back to UTC rather than throwing on a zone this runtime cannot resolve", () => {
    assert.equal(safeZone("Mars/Olympus_Mons"), "UTC");
    assert.equal(safeZone(null), "UTC");
    assert.equal(safeZone(""), "UTC");
    assert.equal(safeZone("America/Sao_Paulo"), "America/Sao_Paulo");
  });
});

describe("localDay", () => {
  it("gives each athlete their own calendar date, not the server's", () => {
    // 23:30 UTC on the 5th. Already the 6th in Tokyo, still the 5th in São Paulo.
    const instant = new Date("2026-08-05T23:30:00Z");

    assert.equal(localDay(instant, "UTC"), "2026-08-05");
    assert.equal(localDay(instant, "Asia/Tokyo"), "2026-08-06");
    assert.equal(localDay(instant, "America/Sao_Paulo"), "2026-08-05");
  });

  it("is the reason 'once a day' means once, either side of midnight UTC", () => {
    // An hour apart, spanning UTC midnight. In Tokyo both are the same day, so
    // the idempotency key holds and the second send is refused.
    const before = new Date("2026-08-05T23:30:00Z");
    const after = new Date("2026-08-06T00:30:00Z");

    assert.equal(localDay(before, "Asia/Tokyo"), localDay(after, "Asia/Tokyo"));
    assert.notEqual(localDay(before, "UTC"), localDay(after, "UTC"));
  });

  it("uses UTC for an athlete who has never opened the app on a real device", () => {
    const instant = new Date("2026-08-05T23:30:00Z");
    assert.equal(localDay(instant, null), "2026-08-05");
  });
});

describe("localHour", () => {
  it("reads the hour where the athlete is", () => {
    // 12:00 UTC is 09:00 in São Paulo (UTC-3) and 21:00 in Tokyo (UTC+9).
    const noonUtc = new Date("2026-08-05T12:00:00Z");

    assert.equal(localHour(noonUtc, "UTC"), 12);
    assert.equal(localHour(noonUtc, "America/Sao_Paulo"), 9);
    assert.equal(localHour(noonUtc, "Asia/Tokyo"), 21);
  });

  it("reports midnight as 0, never 24", () => {
    assert.equal(localHour(new Date("2026-08-05T00:00:00Z"), "UTC"), 0);
  });
});

describe("isReasonableHour", () => {
  it("refuses the middle of the night wherever the athlete actually is", () => {
    // 06:00 UTC — a civilised 15:00 in Tokyo, but 03:00 in São Paulo.
    const instant = new Date("2026-08-05T06:00:00Z");

    assert.equal(isReasonableHour(instant, "Asia/Tokyo"), true);
    assert.equal(isReasonableHour(instant, "America/Sao_Paulo"), false, "3am is never fine");
  });

  it("opens at 09:00 and closes at 21:00 local", () => {
    const at = (hour: string) => new Date(`2026-08-05T${hour}:00:00Z`);

    assert.equal(isReasonableHour(at("08"), "UTC"), false);
    assert.equal(isReasonableHour(at("09"), "UTC"), true);
    assert.equal(isReasonableHour(at("20"), "UTC"), true);
    assert.equal(isReasonableHour(at("21"), "UTC"), false, "not the last thing they read");
  });

  it("follows daylight saving rather than a fixed offset", () => {
    // London is UTC+1 in August and UTC+0 in January. 08:30 UTC is therefore a
    // sendable 09:30 in summer and a too-early 08:30 in winter.
    assert.equal(isReasonableHour(new Date("2026-08-05T08:30:00Z"), "Europe/London"), true);
    assert.equal(isReasonableHour(new Date("2026-01-05T08:30:00Z"), "Europe/London"), false);
  });
});

describe("localWeekday", () => {
  it("counts Monday as 1 and Sunday as 7, matching the streak engine", () => {
    // 2026-08-03 is a Monday.
    assert.equal(localWeekday(new Date("2026-08-03T12:00:00Z"), "UTC"), 1);
    assert.equal(localWeekday(new Date("2026-08-08T12:00:00Z"), "UTC"), 6);
    assert.equal(localWeekday(new Date("2026-08-09T12:00:00Z"), "UTC"), 7);
  });

  it("can disagree with the server about what day it is", () => {
    // Sunday 23:00 UTC is already Monday in Tokyo — which is the moment a
    // streak week rolls over, so getting this wrong warns the wrong people.
    const sundayNight = new Date("2026-08-09T23:00:00Z");

    assert.equal(localWeekday(sundayNight, "UTC"), 7);
    assert.equal(localWeekday(sundayNight, "Asia/Tokyo"), 1);
  });
});
