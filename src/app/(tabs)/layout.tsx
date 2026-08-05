import { BottomNav } from "@/components/bottom-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { PushPrompt } from "@/components/push-prompt";
import { requireProfile } from "@/server/user";

/**
 * The five tab screens. The session logger deliberately lives outside this
 * group — mid-workout, the nav is wasted vertical space and a mis-tap risk.
 *
 * The profile gate sits here rather than on the Today page so that landing
 * directly on any tab still sends a first-time user to the anamnesis.
 */
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {/* Bottom padding clears the fixed nav plus the home indicator. */}
      <main className="flex-1 pb-28">{children}</main>
      <BottomNav />
      {/* Here rather than on Today: Chromium decides when the app qualifies to
          be installed, and that can land on whichever tab is open at the time.
          Deliberately not in the root layout — the login screen is the wrong
          moment to ask someone to keep an app they cannot see yet. */}
      <InstallPrompt />
      {/* Holds itself back while the install prompt is still on offer — two
          sheets rising over each other reads as a bug, and on iOS the install
          is the prerequisite for push working at all. */}
      <PushPrompt />
    </div>
  );
}
