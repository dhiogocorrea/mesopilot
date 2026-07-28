import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getOptionalUserContext } from "@/server/user";

export default async function LoginPage() {
  // Already signed in — nothing on this screen would do anything but confuse.
  if (await getOptionalUserContext()) redirect("/");

  return <AuthForm />;
}
