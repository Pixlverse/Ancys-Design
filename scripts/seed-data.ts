/**
 * Starting rate card for a fresh install.
 *
 * These names are *data*, not code. Nothing in the application branches on them,
 * and the owner can add, rename or deactivate any of it from Settings without a
 * deploy (CLAUDE.md section 5).
 */

/** `[key, label, required]` — order in the array is the order on the form. */
type MeasurementSeed = readonly [string, string, boolean]

export interface GarmentTypeSeed {
  name: string
  baseRateRupees: string
  measurements: readonly MeasurementSeed[]
}

export const GARMENT_TYPE_SEED: readonly GarmentTypeSeed[] = [
  {
    name: "Blouse",
    baseRateRupees: "450",
    measurements: [
      ["bust", "Bust", true],
      ["waist", "Waist", true],
      ["shoulder", "Shoulder", true],
      ["blouseLength", "Blouse length", true],
      ["sleeveLength", "Sleeve length", true],
      ["sleeveRound", "Sleeve round", false],
      ["armhole", "Armhole", false],
      ["frontNeckDepth", "Front neck depth", false],
      ["backNeckDepth", "Back neck depth", false],
    ],
  },
  {
    name: "Churidar Set",
    baseRateRupees: "800",
    measurements: [
      ["bust", "Bust", true],
      ["waist", "Waist", true],
      ["hip", "Hip", true],
      ["shoulder", "Shoulder", true],
      ["kurtaLength", "Kurta length", true],
      ["sleeveLength", "Sleeve length", true],
      ["armhole", "Armhole", false],
      ["bottomWaist", "Bottom waist", true],
      ["bottomLength", "Bottom length", true],
      ["calf", "Calf", false],
      ["ankle", "Ankle", false],
    ],
  },
  {
    name: "Pant",
    baseRateRupees: "600",
    measurements: [
      ["waist", "Waist", true],
      ["seat", "Seat", true],
      ["length", "Length", true],
      ["thigh", "Thigh", false],
      ["knee", "Knee", false],
      ["bottom", "Bottom", false],
    ],
  },
  {
    name: "Saree Falls",
    baseRateRupees: "150",
    measurements: [["sareeLength", "Saree length", false]],
  },
]

/**
 * One customer so a fresh install is not a wall of empty states. Created as a
 * lead, like any other new customer, and only on first seed.
 */
export const DEMO_CUSTOMER = {
  name: "Demo Customer",
  phone: "9000000001",
  address: "12 Temple Road, Thrissur",
  notes: "Seeded example. Safe to delete once the shop has real customers.",
} as const
