import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import sharp from "sharp";

/**
 * Rasterises the app mark into the PNGs the install flow needs.
 *
 *   npm run icons:generate
 *
 * Two platforms refuse the SVGs we already ship:
 *
 * - **iOS** ignores the manifest's icons entirely and reads
 *   `<link rel="apple-touch-icon">`, which Next only emits for an
 *   `apple-icon.(jpg|jpeg|png)` file — no SVG. Without one, adding the app to
 *   the home screen pins a *screenshot of the page* rather than the mark.
 * - **Chrome** weighs the manifest's icons when it decides whether the app is
 *   installable at all, and a raster 192/512 pair is what every browser
 *   accepts. The SVGs stay listed beside them for devices that prefer vector.
 *
 * Generated rather than exported by hand so they cannot drift: `logo.tsx`,
 * `src/app/icon.svg`, `public/icon.svg` and `public/icon-maskable.svg` already
 * carry the same silhouette, and a stale PNG is one more copy to remember.
 * Re-run this after touching either SVG.
 */

/**
 * `icon.svg` draws its own rounded corners, so it is the source wherever the
 * platform shows the icon as-is. `icon-maskable.svg` is square, full-bleed and
 * keeps its artwork inside the safe zone — which is also what iOS wants, since
 * it applies its own squircle and a pre-rounded source comes out rounded twice.
 */
const TARGETS = [
  { from: "public/icon.svg", to: "public/icon-192.png", size: 192 },
  { from: "public/icon.svg", to: "public/icon-512.png", size: 512 },
  { from: "public/icon-maskable.svg", to: "public/icon-maskable-192.png", size: 192 },
  { from: "public/icon-maskable.svg", to: "public/icon-maskable-512.png", size: 512 },
  // 180 is the size iOS asks for; Next serves this as the apple-touch-icon.
  { from: "public/icon-maskable.svg", to: "src/app/apple-icon.png", size: 180 },
];

async function main(): Promise<void> {
  // npm scripts run from the project root, like every other script here.
  const root = process.cwd();

  for (const { from, to, size } of TARGETS) {
    const out = join(root, to);
    await mkdir(dirname(out), { recursive: true });

    // `density` is applied before the resize: libvips rasterises the SVG at
    // this DPI first, and the default 72 renders a 512pt drawing at 512px,
    // which then upscales softly instead of being drawn sharp at target size.
    const png = await sharp(join(root, from), { density: 384 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    await writeFile(out, png);
    console.log(`${to.padEnd(34)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
