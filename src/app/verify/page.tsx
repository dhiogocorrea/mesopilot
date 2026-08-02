import { ButtonLink, Screen } from "@/components/ui";
import { Logo } from "@/components/logo";
import { createTranslator } from "@/lib/i18n";
import { consumeVerificationToken } from "@/server/email-tokens";
import { getPreferredLocale } from "@/server/locale";
import { getOptionalUserContext } from "@/server/user";

/**
 * Where the emailed link lands. Deliberately outside the tabs and usable while
 * signed out — the link is often opened on a different device from the one that
 * signed up, and making it require a session would strand exactly that person.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const [context, preferred] = await Promise.all([
    getOptionalUserContext(),
    getPreferredLocale(),
  ]);
  const t = createTranslator(context?.locale ?? preferred);

  const outcome = await consumeVerificationToken(token ?? "");

  const copy = {
    verified: { title: t("verify.title"), body: t("verify.body") },
    already: { title: t("verify.alreadyTitle"), body: t("verify.alreadyBody") },
    invalid: { title: t("verify.failedTitle"), body: t("verify.failedBody") },
  }[outcome];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center">
      <Screen>
        <Logo />
        <h1 className="display-face text-title mt-8">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{copy.body}</p>

        <div className="mt-8">
          <ButtonLink href="/" size="lg" full>
            {t("verify.continue")}
          </ButtonLink>
        </div>
      </Screen>
    </div>
  );
}
