import { Schema, model, models, type Model, type Types } from "mongoose"

/**
 * Measurements are referenced, never embedded, and never updated in place:
 * a body changes over time, and an order stitched last year must keep the
 * measurements it was actually cut from (CLAUDE.md section 5).
 */
export interface MeasurementSetDocument {
  customerId: Types.ObjectId
  garmentTypeId: Types.ObjectId
  /** Keyed by the garment type's measurement field keys. Numbers, in the field's unit. */
  values: Record<string, number>
  takenOn: Date
  takenBy: Types.ObjectId
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const measurementSetSchema = new Schema<MeasurementSetDocument>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    garmentTypeId: {
      type: Schema.Types.ObjectId,
      ref: "GarmentType",
      required: true,
    },
    // Typed as Record<string, number> above; the keys are the garment type's,
    // so the shape is data rather than something the schema can enumerate.
    values: { type: Object, required: true },
    takenOn: { type: Date, required: true },
    takenBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
)

// The hot query: this customer's sets for this garment, newest first.
measurementSetSchema.index({ customerId: 1, garmentTypeId: 1, takenOn: -1 })

export const MeasurementSet: Model<MeasurementSetDocument> =
  (models.MeasurementSet as Model<MeasurementSetDocument>) ??
  model<MeasurementSetDocument>("MeasurementSet", measurementSetSchema)
