import type { MeasurementValues } from "@/schemas/measurementSet"

/**
 * Which keys changed between a set and the one taken before it. Used to mark the
 * values worth a second look in the history list — a body that has changed is
 * the reason a new set was taken at all.
 */
export function changedKeys(
  newer: MeasurementValues,
  older: MeasurementValues | undefined
): Set<string> {
  // The first set ever taken has nothing to differ from.
  if (!older) return new Set()

  const changed = new Set<string>()
  for (const [key, value] of Object.entries(newer)) {
    if (older[key] !== value) changed.add(key)
  }
  return changed
}

/** Formats a stored measurement for display: 32.5 stays 32.5, 36 stays 36. */
export function formatMeasurement(value: number, unit: string): string {
  return `${value}${unit === "in" ? '"' : ` ${unit}`}`
}
