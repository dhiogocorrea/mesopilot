# Meso505

A mobile-first training app for hypertrophy, built around the Renaissance Periodization
autoregulation model: you log what you actually lifted, answer four questions about how
it felt, and the app decides next week's volume and load for you.

## How the progression works

Each training block (mesocycle) runs 4–8 weeks, the last of which is a deload.

**Effort ramps automatically.** Week 1 targets 3 reps in reserve and steps down to 0 on
the final training week, so intensity climbs as the block accumulates fatigue.

**Volume responds to feedback.** After each exercise you answer four questions:

| Question | What it tells the engine |
| --- | --- |
| How sore was this muscle coming in? | Whether you recovered in time |
| How was the pump? | Whether the stimulus was enough |
| How hard was the work? | What the session cost you |
| Any joint or tendon pain? | Whether to back off for safety |

Those combine into a set change, clamped so a muscle's weekly volume stays between its
MEV (minimum effective volume) and MRV (maximum recoverable volume). Hit MRV and the app
tells you a deload is due. Report real joint pain and it cuts volume and flags the
exercise for a swap regardless of how good the pump was.

**Load responds to performance.** The engine projects what you'd manage at next week's
lower RIR target. Beat the top of the rep range and the weight goes up — by one loadable
increment minimum, more on lower-body compounds than on curls. Fall short and it comes
down.

**Recovery context throttles everything.** Poor sleep, high stress, or a calorie deficit
cap how fast volume climbs, because the extra sets won't be recovered anyway.

Every prescription is explained. Tap *Why this prescription?* on any exercise to see the
reasoning behind it.

## The AI layer

With a model configured, it reviews each completed session against the engine's output
and your training history, writes a short note per exercise, and can nudge the
prescription. It is a reviewer, not the author: overrides are clamped to ±1 set and ±10%
load, and if the model is unavailable the deterministic engine's answer stands. **The app
is fully functional without it.**

The provider goes through LangChain, so it is a deployment detail rather than something
the training code knows about. **Azure OpenAI is the primary target**; plain OpenAI is
the fallback when the Azure variables are incomplete. Adding another provider is one
branch in `createModel` and nothing else.

## Stack

Next.js 16 (App Router, React 19) · Prisma 7 + PostgreSQL · Tailwind 4 · LangChain.
English and Brazilian Portuguese throughout, including the exercise library.

## Accounts

Sign in with a username or email and a password, or with Google. Passwords are hashed
with scrypt from Node's standard library; the session cookie holds a random opaque token
and the database stores only its SHA-256, so a leaked dump cannot be replayed as a login.

Signing up sends a confirmation email through Resend. Confirming is not required to
train — the app works either way — and Settings shows the status with a button to send
the link again. Without `RESEND_API_KEY` the email is printed to the server console,
link included, so the whole flow works in development.

Each account's training data is its own. Server actions are public HTTP endpoints, so
every one that takes an id checks who owns it before writing — see
`src/server/ownership.ts`. The seeded exercises, programs and tracks are shared and
read-only; anything you create belongs to you alone.

## Getting started

```bash
npm install
cp .env.example .env   # then point DATABASE_URL at your Postgres
npm run db:deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000 — best viewed with a phone-sized viewport. Sign up, and the
first run walks you through the health and training profile, then the track picker.

Seeded content: 14 muscle groups with volume landmarks, 81 exercises, and 30 standalone
programs spanning 2–6 days a week, 20–65 minutes a session, every experience level and
all four goals — plus 4 tracks built from 10 more blocks written as their phases. You
can add your own exercises from the Exercises tab.

Alongside the standard splits (full body, upper/lower, push/pull/legs, chest & triceps /
back & biceps, body-part splits) there are several well-known historical routines: the
six-lift full-body program Arnold Schwarzenegger trained on early in his career, the
one-set-to-failure split Dorian Yates used, Charles Poliquin's 10×10 German Volume
Training, and the power/hypertrophy hybrids the lifting community calls PHUL and PHAT.

These are named for what they *are* rather than who ran them, with the lineage stated in
the description — a training method isn't ownable, but implying someone endorsed this
app's version of it would be dishonest. Search covers descriptions, so "arnold",
"yates", "poliquin" or "phat" all find them.

## Tracks and blocks

A **block** is one 4–8 week mesocycle. A **track** is one block or several, run in
order — it answers "and then what?" rather than just "what do I train this month?".

**The picker only ever shows tracks.** A program that stands alone is simply a track of
one, so there is no second list and nothing to choose between before you have chosen
anything. Tap a track to see the blocks inside it, and tap a block to see its days and
exercises before you commit.

A block that belongs to a track appears **only inside it**. A phase of a longer program
is not something you would run on its own — *Pure Bodybuilding · 5-week novelty phase*
means nothing outside the sequence it was written for.

Today and the Plan tab show where you are (*Foundations · Block 1 of 3*), and when a
block finishes the app offers the next one by name instead of dropping you back into
the full picker. A one-off block behaves exactly as it always did.

Four multi-block tracks ship with the app — Foundations, Hypertrophy Build, Strength &
Size and Lean Out — and importing a multi-block program builds one from its blocks.

Their blocks are written *as phases* (*Foundations · Learn the Lifts*, then *Add
Volume*, then *Split the Week*) rather than borrowed from the standalone library. A
track built out of Upper / Lower 4x would have taken Upper / Lower 4x off the list,
since a block that belongs to a track is only shown inside it.

## Finding a track

The picker ranks every track against your profile and, by default, shows only the ones
that actually fit: the same number of training days you committed to, and a session
that lands inside your stated time budget (with five minutes of slack, because nobody's
gym window is precise to the minute). Days and duration are hard constraints — a block
you can't fit into your week won't get done — while experience level and goal only
influence the ranking.

A track is judged by the block you would start *now*, not by its hardest, because a
track is meant to grow your capacity as it goes. Multi-block tracks stay on screen even
under the filter as long as that first block is close to what you can do — the summary
line shows the full spread (*3–4 days · ~45–60 min*) and the row says plainly where it
misses.

Every row says plainly why it does or doesn't fit ("6 days a week — you planned 4",
"15 min over your 45 min"), and when nothing matches exactly the filter relaxes itself
and tells you rather than showing an empty screen. Search covers names, descriptions and
the names of the blocks inside, and ignores accents, so `forca` finds *Força Minimalista*.

Session lengths are computed from each block's own prescribed sets and rest periods
rather than assigned by hand, so they stay honest if the content changes.

## Achievements

Finishing sessions earns medals and points. Twenty-two of them across six metrics —
sessions completed, blocks completed, blocks with nothing skipped, total tonnage, the
weekly training streak, and how many different exercises you have logged — in four
tiers worth 10, 25, 50 and 100 points.

New medals appear on the session summary, right where you finished the work. The full
list lives under Progress → All achievements, with the locked ones sorted by how close
you are rather than alphabetically, so the top of that list is what you could earn next.

The streak counts back from your most recent session rather than from today, so it does
not evaporate mid-week — it breaks only once a whole Monday-to-Sunday week passes with
nothing logged.

Points are snapshotted onto each unlock, which keeps a future leaderboard to a single
`sum(points)` and means re-pricing a medal never changes what anyone already earned.

## Friends

Add someone by their exact username — there is no directory to browse — and they have to
accept before either of you sees anything. Once connected, the Friends screen shows a
feed of their finished sessions and the medals they earn, plus a list of everyone with
their points, sessions and current streak.

**Your health profile is never shared.** Bodyweight, injuries, sleep, stress, nutrition
and caloric state stay yours; friends see training activity and nothing else. The screen
says so where you add people, so you know what you are agreeing to before you agree.

Either of you can end a friendship, and both stop seeing each other immediately. A
declined request stays declined — the person who asked cannot simply ask again.

## Form demonstrations

Every exercise has a demo control, in the library and on each card in the session logger.

All 81 ship with a video that **plays inline** — YouTube and Vimeo embed in-page via
`youtube-nocookie.com`, and direct `.gif` / `.mp4` / `.webm` files render in place.

### These are unverified, and the app says so

Each link was chosen by searching for the exercise name and taking the result whose
*title* matched most exactly. **Nobody has watched them.** A title can misdescribe its
video, and videos get deleted. So every seeded link is marked `demoSource: "inferred"`,
and opening an exercise's demo editor says so.

That caveat deliberately does *not* appear in the list itself. When all 81 carry the
same mark it stops reading as "unverified link" and starts reading as "broken
exercise" — a warning that applies to everything communicates nothing except alarm.

Paste your own link on any exercise and it becomes `"user"`: the caveat disappears and
the seed will never overwrite it. Clearing a link restores the fallback — a **search
built from the exercise's own name** in your current language, which cannot point at
the wrong movement. Only `http(s)` URLs are accepted.

`npm test` guards the map: every key must be a real exercise, all 81 must be covered,
every URL must be a watchable video rather than a search page, and no two exercises may
share a video (which is nearly always a copy-paste slip).

**No bundled GIF library.** Every free exercise-GIF dataset investigated either carries
third-party copyright (the widely-mirrored animation sets are © Gym Visual and require
your own licence) or has unresolved licensing questions. Linking to videos avoids
redistributing anything. If you licence a media set, `demoUrl` takes those URLs directly.

## Importing a program you own

If you have a training program as a spreadsheet, `npm run import:programs -- "<folder>"`
reads it into your database. It currently understands two layouts, chosen by filename:
the Pure Bodybuilding Program and the Min-Max Program.

```bash
npm run import:dry-run -- "path/to/Program.xlsx"            # parse and print, no writes
npm run import:programs -- "path/to/folder" alice           # into alice's library
npm run import:programs -- "path/to/folder" alice --shared  # onto the platform
```

By default the programs belong to one account and nobody else can see them. `--shared`
publishes them beside the seeded library so every account gets them, promoting the
exercises they use along the way. Whether a given program may be shared that way is a
licensing question about your copy, not something the importer can answer — the flag is
there so the choice is deliberate rather than a side effect.

Re-running is safe: programs are matched by name and rebuilt, exercises are matched
before being created, and a demo link you chose yourself is never overwritten. Re-running
with `--shared` promotes what was imported privately instead of duplicating it.

Published programs usually come as several blocks meant to be run back to back, so the
importer also stitches them into a track per split — build, then novelty, then the
harder phases, in the order the author intended.

Imported programs are yours to edit but are not labelled *My program* — that badge is
for programs you actually wrote. The difference is `source: "import"`, set by the
importer and nothing else.

**The source files stay where they are.** Nothing from a purchased program is copied
into this repository — importing your own copy for your own training is one thing,
committing its contents to source control is redistribution.

## Building your own program

*Build your own* opens a builder where you name the program, add days, and fill each one
from the exercise library — setting sets, rep range and rest per exercise, and reordering
them. The estimated session length updates as you go, and your program then sits in the
picker alongside the stock ones, ranked against your profile the same way.

The faster route is usually **Duplicate & edit** on any existing program: it copies the
whole thing into the builder so you can change the few exercises you actually care about
instead of starting from a blank page. The original is untouched.

Editing or deleting a custom program never disturbs a block already in progress —
sessions copy their own prescriptions when the block is created.

### Optional: enable the AI coach

Azure needs three things in `.env` — the key, the **deployment** name (Azure pins the
model to the deployment, so there is no model name to set), and the endpoint:

```
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_API_DEPLOYMENT_NAME=your-deployment
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
```

`AZURE_OPENAI_API_INSTANCE_NAME` works instead of the endpoint, and
`AZURE_OPENAI_API_VERSION` overrides the default. Set `OPENAI_API_KEY` instead to use
plain OpenAI. Leave all of it blank and the engine runs alone.

### Deploying

`DATABASE_URL` is a real Postgres server, so `npm run db:reset` drops everyone's data,
not a local file. Production applies migrations with `npm run db:deploy`.

On Supabase, use the **session pooler** (port 5432) for migrations and the seed, and the
**transaction pooler** (port 6543, `?pgbouncer=true`) for the app itself if you deploy
somewhere serverless — one connection per function instance exhausts direct connections
quickly.

## Development

```bash
npm test           # progression engine unit tests
npm run typecheck
npm run lint
npm run db:reset   # wipe and reseed
```

## Not built yet

- Password reset — there is no email on file, so a forgotten password needs a database edit
- Curating the demo link on a *seeded* exercise; those rows are shared between accounts,
  so it needs a per-user override table
- Offline support; the logger needs a connection to save sets
- Reordering days (exercises within a day can be reordered; days themselves cannot)
