import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";

import { urlBase64ToUint8Array } from "./device";

/**
 * The only pure function in `device.ts` — everything else reads the browser.
 * It is worth a test because a VAPID key that decodes to the wrong bytes fails
 * at `pushManager.subscribe()`, in the browser, on a real athlete's tap, with a
 * message that says nothing about base64.
 */
describe("urlBase64ToUint8Array", () => {
  // Node has `atob`, but the function reads it off `window` like the browser it
  // is written for.
  const original = (globalThis as { window?: unknown }).window;

  before(() => {
    (globalThis as { window?: unknown }).window = { atob: globalThis.atob };
  });

  after(() => {
    (globalThis as { window?: unknown }).window = original;
  });

  it("decodes standard base64", () => {
    // "hello" -> aGVsbG8=
    assert.deepEqual([...urlBase64ToUint8Array("aGVsbG8=")], [104, 101, 108, 108, 111]);
  });

  it("restores padding the URL-safe form strips", () => {
    // "hello" again with no "=" — how a VAPID key actually arrives.
    assert.deepEqual([...urlBase64ToUint8Array("aGVsbG8")], [104, 101, 108, 108, 111]);
  });

  it("translates the URL-safe alphabet back", () => {
    // 0xFB 0xFF encodes as "+/8=" in standard base64 and "-_8" URL-safe; both
    // must give the same bytes or the key is silently wrong.
    assert.deepEqual([...urlBase64ToUint8Array("-_8")], [...urlBase64ToUint8Array("+/8=")]);
    assert.deepEqual([...urlBase64ToUint8Array("-_8")], [251, 255]);
  });

  it("returns bytes backed by a plain ArrayBuffer", () => {
    // `subscribe()` takes a BufferSource, which a SharedArrayBuffer-backed
    // array does not satisfy. This is the runtime half of that type.
    assert.ok(urlBase64ToUint8Array("aGVsbG8").buffer instanceof ArrayBuffer);
  });

  it("handles a realistic 65-byte VAPID public key", () => {
    // Uncompressed P-256 point: 0x04 followed by two 32-byte coordinates.
    const bytes = new Uint8Array(65);
    bytes[0] = 4;
    for (let i = 1; i < 65; i += 1) bytes[i] = i;

    const urlSafe = Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    assert.deepEqual([...urlBase64ToUint8Array(urlSafe)], [...bytes]);
  });
});
