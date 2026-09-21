/**
 * A coloured initials chip. Gives a list row something to anchor on, and the
 * colour is derived from the name so the same person looks the same everywhere.
 */
const TONES = [
  "bg-sky-100 text-sky-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
  "bg-cyan-100 text-cyan-800",
  "bg-slate-200 text-slate-700",
  "bg-blue-100 text-blue-800",
]

export function Initials({
  name,
  className = "size-10",
}: {
  name: string
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  let hash = 0
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${TONES[hash % TONES.length]} ${className}`}
    >
      {initials || "?"}
    </span>
  )
}
