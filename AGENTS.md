<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Meso505

Mobile-first hypertrophy training app. Next.js 16 (App Router) + Prisma 7 + PostgreSQL,
modelled on the Renaissance Periodization autoregulation method.

## Non-obvious constraints

- **Prisma 7 needs a driver adapter.** The client is generated to `src/generated/prisma`
  (gitignored) and instantiated with `PrismaPg`. Run `npm run db:migrate` after editing
  `prisma/schema.prisma`; `postinstall` handles `prisma generate`.
- **Postgres, hosted on Supabase.** There is no local database — `DATABASE_URL` points at
  a real server, so `db:reset` and `deleteMany` destroy the athlete's live data rather
  than a scratch file. Migrations and the seed want the *session* pooler (5432); a
  serverless deploy of the app wants the transaction pooler (6543, `?pgbouncer=true`).
- **No Prisma enums, no `Json` columns.** The schema uses `String` plus TS union types in
  `src/lib/types.ts` — that file is the source of truth for allowed values. Small lists
  are JSON-in-`String`, parsed via `src/lib/json.ts`. That portability is what made the
  move off SQLite a one-line datasource change; don't spend it.
- **All loads are stored in kilograms.** `unit` is a display preference only. Convert at
  the UI boundary with `fromKg` / `toKg` (`src/lib/units.ts`). Never write a `lb` value
  to the database.

## Accounts and authorisation

Sessions are an httpOnly cookie holding a random opaque token, with only its SHA-256 in
`AuthSession` so a database dump cannot be replayed as a login. `src/server/auth.ts` is
that whole mechanism, plus scrypt from `node:crypto` for passwords. The training-session
model is `Session`, so the auth one had to be `AuthSession`.

Three ways in, all landing on the same session:

- **Username or email + password.** `passwordHash` is nullable — a Google-only account
  has none, and `signIn` treats that exactly like a wrong password so the form never
  discloses how someone else gets in.
- **Google**, hand-rolled in `src/server/google.ts`: `state` in a short-lived cookie,
  code swapped for an access token over TLS, then the userinfo endpoint. Because the
  token arrives straight from Google on a connection only we could open, there is no ID
  token signature to verify — which removes the part of OAuth that is easy to get subtly
  wrong. Accounts are matched on the provider's `sub`, **never on email alone**; an email
  match links only to an account that has itself *verified* that address, because
  otherwise a Google account could claim someone's unverified one.
- **Email verification** (`email-tokens.ts`), same token discipline as sessions: random
  value in the link, SHA-256 in the row. Every failure returns `"invalid"` — unknown,
  expired, spent and stale-address are one answer, because which one it was is not
  information a stranger holding a guessed token should get.

Email is **optional and unenforced**: accounts predate it, and blocking unverified ones
would have locked out every account that existed before this. `RESEND_API_KEY` absent is
a supported state — the message and its link go to the server console instead, so sign-up
and verification work end to end in development with no account anywhere.

`src/server/user.ts` turns a request into a `userId`. `getUserContext()` redirects to
`/login`; `getOptionalUserContext()` returns null. The root layout **must** use the
optional one — a redirecting version wraps the login screen and sends it to itself.

**Every server action is a public endpoint, and an id from the client says nothing about
whose it is.** `src/server/ownership.ts` holds the guards; a new action that accepts an
id calls one before touching a row, or it is an IDOR. Note the two flavours:
`assertOwns*` means "you created this", `assertCanUse*` means "this is yours or it is
stock", which is what lets everyone build blocks out of the seeded library. Reads need it
too — `getSessionDetail(id, userId)` filters on the owner rather than checking after.

Columns on *stock* rows are shared by every account. That is why `setExerciseDemo` and
`archiveExercise` are restricted to the athlete's own exercises: writing `demoUrl` on a
seeded exercise would rewrite the library for everyone. Curating the inferred links again
needs a per-user override table, not a relaxed guard.

## Architecture

```
src/lib/progression/   Pure, tested autoregulation engine. No I/O, no Prisma.
src/lib/program-match  Pure, tested program↔profile scoring.
src/lib/training-time  Session duration estimates, shared by seed and UI.
src/server/            Server-only: queries, server actions, engine wiring, AI coach.
src/lib/i18n/          Flat-key dictionaries (en + pt-BR). Adding a key to `en`
                       without translating it is a compile error.
src/app/(tabs)/        The five tab screens (bottom nav). Its layout calls
                       `requireProfile()`, so every tab route is gated behind
                       the anamnesis — don't re-check `hasProfile` in pages.
src/app/session/       The logger — deliberately outside (tabs); mid-workout the nav
                       is wasted vertical space and a mis-tap risk.
prisma/seed-programs   The stock program library, in compact `"key:sets:min-max"`
                       slot form. `estimatedMinutes` is computed from these slots
                       at seed time — never hand-write it.
prisma/seed-tracks     Stock tracks: ordered runs of the programs above, by key.
                       An unknown key throws at seed time rather than silently
                       producing a track with a hole in it.
```

`Exercise.demoUrl` is backfill-only: the seed fills it via `updateMany({demoUrl: null})`
so a link the athlete curated is never overwritten, and `demoSource` distinguishes
`"inferred"` (auto-picked from a search title, shown as *Unchecked*) from `"user"`.
`src/lib/demo.ts` falls back to a name-based search when the column is null, which is
the one thing that cannot point at the wrong lift. `prisma/seed-demos.test.ts` guards
the map — run `npm test` after editing it.

Don't bulk-populate demos from a third-party dataset without checking that dataset's
*media* licence: the common exercise-GIF sets are © Gym Visual, not the MIT/Unlicense
terms their repositories advertise for the surrounding code. Linking to a video is not
redistribution; mirroring its frames is.

Programs that follow a well-known published routine are named for their structure, with
the attribution as a factual line in the description ("the split Dorian Yates built six
Mr. Olympia titles on"). Don't rename them after the person — search already covers
descriptions, so they stay findable without implying an endorsement.

**The engine never emits prose.** `decideSets` / `decideLoad` / `prescribe` return
reason *codes*; `src/lib/progression/reasons.ts` is the only place that turns them into
words, in both locales. Add a code there when you add a rule.

**Feedback is per muscle group, not per exercise** (`SessionMuscleFeedback`, one row per
`(sessionId, muscleGroupId)`). The four questions are about a muscle — "how sore was your
chest coming in" has one answer however many chest movements you did — and asking them of
every exercise produced several answers to the same question, which the engine then read
as two different accounts of one muscle's recovery while splitting that muscle's volume.
`prescribe()` still takes feedback as a parameter, so every exercise training a muscle is
prescribed from that muscle's single answer; the pure engine never knew the difference.
The logger asks after the *last* exercise of each muscle, in a bottom sheet
(`src/components/sheet.tsx`) rather than inline — mid-workout a form expanded in the list
pushes the remaining sets off screen. It **opens itself** the moment every set training
that muscle is ticked: the answers are what next week is built from, and a prompt you
have to notice and tap is one the athlete finishes the session without. Only the
transition fires it — muscles already finished when the screen mounts are seeded as
asked, so reopening a session is not greeted by a modal, and dismissing it leaves the
row to tap. Un-ticking a set arms it again.

**Mesocycles are generated one week at a time.** Week 1 is written when the block is
created; every later week is written by `applyProgression` as the previous one is
completed — next week's prescription depends on feedback that doesn't exist yet. Don't
add code that assumes future weeks are already in the database.

**The plan *is* the sessions**, which is why editing one mid-workout needs a scope. Next
week is generated from this week's entries, so a movement swapped in the logger is
permanent unless the row says otherwise — the athlete is asked "just today" or "and the
coming weeks", and `SessionExercise.plan` / `plannedExerciseId` carry the answer.
`plan` is `"planned"` (do it, carry it), `"extra"` (added today, `applyProgression`
drops it) or `"skipped"` (kept in the plan, not done today); `plannedExerciseId` is the
movement a one-off substitution stands in for, and `applyProgression` writes
`plannedExerciseId ?? exerciseId` into next week. Neither column is copied forward — a
generated week always starts clean.

A skipped entry **never reaches the engine**: an untouched slot looks exactly like a
session that produced nothing, and `prescribe()` would cut its sets on the strength of
work that was never attempted. It is carried over unchanged at the new week's RIR with
the `skipped_last_week` reason, and it is excluded from `weeklyVolumeByMuscle` because
the muscle did not receive those sets.

**A completed session is closed to writes, and `reopenSession` is the only way back
in.** `logSet`, `addSet`, `removeSet`, `saveFeedback` and the three edit actions all
call `assertSessionOpen` — the ownership guards return the session's status so it costs
no extra read. Editing a finished session in place left its numbers and the week they
produced disagreeing, with nothing to notice.

Reopening deletes the week this session generated, because finishing again writes it
afresh from the corrected numbers — so it is refused once that week has been started,
and the athlete is told why rather than losing real sets to a correction. `clear` also
wipes the log and returns the session to `planned`, keeping the prescribed load (that is
the plan, not a record). Reopening a final-week session puts the *block* back to
`active`: it was marked completed by whichever final-week session was finished first.

**Deleting a session is deliberately not offered.** The block is a chain — Week 3 Day 1
exists because Week 2 Day 1 was finished — so removing a link leaves that day unable to
ever produce another session. Reopening rewinds the chain instead of cutting it.

**Achievements are never revoked**, only re-evaluated. An unlock row records that it
happened, and correcting a typo does not un-happen it; the alternative punishes the one
behaviour you want. It also makes re-finishing idempotent.

Swaps are **within a muscle group only**. The slot carries that muscle's volume and the
engine reasons about volume per muscle; a chest slot that quietly became a biceps one
moves a week's sets between two sets of landmarks with nothing saying so. All three
edits also refuse once a set is ticked on the entry — substituting under logged numbers
files them against a lift that never did them, and `getPreviousPerformance` keys on the
exercise, so the corrupted comparison outlives the session.

**Both writers batch, and they have to.** Creating a block or a week means dozens of
rows; as one round-trip each inside `$transaction` that overran Prisma's 5s interactive
timeout against a hosted database — a full block is ~60 writes. Both use
`createManyAndReturn` and match children to parents by a returned key (`dayIndex`,
`order`) rather than by row order. `applyProgression` computes every prescription
*before* opening the transaction, which it can because the engine is pure. Don't
reintroduce a per-row loop in there.

**A track is an ordered list of programs, and a block remembers its *index* in one**
(`Mesocycle.trackId` + `trackPosition`), not the entry row. Re-importing a program
rebuilds its `ProgramTrackEntry` rows, which would orphan a foreign key mid-track; an
index survives that, and `src/server/track.ts` degrades to "no next block" if the track
got shorter. Everything track-related is optional — a block with a null `trackId` is the
normal one-off and every screen must keep working for it.

**The picker shows tracks only — never two lists.** A program that belongs to no track
is presented as a track of one (`kind: "block"`), assembled in `plan/new/page.tsx`, not
in the database; there are no one-entry `ProgramTrack` rows. A program that *is* a step
of a track is listed only inside it — "PBP · 5-WEEK NOVELTY PHASE" is not an offer on
its own, and showing it twice put the same training in the picker under two names. This
is why the stock tracks own their blocks (`foundations_learn`, `hyper_build_base`, …)
instead of pointing at `upper_lower_4`: composing a track out of a standalone program
would delete that program from the library. Both shapes rank through the same
`rankPrograms`, fed the **first** block's days and minutes — the one you would start
today. Feeding it the hardest block instead is correct on paper and hid every
multi-block track behind the profile filter, which is how the feature stops existing.
For the same reason a multi-block track survives that filter when its first block is
within a day and 15 minutes of the profile (`startableNow`); the row still states the
mismatch. Don't reintroduce a separate program list: having to decide between "a
program" and "a sequence of programs" before choosing either was the confusion this
collapsed.

**The AI coach reviews, it doesn't decide.** `src/server/coach.ts` runs *after* the
deterministic engine and its overrides are clamped to ±1 set and ±10% load. With no model
configured the app is fully functional on the engine alone, and any coach failure is
swallowed so it can never lose logged work. Keep it that way.

The provider is reached through LangChain and chosen in `createModel`: Azure OpenAI when
its variables are complete, plain OpenAI otherwise, null when neither is. Azure wins when
both are present — a stray `OPENAI_API_KEY` must never silently redirect an athlete's
data to another vendor. Everything below `createModel` speaks `BaseChatModel`, and the
response shape is the same zod schema the app validates with elsewhere, handed to
`withStructuredOutput` — don't reintroduce a hand-written JSON schema or a hand-written
parser.

## Achievements

`src/lib/achievements/` is pure and tested, like the progression engine: the catalogue
is a code constant and `evaluate()` turns numbers into awards with no I/O. Only the
*unlock* is a database row, because only the unlock is per-athlete.

Three rules the tests enforce, and one they cannot:

- **Keys are permanent.** They are written into `UserAchievement` rows; renaming one
  orphans every medal already earned.
- **Points are snapshotted onto the row at unlock.** A leaderboard is then
  `sum(points) group by userId` — one aggregate rather than loading every unlock and
  re-scoring it — and re-pricing a medal never rewrites what someone already has.
- **Every tier crossed is awarded at once**, not just the next one. A single huge
  session, or an imported history, can legitimately clear two, and dropping the lower
  one leaves a hole nothing ever fills.

`awardAchievements` swallows its own failures for the same reason the coach does: it
runs *after* the session is saved, and a medal arriving late is a non-event next to a
session that failed to save. It is called at the end of `finishSession`, after
`applyProgression` has had its chance to complete the block, so "finish a block" can
fire on the session that finished it. Newly earned keys ride to the summary screen in
the query string, and the page re-checks each one against what the athlete actually
holds — a hand-edited URL shows nothing.

## Friends

`src/server/friends.ts` is the whole read side; `friend-actions.ts` is the write side.

**What a friend can see is deliberately narrow, and the narrowness is the feature.**
Completed sessions and unlocked medals — nothing from `Profile`. Bodyweight, injuries,
sleep, stress, nutrition and caloric state are health data that happens to live in the
same database, and none of it is part of "see their progress". Every query in that file
uses an explicit `select` of `{ id, username, name }` for other people; never widen it
to `include: { profile: true }` for convenience.

Consent is mutual and explicit. A `Friendship` row does nothing until `status` is
`"accepted"`, so nobody's history becomes visible by someone else's action alone. One
row holds the pair with whoever asked first, which means **every read has to look in
both directions** — `acceptedEdges` is the only place that resolves that, and everything
else goes through it.

A declined row is kept rather than deleted, and the unique constraint on
`(requesterId, addresseeId)` is what then stops the same person asking again. Deleting
it would turn "no" into a button someone can press daily. Removing a friend *does*
delete the row, because that is not a "no" that needs remembering.

`friendProfile()` is the one read that takes a **username from the URL**, so it resolves
the account and then checks the friendship itself — the page cannot be trusted to do it,
because this is the function that touches the rows. A username that is not an accepted
friend (including the athlete's own) returns null and the route 404s. It lists only
*earned* medals: `achievementSummary` also returns the locked ones with progress toward
every threshold, which would hand over a reconstruction of their whole training profile
rather than the highlights they agreed to share.

`leaderboard()` covers the viewer and their accepted friends only — there is no global
board, because a stranger's total is not something either of you agreed to share. It
sums the snapshotted `points` column, which is the reason that column exists, and
returns **both windows from one pass**: all-time and the current month, split in memory
rather than asked of the database twice. The month filters on `unlockedAt` — a medal is
a thing that happened on a day — not on replaying what someone would have earned by a
date.

The shape and the sort live in `src/lib/standings.ts`, not in `friends.ts`, because
`src/components/standings.tsx` is a client component and importing anything from
`src/server/` drags `server-only` (and Prisma behind it) into the browser bundle. The
period toggle is local state for the same reason it is worth having: both windows are
already on the device, so switching is a re-sort, not a round trip. Routing it through a
search param re-fetched the whole page to change one section and lost the reader's place
— the standings sit mid-screen, and `scroll={false}` did not hold position across it.

`rankBy` ties on sessions before falling back to the username. Medals are milestones, so
most months nobody crosses one; without that tiebreak the monthly board is alphabetical.

The feed is derived from the training data, not written to an events table: nothing to
backfill, nothing to keep in sync, and a session that is edited or deleted stops being
in the feed because it stops being true. Two reads merged in memory beats an append-only
log that can disagree with the sessions it describes.

## Notifications

`src/server/notify.ts` is the whole send side. `notify(userId, kind, params)` is
the only way anything reaches an athlete who is not looking at the app, and it
holds three properties on purpose:

- **It takes a `userId` and nothing from the request.** That is what will let a
  scheduled job call it. `coachSession()` reads `getUserContext()` internally and
  therefore *cannot* run outside a request — this must not repeat that.
- **It localises from the recipient's `User.locale`**, never the actor's request
  context, so a Brazilian athlete hears about an English-speaking friend's
  request in Portuguese. Copy lives in the dictionaries as `notif.*` keys rather
  than in a local `COPY` const like `email.ts`, because `pt` being typed as
  `Dictionary` is what makes a missing translation a compile error.
- **It cannot break its caller.** The body is wrapped, it returns `void` so
  nothing can branch on it, and every call site goes through `after()`. Same
  reasoning as `awardAchievements` and the coach.

`NotifyPayloads` is a mapped type, one entry per kind. That is the outbound half
of the privacy rule `friends.ts` enforces on reads — a payload cannot mention
bodyweight or injuries because no kind's params admit them. Widening a payload to
`Record<string, unknown>` would throw that away.

**`PushDevice`, not `PushSubscription`** — the latter is a `lib.dom` global the
client opt-in uses, and a generated model of that name shadows it silently. Same
collision that forced `AuthSession`. The `endpoint` *is* the device and is
unique, so saving is an upsert; `userId` is in the **update** branch too, because
the same browser can later be signed in as someone else.

**The row is the preference.** Subscribing is the opt-in and the Settings switch
deletes the rows, so there is nothing left that can be sent. There is no
preferences table until scheduled nudges arrive — those are the ones people mute
individually, and they want an opt-out row (absent row = subscribed, the
`Friendship` declined-row logic inverted), not a column per category.

A 404 or 410 from the push service means that subscription is gone for good, so
the row is deleted **by endpoint** with `deleteMany` — `delete` throws when two
concurrent sends both find it already gone. Any other status is a bad afternoon
at Google, not a reason to unsubscribe someone.

VAPID keys absent is a supported state, like `RESEND_API_KEY` and the coach: the
message is logged instead of sent. Two traps worth keeping in mind —
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` is inlined at **build** time, so missing it from
the build environment ships `undefined` to the browser while the server looks
configured; and `web-push` accepts only an `https:` or `mailto:` VAPID subject,
which `http://localhost` is not, so `vapidSubject()` cannot simply fall back to
`appUrl()`.

`public/sw.js` is plain JavaScript served verbatim, with **no `fetch` handler** —
adding one would quietly give the app offline caching it has never been built or
tested for, and a stale prescription served from a cache mid-workout is worse
than a page that does not load. `next.config.ts` sends it `no-store`, because a
browser holding a stale worker runs last month's push handler indefinitely.

**On iOS, push is delivered only to a home-screen-installed app.** That makes the
install prompt a hard prerequisite there, which is why `push-prompt.tsx` renders
nothing when `isIOSDevice() && !isStandalone()` and holds itself back while the
install prompt is still on offer. Both mount in the tabs layout; two self-opening
sheets stacking reads as a bug. The device facts they share live in
`src/lib/device.ts` so the two can never disagree — and `m505_visits` has exactly
one writer, `InstallPrompt`, because a second one would double-count and break
both gates.

## Visual system

Dark only — `color-scheme: dark`, no light branch. One surface to design against.

Tokens live in `src/app/globals.css`; **never hardcode a hex in a component.**
Canvas → `surface` → `surface-2` → `surface-3` are deliberately small steps (a big
jump on dark reads as a modal, not as grouping). Text is `ink` / `ink-2` / `ink-3`.

**Structure comes from type, spacing and hairlines — not from boxing everything.**
`Panel` is at most one per screen, for the thing the screen exists to do; group with
`Section` (a small uppercase label) and `List`/`Row` (hairline-separated, bleeding to
the screen edge) instead. If a new screen stacks three bordered boxes, that's the
regression this redesign removed.

The accent (`#e12b34`) marks what you can act on and what is live. Nothing decorative.
A screen with more than a handful of accent-coloured elements is overusing it — the
exercise library has exactly one. Text *on* the accent is white (`--color-accent-ink`);
red is too dark for the inverted treatment orange allowed.

**Headings wear `display-face`, figures never do.** That utility switches to a condensed
stack and uppercases, which is what gives the app its gym register — and condensed digits
are the last thing you want to read between sets, so the number rows stay on the sans.
There is still no webfont: every family in `--font-display` ships with a platform, and a
build-time font fetch has broken this build before.

The logo is `src/components/logo.tsx`, drawn as geometry rather than set in a typeface —
with no webfont, live text would render differently on every device, and a logo that
changes shape by device is not a logo. It is a mesocycle in profile: four climbing weeks,
the peak in accent, then the deload drop — the same silhouette `WeekTrack` draws on
Today. Keep those two in agreement; the mark means something only while the app actually
works that way. `public/icon.svg`, `public/icon-maskable.svg` and `src/app/icon.svg`
carry the same mark and must be updated together.

The PNGs beside them (`public/icon-{192,512}.png`, `public/icon-maskable-*.png` and
`src/app/apple-icon.png`) are **generated** — `npm run icons:generate` rasterises them
from those SVGs, so edit the SVG and re-run rather than exporting one by hand. They
exist because the install flow cannot use vector: iOS ignores the manifest's icons
entirely and reads `apple-touch-icon`, which Next only emits for an
`apple-icon.(jpg|jpeg|png)` file, and without one "Add to Home Screen" pins a
screenshot of the page. Chromium also weighs the manifest's icons when deciding whether
the app is installable at all, which is what makes `beforeinstallprompt` fire.

The visual register borrows the category's vocabulary — near-black, one signal red,
condensed caps — and none of anyone's identity. Don't import a competitor's mark,
wordmark, brand colour or typeface, and don't describe the app as affiliated with the
Renaissance Periodization people whose method it implements.

## The landing page lives in the sibling `meso505-site/` project

It is a **separate Next project in its own directory** (`../meso505-site`),
deployed on its own to meso505.com while the app takes app.meso505.com. It has
no Prisma, no session and no server actions — the only thing it knows about the
app is its URL, in `NEXT_PUBLIC_APP_URL`. It lives entirely outside this project
now, so it has no bearing on this app's `tsconfig.json` or `eslint.config.mjs`;
`meso505-site/README.md` is its own documentation.

One consequence for this project:

- `globals.css` and `logo.tsx` are **vendored** into it. A token or a mark
  changed here has to be changed there too — the same rule that already applies
  to `public/icon.svg`, `public/icon-maskable.svg` and `src/app/icon.svg`.

Nothing on that page claims a user count, a testimonial or a rating, and every
figure on it is a fact about the product that can be checked in this repository.
Keep it that way.

**A person is an `Avatar` and a `PersonName`** (`src/components/avatar.tsx`) — name on
top, `@username` under it, everywhere someone is listed. The avatar is initials, not a
colour-coded disc: identity colour is decorative colour, and a row of tinted circles on
this canvas competes with the one accent that means "live". It is drawn rather than
fetched, so rendering a friend's row sends no viewer's IP to a third-party host.
`initialsFor` lives in `src/lib/initials.ts`, pure and tested, because every edge case is
in the string. The standings podium takes its three metals from `TIER_INK` in
`medal.tsx` rather than a second set of hexes.

**Charts are drawn by hand** (`src/components/chart.tsx`) — the app ships no webfont and
no third-party bundle, and a charting library would outweigh the whole progress screen
and still need overriding to reach the palette. They carry no gridlines, axes or legend:
the figure beside the shape is the reading, and the accent marks only the live value.
`Sparkline` returns null below two points and centres a flat series (scaling it against
a zero span puts a lift that has not moved along the floor, which reads as a collapse);
`BarChart` gives a zero-value session a visible sliver so a rest day and a missing bar
are not the same picture.

**Any screen the bottom nav cannot reach needs `ScreenHeader back=`.** `/achievements`,
`/friends` and `/friends/[username]` live under `(tabs)` for the layout but have no tab,
so no tab is ever marked current and without the chevron they are dead ends.

Numbers are the hero: `tabular-nums` is on globally so figures don't reflow mid-set,
and the `text-display` / `Stat` sizes are tuned for figures rather than prose.

## Exercise names in two languages

Seeded exercises are translated by hand in `prisma/seed-data.ts`. *Imported* ones arrive
with only an English name, and the importer used to copy it into `namePt` — which left a
Portuguese athlete reading a library half in English.

`src/lib/i18n/exercise-names.ts` composes the Portuguese instead of listing it: gym names
are `[modifiers] [equipment] [movement]`, so a vocabulary of each is reassembled in
Portuguese word order. Two rules make the output read like Portuguese rather than
translated English:

- Adjectives **agree with the head noun's gender** — *Remada sentad**a*** but *Supino
  sentad**o***, from the same English word.
- Bare adjectives hug the noun, prepositional phrases trail: *Rosca alternada com
  halteres*, never *Rosca com halteres alternada*.

It returns `null` when any part of the name is not vocabulary — a half-translated name is
worse than an English one. `npm run translate:exercises` fills in anything still
untranslated (`--write` to apply, dry run by default) and only touches rows where
`namePt` still equals `nameEn`, so a name the athlete edited is never overwritten.

Growing the vocabulary is the way to cover a new program; the override map is for names
that genuinely do not decompose.

## Importing purchased programs

`scripts/import-programs.ts` reads published `.xlsx` programs into the database.
`scripts/readers.ts` picks the parser and the naming from the filename — `parse-pbp.ts`
for Pure Bodybuilding, `parse-minmax.ts` for Min-Max. They share the cell helpers
(`unmangle`, `cell`, `hyperlink`) and the `PbpBlock` output shape, but not the row
walker: Min-Max puts every column one to the right, marks blocks with `Block n` rows
inside a single sheet, and repeats each block for six `Week n` sections. **Only the
first week of a Min-Max block is read** — within a block the sets, reps, rest and
exercise selection never change, only the RIR targets, and RIR is the one thing this
app's engine ramps for itself. A new publisher means a new parser plus a branch in
`readerFor`, not conditionals threaded through an existing walker. **Their contents must never end up in this repo** — it is a paid product, and
committing it to source control is a different act from serving it off a deployment.
That is the whole reason this is an importer and not a seed; don't "helpfully" move the
output into `prisma/`.

`--shared` writes the programs, tracks and their exercises as platform content
(`isCustom: false, userId: null`) instead of one athlete's library, so every account
sees them. Whether a given workbook may be published that way is a licensing question
for whoever runs the deployment, not something the script can decide — the flag exists
so the answer is at least deliberate. Re-running with it **promotes** rows imported
privately before rather than duplicating them, which is why the template and track
lookups drop the `userId` filter in shared mode. Exercises get promoted too: a shared
program built out of one athlete's private exercises would be visible to everyone and
readable by nobody.

Two traps the parser exists to handle, both worth knowing if you touch it:

- **Excel silently turned ranges into dates.** `8-10` became `2024-08-10`, `1-2` became
  `2023-01-02`. Month and day *are* the range, and neither column can legitimately hold
  a date, so the damage is reversible — see `unmangle()`.
- **exceljs returns the master value for every cell in a merged range** (openpyxl
  returns null for the non-anchor cells). Day labels are merged down their rows, so a
  new day starts only when the label *changes*. Exercise names are
  `{ text, hyperlink }` objects, and that hyperlink is the program author's own demo
  video — carried across as `demoUrl` with `demoSource: "program"`, which outranks an
  `"inferred"` link but never an athlete's own choice.
- **A workbook lists a rotation, not a week.** PBP's PPL is eight sessions
  (Pull/Push/Legs/Arms #1 then #2) run *four a week over a fortnight*. Storing the raw
  session count as `daysPerWeek` made those programs match nobody's profile, so
  `rotationWeeks()` spreads anything over six sessions across as many weeks as it needs.
  `ProgramTemplate.daysPerWeek` is therefore the athlete's **frequency**; the number of
  sessions in a pass is `days.length`, and `createMesocycleFromTemplate` writes *that*
  to `Mesocycle.daysPerWeek` so the progress total counts what actually gets generated.
  Note the residual: a mesocycle "week" is one pass, so a 5-week PPL block is ten
  calendar weeks.

`npm run import:dry-run -- "<file.xlsx>"` parses and prints without writing, which is
the right way to check a workbook before letting it near the database.

Everything the importer writes gets `source: "import"`. `isCustom` alone means "not
shipped with the app", which covers both what the athlete built and what they imported —
only the first is *by* them, and the **"My program" chip must never appear on imported
content**. Derive the distinction with `programOrigin()` (`src/lib/types.ts`); an
imported program is still fully editable, so only the label differs.

## Commands

```bash
npm run dev         # dev server
npm test            # engine unit tests (node:test via tsx)
npm run typecheck   # tsc --noEmit
npm run lint
npm run db:seed     # idempotent — upserts muscles, exercises, programs, tracks
npm run db:deploy   # apply pending migrations (what CI/production runs)
npm run db:reset    # DESTRUCTIVE — drops the shared database. Ask first.
```

Run `npm test` after touching anything in `src/lib/progression/` or
`src/lib/program-match.ts` — those are the parts of this app that are genuinely easy
to break silently.

After changing `prisma/schema.prisma`, run `prisma generate` **and restart the dev
server**. `migrate dev` does not always regenerate, and `src/lib/db.ts` caches the
client on `globalThis`, so a running server will keep serving the old shape — new
columns silently come back `undefined` rather than erroring.

> ⚠️ **`DATABASE_URL` is a live, shared database with real training history.** It is
> not scratch space: it holds actual profiles, blocks and logged sets for every
> account, and there is no backup. Never run `db:reset`, `deleteMany`, or a profile
> rewrite to tidy up after yourself — ask first, and prefer creating a throwaway block
> you delete by id over clearing a table. `db:reset` in particular now drops *other
> people's* data, not just the developer's.
