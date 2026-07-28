import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { demoSearchUrl, isDirectMedia, isSafeDemoUrl, resolveDemo, toEmbedUrl } from "./demo";

describe("demoSearchUrl", () => {
  it("builds a search from the exercise's own name", () => {
    const url = demoSearchUrl("Barbell Bench Press", "en");
    assert.ok(url.startsWith("https://www.youtube.com/results?search_query="));
    assert.ok(url.includes("Barbell+Bench+Press") || url.includes("Barbell%20Bench%20Press"));
  });

  it("searches in the athlete's own language", () => {
    const pt = demoSearchUrl("Supino reto com barra", "pt");
    assert.ok(decodeURIComponent(pt).includes("execução correta"));
    assert.ok(decodeURIComponent(demoSearchUrl("Barbell Row", "en")).includes("proper form"));
  });

  it("escapes names that would otherwise break the query", () => {
    const url = demoSearchUrl("Push-Up & Dip / Flexão", "pt");
    assert.ok(!url.includes(" "));
    assert.ok(!url.includes("&search"), "the ampersand must not start a new query param");
    assert.ok(decodeURIComponent(url).includes("Push-Up & Dip / Flexão"));
  });
});

describe("toEmbedUrl", () => {
  it("embeds the common YouTube URL shapes", () => {
    const expected = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";
    for (const input of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    ]) {
      assert.equal(toEmbedUrl(input), expected, input);
    }
  });

  it("embeds Vimeo", () => {
    assert.equal(
      toEmbedUrl("https://vimeo.com/123456789"),
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("refuses to embed a search results page", () => {
    // The default demo is a search; it must stay a link, not become a player.
    assert.equal(toEmbedUrl("https://www.youtube.com/results?search_query=squat"), null);
  });

  it("returns null for hosts it cannot embed and for junk", () => {
    assert.equal(toEmbedUrl("https://example.com/some/page"), null);
    assert.equal(toEmbedUrl("not a url"), null);
    assert.equal(toEmbedUrl(""), null);
  });
});

describe("isDirectMedia", () => {
  it("recognises playable files", () => {
    assert.ok(isDirectMedia("https://example.com/squat.gif"));
    assert.ok(isDirectMedia("https://example.com/a/b/squat.MP4"));
    assert.ok(isDirectMedia("https://example.com/squat.webm?v=2"));
  });

  it("rejects pages and junk", () => {
    assert.equal(isDirectMedia("https://example.com/squat"), false);
    assert.equal(isDirectMedia("https://example.com/gif/page"), false);
    assert.equal(isDirectMedia("nonsense"), false);
  });
});

describe("resolveDemo", () => {
  it("falls back to a name search when nothing is stored", () => {
    for (const stored of [null, undefined, "", "   "]) {
      const demo = resolveDemo("Back Squat", stored, "en");
      assert.equal(demo.kind, "search");
      assert.ok(demo.url.includes("youtube.com/results"));
    }
  });

  it("embeds a stored video", () => {
    const demo = resolveDemo("Back Squat", "https://youtu.be/abc123", "en");
    assert.equal(demo.kind, "embed");
    assert.ok(demo.url.includes("youtube-nocookie.com/embed/abc123"));
  });

  it("plays a stored media file inline", () => {
    const demo = resolveDemo("Back Squat", "https://example.com/squat.gif", "en");
    assert.equal(demo.kind, "media");
    assert.equal(demo.url, "https://example.com/squat.gif");
  });

  it("keeps anything else as an external link", () => {
    const demo = resolveDemo("Back Squat", "https://exrx.net/squat", "en");
    assert.equal(demo.kind, "link");
    assert.equal(demo.url, "https://exrx.net/squat");
  });
});

describe("isSafeDemoUrl", () => {
  it("accepts http and https only", () => {
    assert.ok(isSafeDemoUrl("https://youtu.be/abc"));
    assert.ok(isSafeDemoUrl("http://example.com/a.gif"));
  });

  it("rejects script and data URLs pasted into the field", () => {
    assert.equal(isSafeDemoUrl("javascript:alert(1)"), false);
    assert.equal(isSafeDemoUrl("data:text/html,<script>alert(1)</script>"), false);
    assert.equal(isSafeDemoUrl("file:///etc/passwd"), false);
    assert.equal(isSafeDemoUrl("just some text"), false);
  });
});
