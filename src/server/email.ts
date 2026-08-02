import "server-only";

import { Resend } from "resend";

import type { Locale } from "@/lib/types";

/**
 * Transactional email, through Resend.
 *
 * Unconfigured is a supported state, like the AI coach: with no
 * `RESEND_API_KEY` the message is logged to the server console instead of sent,
 * so signing up and verifying still work end to end in development without an
 * account anywhere. Nothing in the app treats a failure to send as a failure to
 * do the thing the email was about.
 */

const FROM = process.env.EMAIL_FROM ?? "Meso505 <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * The address links point at. Set `APP_URL` in production — a verification link
 * to localhost is useless in an inbox, and guessing from request headers means
 * trusting a header an attacker controls.
 */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

type Message = { to: string; subject: string; heading: string; body: string; cta?: { label: string; url: string } };

async function send(message: Message): Promise<void> {
  if (!isEmailConfigured()) {
    console.info(
      `[email] RESEND_API_KEY not set — not sending "${message.subject}" to ${message.to}` +
        (message.cta ? `\n[email] link: ${message.cta.url}` : ""),
    );
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: message.to,
    subject: message.subject,
    html: render(message),
    text: message.cta ? `${message.body}\n\n${message.cta.url}` : message.body,
  });

  // Thrown, not swallowed: the caller decides. Sign-up must not fail because
  // an inbox is unreachable, but "resend the link" should say that it didn't.
  if (error) throw new Error(`Resend refused the message: ${error.message}`);
}

/**
 * Inline styles and a table-free layout on purpose — email clients strip
 * stylesheets, and this is two paragraphs and a button.
 */
function render({ heading, body, cta }: Message): string {
  const button = cta
    ? `<p style="margin:32px 0"><a href="${cta.url}" style="background:#e12b34;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;display:inline-block">${cta.label}</a></p>
       <p style="color:#6e6e76;font-size:13px;line-height:1.6">If the button does not work, paste this into your browser:<br><span style="color:#a1a1a8">${cta.url}</span></p>`
    : "";

  return `<div style="background:#060607;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#141416;border-radius:16px;padding:32px;color:#fafaf9">
    <p style="margin:0 0 24px;font-size:13px;letter-spacing:0.09em;text-transform:uppercase;color:#6e6e76">Meso505</p>
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">${heading}</h1>
    <p style="margin:0;color:#a1a1a8;font-size:15px;line-height:1.6">${body}</p>
    ${button}
  </div>
</div>`;
}

const COPY = {
  en: {
    subject: "Confirm your email",
    heading: "Confirm your email",
    body: "Tap the button to confirm this address for your Meso505 account. The link is good for 24 hours. If you did not sign up, you can ignore this.",
    cta: "Confirm email",
  },
  pt: {
    subject: "Confirme seu e-mail",
    heading: "Confirme seu e-mail",
    body: "Toque no botão para confirmar este endereço na sua conta Meso505. O link vale por 24 horas. Se não foi você que criou a conta, pode ignorar.",
    cta: "Confirmar e-mail",
  },
} satisfies Record<Locale, { subject: string; heading: string; body: string; cta: string }>;

export async function sendVerificationEmail(
  to: string,
  token: string,
  locale: Locale,
): Promise<void> {
  const copy = COPY[locale];
  await send({
    to,
    subject: copy.subject,
    heading: copy.heading,
    body: copy.body,
    cta: { label: copy.cta, url: `${appUrl()}/verify?token=${encodeURIComponent(token)}` },
  });
}
