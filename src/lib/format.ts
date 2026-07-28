/**
 * A fixed-rep prescription (10x10 protocols, 5x5 strength work) stores the same
 * number in both bounds. Rendering that as "10-10" reads like a mistake.
 */
export function formatRepRange(repMin: number, repMax: number): string {
  return repMin === repMax ? String(repMin) : `${repMin}-${repMax}`;
}
