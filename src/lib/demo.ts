import type { Locale } from "./types";

/**
 * How to show a form demonstration for an exercise.
 *
 * The default for every exercise is a *search* built from its own name rather
 * than a specific clip. That is deliberate: a link that points at the wrong
 * movement is worse than no link at all when someone is checking their form,
 * and a search built from the name is the only thing that cannot be wrong.
 * Paste a specific URL and it is used instead — embedded inline when the app
 * can play it, opened externally when it cannot.
 */

export type DemoKind =
  /** A player we can embed in-page (YouTube, Vimeo). */
  | "embed"
  /** A direct media file we can put in a <video> or <img>. */
  | "media"
  /** Anything else the user pasted — opened in a new tab. */
  | "link"
  /** No URL stored; a name-based search that always resolves. */
  | "search";

export type ExerciseDemo = {
  kind: DemoKind;
  /** Where to point the player or the link. */
  url: string;
};

const SEARCH_QUALIFIER: Record<Locale, string> = {
  en: "proper form",
  pt: "execução correta",
};

export function demoSearchUrl(exerciseName: string, locale: Locale): string {
  const query = `${exerciseName} ${SEARCH_QUALIFIER[locale]}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

const MEDIA_EXTENSIONS = [".gif", ".mp4", ".webm", ".ogv"];

export function isDirectMedia(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return MEDIA_EXTENSIONS.some((extension) => pathname.toLowerCase().endsWith(extension));
  } catch {
    return false;
  }
}

/** Returns a privacy-preserving embed URL, or null when the host isn't embeddable. */
export function toEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return id ? youtubeEmbed(id) : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    // A search results page is not a video — leave it as a plain link.
    if (parsed.pathname === "/results") return null;

    const id = parsed.searchParams.get("v");
    if (id) return youtubeEmbed(id);

    // /embed/<id> and /shorts/<id>
    const match = /^\/(?:embed|shorts|v)\/([\w-]+)/.exec(parsed.pathname);
    if (match?.[1]) return youtubeEmbed(match[1]);
    return null;
  }

  if (host === "vimeo.com") {
    const match = /^\/(\d+)/.exec(parsed.pathname);
    return match?.[1] ? `https://player.vimeo.com/video/${match[1]}` : null;
  }

  return null;
}

function youtubeEmbed(id: string): string {
  // nocookie avoids setting tracking cookies until playback actually starts.
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
}

export function resolveDemo(
  exerciseName: string,
  demoUrl: string | null | undefined,
  locale: Locale,
): ExerciseDemo {
  const trimmed = demoUrl?.trim();
  if (!trimmed) return { kind: "search", url: demoSearchUrl(exerciseName, locale) };

  const embed = toEmbedUrl(trimmed);
  if (embed) return { kind: "embed", url: embed };

  if (isDirectMedia(trimmed)) return { kind: "media", url: trimmed };

  return { kind: "link", url: trimmed };
}

/** Rejects anything that isn't an http(s) URL — including `javascript:`. */
export function isSafeDemoUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
