import { SettingsForm } from "@/components/settings-form";
import { SignOutButton } from "@/components/sign-out-button";
import { Chevron, Chip, List, Row, RowLink, Screen, ScreenHeader, Section } from "@/components/ui";
import { createTranslator } from "@/lib/i18n";
import { isCoachConfigured } from "@/server/coach";
import { getUserContext } from "@/server/user";

export default async function SettingsPage() {
  const { name, username, locale, unit } = await getUserContext();
  const t = createTranslator(locale);
  const coachReady = isCoachConfigured();

  return (
    <>
      <ScreenHeader title={t("settings.title")} meta={name} />

      <Screen>
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
          <p className="mb-4 text-[13px] text-ink-3">
            {t("settings.signedInAs", { username })}
          </p>
          <SignOutButton />
        </Section>

        <Section label={t("settings.about")}>
          <p className="text-[15px]">{t("app.name")}</p>
          <p className="mt-1 text-[13px] text-ink-3">{t("app.tagline")}</p>
        </Section>
      </Screen>
    </>
  );
}
