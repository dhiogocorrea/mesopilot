import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { isGoogleConfigured } from "@/server/google";
import { getOptionalUserContext } from "@/server/user";

const PROVIDER_ERRORS = {
  google_failed: "auth.errGoogle",
  google_unavailable: "auth.errGoogleUnavailable",
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // Already signed in — nothing on this screen would do anything but confuse.
  if (await getOptionalUserContext()) redirect("/");

  // Hidden rather than shown-and-broken when the credentials are absent: a
  // button that always fails is worse than no button.
  return (
    <AuthForm
      googleEnabled={isGoogleConfigured()}
      providerError={PROVIDER_ERRORS[error as keyof typeof PROVIDER_ERRORS]}
    />
  );
}
