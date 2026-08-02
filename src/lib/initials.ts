/**
 * Initials for an avatar. Pure and separate from the component so it can be
 * tested without pulling React in — the edge cases are all in the string.
 */
export function initialsFor(name: string, username?: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  // A name is required at sign-up, but an edited or imported one can still end
  // up blank, and a blank disc looks like a bug rather than a person.
  if (words.length === 0) return first(username ?? "?");
  if (words.length === 1) return first(words[0]!);

  // First and last: "Ana Paula dos Santos" is AS, not AP. The last word is the
  // family name in both languages this app speaks.
  return first(words[0]!) + first(words[words.length - 1]!);
}

/**
 * The first *character*, not the first code unit — an emoji or an accented
 * letter outside the BMP would otherwise be sliced in half into a replacement
 * character.
 */
function first(value: string): string {
  return ([...value][0] ?? "?").toUpperCase();
}
