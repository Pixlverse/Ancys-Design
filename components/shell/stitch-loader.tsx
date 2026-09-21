/**
 * A running stitch, for a tailoring shop.
 *
 * The thread is a dashed path whose offset animates, so the stitches appear to
 * travel; the needle rides along it, dipping into the seam the way a hand would,
 * with its thread trailing behind. Pure SVG and CSS — nothing to download, and
 * it inherits `currentColor` so it sits on any surface.
 */
export function StitchLoader({
  className = "h-9 w-28",
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 140 44"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      role="presentation"
    >
      {/* The cloth: the seam the needle is working along. */}
      <path d="M6 32 H134" strokeWidth="2" className="opacity-20" />

      {/* The thread: dashes travelling, so the seam looks like it is being sewn. */}
      <path d="M6 32 H134" strokeWidth="2.6" className="stitch-thread" />

      {/* The needle, piercing the seam, thread trailing from its eye. */}
      <g className="stitch-needle">
        <path d="M0 0 L16 -19" strokeWidth="1.9" />
        <ellipse
          cx="13.6"
          cy="-16.2"
          rx="1"
          ry="2.7"
          strokeWidth="0.9"
          transform="rotate(40 13.6 -16.2)"
        />
        <path d="M16 -19 q 9 -2 11 4" strokeWidth="1.5" className="opacity-55" />
      </g>
    </svg>
  )
}
