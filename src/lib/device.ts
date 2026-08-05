/**
 * Facts about the device the app is running on.
 *
 * These live together because two features now depend on the *same* answers and
 * must not disagree: the install prompt asks whether the app is already on the
 * home screen, and the push prompt asks whether it can be — on iOS, push is
 * delivered only to an installed app, so the gate there is exactly
 * `isIOSDevice() && !isStandalone()`. Two copies of "is this iOS" is two
 * chances for one of them to drift.
 *
 * All of these read the browser, so they are read through `useSyncExternalStore`
 * with a `false` server snapshot rather than assigned from an effect — see the
 * comment in `install-prompt.tsx`.
 */

/** The app is running from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari never adopted `display-mode` and reports it here instead.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function subscribeDisplayMode(onChange: () => void): () => void {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function isIOSDevice(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** Push needs all three; Safari on an un-installed iOS home screen has none. */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** For facts that cannot change while the page is open, like the user agent. */
export const noSubscription = () => () => {};

export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    // Private mode, or storage disabled.
    return false;
  }
}

export function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Not remembering across a reload is better than failing a render over a
    // prompt. See `readFlag`.
  }
}

/**
 * `applicationServerKey` wants raw bytes, and a VAPID public key travels as
 * URL-safe base64. Pure, so it is tested rather than trusted.
 *
 * Returns `Uint8Array<ArrayBuffer>` rather than a bare `Uint8Array`: since
 * TypeScript 5.7 the array is generic over its buffer, and only the
 * `ArrayBuffer` form satisfies the `BufferSource` that `subscribe()` takes —
 * the default `ArrayBufferLike` admits a `SharedArrayBuffer`, which it does not.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);

  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
