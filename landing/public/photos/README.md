# Landing page photography

These four files are what the landing page renders. They are **derived crops** —
the originals live in `assets/photos-src/`, outside `public/` so they are never
served, and are regenerated with the recipe below rather than edited by hand.

| File                 | Slot                        | Size       | Weight |
| -------------------- | --------------------------- | ---------- | ------ |
| `athlete-squat.webp` | Hero, left of the phones    | 720 × 1080 | 88 KB  |
| `athlete-curl.webp`  | Hero, right of the phones   | 720 × 1080 | 99 KB  |
| `gym-deadlift.jpg`   | Full-bleed band             | 2200 × 824 | 97 KB  |
| `gym-room.jpg`       | Backdrop of the closing CTA | 1800 × 987 | 130 KB |

Together they are about 420 KB. The originals are roughly 10 MB, which is why
none of them is served directly.

**The two hero figures are WebP because they carry an alpha channel.** Their
edges are genuinely transparent, so they composite onto the canvas with nothing
around them. The alternatives were each tried and each one showed: a CSS mask
that stops short leaves a lit rectangle, one that overcorrects leaves a dark
ellipse, and edges painted to a flat colour have to match whatever the CSS
filter does to them, which is a promise no image file can keep. Transparency has
no colour to match. The other two stay JPEG; they fill full-width bands where an
edge is wanted.

## Sources and licences

All four are from Unsplash, whose licence permits commercial use with no
attribution required. The photo ID is in each original's filename.

| Original                                    | Photographer     | Unsplash ID   |
| ------------------------------------------- | ---------------- | ------------- |
| `sushil-ghimire-5UbIqV58CW8-unsplash.jpg`   | Sushil Ghimire   | `5UbIqV58CW8` |
| `anastase-maragos-7kEpUPB8vNk-unsplash.jpg` | Anastase Maragos | `7kEpUPB8vNk` |
| `anastase-maragos-aclkvEMIfL8-unsplash.jpg` | Anastase Maragos | `aclkvEMIfL8` |
| `mohamed-fareed-rbSNsoXk-3A-unsplash.jpg`   | Mohamed Fareed   | `rbSNsoXk-3A` |

> **Three of these show identifiable people, and the Unsplash licence does not
> include a model release** — Unsplash says so itself. That is a separate
> permission from the photographer's, and using someone's likeness to promote a
> product generally needs it. `gym-room.jpg` is empty, so only it is clear of
> the question. Worth resolving before this page is anything other than a
> preview: paid model-released stock, your own photographs with a signed
> release, or crops where nobody is recognisable.

## Regenerating

Cropping is per-slot because the frames differ, and the numbers below are chosen
for what is actually in each one. `sharp` ships with Next, so no extra
dependency is needed — put this in a scratch `.mjs` at the project root and run
it with `node`.

```js
import sharp from "sharp";

// linear(a, b) is a*input + b. This pair maps the chosen shadow value to 0 and
// leaves white at white — the background goes to true black so the figure can
// stand on the canvas with no rectangle around it.
const crush = (floor) => [255 / (255 - floor), -floor * (255 / (255 - floor))];

// The alpha vignette. Two passes: a radial that closes every edge, then a
// second on the top alone, because both frames keep lamps and rigging above the
// subject that the radial leaves hanging in mid-air.
const alphaMask = (topStop) => [
  { input: Buffer.from(`<svg width="720" height="1080"><defs><radialGradient id="v" cx="48%" cy="44%" r="68%"><stop offset="0.40" stop-color="#fff" stop-opacity="1"/><stop offset="0.78" stop-color="#fff" stop-opacity="0.4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="720" height="1080" fill="url(#v)"/></svg>`), blend: "dest-in" },
  { input: Buffer.from(`<svg width="720" height="1080"><defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${topStop}" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="720" height="1080" fill="url(#t)"/></svg>`), blend: "dest-in" },
];

// Woman under a loaded bar. Already 2:3 and already monochrome, so no crop.
// Crushed, then lifted: `modulate` is multiplicative, so it brightens her lit
// side without bringing the background back with it.
await sharp("assets/photos-src/sushil-ghimire-5UbIqV58CW8-unsplash.jpg")
  .resize({ width: 720, height: 1080, fit: "cover", position: "top" })
  .linear(...crush(46))
  .modulate({ brightness: 1.35 })
  .ensureAlpha()
  .composite(alphaMask(0.17)) // her head sits high, so stop the fade above it
  .webp({ quality: 76, alphaQuality: 90, effort: 6 })
  .toFile("public/photos/athlete-squat.webp");

// Man curling, cut from a 3:2 landscape into a column tight enough to lose the
// lit wall behind him. Crushed harder, because his gym is brighter than hers.
await sharp("assets/photos-src/anastase-maragos-7kEpUPB8vNk-unsplash.jpg")
  .extract({ left: 1800, top: 100, width: 2200, height: 3300 })
  .resize({ width: 720, height: 1080, fit: "cover" })
  .linear(...crush(96))
  .ensureAlpha()
  .composite(alphaMask(0.13))
  .webp({ quality: 76, alphaQuality: 90, effort: 6 })
  .toFile("public/photos/athlete-curl.webp");

// Deadlift, for the band. `modulate` because this is the one frame shot in a
// bright white gym — the only photo lighter than the canvas it sits on, and
// correcting it here keeps one CSS treatment for every slot.
await sharp("assets/photos-src/anastase-maragos-aclkvEMIfL8-unsplash.jpg")
  .extract({ left: 0, top: 800, width: 5338, height: 2000 })
  .resize({ width: 2200, height: 824, fit: "cover" })
  .modulate({ brightness: 0.55 })
  .jpeg({ quality: 74, progressive: true, mozjpeg: true })
  .toFile("public/photos/gym-deadlift.jpg");

// The empty room: a landscape strip taken across the benches, not the ceiling.
await sharp("assets/photos-src/mohamed-fareed-rbSNsoXk-3A-unsplash.jpg")
  .extract({ left: 0, top: 2500, width: 3464, height: 1900 })
  .resize({ width: 1800, height: 987, fit: "cover" })
  .jpeg({ quality: 74, progressive: true, mozjpeg: true })
  .toFile("public/photos/gym-room.jpg");
```

## Replacing one

Keep the filename and the aspect ratio and nothing else needs touching — the
page reads these paths directly, and a slot whose file is missing paints nothing
rather than breaking.

**The two hero frames have to be shot dark on dark.** The alpha vignette is a
soft ellipse, not a cutout: it hides what is near the edges, not what is behind
the subject. A daylight frame, or one with a lit wall right behind the person,
still reads as a photograph however it is masked, because that background
survives in the middle where the alpha is fully opaque. Rim-lit, low-key, one
figure, and crush the background to black before the mask goes on.

They also render **130–256px wide**, so anything either side of the subject is
lost. The band is the opposite: it sits behind a headline occupying the left
40%, so keep the subject right of centre.

Every photo is desaturated and given a slight warm cast before it renders — see
`TREATMENT` in `src/components/landing/photo.tsx`. Judge candidates on shape and
light, not on colour.
