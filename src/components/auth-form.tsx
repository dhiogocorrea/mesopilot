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
export function AuthForm({ initialMode = "signIn" }: { initialMode?: "signIn" | "signUp" }) {
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
          <Label htmlFor="username">{t("auth.username")}</Label>
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

        {result?.error && <p className="text-sm text-danger">{t(result.error)}</p>}

        <Button type="submit" size="lg" full disabled={pending}>
          {pending
            ? t("common.loading")
            : mode === "signIn"
              ? t("auth.signIn")
              : t("auth.createAccount")}
        </Button>
      </form>
    </div>
  );
}
