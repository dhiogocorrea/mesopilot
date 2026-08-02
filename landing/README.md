# Meso505 — landing site

The marketing page at **meso505.com**. The app it sells lives at
**app.meso505.com** and is the project in the directory above this one.

Two projects rather than one, deliberately: this page needs no database, no
session and no server actions, so it has no business carrying Prisma and an
auth layer in its bundle or redeploying every time the logger changes. It knows
exactly one thing about the app — its URL.

```bash
npm install
npm run dev     # http://localhost:3001
```

Port 3001 so it can run beside the app on 3000. Point the CTAs at that local
app by copying `.env.example` to `.env.local` and setting
`NEXT_PUBLIC_APP_URL=http://localhost:3000`.

## Deploying

It is a stock Next app. On Vercel, add a second project from the same
repository and set **Root Directory** to `landing`; the domain is
`meso505.com`, and `NEXT_PUBLIC_APP_URL` is the only variable it needs.

## What was copied, and what that costs

`globals.css`, `logo.tsx` and a `cx` helper are **vendored** from the app
rather than shared through a workspace. That keeps this project independent —
no monorepo wiring, no build coupling — at the price of two copies.

Which means: **a change to the design tokens or to the logo has to be made
twice.** The app's `AGENTS.md` already asks that the logo, `WeekTrack` and the
icon SVGs be kept in agreement; this is now a fourth place. If that starts
being missed, the answer is an npm workspace holding the tokens and the mark,
and the fix is mechanical.

The phone mockups in `src/components/phone.tsx` are the app's screens rebuilt
in markup, not screenshots — a picture of somebody's real training data, going
stale the first time a screen changes, is not what belongs on a marketing page.
They will drift from the product as it moves; that is a copywriting problem to
revisit occasionally, not a build one.

## The numbers on the page are real

`40 programs / 4 tracks / 81 exercises / 2–6 days a week` are counted from the
app's seed files — `prisma/seed-programs.ts`, `seed-tracks.ts` and
`seed-data.ts` in the project above. They will go stale the moment the library
grows, so recount rather than guess:

```bash
cd ..  # the app
npx tsx -e "import {EXERCISES} from './prisma/seed-data';import {TEMPLATES} from './prisma/seed-programs';import {TRACKS} from './prisma/seed-tracks';console.log(TEMPLATES.length,TRACKS.length,EXERCISES.length)"
```

The same rule the app's AGENTS.md sets applies here: **nothing on this page
claims a user count, a testimonial or a rating.** Every figure is a fact about
the product that can be checked in the repository. Don't add social proof that
isn't real, and don't make comparative claims about other products — the
footer's non-affiliation line exists precisely because this app implements
somebody else's published method.

## The photographs

See `public/photos/README.md` for what each slot expects, the crop recipe, and
the licensing position — which is not settled. Three of the four show
identifiable people under an Unsplash licence that does **not** include a model
release. That is fine for a preview and not fine for a page that is actually
selling something.
