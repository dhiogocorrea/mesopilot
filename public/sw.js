/**
 * The service worker exists for one reason: a push notification cannot be shown
 * without one. It is deliberately not a caching layer.
 *
 * **There is no `fetch` handler here on purpose.** Adding one would quietly give
 * the app offline behaviour it has never been built or tested for — stale
 * prescriptions served from a cache mid-workout is a worse failure than a page
 * that does not load. If offline support is ever wanted it is a deliberate
 * project, not a side effect of notifications.
 *
 * Plain JavaScript in `public/`, not TypeScript: this file is served verbatim
 * and never passes through the bundler.
 */

// No versioning and no cached assets, so a redeploy should take over at once
// rather than waiting for every tab to close. There is nothing in flight that a
// new worker could invalidate.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  if (!data || !data.title) return;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      // `badge` is omitted deliberately — the monochrome asset the Next guide
      // references does not exist here, and a missing badge renders as a broken
      // grey square on Android rather than falling back to the icon.
      icon: "/icon-192.png",
      // Collapses repeats instead of stacking identical banners.
      tag: data.tag,
      data: { url: safePath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const path = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(open(path));
});

/**
 * Only ever navigate within the app. The payload is written by our own server,
 * but this worker outlives any given deploy and a notification is the one thing
 * here that turns data into navigation — so it refuses anything that is not a
 * plain relative path.
 */
function safePath(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

/**
 * Focus a window the athlete already has open before opening another. On an
 * installed PWA a bare `openWindow` spawns a fresh window every time, so tapping
 * three notifications leaves three copies of the app running.
 */
async function open(path) {
  const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of clientList) {
    if ("focus" in client) {
      await client.focus();
      if ("navigate" in client) await client.navigate(path);
      return;
    }
  }

  await self.clients.openWindow(path);
}
