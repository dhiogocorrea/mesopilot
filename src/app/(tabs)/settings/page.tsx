import { Avatar } from "@/components/avatar";
import { ResetTrainingButton } from "@/components/reset-training-button";
import { SettingsForm } from "@/components/settings-form";
import { SignOutButton } from "@/components/sign-out-button";
import { VerifyEmailButton } from "@/components/verify-email-button";
import { db } from "@/lib/db";
import { Chevron, Chip, List, Row, RowLink, Screen, ScreenHeader, Section } from "@/components/ui";
import { createTranslator } from "@/lib/i18n";
import { isCoachConfigured } from "@/server/coach";
import { getUserContext } from "@/server/user";

export default async function SettingsPage() {
  const { userId, name, username, locale, unit } = await getUserContext();
  const t = createTranslator(locale);
  const coachReady = isCoachConfigured();

  const account = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerifiedAt: true,
      oauthAccounts: { select: { provider: true } },
    },
  });

  const googleLinked = account?.oauthAccounts.some((row) => row.provider === "google") ?? false;

  return (
    <>
      <ScreenHeader
        leading={<Avatar name={name} username={username} size="lg" />}
        title={name}
        meta={`@${username}`}
      />

      <Screen>
        {/* The handle, stated plainly: adding a friend asks for one, and until
            now there was nowhere to read your own. */}
        <p className="mb-8 text-[13px] leading-relaxed text-ink-3">
          {t("settings.handleHint")}
        </p>

        <SettingsForm name={name} locale={locale} unit={unit} />

        <Section label={t("settings.profile")}>
          <List>
            <Row>
              <RowLink href="/onboarding">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{t("settings.anamnesis")}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">
                    {t("settings.anamnesisBody")}
                  </span>
                </span>
                <Chevron />
              </RowLink>
            </Row>
          </List>
        </Section>

        <Section label={t("settings.aiCoach")}>
          <div className="flex items-start justify-between gap-4">
            <p className="max-w-[42ch] text-[13px] leading-relaxed text-ink-2">
              {t("settings.aiCoachBody")}
            </p>
            <Chip tone={coachReady ? "accent" : "neutral"}>
              {coachReady ? t("settings.aiCoachOn") : t("settings.aiCoachOff")}
            </Chip>
          </div>
        </Section>

        <Section label={t("settings.account")}>
          <p className="text-[13px] text-ink-3">{t("settings.signedInAs", { username })}</p>

          <div className="mt-4 space-y-3">
            {account?.email ? (
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{account.email}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-3">
                    {account.emailVerifiedAt
                      ? t("settings.emailVerified")
                      : t("settings.emailUnverified")}
                  </span>
                </span>
                {account.emailVerifiedAt ? (
                  <Chip tone="accent">✓</Chip>
                ) : (
                  <Chip tone="warn">!</Chip>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">{t("settings.noEmail")}</p>
            )}

            {account?.email && !account.emailVerifiedAt && <VerifyEmailButton />}

            {googleLinked && (
              <p className="text-[13px] text-ink-3">{t("settings.googleLinked")}</p>
            )}
          </div>

          <div className="mt-5">
            <SignOutButton />
          </div>
        </Section>

        <Section label={t("settings.data")}>
          <p className="mb-4 text-[13px] leading-relaxed text-ink-3">
            {t("settings.resetDataBody")}
          </p>
          <ResetTrainingButton />
        </Section>

        <Section label={t("settings.about")}>
          <p className="text-[15px]">{t("app.name")}</p>
          <p className="mt-1 text-[13px] text-ink-3">{t("app.tagline")}</p>
        </Section>
      </Screen>
    </>
  );
}
