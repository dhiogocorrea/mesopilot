import { cx } from "@/lib/cx";

/**
 * A photograph on the landing page.
 *
 * Painted as a background rather than an `<img>`: a file that is not there
 * simply does not paint, where an `<img>` would render a broken-image glyph.
 * See `public/photos/README.md` for what each slot expects.
 *
 * Art direction is not decoration here. A full-colour photograph on this canvas
 * would be the only thing on the page carrying colour that is not the accent,
 * and it would tear a hole in a palette the whole app is built on. So every
 * photo is desaturated and given a slight warm cast.
 *
 * That treatment is a **filter on the image layer**, not a tint overlaid on
 * top, and the difference matters: an overlay paints its colour whether or not
 * the photograph loaded, which turned each empty slot into a coloured
 * rectangle. A filter has nothing to act on until there is an image.
 */

/**
 * Grey first, then a little warmth turned toward the accent's hue. Deliberately
 * restrained: the accent means "live" everywhere else in this product, and a
 * photograph washed red is decorative accent — it makes the buttons stop
 * reading as the loud thing on the page. Near-monochrome with a warm cast sits
 * under the type instead of competing with it.
 *
 * Built from filters so it costs no second element and disappears with the
 * image, which is the whole reason an overlay was wrong.
 */
const TREATMENT =
  "[filter:grayscale(1)_sepia(0.38)_hue-rotate(-18deg)_saturate(1.35)_contrast(1.08)_brightness(0.8)]";

export function Photo({
  src,
  alt,
  className,
  fade = "bottom",
}: {
  /** Path under `public/`. A missing file paints nothing at all. */
  src: string;
  alt: string;
  className?: string;
  /**
   * Where the photograph should melt into the page. A subject that needs its
   * whole outline feathered carries that as **alpha in the file** instead — a
   * CSS mask cannot tell a ceiling light from a shoulder, and anything it
   * leaves behind reads as a rectangle or, once you overcorrect, an ellipse.
   */
  fade?: "bottom" | "sides" | "none";
}) {
  const mask =
    fade === "bottom"
      ? "[mask-image:linear-gradient(to_top,transparent,black_38%)]"
      : fade === "sides"
        ? "[mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]"
        : "";

  // Two elements, and the split matters: the caller owns the outer box's
  // position, and `relative` in here would win over the `absolute` they passed
  // — which order Tailwind emits decides, not which order they are written. The
  // inner wrapper is what gives the layers something to be absolute against.
  return (
    <div role="img" aria-label={alt} className={cx("overflow-hidden", className)}>
      <div className="relative size-full">
        <div
          aria-hidden="true"
          className={cx("absolute inset-0 bg-cover bg-center bg-no-repeat", TREATMENT, mask)}
          style={{ backgroundImage: `url(${src})` }}
        />
      </div>
    </div>
  );
}
