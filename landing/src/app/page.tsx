import {
  PhoneFrame,
  ScreenLogger,
  ScreenPlan,
  ScreenProgress,
  ScreenToday,
} from "@/components/phone";
import { CoachNote } from "@/components/coach-note";
import { Photo } from "@/components/photo";
import { Logo } from "@/components/logo";
import { cx } from "@/lib/cx";
import { COPY, detectLocale } from "@/lib/copy";

/**
 * The marketing page, and the whole of this project.
 *
 * It knows nothing about the app beyond its URL. No Prisma, no session, no
 * server actions — which is why it lives on its own domain and deploys on its
 * own schedule. Every "start" button is a link across to app.meso505.com.
 */

/** Overridable per environment so a local app on :3000 can be linked to. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.meso505.com";

export default async function LandingPage() {
  const copy = COPY[await detectLocale()];

  return (
    <div className="relative overflow-x-hidden">
      {/* One accent glow behind the fold. More than one and the page starts
          looking like a template rather than like the app. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[42rem] w-[52rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
      />

      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Logo />
          <nav className="flex items-center gap-2">
            <a
              href={`${APP_URL}/login`}
              className="tap hidden items-center px-3 text-[14px] font-medium text-ink-2 sm:flex"
            >
              {copy.navSignIn}
            </a>
            <a
              href={APP_URL}
              className="tap flex items-center rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
            >
              {copy.navStart}
            </a>
          </nav>
        </div>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <section className="mx-auto max-w-6xl px-5 pb-4 pt-14 sm:pt-20">
        <p className="text-label uppercase text-accent">{copy.eyebrow}</p>
        <h1 className="display-face mt-4 max-w-[16ch] text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-tight">
          {copy.headline[0]}{" "}
          <span className="text-accent">{copy.headline[1]}</span>
        </h1>
        <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-ink-2">{copy.sub}</p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={APP_URL}
            className="tap flex items-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-ink"
          >
            {copy.ctaPrimary}
          </a>
          <a
            href={`${APP_URL}/login`}
            className="tap flex items-center rounded-xl border border-hairline-strong px-6 text-[15px] font-medium text-ink"
          >
            {copy.ctaSecondary}
          </a>
        </div>
        <p className="mt-4 text-[13px] text-ink-3">{copy.ctaNote}</p>
      </section>

      {/* The lifters flank the phones; the phones overlap and lean. */}
      <section className="relative mx-auto max-w-6xl px-5 pt-6">
        <div className="relative flex items-end justify-center">
          {/* Both sit behind the phones and bleed off the edges, so even the
              small viewport reads as two athletes either side of a screen.
              No CSS mask on these two: the alpha is in the file, which is the
              only version of this that composites correctly regardless of what
              is behind it. */}
          <Photo
            src="/photos/athlete-squat.webp"
            alt={copy.photoPressAlt}
            fade="none"
            // Explicit heights, not a percentage: the row's height comes from
            // its content, so `h-[70%]` is indefinite — it resolves to zero, and
            // `overflow-hidden` then clips the fallback out of existence.
            className="pointer-events-none absolute -left-4 bottom-0 -z-10 h-52 w-32 sm:left-0 sm:h-72 sm:w-44 lg:h-96 lg:w-64"
          />
          <Photo
            src="/photos/athlete-curl.webp"
            alt={copy.photoDeadliftAlt}
            fade="none"
            className="pointer-events-none absolute -right-4 bottom-0 -z-10 h-52 w-32 sm:right-0 sm:h-72 sm:w-44 lg:h-96 lg:w-64"
          />

          <div className="flex items-end justify-center">
            <PhoneFrame className="hidden -mr-16 translate-y-8 -rotate-6 opacity-90 md:block">
              <ScreenToday />
            </PhoneFrame>

            <PhoneFrame glow className="z-10">
              <ScreenLogger />
            </PhoneFrame>

            <PhoneFrame className="hidden -ml-16 translate-y-8 rotate-6 opacity-90 md:block">
              <ScreenProgress />
            </PhoneFrame>
          </div>
        </div>

        {/* The screens run off the bottom rather than stopping dead. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent"
        />
      </section>

      {/* -------------------------------------------------------------- how */}
      <section className="mx-auto mt-24 max-w-6xl px-5">
        <p className="text-label uppercase text-accent">{copy.howLabel}</p>
        <h2 className="display-face mt-3 max-w-[18ch] text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.02]">
          {copy.howTitle}
        </h2>

        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {copy.steps.map(([title, lead, body], index) => (
            <li key={title} className="border-t border-hairline pt-5">
              <span className="text-[13px] font-bold tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-[19px] font-semibold leading-snug">{title}</h3>
              <p className="mt-2 text-[15px] font-medium text-ink-2">{lead}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------------- programs */}
      <section className="mx-auto mt-28 max-w-6xl px-5">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-label uppercase text-accent">{copy.programsLabel}</p>
            <h2 className="display-face mt-3 max-w-[17ch] text-[clamp(1.9rem,5vw,3rem)] leading-[1.02]">
              {copy.programsTitle}
            </h2>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-ink-2">
              {copy.programsBody}
            </p>

            {/* Figures about the library, on the section that is about the
                library — they answer "is there enough here for me", which is
                the only reason to state a number on a page like this. */}
            <dl className="mt-8 grid grid-cols-4 gap-4 border-y border-hairline py-5">
              {copy.programsStats.map(([value, label]) => (
                <div key={label}>
                  <dt className="text-[1.75rem] font-bold tabular-nums leading-none">{value}</dt>
                  <dd className="text-label mt-2 uppercase leading-tight text-ink-3">{label}</dd>
                </div>
              ))}
            </dl>

            <ul className="mt-8 space-y-6">
              {copy.programsPoints.map(([title, body]) => (
                <li key={title} className="border-l-2 border-accent-line pl-4">
                  <h3 className="text-[16px] font-semibold leading-snug">{title}</h3>
                  <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed text-ink-3">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center lg:justify-end">
            <PhoneFrame glow>
              <ScreenPlan />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- features */}
      <section className="mx-auto mt-28 max-w-6xl px-5">
        <p className="text-label uppercase text-accent">{copy.featuresLabel}</p>
        <h2 className="display-face mt-3 max-w-[18ch] text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.02]">
          {copy.featuresTitle}
        </h2>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {copy.features.map(([title, body]) => (
            <div key={title} className="bg-canvas p-6">
              <h3 className="text-[17px] font-semibold leading-snug">{title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-ink-3">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- showcase */}
      <section className="mx-auto mt-28 max-w-6xl px-5">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-label uppercase text-accent">{copy.showcaseLabel}</p>
            <h2 className="display-face mt-3 max-w-[16ch] text-[clamp(1.9rem,5vw,3rem)] leading-[1.02]">
              {copy.showcaseTitle}
            </h2>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-ink-2">
              {copy.showcaseBody}
            </p>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <PhoneFrame className="-mr-12 translate-y-6 -rotate-3 opacity-80">
              <ScreenProgress />
            </PhoneFrame>
            <PhoneFrame glow className="z-10">
              <ScreenLogger />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ coach */}
      <section className="mx-auto mt-28 max-w-6xl px-5">
        <p className="text-label uppercase text-accent">{copy.coachLabel}</p>
        <h2 className="display-face mt-3 max-w-[20ch] text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.02]">
          {copy.coachTitle}
        </h2>
        <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-ink-2">
          {copy.coachBody}
        </p>

        <div className="mt-12 grid items-start gap-12 lg:grid-cols-2">
          <CoachNote
            exercise={copy.coachDemoExercise}
            delta={copy.coachDemoDelta}
            engineLabel={copy.coachDemoEngineLabel}
            engine={copy.coachDemoEngine}
            coachLabel={copy.coachDemoCoachLabel}
            note={copy.coachDemoNote}
            clamp={copy.coachPoints[0][0]}
          />

          <ul className="space-y-7">
            {copy.coachPoints.map(([title, body]) => (
              <li key={title}>
                <h3 className="text-[16px] font-semibold leading-snug">{title}</h3>
                <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed text-ink-3">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------------- social */}
      <section className="mx-auto mt-28 max-w-6xl px-5">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 flex justify-center lg:order-1 lg:justify-start">
            <PhoneFrame glow>
              <ScreenToday />
            </PhoneFrame>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-label uppercase text-accent">{copy.socialLabel}</p>
            <h2 className="display-face mt-3 max-w-[16ch] text-[clamp(1.9rem,5vw,3rem)] leading-[1.02]">
              {copy.socialTitle}
            </h2>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-ink-2">
              {copy.socialBody}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- band */}
      <section className="relative mt-28">
        <Photo
          src="/photos/gym-deadlift.jpg"
          alt={copy.photoBandAlt}
          fade="none"
          className="h-[22rem] w-full sm:h-[26rem]"
        />
        {/* Two scrims. The vertical one closes the canvas over the top and
            bottom edges so the band reads as part of the page rather than a
            picture dropped into it; the horizontal one holds the left third
            dark, because that is where the type sits. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas via-canvas/30 to-canvas"
        />
        <div
          aria-hidden="true"
          // Stops, not a default ramp: the copy runs to about 40% of the width
          // and the athlete stands at just past half, so the scrim has to be
          // opaque across the first and gone by the second.
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas from-15% via-canvas/55 via-42% to-transparent to-72%"
        />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-5">
            <p className="text-label uppercase text-accent">{copy.bandLabel}</p>
            <h2 className="display-face mt-3 max-w-[16ch] text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.02]">
              {copy.bandTitle}
            </h2>
            <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-ink-2">
              {copy.bandBody}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ close */}
      <section className="mx-auto mt-28 max-w-6xl px-5">
        <div className="relative overflow-hidden rounded-3xl border border-hairline-strong bg-surface px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-accent/15 blur-[100px]"
          />

          {/* The empty room, well behind the type. A photograph and a drawn
              silhouette in the same box read as two different pages, so the
              lifters step out here. */}
          <Photo
            src="/photos/gym-room.jpg"
            alt={copy.photoRoomAlt}
            fade="none"
            className="pointer-events-none absolute inset-0 opacity-25"
          />
          {/* The panel is a raised surface first and a photograph second. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-surface/40"
          />

          <div className="relative">
            <h2 className="display-face mx-auto max-w-[20ch] text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.02]">
              {copy.closeTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-relaxed text-ink-2">
              {copy.closeBody}
            </p>
            <a
              href={APP_URL}
              className={cx(
                "tap mt-8 inline-flex items-center rounded-xl bg-accent px-7",
                "text-[15px] font-semibold text-accent-ink",
              )}
            >
              {copy.ctaPrimary}
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-20 max-w-6xl px-5 pb-16">
        <div className="flex flex-col gap-6 border-t border-hairline pt-8 sm:flex-row sm:items-start sm:justify-between">
          <Logo />
          <p className="max-w-[52ch] text-[12px] leading-relaxed text-ink-3">{copy.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}
