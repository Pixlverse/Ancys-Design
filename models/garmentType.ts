import { Schema, model, models, type InferSchemaType, type Model } from "mongoose"

import { MEASUREMENT_UNITS } from "@/schemas/garmentType"

/**
 * A garment type is two things at once: a line on the rate card, and the
 * definition of the measurement form for that garment. Both are data the owner
 * edits from Settings — there is no list of garment names anywhere in the code
 * (CLAUDE.md section 5).
 */
const measurementFieldSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    unit: { type: String, enum: MEASUREMENT_UNITS, required: true, default: "in" },
    required: { type: Boolean, required: true, default: false },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const garmentTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Integer paise (rule 1). Snapshotted onto order items at order time. */
    baseRate: { type: Number, required: true, min: 0 },
    measurementFields: { type: [measurementFieldSchema], default: [] },
    isActive: { type: Boolean, required: true, default: true },
    isDeleted: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
)

// Two live garment types must not share a name, but a soft-deleted one should
// not block reusing its name.
garmentTypeSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { isDeleted: false },
  }
)

export type GarmentTypeDocument = InferSchemaType<typeof garmentTypeSchema>

export const GarmentType: Model<GarmentTypeDocument> =
  (models.GarmentType as Model<GarmentTypeDocument>) ??
  model<GarmentTypeDocument>("GarmentType", garmentTypeSchema)
