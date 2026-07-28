import { BottomNav } from "@/components/bottom-nav";
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
    </div>
  );
}
