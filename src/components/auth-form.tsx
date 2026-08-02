"use client";

import { useActionState, useState } from "react";

import { useI18n } from "@/lib/i18n/provider";
import { signIn, signUp, type AuthResult } from "@/server/auth-actions";
import { LocaleSwitch } from "./locale-switch";
import { Logo } from "./logo";
import { Button, Input, Label, cx } from "./ui";

/**
 * Sign in and sign up on one screen. They differ by a single field's meaning,
 * and a separate route for each would put a navigation between an athlete and
 * the realisation that they picked the wrong one.
 */
export function AuthForm({
  initialMode = "signIn",
  googleEnabled = false,
  providerError,
}: {
  initialMode?: "signIn" | "signUp";
  googleEnabled?: boolean;
  /** Set when Google bounced the athlete back here rather than signing them in. */
  providerError?: "auth.errGoogle" | "auth.errGoogleUnavailable";
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState(initialMode);

  const action = mode === "signIn" ? signIn : signUp;
  const [result, submit, pending] = useActionState<AuthResult, FormData>(action, undefined);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 pb-16">
      <div className="flex items-start justify-between gap-4">
        <h1>
          <Logo />
        </h1>
        <LocaleSwitch className="shrink-0 pt-1" />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{t("auth.tagline")}</p>

      <div className="mt-8 grid grid-cols-2 gap-2">
        {(["signIn", "signUp"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={cx(
              "h-11 rounded-xl border text-[13px] font-medium transition-colors",
              mode === value
                ? "border-accent bg-accent-soft text-accent"
                : "border-hairline-strong text-ink-2 active:bg-surface",
            )}
          >
            {value === "signIn" ? t("auth.signIn") : t("auth.signUp")}
          </button>
        ))}
      </div>

      {/* Keyed by mode so switching tabs clears what the other one typed. */}
      <form key={mode} action={submit} className="mt-6 space-y-5">
        <div>
          <Label htmlFor="username">
            {mode === "signIn" ? t("auth.identifier") : t("auth.username")}
          </Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </div>

        {mode === "signUp" && (
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>
        )}

        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            required
          />
          {mode === "signUp" && <p className="mt-2 text-xs text-ink-3">{t("auth.passwordHint")}</p>}
        </div>

        {/* The form's own error wins: it describes what they just typed. */}
        {result?.error ? (
          <p className="text-sm text-danger">{t(result.error)}</p>
        ) : (
          providerError && <p className="text-sm text-danger">{t(providerError)}</p>
        )}

        <Button type="submit" size="lg" full disabled={pending}>
          {pending
            ? t("common.loading")
            : mode === "signIn"
              ? t("auth.signIn")
              : t("auth.createAccount")}
        </Button>
      </form>

      {googleEnabled && (
        <>
          {/* A rule with the word in it rather than a heading: this separates
              two ways in, it does not start a new section. */}
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline-strong" />
            <span className="text-[12px] uppercase tracking-wider text-ink-3">
              {t("auth.orContinueWith")}
            </span>
            <span className="h-px flex-1 bg-hairline-strong" />
          </div>

          {/* A plain link, not a fetch: the OAuth handshake is a browser
              redirect, and pretending otherwise only adds a spinner. */}
          <a
            href="/api/auth/google"
            className="tap flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-hairline-strong text-[15px] font-medium active:bg-surface"
          >
            <GoogleMark />
            {t("auth.google")}
          </a>
        </>
      )}
    </div>
  );
}

/** Google's own mark, drawn — the app ships no image assets for this. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7C21.7 18.9 23 15.9 23 12.3Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.6-2-6.5-4.8H1.7v3A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path fill="#FBBC05" d="M5.5 14.1a6.9 6.9 0 0 1 0-4.4v-3H1.7a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.7 6.7l3.8 3c.9-2.8 3.5-4.3 6.5-4.3Z"
      />
    </svg>
  );
}
