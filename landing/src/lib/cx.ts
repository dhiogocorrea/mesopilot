/**
 * The one helper the copied components needed from the app's `ui.tsx`. Vendored
 * rather than shared: this project deploys on its own and nothing else in
 * `ui.tsx` — rows, panels, buttons — has any use on a marketing page.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
