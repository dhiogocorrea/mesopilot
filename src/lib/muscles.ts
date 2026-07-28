/**
 * Lower-body muscles take bigger absolute load jumps than upper-body ones —
 * adding 5 kg to a squat is a smaller relative step than adding it to a curl.
 * Shared by the seed and the progression engine so they cannot drift apart.
 */
export const LOWER_BODY_MUSCLE_KEYS = new Set([
  "quads",
  "hamstrings",
  "glutes",
  "calves",
]);

export function isLowerBody(muscleKey: string): boolean {
  return LOWER_BODY_MUSCLE_KEYS.has(muscleKey);
}
